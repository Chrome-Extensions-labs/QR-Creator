# QR Code Creator

![QR Code Creator](store-assets/github-banner-1280x640.png)

An independent, open-source Chrome extension for creating and reading QR codes. It runs locally, without an account or a remote QR service.

## Features

- Create QR codes from the current tab, any link or text, Wi-Fi credentials and vCard 3.0 contacts.
- Select an area on a page to read a QR code, including codes rendered in canvas or cross-origin images. Review the result, copy it or open an HTTP(S) link yourself.
- Read PNG, JPEG, WebP and BMP images; both normal and inverted QR codes are supported.
- Customize dots, corners, colors and a center logo. Logos use high error correction automatically.
- Export PNG at 512, 1024 or 2048 pixels, export SVG, or copy an image or text.
- Save up to 20 design presets. QR content and Wi-Fi passwords are not saved in presets.
- Enable link hover previews for the current page until it reloads.
- Right-click selected text, a link, an image or a page for QR actions. `Alt+Shift+S` opens area selection; shortcuts can be changed in `chrome://extensions/shortcuts`.

## Install locally

1. Download or clone this repository, or extract `QR-Code-Creator-1.1.0.zip` into a folder.
2. Open `chrome://extensions` in Chrome 127 or later.
3. Enable **Developer mode**, click **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Pin the extension and open a regular website to try the page scanner.

Chrome prevents injection into internal pages, the Chrome Web Store and some protected viewers. On those pages, save the QR as an image and use **From image**. Area selection works on the visible viewport. Very small, damaged, blurred or low-contrast codes may not decode. Custom colors, logos and inverted designs should be checked with a phone before printing. QR payloads are limited to 1200 UTF-8 bytes for predictable capacity at every correction level.

## Privacy

No analytics, external fonts, network requests or persistent access to all websites. Page tools are injected on request. See [PRIVACY.md](PRIVACY.md) for permission and storage details. Selecting an area temporarily captures the whole visible tab in memory before cropping it locally.

## Development

Requires Node.js 22 or later, npm, Python 3 for packaging, and Chrome for browser checks and store screenshots.

The extension itself does not need `node_modules` or `npm install`: its runtime libraries are bundled in `libs/`. Keep `package.json` and `package-lock.json` in Git; restore development dependencies with `npm ci`. Generated dependencies, temporary tools, test results and release archives are excluded by `.gitignore`.

```sh
npm ci
npm test
npm run test:browser
npm run assets
npm run package
```

Browser tests load the production manifest into an isolated, temporary Chrome profile using CDP. They grant `activeTab` by invoking the extension action. They do not add host permissions to the manifest or change your normal browser profile. `QR_TEST_BROWSER` can point to a compatible Chromium executable instead of installed Chrome.

Runtime libraries are vendored in `libs/`. Development dependencies are omitted from the upload archive. `scripts/vendor.cjs` can reproduce the vendored JavaScript and license files from the pinned npm packages. `scripts/assets.cjs` reproduces all five screenshots from the running extension. AI-generated promotional banners and their prompts are in `store-assets/`.

## Release material

Images are indexed in [store-assets/README.md](store-assets/README.md). Build the extension ZIP and source archive with `npm run package`; the upload archive contains only the extension files and required notices.

Possible future improvements: batch scanning with multiple results, a separate camera-scanning flow with optional permission, structured Wi-Fi/contact result cards and interface translations. They are not advertised as current features.

## License

Apache-2.0, matching the [project repository](https://github.com/Chrome-Extensions-labs/QR-Creator). Third-party licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
