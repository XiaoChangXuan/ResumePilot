chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});

async function dispatchTrustedClick(tabId, point) {
  if (!tabId || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
    return { ok: false, error: 'Invalid click coordinates' };
  }

  const debuggee = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(debuggee, '1.3');
    attached = true;
    const common = { x: point.x, y: point.y, pointerType: 'mouse' };
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchMouseEvent', { type: 'mouseMoved', ...common });
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...common,
      button: 'left',
      buttons: 1,
      clickCount: 1
    });
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...common,
      button: 'left',
      buttons: 0,
      clickCount: 1
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  } finally {
    if (attached) {
      try { await chrome.debugger.detach(debuggee); } catch {}
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RESUME_AUTOFILL_TRUSTED_CLICK') {
    dispatchTrustedClick(sender.tab?.id, message.point).then(sendResponse);
    return true;
  }
  return false;
});
