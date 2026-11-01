const fs = require('node:fs');
const sharp = require('sharp');
(async () => {
  const source = fs.readFileSync('assets/icon-master.png');
  for (const size of [16, 32, 48]) await sharp(source).resize(size, size, { kernel: 'nearest' }).png().toFile(`icons/icon${size}.png`);
  // Store icon: the same original mark, with transparent padding recommended by Chrome.
  await sharp(source).resize(96, 96, { kernel: 'nearest' }).extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' }).png().toFile('store-assets/store-icon-128.png');
  fs.copyFileSync('store-assets/store-icon-128.png', 'icons/icon128.png');
})();
