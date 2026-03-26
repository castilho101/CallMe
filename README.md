<div align="center">
  <img src="./logo.png" alt="CallMe logo" width="220" />
<br>
<b>Passive JSONP callback endpoint discovery from real browser sessions</b>

A Chrome extension that silently monitors your browsing, discovers JSONP callback endpoints, and catalogs confirmed findings.

<p>
  <a href="https://cspbypass.com">CSPBypass.com</a> •
  <a href="https://developer.chrome.com/docs/extensions/mv3/">Manifest V3</a>
</p>
</div>

<hr>

## Overview

JSONP endpoints that reflect arbitrary callback names remain a reliable vector for **CSP bypasses** and **cross-site data leaks**.

Finding them manually is tedious. CallMe automates the discovery:

1. intercept HTTP responses during normal browsing
2. probe candidate endpoints with a unique marker
3. validate that the marker is reflected in a valid JavaScript execution context
4. store and deduplicate confirmed findings per hostname
5. export or contribute validated discoveries

No active scanning. CallMe only tests endpoints your browser already contacts.

<hr>

## How It Works

```text
Browser Request
  -> webRequest Listener
  -> Content-Type Filter (JS/JSON only)
  -> Probe URL with Marker (xk7mq2bp9v)
  -> Validate Reflection (function call context)
  -> Store & Deduplicate (one finding per host)
  -> Popup UI / Export / CSPBypass Contribution
```

**Probing strategy:**

- tests existing query parameters on the URL first (strongest signal)
- falls back to common callback names: `callback`, `jsonp`
- validates reflection appears in executable context — not just echoed in a string

**Validation covers:**

- direct function calls: `marker(...)` or `marker (...)`
- bracket notation: `window["marker"]` or `setTimeout("marker", 0)`
- rejects URL echoes, plain string reflection, and other false positives

<hr>

## Features

- **Passive Discovery** — monitors all web requests via the `webRequest` API, zero manual input required
- **Smart Validation** — confirms marker reflection in function calls, rejects false positives
- **Per-Host Dedup** — stores one finding per hostname, skips already-tested URLs
- **Searchable UI** — filter discovered endpoints by URL, parameter name, or code snippet
- **One-Click Copy** — copy any probe URL to clipboard instantly
- **Export** — copy all findings as JSON or download as `callme-endpoints.json`
- **CSPBypass Integration** — format and contribute findings directly to [cspbypass.com](https://cspbypass.com)

<hr>

## CSPBypass.com Integration

The **cspbypass.com** button in the popup automatically:

- filters discoveries against domains commonly found in real-world CSP headers
- removes duplicates already present in the CSPBypass dataset
- formats output as TSV ready for direct contribution
- only includes domains with significant CSP presence (>10 occurrences)

> **Warning:** Always test your endpoints and verify they trigger an actual alert before submitting. Do not contribute untested or broken gadgets.

<hr>

## Installation

```bash
git clone https://github.com/castilho101/CallMe.git
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the cloned folder
4. CallMe will appear in your extensions bar — pin it for quick access

<hr>

## Usage

1. **Browse normally** — CallMe works passively in the background
2. **Click the extension icon** to view discovered JSONP endpoints
3. **Search / filter** findings by URL, parameter, or snippet
4. **Copy** individual probe URLs or **export** all findings
5. **Contribute** validated findings to [cspbypass.com](https://cspbypass.com)

<hr>

<hr>

<div align="center">

Built for the web security community. Hope you enjoy!
</div>
