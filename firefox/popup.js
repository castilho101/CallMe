const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");
const exportBtn = document.getElementById("export");
const clearBtn = document.getElementById("clear");
const searchEl = document.getElementById("search");
const contributeBtn = document.getElementById("contribute");

let allEndpoints = [];
let cspCache = null;

function showStatus(text, duration = 2000) {
  statusEl.textContent = text;
  statusEl.style.display = "block";
  setTimeout(() => { statusEl.style.display = "none"; }, duration);
}

function renderEndpoints(endpoints) {
  if (!endpoints.length) {
    listEl.innerHTML = '<div class="empty">No JSONP endpoints discovered yet.<br>Browse around to find some.</div>';
    return;
  }
  listEl.innerHTML = endpoints
    .slice()
    .reverse()
    .map((e, i) => {
      const time = new Date(e.timestamp).toLocaleString();
      const snippetHtml = e.snippet
        ? `<div class="snippet"><code>${escapeHtml(e.snippet)}</code></div>`
        : "";
      return `<div class="endpoint">
        <div class="url">${escapeHtml(e.url)}</div>
        ${snippetHtml}
        <div class="meta">
          <span>param: <b>${escapeHtml(e.param)}</b></span>
          <span>${time}</span>
          <button class="copy-btn" data-idx="${i}">Copy URL</button>
        </div>
      </div>`;
    })
    .join("");

  // Wire up copy buttons
  const reversed = endpoints.slice().reverse();
  listEl.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const ep = reversed[btn.dataset.idx];
      try {
        await navigator.clipboard.writeText(ep.probeUrl);
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy URL"; }, 1500);
      } catch {
        showStatus("Copy failed.");
      }
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function filterEndpoints() {
  const q = searchEl.value.toLowerCase();
  if (!q) return renderEndpoints(allEndpoints);
  renderEndpoints(allEndpoints.filter((e) =>
    e.url.toLowerCase().includes(q) ||
    e.param.toLowerCase().includes(q) ||
    (e.snippet && e.snippet.toLowerCase().includes(q))
  ));
}

function loadEndpoints() {
  chrome.runtime.sendMessage({ action: "getEndpoints" }, (endpoints) => {
    allEndpoints = endpoints || [];
    filterEndpoints();
  });
}

searchEl.addEventListener("input", filterEndpoints);

exportBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "getEndpoints" }, async (endpoints) => {
    if (!endpoints || !endpoints.length) {
      showStatus("Nothing to export.");
      return;
    }
    const json = JSON.stringify(endpoints, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      showStatus("Copied to clipboard!");
    } catch {
      // Fallback: download as file
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "callme-endpoints.json";
      a.click();
      URL.revokeObjectURL(url);
      showStatus("Downloaded as file.");
    }
  });
});

function getHostPath(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname + u.pathname.replace(/\/+$/, "");
  } catch { return null; }
}

contributeBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "getEndpoints" }, async (endpoints) => {
    if (!endpoints || !endpoints.length) {
      showStatus("No endpoints to contribute.");
      return;
    }

    try {
      if (!cspCache) {
        showStatus("Fetching CSPBypass data...", 10000);

        const [domainsResp, tsvResp] = await Promise.all([
          fetch("https://raw.githubusercontent.com/renniepak/CSPBypass/refs/heads/main/csp_domains.json"),
          fetch("https://raw.githubusercontent.com/renniepak/CSPBypass/refs/heads/main/data.tsv"),
        ]);

        if (!domainsResp.ok || !tsvResp.ok) {
          showStatus("Failed to fetch CSPBypass data.");
          return;
        }

        const cspDomains = await domainsResp.json();
        const tsvText = await tsvResp.text();

        const validDomains = new Set(
          cspDomains.filter((d) => d.count > 10).map((d) => d.domain)
        );

        const existingPaths = new Set();
        for (const line of tsvText.split("\n")) {
          const match = line.match(/src=["']?([^"'\s>]+)/);
          if (match) {
            const hp = getHostPath(match[1]);
            if (hp) existingPaths.add(hp);
          }
        }

        cspCache = { validDomains, existingPaths };
      }

      const { validDomains, existingPaths } = cspCache;

      const lines = endpoints
        .filter((e) => {
          try {
            const host = new URL(e.url).hostname;
            if (!validDomains.has(host)) return false;
            const hp = getHostPath(e.url);
            if (hp && existingPaths.has(hp)) return false;
            return true;
          } catch { return false; }
        })
        .map((e) => {
          const host = new URL(e.url).hostname;
          const pocUrl = e.probeUrl.replaceAll("xk7mq2bp9v", "alert");
          return `${host}\t<script src=${pocUrl}></script>`;
        })
        .sort();

      if (!lines.length) {
        showStatus("No new endpoints to contribute (filtered or already in CSPBypass).");
        return;
      }

      const tsv = lines.join("\n") + "\n";
      try {
        await navigator.clipboard.writeText(tsv);
        showStatus(`Copied ${lines.length} new bypass(es) to clipboard!`);
      } catch {
        const blob = new Blob([tsv], { type: "text/tab-separated-values" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cspbypass-contribution.tsv";
        a.click();
        URL.revokeObjectURL(url);
        showStatus(`Downloaded ${lines.length} new bypass(es) as file.`);
      }
    } catch {
      showStatus("Failed to fetch CSPBypass data.");
    }
  });
});

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear all discovered endpoints?")) return;
  chrome.runtime.sendMessage({ action: "clearEndpoints" }, () => {
    allEndpoints = [];
    searchEl.value = "";
    renderEndpoints([]);
    showStatus("Cleared.");
  });
});

loadEndpoints();
