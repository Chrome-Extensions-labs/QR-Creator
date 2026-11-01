const { launch } = require('./browser-harness.cjs');
const fs = require('node:fs/promises');
(async () => {
  const { context, worker, id } = await launch();
  try {
    console.log('Extension:', id);
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE:', msg.text()); });
    page.on('pageerror', error => console.log('PAGE:', error.message));
    await page.goto(`chrome-extension://${id}/popup.html`);
    await page.locator('#inputUrl').fill('https://github.com/Chrome-Extensions-labs/QR-Creator');
    await page.waitForFunction(() => document.querySelector('#statusMsg').textContent === 'READY TO SHARE');
    await fs.mkdir('test-results', { recursive: true });
    await page.locator('.app').screenshot({ path: 'test-results/popup.png' });
    console.log(await page.locator('.app').boundingBox());
  } finally { await context.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
