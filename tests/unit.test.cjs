const { test } = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../qr-core.js');
test('Wi-Fi escapes separators, backslashes and quotes without trimming the SSID', () => {
  const data = Q.wifi({ ssid: 'Cafe;net', password: 'a\\b:c,"d', hidden: true });
  assert.equal(data, 'WIFI:T:WPA;S:Cafe\\;net;P:a\\\\b\\:c\\,\\"d;H:true;;');
  assert.ok(Q.wifi({ ssid: ' space ' }).includes('S: space ;'));
});
test('open Wi-Fi omits a previous password', () => assert.equal(Q.wifi({ ssid: 'Guest', encryption: 'nopass', password: 'secret' }), 'WIFI:T:nopass;S:Guest;H:false;;'));
test('empty inputs produce no placeholder QR', () => { assert.equal(Q.wifi({ ssid: '' }), ''); assert.equal(Q.vcard({ first: '' }), ''); assert.throws(() => Q.config('', {})); });
test('vCard escapes injected lines and delimiters and uses CRLF', () => {
  const result = Q.vcard({ first: 'Ada', last: 'Lovelace', org: 'A;B,C\nEND:VCARD' });
  assert.ok(result.includes('N:Lovelace;Ada;;;\r\nFN:Ada Lovelace'));
  assert.ok(result.includes('ORG:A\\;B\\,C\\nEND:VCARD'));
  assert.equal(result.split('\r\n').filter(x => x === 'END:VCARD').length, 1);
});
test('vCard folding respects UTF-8 characters and 75-byte lines', () => {
  const data = Q.vcard({ first: 'Ж'.repeat(100) });
  assert.ok(data.split('\r\n').every(line => Q.bytes(line) <= 75));
  assert.ok(!data.includes('\uFFFD'));
});
test('only HTTP and HTTPS links may be opened', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/test', 'chrome://settings', 'not a link']) assert.equal(Q.safeUrl(url), null);
  assert.equal(Q.safeUrl('https://example.com/a'), 'https://example.com/a');
});
test('capacity is based on UTF-8 bytes, including emoji', () => { assert.equal(Q.bytes('😀'), 4); assert.throws(() => Q.config('😀'.repeat(301), {}), /1200/); assert.doesNotThrow(() => Q.config('a'.repeat(1200), {})); });
test('QR library receives the actual UTF-8 bytes in Byte mode', () => {
  const cfg = Q.config('Олена 😀', {}); assert.equal(cfg.qrOptions.mode, 'Byte');
  assert.deepEqual([...cfg.data].map(char => char.charCodeAt(0)), [...new TextEncoder().encode('Олена 😀')]);
});
test('presets cannot introduce arbitrary style, external images or invalid colors', () => {
  const d = Q.normalizeDesign({ ecl: 'invalid', dotColor: 'url(https://evil)', dotStyle: 'evil', logoDataUrl: 'https://example.com/logo.png' });
  assert.deepEqual(d, Q.defaults);
});
test('legacy presets keep their design but discard QR thumbnails and payload fields', () => {
  const result = Q.normalizePresets([{ id: 123, name: 'Forest', dotColor: '#14543a', thumb: 'data:image/png;private', data: 'password', password: 'secret' }]);
  assert.equal(result[0].id, 123); assert.equal(result[0].dotColor, '#14543a');
  assert.ok(!JSON.stringify(result).includes('private') && !JSON.stringify(result).includes('secret') && !JSON.stringify(result).includes('password'));
  assert.deepEqual(Q.normalizePresets({}), []);
});
test('logo forces high error correction, and removing it removes image config', () => {
  const cfg = Q.config('test', { logoDataUrl: 'data:image/png;base64,eA==', ecl: 'L' });
  assert.equal(cfg.qrOptions.errorCorrectionLevel, 'H'); assert.ok(cfg.image);
  assert.ok(!('image' in Q.config('test', {})));
});
test('contrast and inversion warnings identify unreadable designs', () => {
  assert.equal(Q.warning(Q.defaults), ''); assert.match(Q.warning({ dotColor: '#ffffff', bgColor: '#ffffff' }), /contrast/); assert.match(Q.warning({ invert: true }), /Inverted/);
});
test('crop handles high DPI independently on both axes', () => assert.deepEqual(Q.cropRect({ x: 10, y: 20, width: 100, height: 80 }, { width: 800, height: 600 }, 1600, 1200), { x: 20, y: 40, width: 200, height: 160 }));
test('crop rejects invalid, negative, tiny and out-of-bounds selections', () => {
  for (const rect of [null, { x: NaN, y: 0, width: 100, height: 100 }, { x: -1, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 5, height: 100 }, { x: 750, y: 0, width: 100, height: 100 }]) assert.throws(() => Q.cropRect(rect, { width: 800, height: 600 }, 1600, 1200));
});
