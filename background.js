// 个人资料和 AI Key 只允许弹窗、配置页和后台等受信任扩展上下文读取。
// 注入招聘网页的 content script 通过明确消息获取本次必要资料，不能直接枚举本地存储。
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});

async function dispatchTrustedClick(tabId, point) {
  if (!tabId || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
    return { ok: false, error: '候选坐标无效' };
  }
  const debuggee = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(debuggee, '1.3');
    attached = true;
    const common = { x: point.x, y: point.y, pointerType: 'mouse' };
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchMouseEvent', { type: 'mouseMoved', ...common });
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', ...common, button: 'left', buttons: 1, clickCount: 1
    });
    await chrome.debugger.sendCommand(debuggee, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', ...common, button: 'left', buttons: 0, clickCount: 1
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RESUME_AUTOFILL_TRUSTED_CLICK') {
    dispatchTrustedClick(_sender.tab?.id, message.point).then(sendResponse);
    return true;
  }
});
