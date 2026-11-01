/* Reproduce locally bundled, pinned dependencies. Run npm ci first. */
const fs = require('node:fs');
for (const [from, to] of [
  ['node_modules/qr-code-styling/lib/qr-code-styling.js', 'libs/qr-code-styling.min.js'],
  ['node_modules/qr-code-styling/LICENSE', 'libs/qr-code-styling.LICENSE'],
  ['node_modules/jsqr/dist/jsQR.js', 'libs/jsqr.js'],
  ['node_modules/jsqr/LICENSE', 'libs/jsqr.LICENSE']
]) fs.copyFileSync(from, to);
console.log('Vendored QR Code Styling 1.9.2 and jsQR 1.4.0.');
