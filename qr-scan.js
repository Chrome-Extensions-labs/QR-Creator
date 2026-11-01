/* Shared decoder for popup image files and background page captures. */
(function (root) {
  'use strict';
  async function decode(blob, rect, viewport) {
    if (blob.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
    const bitmap = await createImageBitmap(blob).catch(() => { throw new Error('Cannot read this image. Try PNG, JPEG or WebP.'); });
    try {
      if (bitmap.width * bitmap.height > 32e6) throw new Error('Image is too large. Crop it first.');
      const crop = rect ? QRCore.cropRect(rect, viewport, bitmap.width, bitmap.height) : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
      for (const limit of [1600, 2600, 800]) {
        const scale = Math.min(1, limit / Math.max(crop.width, crop.height));
        const width = Math.max(1, Math.round(crop.width * scale)), height = Math.max(1, Math.round(crop.height * scale));
        const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height), result = root.jsQR(pixels.data, width, height, { inversionAttempts: 'attemptBoth' });
        if (result && result.data) return result.data;
      }
      throw new Error('No QR code found. Select one complete code, including its border.');
    } finally { bitmap.close(); }
  }
  root.QRScan = { decode };
})(globalThis);
