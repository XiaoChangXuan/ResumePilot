export const AI_GATEWAY_URL = 'http://llm.api.corp.qunar.com/v1';
export const AI_GATEWAY_ORIGIN_PATTERN = 'http://llm.api.corp.qunar.com/*';

const AI_CONFIG_STORAGE_KEY = 'aiConfig';

function normalizeConfig(config = {}) {
  return {
    gatewayUrl: AI_GATEWAY_URL,
    model: String(config.model || '').trim(),
    apiKey: String(config.apiKey || '').trim()
  };
}

export async function loadAIConfig() {
  const stored = await chrome.storage.local.get(AI_CONFIG_STORAGE_KEY);
  return normalizeConfig(stored[AI_CONFIG_STORAGE_KEY]);
}

export async function saveAIConfig(config) {
  const normalized = normalizeConfig(config);
  await chrome.storage.local.set({ [AI_CONFIG_STORAGE_KEY]: normalized });
  return normalized;
}

export async function clearAIConfig() {
  await chrome.storage.local.remove(AI_CONFIG_STORAGE_KEY);
}

export function validateAIConfig(config) {
  const normalized = normalizeConfig(config);
  if (!normalized.model) throw new Error('请先配置模型名');
  if (!normalized.apiKey) throw new Error('请先配置 API Key');
  return normalized;
}

export async function hasAIGatewayPermission() {
  return chrome.permissions.contains({ origins: [AI_GATEWAY_ORIGIN_PATTERN] });
}

export async function requestAIGatewayPermission() {
  return chrome.permissions.request({ origins: [AI_GATEWAY_ORIGIN_PATTERN] });
}

export async function createChatCompletion({ messages, temperature, maxTokens, signal } = {}) {
  const config = validateAIConfig(await loadAIConfig());
  if (!Array.isArray(messages) || !messages.length) throw new Error('消息列表为空');
  if (!await hasAIGatewayPermission()) {
    throw new Error('尚未授权访问 AI 网关；请在用户点击触发的流程中请求网关权限');
  }

  const body = { model: config.model, messages };
  if (Number.isFinite(temperature)) body.temperature = temperature;
  if (Number.isFinite(maxTokens)) body.max_tokens = maxTokens;

  const response = await fetch(`${config.gatewayUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || text.slice(0, 300) || `HTTP ${response.status}`;
    throw new Error(`AI 网关请求失败：${message}`);
  }
  return payload;
}
