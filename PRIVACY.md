# Privacy policy — QR Code Creator

Effective date: November 1, 2026. Applies to version 1.1.0.

QR Code Creator processes QR codes on your device. It has no account system, advertising, analytics, tracking pixels or remote processing service. The extension does not collect, transmit, sell or share personal data.

## Data processed locally

- Links, text, Wi-Fi details, contact fields and uploaded logos are used only to generate the QR code you request.
- The current tab's URL can prefill the generator when you invoke the extension.
- When you select an area to scan, Chrome captures the visible tab temporarily in memory. The extension crops that capture to your selection and decodes it locally. The capture is not saved or sent to a server.
- Uploaded QR images are decoded locally. Decoded links open only when you choose Open link.
- Hover previews read the link you hover over, only after you enable the feature on that page.

## Storage and clipboard

Design presets, including their colors, styles and an optional logo, are saved in Chrome's local extension storage. Presets do not save QR content, Wi-Fi passwords, contact fields, decoded results or QR thumbnails. You can delete presets in the extension; uninstalling removes extension storage. Designs are not synced to a server.

Text or links chosen through a context menu are held temporarily in Chrome's session storage until the popup reads them or the browser session ends. No browsing history is stored.

Clipboard content is written only when you click a Copy button. The extension does not read the clipboard.

## Permissions

- `activeTab`: temporary access to the tab on which you invoke the extension, for its URL, requested scan and hover previews.
- `scripting`: inject the page scanner or hover preview after your action.
- `storage`: save local design presets and transfer temporary context-menu input.
- `contextMenus`: add QR actions to the right-click menu.
- `clipboardWrite`: copy a QR image or text when requested.

There are no permanent all-sites permissions, automatic content scripts, notifications, camera access or general browsing-history permission.

## External links

If you choose to open a decoded link or the GitHub project link, your browser visits that destination. Those websites have their own privacy policies. QR Code Creator does not send them your other QR content.

## Contact and changes

Questions and privacy reports can be submitted through [the project's GitHub issues](https://github.com/Chrome-Extensions-labs/QR-Creator/issues). Any data you voluntarily publish in an issue is governed by GitHub's privacy policy. This policy will be updated if the extension's behavior changes.
