/* Shared, DOM-free validation and QR payload builders. */
(function (root) {
  'use strict';
  const MAX_BYTES = 1200;
  const defaults = Object.freeze({ ecl: 'M', dotStyle: 'square', cornerSqStyle: 'square', cornerDotStyle: 'square', dotColor: '#14213d', bgColor: '#ffffff', cornerColor: '#14213d', invert: false, logoDataUrl: null });
  const bytes = text => new TextEncoder().encode(text).length;
  const wifiEscape = value => String(value).replace(/([\\;,:"])/g, '\\$1');
  const vEscape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  function wifi({ ssid, password = '', encryption = 'WPA', hidden = false }) {
    if (!ssid) return '';
    const enc = ['WPA', 'WEP', 'nopass'].includes(encryption) ? encryption : 'WPA';
    return `WIFI:T:${enc};S:${wifiEscape(ssid)};${enc === 'nopass' ? '' : `P:${wifiEscape(password)};`}H:${Boolean(hidden)};;`;
  }
  function fold(line) {
    let result = '', count = 0;
    for (const char of line) {
      const length = bytes(char);
      if (count + length > 75) { result += '\r\n '; count = 1; }
      result += char; count += length;
    }
    return result;
  }
  function vcard({ first = '', last = '', phone = '', email = '', org = '', url = '' }) {
    if (!first.trim() && !last.trim()) return '';
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEscape(last)};${vEscape(first)};;;`, `FN:${vEscape(`${first} ${last}`.trim())}`];
    for (const [key, value] of [['ORG', org], ['TEL;TYPE=CELL', phone], ['EMAIL', email], ['URL', url]]) if (value) lines.push(`${key}:${vEscape(value)}`);
    return [...lines, 'END:VCARD'].map(fold).join('\r\n');
  }
  function safeUrl(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  function normalizeDesign(raw = {}) {
    const design = { ...defaults };
    const allowed = { ecl: ['L', 'M', 'Q', 'H'], dotStyle: ['square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded'], cornerSqStyle: ['square', 'dot', 'extra-rounded'], cornerDotStyle: ['square', 'dot'] };
    for (const key of Object.keys(allowed)) if (allowed[key].includes(raw[key])) design[key] = raw[key];
    for (const key of ['dotColor', 'bgColor', 'cornerColor']) if (/^#[\da-f]{6}$/i.test(raw[key])) design[key] = raw[key];
    design.invert = raw.invert === true;
    if (typeof raw.logoDataUrl === 'string' && raw.logoDataUrl.length < 400000 && /^data:image\/(png|jpeg|webp);base64,/.test(raw.logoDataUrl)) design.logoDataUrl = raw.logoDataUrl;
    if (design.logoDataUrl) design.ecl = 'H';
    return design;
  }
  function config(data, raw, size = 1024, type = 'canvas') {
    if (!data) throw new Error('Enter data to create a QR code.');
    if (bytes(data) > MAX_BYTES) throw new Error(`Too much data. Use up to ${MAX_BYTES} UTF-8 bytes.`);
    const d = normalizeDesign(raw), dot = d.invert ? d.bgColor : d.dotColor, bg = d.invert ? d.dotColor : d.bgColor;
    return {
      // qrcode-generator's Byte encoder truncates JS characters to 8 bits.
      // Feed UTF-8 bytes explicitly so Cyrillic, CJK and emoji survive decoding.
      width: size, height: size, type, data: String.fromCharCode(...new TextEncoder().encode(data)),
      margin: Math.ceil(size / 10), qrOptions: { mode: 'Byte', errorCorrectionLevel: d.ecl },
      dotsOptions: { type: d.dotStyle, color: dot },
      cornersSquareOptions: { type: d.cornerSqStyle, color: d.invert ? d.bgColor : d.cornerColor },
      cornersDotOptions: { type: d.cornerDotStyle, color: d.invert ? d.bgColor : d.cornerColor }, backgroundOptions: { color: bg },
      ...(d.logoDataUrl ? { image: d.logoDataUrl, imageOptions: { saveAsBlob: false, imageSize: 0.25, margin: Math.ceil(size / 100), hideBackgroundDots: true } } : {})
    };
  }
  function luminance(hex) {
    const c = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  }
  function warning(raw) {
    const cfg = config('test', raw), bg = luminance(cfg.backgroundOptions.color), inks = [cfg.dotsOptions.color, cfg.cornersSquareOptions.color].map(luminance);
    if (inks.some(x => (Math.max(x, bg) + 0.05) / (Math.min(x, bg) + 0.05) < 4.5)) return 'Low contrast: use darker dots and a lighter background.';
    if (inks.some(x => x > bg)) return 'Inverted colors may be harder for some cameras to scan.';
    return '';
  }
  function cropRect(rect, viewport, width, height) {
    if (!rect || !viewport || ![rect.x, rect.y, rect.width, rect.height, viewport.width, viewport.height].every(Number.isFinite)) throw new Error('Invalid selection.');
    if (viewport.width <= 0 || viewport.height <= 0 || rect.width < 16 || rect.height < 16 || rect.x < 0 || rect.y < 0 || rect.x + rect.width > viewport.width + 1 || rect.y + rect.height > viewport.height + 1) throw new Error('Select a larger area inside the page.');
    const x = Math.floor(rect.x * width / viewport.width), y = Math.floor(rect.y * height / viewport.height);
    return { x, y, width: Math.min(width - x, Math.ceil(rect.width * width / viewport.width)), height: Math.min(height - y, Math.ceil(rect.height * height / viewport.height)) };
  }
  function normalizePresets(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(p => p && typeof p === 'object' && typeof p.name === 'string').slice(0, 20).map(p => ({
      ...normalizeDesign(p), name: p.name.trim().slice(0, 24) || 'Preset',
      id: typeof p.id === 'string' && p.id.length <= 80 || typeof p.id === 'number' && Number.isFinite(p.id) ? p.id : crypto.randomUUID()
    }));
  }
  root.QRCore = { MAX_BYTES, defaults, bytes, wifi, vcard, safeUrl, normalizeDesign, normalizePresets, config, warning, cropRect };
  if (typeof module !== 'undefined') module.exports = root.QRCore;
})(globalThis);
