'use strict';
// MV3 caches importScripts dependencies at worker installation time.
importScripts('qr-core.js', 'libs/jsqr.js', 'qr-scan.js');
const MENU = { selection: 'qrm_selection', link: 'qrm_link', image: 'qrm_scan_image', area: 'qrm_scan_area' };
let captureBusy = false;
chrome.runtime.onInstalled.addListener(() => {
  // Remove legacy QR thumbnails, which may contain private payloads.
  chrome.storage.local.get('qrMaker_presets_v2').then(result => {
    if (result.qrMaker_presets_v2 !== undefined) return chrome.storage.local.set({ qrMaker_presets_v2: QRCore.normalizePresets(result.qrMaker_presets_v2) });
  }).catch(error => console.warn('Preset migration failed:', error.message));
  chrome.contextMenus.removeAll(() => {
    for (const [id, title, contexts] of [
      [MENU.selection, 'Create QR code for selected text', ['selection']], [MENU.link, 'Create QR code for this link', ['link']],
      [MENU.image, 'Read QR code in this image', ['image']], [MENU.area, 'Select an area to scan a QR code', ['page']]
    ]) chrome.contextMenus.create({ id, title, contexts });
  });
});
async function pageMessage(tabId, message) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['qr-core.js', 'content.js'] });
  return chrome.tabs.sendMessage(tabId, message);
}
async function openWithData(data) {
  await chrome.storage.session.set({ pendingQrData: data });
  try { await chrome.action.openPopup(); } catch { await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') }); }
}
async function showFailure(tabId, error) {
  try { await pageMessage(tabId, { type: 'ERROR', error: error.message }); }
  catch {
    await chrome.storage.session.set({ pendingError: 'This page does not allow scanning. Open a regular website or scan an image file.' });
    try { await chrome.action.openPopup(); } catch { /* Available on next popup open. */ }
  }
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  (async () => {
    if (info.menuItemId === MENU.selection) await openWithData(info.selectionText || '');
    if (info.menuItemId === MENU.link) await openWithData(info.linkUrl || '');
    if ([MENU.image, MENU.area].includes(info.menuItemId)) await pageMessage(tab.id, { type: 'START_SCAN', imageUrl: info.menuItemId === MENU.image ? info.srcUrl : null });
  })().catch(error => showFailure(tab?.id, error));
});
chrome.commands.onCommand.addListener(command => {
  if (command !== 'scan-area') return;
  chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    if (!tab) return;
    try { await pageMessage(tab.id, { type: 'START_SCAN' }); }
    catch (error) { await showFailure(tab.id, error); }
  }).catch(error => console.warn('Could not start scan:', error.message));
});
async function scanSelection(msg, sender) {
  const tab = sender.tab;
  if (!tab || sender.frameId !== 0) throw new Error('Scan must start in the active page.');
  if (captureBusy) throw new Error('A scan is already in progress. Try again in a moment.');
  captureBusy = true;
  try {
    QRCore.cropRect(msg.rect, msg.viewport, 1000, 1000);
    const [before] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (before?.id !== tab.id) throw new Error('The active tab changed. Start the scan again.');
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const [after] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (after?.id !== tab.id || after.url !== before.url) throw new Error('The page changed. Start the scan again.');
    const blob = new Blob([Uint8Array.from(atob(dataUrl.split(',')[1]), char => char.charCodeAt(0))], { type: 'image/png' });
    return { data: await QRScan.decode(blob, msg.rect, msg.viewport) };
  } finally { captureBusy = false; }
}
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return;
  if (msg.type === 'SCAN_RECT') {
    scanSelection(msg, sender).then(respond).catch(error => respond({ error: error.message }));
    return true;
  }
});
