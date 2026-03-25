const MARKER = "xk7mq2bp9v";
const CALLBACK_PARAMS = ["callback", "jsonp"];
const CONTENT_TYPES = ["application/javascript", "text/javascript", "application/json"];
const PROBE_TIMEOUT = 5000;

const testedUrls = new Set();

// Generate red square icon programmatically
function generateIcon() {
  const size = 16;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e53935";
  ctx.fillRect(0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

// Set extension icon on install/startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setIcon({ imageData: generateIcon() });
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.action.setIcon({ imageData: generateIcon() });
  updateBadge();
});

// Update badge with current endpoint count
async function updateBadge() {
  const { endpoints = [] } = await chrome.storage.local.get("endpoints");
  const count = endpoints.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#e53935" });
}

// Get canonical base URL for dedup — strip all query params (we test them individually)
function getBaseUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    url.search = "";
    return url.toString();
  } catch {
    return urlStr;
  }
}

// Extract existing query param names from a URL
function getExistingParams(urlStr) {
  try {
    const url = new URL(urlStr);
    return [...new Set(url.searchParams.keys())];
  } catch {
    return [];
  }
}

// Check if response content-type is JS or JSON
function hasRelevantContentType(headers) {
  if (!headers) return false;
  for (const h of headers) {
    if (h.name.toLowerCase() === "content-type") {
      const val = h.value.toLowerCase();
      return CONTENT_TYPES.some((ct) => val.includes(ct));
    }
  }
  return false;
}

// Check if a quoted string is just a URL echoing the marker back
function isUrlLike(str) {
  return /(:\/\/|[?&]\w+=)/.test(str);
}

// Extract a short snippet around an index in the text
function extractSnippet(text, idx, maxLen = 80) {
  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(text.length, idx + MARKER.length + half);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

// Validate that the marker is reflected in a meaningful way
// Returns a snippet string on success, false on failure
function validateResponse(text) {
  if (!text.includes(MARKER)) return false;

  // Strip URL-encoded occurrences if encoding actually differs from raw marker
  const encoded = encodeURIComponent(MARKER);
  let cleaned = text;
  if (encoded !== MARKER) {
    cleaned = text.replace(new RegExp(encoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");
    if (!cleaned.includes(MARKER)) return false;
  }

  // Check 1: marker used as a function call — castilho( or castilho  (
  const callRe = new RegExp(MARKER + "\\s*\\(");
  const callMatch = callRe.exec(cleaned);
  if (callMatch) return extractSnippet(cleaned, callMatch.index);

  // Check 2: marker inside quotes, preceded by identifier + ( or [
  // Keep:    window["castilho"]  setTimeout("castilho",0)
  // Discard: "10":"castilho"  plain "castilho"
  const bracketRe = new RegExp('[a-zA-Z][(\\[]["\'][^"\']*?' + MARKER + '[^"\']*?["\']');
  const bracketMatch = bracketRe.exec(cleaned);
  if (bracketMatch) return extractSnippet(cleaned, bracketMatch.index);

  // No valid reflection found
  return false;
}

// Build probe URL: start from the original URL (preserving other params) and set the target param
function buildProbeUrl(originalUrl, param) {
  try {
    const url = new URL(originalUrl);
    url.searchParams.set(param, MARKER);
    return url.toString();
  } catch {
    return null;
  }
}

// Probe a URL with a specific callback param. Returns { probeUrl, snippet } on success, null otherwise.
async function probe(originalUrl, param) {
  const probeUrl = buildProbeUrl(originalUrl, param);
  if (!probeUrl) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    const resp = await fetch(probeUrl, {
      credentials: "omit",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const text = await resp.text();
    const snippet = validateResponse(text);
    if (snippet) {
      return { probeUrl, snippet };
    }
  } catch {
    // Network error or timeout — ignore
  }
  return null;
}

// Store a confirmed endpoint (one per host)
async function storeEndpoint(result) {
  const { endpoints = [] } = await chrome.storage.local.get("endpoints");
  const host = new URL(result.url).hostname;
  const exists = endpoints.some((e) => {
    try { return new URL(e.url).hostname === host; } catch { return false; }
  });
  if (exists) return;
  endpoints.push({
    url: result.url,
    param: result.param,
    probeUrl: result.probeUrl,
    snippet: result.snippet || "",
    timestamp: new Date().toISOString(),
  });
  await chrome.storage.local.set({ endpoints });
  updateBadge();
}

// Main handler for completed requests
async function handleRequest(details) {
  const { url, responseHeaders } = details;

  if (url.startsWith("chrome-extension://")) return;
  if (!hasRelevantContentType(responseHeaders)) return;

  const baseUrl = getBaseUrl(url);
  if (testedUrls.has(baseUrl)) return;
  testedUrls.add(baseUrl);

  // Skip if we already have a finding for this host
  const host = new URL(url).hostname;
  const { endpoints = [] } = await chrome.storage.local.get("endpoints");
  if (endpoints.some((e) => { try { return new URL(e.url).hostname === host; } catch { return false; } })) return;

  const tested = new Set();

  // 1. Test existing query params first — strongest signal
  for (const param of getExistingParams(url)) {
    tested.add(param);
    const result = await probe(url, param);
    if (result) {
      await storeEndpoint({ url: baseUrl, param, ...result });
    }
  }

  // 2. Fall back to default callback/jsonp params (skip already-tested)
  for (const param of CALLBACK_PARAMS) {
    if (tested.has(param)) continue;
    const result = await probe(url, param);
    if (result) {
      await storeEndpoint({ url: baseUrl, param, ...result });
    }
  }
}

// Register listener synchronously at top level (MV3 requirement)
chrome.webRequest.onCompleted.addListener(
  (details) => handleRequest(details),
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Message handler for popup communication
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "getEndpoints") {
    chrome.storage.local.get("endpoints").then(({ endpoints = [] }) => {
      sendResponse(endpoints);
    });
    return true; // async response
  }
  if (msg.action === "clearEndpoints") {
    testedUrls.clear();
    chrome.storage.local.set({ endpoints: [] }).then(() => {
      updateBadge();
      sendResponse(true);
    });
    return true;
  }
});
