/* Store screenshots are composed from the real extension, never generated UI. */
const fs = require('node:fs/promises');
const http = require('node:http');
const sharp = require('sharp');
const { launch } = require('./browser-harness.cjs');
const out = 'store-assets';
const b64 = buffer => `data:image/png;base64,${buffer.toString('base64')}`;
const ready = page => page.waitForFunction(() => document.querySelector('#statusMsg').textContent === 'READY TO SHARE');
async function screenshot(page, selector) { await page.evaluate(() => document.activeElement?.blur()); return page.locator(selector).screenshot(); }
async function poster(page, { number, title, copy, tags, image, kind = '', inset }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;background:#0b1629;color:#f5f4ef;font-family:Segoe UI,Arial,sans-serif}main{position:relative;width:1280px;height:800px;overflow:hidden;background:radial-gradient(ellipse at 90% 0%,#1b3b59 0%,transparent 55%)}
    .grid{position:absolute;inset:0;background-image:linear-gradient(#a8dfff08 1px,transparent 1px),linear-gradient(90deg,#a8dfff08 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(135deg,black,transparent 75%)}
    .brand{position:absolute;left:66px;top:48px;font:600 14px Consolas,monospace;letter-spacing:2px;color:#a6bad4}.mark{color:#f2c332;font-size:24px;margin-right:12px;vertical-align:middle}.number{position:absolute;right:65px;top:54px;font:13px Consolas,monospace;color:#91a6c4;letter-spacing:2px}
    .copy{position:absolute;left:66px;top:188px;width:570px}h1{font-size:73px;line-height:1.03;letter-spacing:-3.1px;font-weight:750;margin:0 0 28px}h1 em{color:#f2c332;font-style:normal}p{font-size:19px;line-height:1.6;color:#adbed5;margin:0;max-width:460px}.tags{display:flex;gap:9px;flex-wrap:wrap;margin-top:28px;max-width:480px}.tag{border:1px solid #3e526c;padding:8px 10px;font:11px Consolas,monospace;color:#d0ddee;letter-spacing:.6px}
    .product{position:absolute;right:76px;top:88px;width:400px;border:1px solid #455774;box-shadow:16px 16px 0 #060e1d;background:#101b30}.product:before{content:'';position:absolute;left:-10px;top:-10px;width:23px;height:23px;border-top:3px solid #f2c332;border-left:3px solid #f2c332}.product img{width:100%;display:block}.product.wifi{top:65px;width:370px}.product.design{top:64px;width:395px}.product.screen{right:48px;top:166px;width:720px}.screen~.copy{width:460px}.screen img{width:100%}
    .browserbar{height:31px;background:#1d2c43;border-bottom:1px solid #455774;color:#91a5c0;padding:8px 12px;font:10px Consolas,monospace;letter-spacing:.3px}.browserbar:before{content:'● ● ●';font-size:7px;margin-right:18px;color:#7c94b5}.bottom{position:absolute;bottom:39px;left:66px;right:65px;display:flex;justify-content:space-between;color:#8299b8;font:11px Consolas,monospace;letter-spacing:1px}.bottom b{color:#b8c9dd;font-weight:400}.pixel{position:absolute;width:9px;height:9px;background:#f2c332;right:53px;bottom:95px;box-shadow:17px 0 #f2c332,0 17px #f2c332,17px 17px #f2c332}.inset{margin-top:28px;width:225px;border:1px solid #3e526c}.inset img{width:100%;display:block}
    .screen-copy{top:214px;width:410px}.screen-copy h1{font-size:60px}.screen-copy p{max-width:360px;font-size:18px}.screen-copy .tags{max-width:340px}
  </style></head><body><main><div class="grid"></div><div class="brand"><span class="mark">▞</span>QR CODE CREATOR</div><div class="number">${number} / 05</div>
  <div class="copy ${kind === 'screen' ? 'screen-copy' : ''}"><h1>${title}</h1><p>${copy}</p><div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>${inset ? `<div class="inset"><img src="${b64(inset)}"></div>` : ''}</div>
  <div class="product ${kind}"><div class="browserbar">${kind === 'screen' ? 'QR Code Creator · page scanner' : 'QR Code Creator · Chrome extension'}</div><img src="${b64(image)}"></div><div class="pixel"></div>
  <div class="bottom"><b>CREATE. SCAN. SHARE.</b><span>INDEPENDENT &amp; OPEN SOURCE</span></div></main></body></html>`);
  const raw = await page.screenshot();
  await sharp(raw).flatten({ background: '#0b1629' }).removeAlpha().png().toFile(`${out}/screenshot-${number}-1280x800.png`);
}
(async () => {
  const { context, id, worker, invoke } = await launch();
  let server;
  try {
    const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('#inputUrl').fill('https://github.com/Chrome-Extensions-labs/QR-Creator'); await ready(popup);
    const url = await screenshot(popup, '.app');
    await popup.locator('#tab-wifi').click(); await popup.locator('#wifiSsid').fill('Studio Guest'); await popup.locator('#wifiPass').fill('a-friendly-guest-network'); await ready(popup);
    const wifi = await screenshot(popup, '.app');
    await popup.locator('#tab-url').click(); await popup.locator('#inputUrl').fill('https://example.com/workshop'); await ready(popup);
    const qrData = await popup.locator('#qrCanvas canvas').evaluate(canvas => canvas.toDataURL());
    const qrBuffer = Buffer.from(qrData.split(',')[1], 'base64');
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#f1efe8;color:#1b2940;font:16px Segoe UI,Arial,sans-serif}.nav{padding:23px 38px;border-bottom:1px solid #d5d8d4;font-size:12px;letter-spacing:3px;font-weight:700}.content{padding:56px 38px;display:flex;align-items:center;gap:36px}.text{width:420px}.eyebrow{font:12px Consolas;color:#6c7d7d;letter-spacing:2px}h1{font-size:53px;line-height:1.05;letter-spacing:-2px;margin:18px 0 25px}p{line-height:1.6;color:#6a7579}.code{padding:20px;background:#fff;box-shadow:8px 8px #d5ddda;text-align:center}.code img{width:220px;height:220px;display:block}.code p{font:11px Consolas;color:#1b2940;margin-bottom:0}.foot{margin:50px 38px;font:12px Consolas;color:#84918e;border-top:1px solid #d5d8d4;padding-top:20px}</style></head><body><div class="nav">FIELD NOTES / OPEN STUDIO</div><div class="content"><div class="text"><div class="eyebrow">A SATURDAY WELL SPENT</div><h1>Make something<br>worth sharing.</h1><p>Join our next creative workshop.<br>Find the details inside the little square.</p><p>14 NOV · 10:00 · THE STUDIO</p></div><div class="code"><img id="code" src="${qrData}"><p>WORKSHOP DETAILS ↗</p></div></div><div class="foot">SAMPLE PAGE · QR CODE CREATOR DEMONSTRATION</div></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const host = await context.newPage(); await host.setViewportSize({ width: 900, height: 640 }); await host.goto(`http://127.0.0.1:${server.address().port}`);
    await invoke(host);
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
    await worker.evaluate(async tabId => { await chrome.scripting.executeScript({ target: { tabId }, files: ['qr-core.js', 'content.js'] }); await chrome.tabs.sendMessage(tabId, { type: 'START_SCAN' }); }, tabId);
    const r = await host.locator('#code').boundingBox();
    await host.mouse.move(r.x - 7, r.y - 7); await host.mouse.down(); await host.mouse.move(r.x + r.width + 7, r.y + r.height + 7, { steps: 12 });
    const selection = await host.screenshot();
    await host.mouse.up();
    const cdp = await context.newCDPSession(host); await cdp.send('DOM.enable');
    for (let attempt = 0; attempt < 30; attempt++) {
      const doc = await cdp.send('DOM.getFlattenedDocument', { depth: -1, pierce: true });
      if (doc.nodes.some(n => n.nodeName === 'TEXTAREA')) break;
      await new Promise(resolve => setTimeout(resolve, 200));
      if (attempt === 29) throw new Error('Scanner result was not displayed.');
    }
    const decoded = await host.screenshot(); await host.keyboard.press('Escape'); await cdp.detach();
    await popup.bringToFront(); await popup.locator('#designDetails summary').click(); await popup.locator('.forest').click(); await popup.locator('#dotStyle').selectOption('rounded'); await popup.locator('#cornerSqStyle').selectOption('extra-rounded');
    await popup.locator('#presetName').fill('Studio green'); await popup.locator('#btnSavePreset').click(); await ready(popup);
    await popup.locator('#toast').waitFor({ state: 'hidden' });
    const settings = await screenshot(popup, '#designDetails'), preview = await screenshot(popup, '.preview');
    const canvas = await context.newPage();
    await poster(canvas, { number: '01', title: 'One link.<br><em>Ready to<br>share.</em>', copy: 'Turn the current tab, a link or your text<br>into a QR code in seconds.', tags: ['PNG + SVG', 'COPY AS IMAGE', 'NO ACCOUNT'], image: url });
    await poster(canvas, { number: '02', title: 'Spot a QR.<br><em>Select it.</em>', copy: 'Draw around a QR code on a page.<br>Even when it is inside a canvas<br>or an image.', tags: ['SELECT AN AREA', 'ALT + SHIFT + S'], image: selection, kind: 'screen' });
    await poster(canvas, { number: '03', title: 'See where<br><em>it leads.</em>', copy: 'Read the destination first.<br>Then copy the text or choose<br>to open the link.', tags: ['REVIEW BEFORE OPENING', 'LOCAL SCANNING'], image: decoded, kind: 'screen' });
    await poster(canvas, { number: '04', title: 'Share Wi-Fi.<br><em>Skip the<br>spelling.</em>', copy: 'Let guests connect with a scan.<br>Create contact cards just as easily.', tags: ['WI-FI NETWORKS', 'CONTACT CARDS'], image: wifi, kind: 'wifi' });
    await poster(canvas, { number: '05', title: 'Your code.<br><em>Your colors.</em>', copy: 'Choose a style, add a logo<br>and save your favorite designs.', tags: ['COLORS + LOGO', 'DESIGN PRESETS', '512–2048 PX'], image: settings, kind: 'design', inset: preview });
    await fs.writeFile(`${out}/screenshot-provenance.json`, JSON.stringify({ note: 'All interface imagery is captured from the actual extension in Chrome. Surrounding titles and framing are store presentation only.', browser: context.browser().version(), screenshots: 5, width: 1280, height: 800 }, null, 2));
    console.log('Created 5 store screenshots, 1280 × 800.');
  } finally { await context.close(); if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
