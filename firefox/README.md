# CallMe — Firefox build

Firefox (Gecko) port of the CallMe JSONP discovery extension. Same behaviour as the
Chrome version in the repo root; the differences are only what the platform requires.

## What changed vs. the Chrome version

| | Chrome (repo root) | Firefox (this dir) |
|---|---|---|
| Manifest | v3 | v2 |
| Background | `service_worker` | persistent `background.scripts` |
| Toolbar API | `action` | `browser_action` |
| Permissions | `permissions` + `host_permissions` | merged into `permissions`, plus `webRequestBlocking` |
| Extension ID | — | `browser_specific_settings.gecko.id` (required for signing) |
| API namespace | `chrome.*` | `browser.*` (falls back to `chrome.*`) via an alias in `background.js` |

`popup.js`, `popup.html` and `logo.png` are unchanged — they already work on both engines.

## Load it temporarily (no signing)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `firefox/manifest.json`

The add-on stays until you restart Firefox.

## Package / install permanently

```bash
cd firefox
zip -r -FS ../CallMe.xpi *
```

A `CallMe.xpi` is also committed in this directory. Permanent (drag-to-install)
installs require the `.xpi` to be signed through
[addons.mozilla.org](https://addons.mozilla.org) (or use Firefox Developer/Nightly
with `xpinstall.signatures.required` set to `false`).

## Lint (optional)

```bash
npx web-ext lint -s firefox
```
