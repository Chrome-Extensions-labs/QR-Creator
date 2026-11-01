/* Injected on request. All page UI lives in an isolated shadow root. */
(() => {
  'use strict';
  if (globalThis.__qrCreatorPageTools) return;
  globalThis.__qrCreatorPageTools = true;
  let modalHost, hoverHost, hoverController, hoverTimer, hoverLink, scanning = false;
  const css = `
    :host{all:initial;color-scheme:dark;font:14px/1.5 system-ui,sans-serif;color:#eef2fb}
    *{box-sizing:border-box}dialog{font:14px/1.5 system-ui,sans-serif;color:#eef2fb;background:#111e35;border:2px solid #f2c332;padding:24px;max-width:min(480px,94vw);box-shadow:8px 8px 0 #060e1f}
    dialog::backdrop{background:#08112499}h2{margin:0 0 12px;font-size:20px}p{margin:8px 0;color:#b6c4da}
    textarea{display:block;width:100%;height:120px;resize:vertical;background:#081124;color:#f6f7fc;border:1px solid #50627c;padding:12px;font:14px/1.5 monospace;word-break:break-all;unicode-bidi:plaintext}
    button,a{font:600 14px system-ui;cursor:pointer;display:inline-block;padding:10px 15px;margin:12px 8px 0 0;color:#101b30;background:#f2c332;border:0;text-decoration:none}
    button.secondary{background:#273c58;color:#eef2fb}:focus-visible{outline:3px solid #66cefa;outline-offset:3px}
    .destination{color:#f2c332;overflow-wrap:anywhere;unicode-bidi:plaintext}.message{min-height:21px}
    dialog.area{position:fixed;inset:0;margin:0;border:0;max-width:none;max-height:none;width:100vw;height:100vh;padding:0;background:transparent;cursor:crosshair;box-shadow:none;touch-action:none;overflow:hidden}
    dialog.area::backdrop{background:transparent}.shade{position:absolute;inset:0;background:#08112488;pointer-events:none}
    .selection{position:absolute;border:2px solid #f2c332;box-shadow:0 0 0 9999px #08112488;pointer-events:none}
    .instructions{position:absolute;top:22px;left:50%;transform:translateX(-50%);padding:12px 18px;background:#111e35;border:1px solid #f2c332;white-space:nowrap;cursor:default}
    .instructions button{margin:0 0 0 20px;padding:5px 10px}.tooltip{width:188px;padding:12px;background:#111e35;border:2px solid #f2c332;box-shadow:5px 5px 0 #081124;color:#f2c332;font:11px/1.5 monospace;text-align:center}
    .tooltip canvas{width:160px;height:160px;display:block;margin-bottom:8px}.tooltip span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `;
  function surface() {
    const host = document.createElement('div');
    host.style.setProperty('all', 'initial', 'important');
    const shadow = host.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet(); sheet.replaceSync(css); shadow.adoptedStyleSheets = [sheet];
    document.documentElement.append(host);
    return { host, shadow };
  }
  function closeModal() { modalHost?.remove(); modalHost = null; }
  function dialog() {
    closeModal();
    const { host, shadow } = surface(); modalHost = host;
    const el = document.createElement('dialog'); shadow.append(el);
    el.addEventListener('cancel', () => { scanning = false; closeModal(); });
    return el;
  }
  function button(label, onClick, secondary = false) {
    const el = document.createElement('button'); el.textContent = label; el.className = secondary ? 'secondary' : ''; el.addEventListener('click', onClick); return el;
  }
  function resultDialog(data, error) {
    const el = dialog(), title = document.createElement('h2');
    title.textContent = error ? 'Could not read QR code' : 'QR code decoded'; el.append(title);
    if (error) { const p = document.createElement('p'); p.textContent = error; el.append(p); }
    else {
      const url = QRCore.safeUrl(data);
      if (url) { const domain = document.createElement('p'); domain.className = 'destination'; domain.textContent = `Destination: ${new URL(url).hostname}`; el.append(domain); }
      const text = document.createElement('textarea'); text.readOnly = true; text.value = data; text.setAttribute('aria-label', 'Decoded QR content'); el.append(text);
      const note = document.createElement('p'); note.textContent = 'Check the destination before opening a link.'; el.append(note);
      const feedback = document.createElement('p'); feedback.className = 'message'; feedback.setAttribute('role', 'status');
      el.append(button('Copy text', async () => {
        try { await navigator.clipboard.writeText(data); feedback.textContent = 'Copied to clipboard.'; }
        catch { feedback.textContent = 'Copy failed. Select the text and press Ctrl+C.'; }
      }));
      if (url) { const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open link'; el.append(link); }
      el.append(feedback);
    }
    el.append(button('Close', closeModal, true)); el.showModal();
  }
  async function scanRect(rect) {
    if (scanning) return;
    scanning = true; closeModal(); hideHover();
    try {
      // Allow the compositor to remove the selection before capturing the page.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => setTimeout(resolve, 90));
      const response = await chrome.runtime.sendMessage({ type: 'SCAN_RECT', rect, viewport: { width: innerWidth, height: innerHeight } });
      if (response?.error) throw new Error(response.error);
      if (typeof response?.data !== 'string') throw new Error('No scan result. Please try again.');
      resultDialog(response.data);
    } catch (error) { resultDialog(null, error.message); }
    finally { scanning = false; }
  }
  function startScan(imageUrl) {
    if (scanning) return;
    hideHover();
    if (imageUrl) {
      const image = [...document.images].find(img => img.currentSrc === imageUrl || img.src === imageUrl);
      const r = image?.getBoundingClientRect();
      if (r && r.width >= 16 && r.height >= 16 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight) {
        void scanRect({ x: r.left, y: r.top, width: r.width, height: r.height }); return;
      }
    }
    const el = dialog(); el.className = 'area'; el.setAttribute('aria-label', 'Drag around a QR code. Press Escape to cancel.');
    const shade = document.createElement('div'); shade.className = 'shade';
    const selection = document.createElement('div'); selection.className = 'selection'; selection.hidden = true;
    const hint = document.createElement('div'); hint.className = 'instructions'; hint.textContent = 'Drag around a QR code · Esc to cancel'; hint.append(button('Cancel', closeModal, true));
    el.append(shade, selection, hint);
    let start;
    const point = event => ({ x: Math.max(0, Math.min(innerWidth, event.clientX)), y: Math.max(0, Math.min(innerHeight, event.clientY)) });
    const rectangle = end => ({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) });
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0 || hint.contains(event.target)) return;
      event.preventDefault(); start = point(event); el.setPointerCapture(event.pointerId); shade.hidden = true; selection.hidden = false;
      Object.assign(selection.style, { left: `${start.x}px`, top: `${start.y}px`, width: '0px', height: '0px' });
    });
    el.addEventListener('pointermove', event => {
      if (!start) return;
      const r = rectangle(point(event)); Object.assign(selection.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
    });
    el.addEventListener('pointerup', event => {
      if (!start) return;
      const r = rectangle(point(event)); start = null;
      if (r.width < 16 || r.height < 16) { selection.hidden = true; shade.hidden = false; return; }
      void scanRect(r);
    });
    el.addEventListener('pointercancel', () => { start = null; selection.hidden = true; shade.hidden = false; });
    el.showModal();
  }
  function hideHover() { clearTimeout(hoverTimer); hoverLink = null; hoverHost?.remove(); hoverHost = null; }
  function setHover(enabled) {
    hoverController?.abort(); hoverController = null; hideHover();
    if (!enabled || typeof QRCodeStyling !== 'function') return;
    hoverController = new AbortController(); const options = { signal: hoverController.signal, passive: true };
    document.addEventListener('pointerover', event => {
      const link = event.target.closest?.('a[href]');
      if (!link || link === hoverLink || modalHost || !QRCore.safeUrl(link.href) || QRCore.bytes(link.href) > QRCore.MAX_BYTES) return;
      hideHover(); hoverLink = link;
      hoverTimer = setTimeout(async () => {
        try {
          const qr = new QRCodeStyling(QRCore.config(link.href, QRCore.defaults, 320)); await qr.getRawData('png');
          if (hoverLink !== link || !hoverController || modalHost) return;
          const { host, shadow } = surface(); hoverHost = host;
          const r = link.getBoundingClientRect();
          Object.assign(host.style, { position: 'fixed', zIndex: '2147483647', pointerEvents: 'none', left: `${Math.max(8, Math.min(r.left, innerWidth - 204))}px`, top: `${Math.max(8, Math.min(r.bottom + 10, innerHeight - 232))}px` });
          const box = document.createElement('div'); box.className = 'tooltip'; const target = document.createElement('div'); box.append(target); qr.append(target);
          const label = document.createElement('span'); label.textContent = new URL(link.href).hostname; box.append(label); shadow.append(box);
        } catch { hideHover(); }
      }, 450);
    }, options);
    document.addEventListener('pointerout', event => { if (hoverLink && !hoverLink.contains(event.relatedTarget)) hideHover(); }, options);
    document.addEventListener('scroll', hideHover, { ...options, capture: true });
    window.addEventListener('blur', hideHover, options);
  }
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (msg.type === 'START_SCAN') { startScan(msg.imageUrl); respond({ ok: true }); }
    if (msg.type === 'HOVER_TOGGLE') { setHover(Boolean(msg.enabled)); respond({ ok: true }); }
    if (msg.type === 'PAGE_STATE') respond({ hover: Boolean(hoverController) });
    if (msg.type === 'ERROR') { resultDialog(null, String(msg.error)); respond({ ok: true }); }
  });
})();
