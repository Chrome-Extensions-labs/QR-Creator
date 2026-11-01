# Validation — QR Code Creator 1.1.0

Verified on November 1, 2026 with Node.js 24.22.1 and Chrome 156.0.8078.74 on Windows.

**Result: 14 unit checks and 22 browser checks passed.** npm audit reported zero known vulnerabilities in the installed dependency tree.

## Verified behavior

- Correct UTF-8 encoding and decoding for Cyrillic, CJK and emoji, across all six dot styles.
- Wi-Fi delimiter and backslash escaping, preservation of SSID spaces and omission of a password for an open network.
- vCard escaping, CRLF line endings and UTF-8-safe line folding.
- Empty and over-capacity input clears the old QR and disables exports; rapid changes cannot export a stale preview.
- An actual 1024 × 1024 PNG download, actual vector SVG output and successful image-file decoding.
- Actual text and PNG clipboard writes in isolated Chrome.
- Customization, logo upload, automatic H correction and logo removal.
- Preset persistence, application and deletion; local presets exclude content, passwords and thumbnails. A migration removes thumbnail/payload fields from old presets.
- Invalid and blank images produce errors. Inverted QR images decode.
- Non-HTTP(S) payloads have no Open link control.
- Production `activeTab` access is granted through an actual extension action using CDP. Tests never add all-sites host permissions.
- A selected page capture decodes in the real MV3 worker. Full pointer drag, decoded-result display, repeated injection and Escape cleanup work.
- On-demand hover previews appear and are removed on disable.
- Screenshot crops work at device scale factors 1 and 2.
- The collapsed URL popup is approximately 596.5 px tall, within Chrome's 600 px popup limit.
- No uncaught page errors or external HTTP requests were observed in the instrumented browser checks. All runtime libraries are bundled locally.

## Images

Five store screenshots were rendered at 1280 × 800 from the working extension. Promotional tiles are 440 × 280 and 1400 × 560. The GitHub banner is 1280 × 640. Final store screenshots and tiles are RGB PNGs without alpha; the store icon has transparent padding.

The upload archive was checked for ZIP integrity, a root-level manifest, referenced files and exclusion of development dependencies. The extracted release was loaded into isolated Chrome and its real QR preview rendered successfully. The upload ZIP is approximately 104 KiB; exact file sizes and SHA-256 hashes are in `release/checksums.json`.

## Scope and remaining manual verification

These checks exercise the specified behavior in isolated Chrome, using synthetic test data. They do not guarantee recognition of every real-world QR code or cover every website, browser build, clipboard manager, camera and printed surface. Protected Chrome pages cannot be injected into. Before submission, install the release ZIP in your normal Chrome profile, check the context-menu and shortcut flows, and scan an exported sample with a phone. Store approval is a separate review by Google.

Reproduce with `npm ci`, `npm test`, `npm run test:browser`. The detailed browser result is generated at `test-results/browser-report.json` during local testing.
