const { chromium } = require('playwright');
async function launch(viewport = { width: 1280, height: 800 }, deviceScaleFactor = 1) {
  // CDP loading works with current branded Chrome; no profile or user settings are changed.
  const context = await chromium.launchPersistentContext('', {
    channel: process.env.QR_TEST_BROWSER ? undefined : 'chrome', executablePath: process.env.QR_TEST_BROWSER,
    headless: true, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'], viewport, deviceScaleFactor
  });
  const browserCDP = await context.browser().newBrowserCDPSession();
  const { id } = await browserCDP.send('Extensions.loadUnpacked', { path: process.env.QR_EXTENSION_PATH || process.cwd() });
  const worker = context.serviceWorkers().find(w => w.url().includes(id)) || await context.waitForEvent('serviceworker');
  async function invoke(page) {
    await page.bringToFront();
    const { targetInfos } = await browserCDP.send('Target.getTargets', { filter: [{ type: 'tab' }] });
    const target = targetInfos.find(info => info.type === 'tab' && info.url === page.url());
    if (!target) throw new Error('Could not find test tab target: ' + JSON.stringify(targetInfos));
    await browserCDP.send('Extensions.triggerAction', { id, targetId: target.targetId });
  }
  return { context, worker, id, invoke };
}
module.exports = { launch };
