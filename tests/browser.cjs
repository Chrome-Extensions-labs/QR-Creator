const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const sharp = require('sharp');
const { launch } = require('../scripts/browser-harness.cjs');
const QR = require('../qr-core.js');
const results = [];
async function check(name, action) { await action(); results.push(name); console.log('PASS', name); }
const ready = page => page.waitForFunction(() => document.querySelector('#statusMsg').textContent === 'READY TO SHARE');
async function decodePreview(page) {
  return page.evaluate(async () => {
    if (!globalThis.jsQR) { await new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'libs/jsqr.js'; s.onload = resolve; s.onerror = reject; document.head.append(s); }); }
    const canvas = document.querySelector('#qrCanvas canvas'), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })?.data;
  });
}
(async () => {
  await fs.mkdir('test-results', { recursive: true });
  const fixture = '<!doctype html><html><head><style>body{margin:0;background:#f6f4ed;font:18px system-ui;padding:80px}img{width:280px;height:280px}a{display:block;margin:20px 0}button{padding:20px}</style></head><body><h1>QR scanner test page</h1><p>Only test content is used in this browser.</p><img id="code" src="/qr.png"><a href="https://example.com/workshop">Workshop details</a><button id="hostButton">Host page button</button></body></html>';
  let qrBuffer;
  const server = http.createServer((req, res) => {
    if (req.url === '/qr.png' && qrBuffer) { res.setHeader('Content-Type', 'image/png'); res.end(qrBuffer); }
    else if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { context, worker, id, invoke } = await launch();
  const errors = [], requests = [];
  context.on('page', page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE', msg.text()); }); page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(origin)) requests.push(req.url()); }); });
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${id}/popup.html`);
    await check('empty input disables export and has no example placeholder', async () => {
      await page.waitForFunction(() => document.querySelector('#statusMsg').textContent === 'ENTER DATA TO START');
      assert.equal(await page.locator('#btnDownloadPng').isDisabled(), true);
    });
    const url = 'https://example.com/workshop?source=qr';
    await check('URL QR can be decoded from actual rendered pixels', async () => { await page.locator('#inputUrl').fill(url); await ready(page); assert.equal(await decodePreview(page), url); });
    await check('default popup fits the Chrome 600px limit', async () => { assert.ok((await page.locator('.app').boundingBox()).height <= 600); });
    await check('PNG download is 1024px and contains the current payload', async () => {
      const download = page.waitForEvent('download'); await page.locator('#btnDownloadPng').click(); const file = await download; await file.saveAs('test-results/qr-export.png');
      qrBuffer = await fs.readFile('test-results/qr-export.png'); const meta = await sharp(qrBuffer).metadata(); assert.equal(meta.width, 1024); assert.equal(meta.height, 1024);
      await page.locator('#scanFile').setInputFiles({ name: 'code.png', mimeType: 'image/png', buffer: qrBuffer });
      await page.locator('#scanResult').waitFor({ state: 'visible' }); assert.equal(await page.locator('#scanText').inputValue(), url);
    });
    await check('SVG export is an actual vector document', async () => {
      const download = page.waitForEvent('download'); await page.locator('#btnDownloadSvg').click(); await (await download).saveAs('test-results/qr-export.svg');
      const svg = await fs.readFile('test-results/qr-export.svg', 'utf8'); assert.match(svg, /<svg/); assert.match(svg, /<path|<rect/);
    });
    await check('rapid edits invalidate the previous QR immediately', async () => {
      await page.locator('#inputUrl').fill('https://example.com/first'); assert.equal(await page.locator('#btnDownloadPng').isDisabled(), true);
      await page.locator('#inputUrl').fill('https://example.com/latest'); await ready(page); assert.equal(await decodePreview(page), 'https://example.com/latest');
    });
    await check('over-capacity input clears the QR and disables export', async () => {
      await page.locator('#inputUrl').fill('😀'.repeat(301)); await page.waitForFunction(() => document.querySelector('#statusMsg').textContent === 'CHECK YOUR DATA');
      assert.equal(await page.locator('#qrCanvas canvas').count(), 0); assert.equal(await page.locator('#btnCopyImg').isDisabled(), true);
    });
    await check('Wi-Fi special characters and open network generate decodable payloads', async () => {
      await page.locator('#tab-wifi').click(); await page.locator('#wifiSsid').fill('Cafe;net'); await page.locator('#wifiPass').fill('a:b;c\\d'); await ready(page);
      assert.equal(await decodePreview(page), QR.wifi({ ssid: 'Cafe;net', password: 'a:b;c\\d' }));
      await page.locator('#wifiEnc').selectOption('nopass'); await ready(page); assert.equal(await page.locator('#wifiPass').isDisabled(), true); assert.ok(!(await decodePreview(page)).includes('P:'));
    });
    await check('Unicode contact with delimiters round-trips through QR pixels', async () => {
      await page.locator('#tab-vcard').click(); await page.locator('#vcardFirst').fill('Олена'); await page.locator('#vcardLast').fill('Коваль'); await page.locator('#vcardOrg').fill('A;B,C'); await ready(page);
      assert.equal(await decodePreview(page), QR.vcard({ first: 'Олена', last: 'Коваль', org: 'A;B,C' }));
    });
    await check('all six dot styles preserve emoji and international text', async () => {
      await page.locator('#tab-url').click(); await page.locator('#inputUrl').fill('Привіт · こんにちは · Hello 😀');
      await page.locator('#designDetails summary').click();
      for (const style of ['square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded']) {
        await page.locator('#dotStyle').selectOption(style); await ready(page); assert.equal(await decodePreview(page), 'Привіт · こんにちは · Hello 😀');
      }
      await page.locator('#designDetails summary').click();
    });
    await check('design presets persist only style, without QR text or Wi-Fi password', async () => {
      await page.locator('#designDetails summary').click(); await page.locator('[data-palette].forest').click(); await page.locator('#dotStyle').selectOption('rounded'); await ready(page);
      await page.locator('#presetName').fill('Forest'); await page.locator('#btnSavePreset').click(); await page.getByTitle('Apply Forest').waitFor();
      const data = await worker.evaluate(() => chrome.storage.local.get(null)); const serialized = JSON.stringify(data);
      assert.ok(!serialized.includes('Олена') && !serialized.includes('a:b;c') && !serialized.includes('thumb') && !serialized.includes('data:image'));
      await page.locator('#btnReset').click(); await page.getByTitle('Apply Forest').click(); assert.equal(await page.locator('#dotStyle').inputValue(), 'rounded');
    });
    await check('logo upload forces H, removal clears it and presets can be deleted', async () => {
      const logo = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#f2c332' } }).png().toBuffer();
      await page.locator('#logoFile').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo }); await ready(page);
      assert.equal(await page.locator('#ecl').inputValue(), 'H'); assert.equal(await page.locator('#ecl').isDisabled(), true); assert.ok(await decodePreview(page));
      await page.locator('#btnRemoveLogo').click(); await ready(page); assert.equal(await page.locator('#logoThumb').isHidden(), true);
      await page.getByRole('button', { name: 'Delete Forest', exact: true }).click(); await page.getByTitle('Apply Forest').waitFor({ state: 'detached' });
    });
    await check('invalid and blank images report failure', async () => {
      await page.locator('#scanFile').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') });
      await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Cannot read'));
      const blank = await sharp({ create: { width: 120, height: 120, channels: 3, background: '#ffffff' } }).png().toBuffer();
      await page.locator('#scanFile').setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: blank }); await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('No QR code'));
    });
    await check('inverted image QR is decoded and unsafe URL gets no Open link', async () => {
      const inverted = await sharp(qrBuffer).negate({ alpha: false }).png().toBuffer(); await page.locator('#scanFile').setInputFiles({ name: 'inverted.png', mimeType: 'image/png', buffer: inverted });
      await page.waitForFunction(() => !document.querySelector('#btnScanFile').disabled);
      if (await page.locator('#scanResult').isHidden()) throw new Error(await page.locator('#toast').textContent());
      await page.locator('#scanResult').waitFor({ state: 'visible' }); assert.equal(await page.locator('#scanText').inputValue(), url);
      await page.locator('#tab-url').click(); await page.locator('#inputUrl').fill('javascript:alert(1)'); await ready(page);
      const unsafe = await page.locator('#qrCanvas canvas').evaluate(canvas => canvas.toDataURL());
      await page.locator('#scanFile').setInputFiles({ name: 'unsafe.png', mimeType: 'image/png', buffer: Buffer.from(unsafe.split(',')[1], 'base64') });
      await page.waitForFunction(() => document.querySelector('#scanText').value.startsWith('javascript:')); assert.equal(await page.locator('#scanOpen').isHidden(), true);
    });
    await check('clipboard buttons write the requested text and a PNG image', async () => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']); await page.bringToFront();
      await page.locator('#btnCopyData').click(); await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Text copied.');
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'javascript:alert(1)');
      await page.locator('#btnCopyImg').click(); await page.waitForFunction(() => document.querySelector('#toast').textContent === 'QR image copied.');
      assert.ok((await page.evaluate(async () => (await navigator.clipboard.read()).flatMap(item => item.types))).includes('image/png'));
    });
    const host = await context.newPage(); await host.goto(origin); await host.locator('#code').waitFor({ state: 'visible' });
    await check('extension action grants activeTab and on-demand content injection works', async () => {
      await invoke(host);
      const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
      console.log('Active test tab', tab.id);
      await worker.evaluate(async tabId => { await chrome.scripting.executeScript({ target: { tabId }, files: ['qr-core.js', 'content.js'] }); }, tab.id);
      await worker.evaluate(async tabId => { const response = await chrome.tabs.sendMessage(tabId, { type: 'PAGE_STATE' }); if (response.hover !== false) throw new Error('Unexpected hover state'); }, tab.id);
    });
    await check('page area screenshot decodes in the service worker', async () => {
      const rect = await host.locator('#code').boundingBox();
      const response = await worker.evaluate(async ({ rect, viewport }) => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return scanSelection({ rect, viewport }, { id: chrome.runtime.id, tab, frameId: 0 });
      }, { rect, viewport: { width: 1280, height: 800 } });
      assert.equal(response.data, url);
    });
    await check('area UI supports repeated injection and Escape cleanup', async () => {
      await worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['qr-core.js', 'content.js'] });
        await chrome.tabs.sendMessage(tab.id, { type: 'START_SCAN' });
      });
      const cdp = await context.newCDPSession(host); await cdp.send('DOM.enable');
      const doc = await cdp.send('DOM.getFlattenedDocument', { depth: -1, pierce: true }); assert.equal(doc.nodes.filter(n => n.nodeName === 'DIALOG').length, 1);
      await host.keyboard.press('Escape'); await host.locator('#hostButton').click();
      const after = await cdp.send('DOM.getFlattenedDocument', { depth: -1, pierce: true }); assert.equal(after.nodes.filter(n => n.nodeName === 'DIALOG').length, 0); await cdp.detach();
    });
    await check('full drag-to-scan flow displays the decoded URL on the page', async () => {
      await worker.evaluate(async () => { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); await chrome.tabs.sendMessage(tab.id, { type: 'START_SCAN' }); });
      const rect = await host.locator('#code').boundingBox();
      await host.mouse.move(rect.x - 5, rect.y - 5); await host.mouse.down(); await host.mouse.move(rect.x + rect.width + 5, rect.y + rect.height + 5, { steps: 10 }); await host.mouse.up();
      const cdp = await context.newCDPSession(host); await cdp.send('DOM.enable'); let value;
      for (let attempt = 0; attempt < 30; attempt++) {
        const doc = await cdp.send('DOM.getFlattenedDocument', { depth: -1, pierce: true }); const text = doc.nodes.find(n => n.nodeName === 'TEXTAREA');
        if (text) { const { object } = await cdp.send('DOM.resolveNode', { nodeId: text.nodeId }); const result = await cdp.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: 'function(){return this.value}', returnByValue: true }); value = result.result.value; break; }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      assert.equal(value, url); await host.keyboard.press('Escape'); await cdp.detach();
    });
    await check('hover preview is opt-in, decodable, and removed when disabled', async () => {
      await worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['libs/qr-code-styling.min.js'] });
        await chrome.tabs.sendMessage(tab.id, { type: 'HOVER_TOGGLE', enabled: true });
      });
      await host.locator('a').hover(); await new Promise(resolve => setTimeout(resolve, 650));
      const cdp = await context.newCDPSession(host); await cdp.send('DOM.enable');
      const doc = await cdp.send('DOM.getFlattenedDocument', { depth: -1, pierce: true }); assert.equal(doc.nodes.filter(n => n.nodeName === 'CANVAS').length, 1);
      await worker.evaluate(async () => { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); await chrome.tabs.sendMessage(tab.id, { type: 'HOVER_TOGGLE', enabled: false }); });
      const after = await cdp.send('DOM.getFlattenedDocument', { depth: -1, pierce: true }); assert.equal(after.nodes.filter(n => n.nodeName === 'CANVAS').length, 0); await cdp.detach();
    });
    await check('popup makes no external HTTP requests and raises no uncaught errors', async () => { assert.deepEqual(requests, []); assert.deepEqual(errors, []); });
    await check('production screenshot crop decodes correctly at device scale factor 2', async () => {
      const high = await launch({ width: 1280, height: 800 }, 2);
      try {
        const host = await high.context.newPage(); await host.goto(origin); await host.locator('#code').waitFor({ state: 'visible' }); await high.invoke(host);
        const rect = await host.locator('#code').boundingBox();
        const response = await high.worker.evaluate(async rect => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          return scanSelection({ rect, viewport: { width: 1280, height: 800 } }, { id: chrome.runtime.id, tab, frameId: 0 });
        }, rect);
        assert.equal(response.data, url);
      } finally { await high.context.close(); }
    });
    await fs.writeFile('test-results/browser-report.json', JSON.stringify({ browser: context.browser().version(), passed: results.length, checks: results, errors, externalRequests: requests }, null, 2));
    console.log(`${results.length} browser checks passed.`);
  } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
