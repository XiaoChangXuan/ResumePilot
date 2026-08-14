import { createChatCompletion, loadAIConfig } from './ai-client.js';

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

function aiMessageText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((item) => item?.text || item?.content || '').join('');
  return '';
}

function parseAIJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('模型没有返回 JSON 对象');
  return JSON.parse(match[0]);
}

async function reviewSelectMismatch(input = {}) {
  const config = await loadAIConfig();
  if (!config.model || !config.apiKey) return { ok: false, enabled: false, reason: 'AI 模型名或 API Key 尚未配置' };
  const field = String(input.field || '').slice(0, 120);
  const key = String(input.key || '').slice(0, 80);
  const target = String(input.target || '').slice(0, 160);
  const observed = String(input.observed || '').slice(0, 160);
  const candidates = [...new Set((Array.isArray(input.candidates) ? input.candidates : [])
    .map((item) => String(item || '').trim()).filter(Boolean).map((item) => item.slice(0, 120)))].slice(0, 20);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const completion = await createChatCompletion({
      temperature: 0,
      maxTokens: 220,
      signal: controller.signal,
      messages: [
        {
          role: 'system',
          content: '你是招聘表单下拉框的保守复核器。判断本地目标值与页面实际值是否语义等价，或应改选哪个现有候选。只返回 JSON：{"decision":"keep|select|clear","value":"","reason":""}。keep 仅用于实际值与目标语义等价；select 的 value 必须逐字等于候选列表中的一项；不确定、冲突或没有安全候选时必须 clear。禁止创造候选、补充个人事实或根据常识猜测用户信息。'
        },
        {
          role: 'user',
          content: JSON.stringify({ field, key, target, observed, candidates })
        }
      ]
    });
    const parsed = parseAIJson(aiMessageText(completion));
    const decision = ['keep', 'select', 'clear'].includes(parsed?.decision) ? parsed.decision : 'clear';
    const reason = String(parsed?.reason || '模型未提供理由').slice(0, 240);
    if (decision === 'keep') {
      if (!observed) return { ok: true, enabled: true, decision: 'clear', value: '', reason: '页面实际值为空，不能保留' };
      return { ok: true, enabled: true, decision, value: observed, reason };
    }
    if (decision === 'select') {
      const requested = String(parsed?.value || '').trim();
      const exact = candidates.find((candidate) => candidate === requested);
      if (!exact) return { ok: true, enabled: true, decision: 'clear', value: '', reason: '模型建议值不在页面候选列表中，已拒绝' };
      return { ok: true, enabled: true, decision, value: exact, reason };
    }
    return { ok: true, enabled: true, decision: 'clear', value: '', reason };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'AI 复核超过 15 秒' : (error?.message || String(error));
    return { ok: false, enabled: true, reason };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RESUME_AUTOFILL_TRUSTED_CLICK') {
    dispatchTrustedClick(_sender.tab?.id, message.point).then(sendResponse);
    return true;
  }
  if (message.type === 'RESUME_AUTOFILL_AI_REVIEW_SELECT') {
    reviewSelectMismatch(message.input).then(sendResponse);
    return true;
  }
});
