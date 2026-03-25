# CallMe

Chrome extension that passively discovers JSONP callback endpoints as you browse.

## What it does

CallMe monitors web requests in the background, tests endpoints for JSONP callback reflection, and catalogs confirmed findings for review.

## Features

- **Parameter testing** — checks existing query params first, then common names (`callback`, `jsonp`)
- **Response validation** — confirms reflection in function calls, avoids false positives
- **Searchable popup UI** — filter, copy, and export discovered endpoints
- **Per-host dedup** — one finding per hostname, no redundant probes
- **Export** — copy as JSON or download `callme-endpoints.json`

## CSPBypass Contribution

CallMe integrates with [cspbypass.com](https://cspbypass.com). The **cspbypass.com** button in the popup formats your discoveries into the right format for direct contribution to the project. It automatically filters findings against domains commonly found in real-world CSP headers and removes duplicates already present in the CSPBypass dataset.

> **Warning:** Always test your endpoints and verify they actually trigger an alert before submitting. Do not contribute untested or broken gadgets.

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
