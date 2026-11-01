'use strict';
const $ = id => document.getElementById(id);
const PRESETS_KEY = 'qrMaker_presets_v2';
let design = { ...QRCore.defaults }, type = 'url', activeTab, currentQR, ready = false, renderTimer, revision = 0, toastTimer, saveBusy = false;
const exportButtons = [...document.querySelectorAll('[data-export]')];
async function renderData(qr, extension) {
  let timer;
  try { return await Promise.race([qr.getRawData(extension), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Rendering timed out. Remove the logo and try again.')), 6000); })]); }
  finally { clearTimeout(timer); }
}
function toast(message, error = false) {
  $('toast').textContent = message; $('toast').className = error ? 'error' : ''; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 6000 : 2600);
}
function payload() {
  if (type === 'wifi') return QRCore.wifi({ ssid: $('wifiSsid').value, password: $('wifiPass').value, encryption: $('wifiEnc').value, hidden: $('wifiHidden').checked });
  if (type === 'vcard') return QRCore.vcard(Object.fromEntries(['first', 'last', 'phone', 'email', 'org', 'url'].map(key => [key, $(`vcard${key[0].toUpperCase()}${key.slice(1)}`).value])));
  return $('inputUrl').value;
}
function invalidate() {
  revision++; ready = false; currentQR = null; exportButtons.forEach(button => { button.disabled = true; });
  $('qrCanvas').replaceChildren();
}
function scheduleRender() {
  clearTimeout(renderTimer); invalidate();
  $('statusMsg').textContent = 'UPDATING…';
  renderTimer = setTimeout(render, 100);
}
async function render() {
  const token = revision, data = payload();
  $('byteCount').textContent = `${QRCore.bytes(data)} B`;
  $('qrWarning').textContent = QRCore.warning(design); $('qrWarning').hidden = !$('qrWarning').textContent;
  if (!data) {
    const span = document.createElement('span'); span.className = 'empty'; span.textContent = 'Your QR code will appear here'; $('qrCanvas').replaceChildren(span);
    $('statusMsg').textContent = 'ENTER DATA TO START'; return;
  }
  try {
    const qr = new QRCodeStyling(QRCore.config(data, design, 512));
    await renderData(qr, 'png');
    if (token !== revision) return;
    $('qrCanvas').replaceChildren(); qr.append($('qrCanvas')); currentQR = qr; ready = true;
    exportButtons.forEach(button => { button.disabled = false; }); $('statusMsg').textContent = 'READY TO SHARE';
  } catch (error) {
    if (token !== revision) return;
    $('statusMsg').textContent = 'CHECK YOUR DATA'; $('qrWarning').textContent = error.message || 'Cannot create this QR code.'; $('qrWarning').hidden = false;
  }
}
function activateTab(next, focus = false) {
  type = next;
  document.querySelectorAll('[role=tab]').forEach(tab => {
    const selected = tab.dataset.type === next; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    $(`panel-${tab.dataset.type}`).hidden = !selected;
    if (selected && focus) tab.focus();
  });
  scheduleRender();
}
function syncDesign() {
  design = QRCore.normalizeDesign(design);
  for (const key of ['dotStyle', 'cornerSqStyle', 'cornerDotStyle', 'ecl', 'dotColor', 'bgColor', 'cornerColor']) $(key).value = design[key];
  $('invert').checked = design.invert; $('ecl').disabled = Boolean(design.logoDataUrl);
  $('logoThumb').hidden = $('btnRemoveLogo').hidden = !design.logoDataUrl;
  if (design.logoDataUrl) $('logoThumb').src = design.logoDataUrl; else $('logoThumb').removeAttribute('src');
}
async function withError(action) { try { await action(); } catch (error) { toast(error.message || 'Something went wrong. Please try again.', true); } }
async function useCurrentTab() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = activeTab?.url;
  if (!url || !/^https?:\/\//.test(url)) { toast('Open a website, or enter your own link or text.', true); return; }
  $('inputUrl').value = url; activateTab('url');
}
async function exportQR(extension, copy = false) {
  if (!ready || !currentQR) return;
  // Snapshot current input and design at the click; never export an older preview.
  const size = Number($('exportSize').value), cfg = QRCore.config(payload(), design, size, extension === 'svg' ? 'svg' : 'canvas');
  const qr = new QRCodeStyling(cfg);
  const blobPromise = renderData(qr, extension);
  if (copy) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]); toast('QR image copied.');
  } else {
    const blob = await blobPromise;
    if (!blob) throw new Error('Export failed. Please try again.');
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `qr-code-${size}.${extension}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000); toast(`${extension.toUpperCase()} download started.`);
  }
}
async function resizeLogo(file) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP logo.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Choose a logo smaller than 2 MB.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Cannot read this logo.'); });
  try {
    if (bitmap.width * bitmap.height > 16e6) throw new Error('Logo dimensions are too large.');
    const canvas = document.createElement('canvas'), scale = Math.min(1, 192 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    design.logoDataUrl = canvas.toDataURL('image/png'); design.ecl = 'H'; syncDesign(); scheduleRender();
  } finally { bitmap.close(); }
}
async function loadPresets() {
  const result = (await chrome.storage.local.get(PRESETS_KEY))[PRESETS_KEY];
  const presets = QRCore.normalizePresets(result);
  if (result !== undefined && JSON.stringify(result) !== JSON.stringify(presets)) await chrome.storage.local.set({ [PRESETS_KEY]: presets });
  return presets;
}
function renderPresets(presets) {
  $('presetsGrid').replaceChildren();
  for (const preset of presets) {
    const group = document.createElement('div'); group.className = 'preset';
    const apply = document.createElement('button'); apply.textContent = preset.name.slice(0, 24); apply.title = `Apply ${preset.name}`;
    apply.addEventListener('click', () => { design = QRCore.normalizeDesign(preset); syncDesign(); scheduleRender(); });
    const remove = document.createElement('button'); remove.className = 'delete'; remove.textContent = '×'; remove.setAttribute('aria-label', `Delete ${preset.name}`);
    remove.addEventListener('click', () => withError(async () => {
      const all = (await loadPresets()).filter(p => p.id !== preset.id); await chrome.storage.local.set({ [PRESETS_KEY]: all }); renderPresets(all);
    }));
    group.append(apply, remove); $('presetsGrid').append(group);
  }
}
async function savePreset() {
  if (saveBusy) return;
  const name = $('presetName').value.trim(); if (!name) { $('presetName').focus(); throw new Error('Give your preset a name first.'); }
  saveBusy = true; $('btnSavePreset').disabled = true;
  try {
    const all = await loadPresets(); if (all.length >= 20) throw new Error('You can save up to 20 presets. Delete one to add another.');
    all.push({ ...QRCore.normalizeDesign(design), id: crypto.randomUUID(), name });
    await chrome.storage.local.set({ [PRESETS_KEY]: all }); renderPresets(all); $('presetName').value = ''; toast('Design saved. QR content was not saved.');
  } finally { saveBusy = false; $('btnSavePreset').disabled = false; }
}
async function injectPage(includeQR = false) {
  if (!activeTab?.id || !/^https?:\/\//.test(activeTab.url || '')) throw new Error('Open a regular website to use this feature.');
  try { await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: [...(includeQR ? ['libs/qr-code-styling.min.js'] : []), 'qr-core.js', 'content.js'] }); }
  catch { throw new Error('This page does not allow access. Try another website, or scan an image file.'); }
}
let scannerLoad;
function loadScanner() {
  if (!scannerLoad) scannerLoad = (async () => {
    for (const src of ['libs/jsqr.js', 'qr-scan.js']) await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = () => reject(new Error('Could not load the scanner. Reload the extension.')); document.head.append(script); });
  })().catch(error => { scannerLoad = null; throw error; });
  return scannerLoad;
}
async function scanFile(file) {
  if (!file) return;
  $('btnScanFile').disabled = true; $('scanResult').hidden = true;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
    await loadScanner(); const data = await QRScan.decode(file); $('scanText').value = data;
    const url = QRCore.safeUrl(data); $('scanOpen').hidden = !url;
    if (url) $('scanOpen').href = url; else $('scanOpen').removeAttribute('href');
    $('scanDomain').textContent = url ? `Destination: ${new URL(url).hostname} · check before opening` : 'Text decoded. No web link to open.';
    $('scanResult').hidden = false; $('scanResult').scrollIntoView({ block: 'nearest' });
  } finally { $('btnScanFile').disabled = false; }
}
function events() {
  document.querySelectorAll('[role=tab]').forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.type));
    tab.addEventListener('keydown', event => {
      const tabs = [...document.querySelectorAll('[role=tab]')], index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : null;
      if (next !== null) { event.preventDefault(); activateTab(tabs[next].dataset.type, true); }
    });
  });
  document.querySelectorAll('.inputs input,.inputs textarea,.inputs select').forEach(el => el.addEventListener('input', scheduleRender));
  $('wifiEnc').addEventListener('change', () => { $('wifiPass').disabled = $('wifiEnc').value === 'nopass'; scheduleRender(); });
  $('showPassword').addEventListener('change', () => { $('wifiPass').type = $('showPassword').checked ? 'text' : 'password'; });
  for (const key of ['dotStyle', 'cornerSqStyle', 'cornerDotStyle', 'ecl', 'dotColor', 'bgColor', 'cornerColor', 'invert']) $(key).addEventListener('input', () => { design[key] = key === 'invert' ? $(key).checked : $(key).value; scheduleRender(); });
  document.querySelectorAll('[data-palette]').forEach(button => button.addEventListener('click', () => { [design.dotColor, design.bgColor, design.cornerColor] = button.dataset.palette.split(','); design.invert = false; syncDesign(); scheduleRender(); }));
  $('btnReset').addEventListener('click', () => { design = { ...QRCore.defaults }; syncDesign(); scheduleRender(); });
  $('btnCurrentTab').addEventListener('click', () => withError(useCurrentTab));
  $('btnDownloadPng').addEventListener('click', () => withError(() => exportQR('png')));
  $('btnDownloadSvg').addEventListener('click', () => withError(() => exportQR('svg')));
  $('btnCopyImg').addEventListener('click', () => withError(() => exportQR('png', true)));
  $('btnCopyData').addEventListener('click', () => withError(async () => { await navigator.clipboard.writeText(payload()); toast('Text copied.'); }));
  $('btnUploadLogo').addEventListener('click', () => $('logoFile').click());
  $('logoFile').addEventListener('change', () => { const file = $('logoFile').files[0]; $('logoFile').value = ''; void withError(() => resizeLogo(file)); });
  $('btnRemoveLogo').addEventListener('click', () => { design.logoDataUrl = null; syncDesign(); scheduleRender(); });
  $('btnSavePreset').addEventListener('click', () => withError(savePreset));
  $('toggleHover').addEventListener('change', () => withError(async () => {
    try { await injectPage(true); await chrome.tabs.sendMessage(activeTab.id, { type: 'HOVER_TOGGLE', enabled: $('toggleHover').checked }); }
    catch (error) { $('toggleHover').checked = false; throw error; }
  }));
  $('btnScanArea').addEventListener('click', () => withError(async () => { await injectPage(); await chrome.tabs.sendMessage(activeTab.id, { type: 'START_SCAN' }); window.close(); }));
  $('btnScanFile').addEventListener('click', () => $('scanFile').click());
  $('scanFile').addEventListener('change', () => { const file = $('scanFile').files[0]; $('scanFile').value = ''; void withError(() => scanFile(file)); });
  $('btnCopyScan').addEventListener('click', () => withError(async () => { await navigator.clipboard.writeText($('scanText').value); toast('Decoded text copied.'); }));
  $('btnUseScan').addEventListener('click', () => { $('inputUrl').value = $('scanText').value; activateTab('url'); window.scrollTo(0, 0); });
}
async function init() {
  events(); syncDesign();
  const [tabResult, sessionResult, presetResult] = await Promise.allSettled([
    chrome.tabs.query({ active: true, currentWindow: true }), chrome.storage.session.get(['pendingQrData', 'pendingError']), loadPresets()
  ]);
  activeTab = tabResult.status === 'fulfilled' ? tabResult.value[0] : null;
  const pending = sessionResult.status === 'fulfilled' ? sessionResult.value : {};
  if (typeof pending.pendingQrData === 'string') $('inputUrl').value = pending.pendingQrData;
  else if (/^https?:\/\//.test(activeTab?.url || '')) $('inputUrl').value = activeTab.url;
  if (sessionResult.status === 'fulfilled') await chrome.storage.session.remove(['pendingQrData', 'pendingError']);
  renderPresets(presetResult.status === 'fulfilled' ? presetResult.value : []);
  if (pending.pendingError) toast(pending.pendingError, true);
  if (activeTab?.id) chrome.tabs.sendMessage(activeTab.id, { type: 'PAGE_STATE' }).then(result => { $('toggleHover').checked = Boolean(result?.hover); }).catch(() => {});
  scheduleRender();
}
init().catch(error => { toast(`Could not initialize: ${error.message}`, true); });
