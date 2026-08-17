export const GITHUB_API_URL = 'https://api.github.com';
export const GITHUB_API_ORIGIN_PATTERN = 'https://api.github.com/*';

const GITHUB_SYNC_STORAGE_KEY = 'githubSyncConfig';
const DEFAULT_BRANCH = 'main';
const DEFAULT_PATH = 'sync/resume-profile.jsonl';
const API_VERSION = '2022-11-28';

function normalizeRepoUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const shorthand = raw.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shorthand) return `https://github.com/${shorthand[1]}/${shorthand[2].replace(/\.git$/i, '')}`;
  try {
    const url = new URL(raw);
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (url.hostname !== 'github.com' || parts.length < 2) return raw;
    return `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/i, '')}`;
  } catch {
    return raw;
  }
}

function parseRepoRef(value = '') {
  const normalized = normalizeRepoUrl(value);
  if (!normalized) return { owner: '', repo: '', repoUrl: '' };
  try {
    const url = new URL(normalized);
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (url.hostname !== 'github.com' || parts.length < 2) return { owner: '', repo: '', repoUrl: normalized };
    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/i, ''),
      repoUrl: `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/i, '')}`
    };
  } catch {
    return { owner: '', repo: '', repoUrl: normalized };
  }
}

function normalizeConfig(config = {}) {
  const repo = parseRepoRef(config.repoUrl || '');
  return {
    repoUrl: repo.repoUrl,
    owner: repo.owner,
    repo: repo.repo,
    branch: String(config.branch || DEFAULT_BRANCH).trim() || DEFAULT_BRANCH,
    path: String(config.path || DEFAULT_PATH).trim().replace(/^\/+/, '') || DEFAULT_PATH,
    token: String(config.token || '').trim()
  };
}

function encodedContentPath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function base64EncodeUtf8(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64DecodeUtf8(value) {
  const binary = atob(String(value || '').replace(/\s+/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function buildSyncEnvelope(profile) {
  return {
    schemaVersion: 1,
    source: 'resume-autofill-mvp',
    syncedAt: new Date().toISOString(),
    profile
  };
}

function parseSyncPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('远端同步文件为空');

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const latest = [...parsed].reverse().find((item) => item && typeof item === 'object');
      if (!latest) throw new Error('远端同步文件中没有有效记录');
      return latest;
    }
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }

  throw new Error('远端同步文件不是有效的 JSONL');
}

async function githubRequest(config, path, init = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'X-GitHub-Api-Version': API_VERSION,
    ...init.headers
  };
  const response = await fetch(`${GITHUB_API_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const message = payload?.message || payload?.errors?.map?.((item) => item?.message || item).filter(Boolean).join('; ') || text.slice(0, 300) || `HTTP ${response.status}`;
    const error = new Error(`GitHub 请求失败：${message}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function readRemoteFile(config) {
  const targetPath = encodedContentPath(config.path);
  return githubRequest(
    config,
    `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${targetPath}?ref=${encodeURIComponent(config.branch)}`
  );
}

export async function loadGitHubSyncConfig() {
  const stored = await chrome.storage.local.get(GITHUB_SYNC_STORAGE_KEY);
  return normalizeConfig(stored[GITHUB_SYNC_STORAGE_KEY]);
}

export async function saveGitHubSyncConfig(config) {
  const normalized = normalizeConfig(config);
  await chrome.storage.local.set({ [GITHUB_SYNC_STORAGE_KEY]: normalized });
  return normalized;
}

export async function clearGitHubSyncConfig() {
  await chrome.storage.local.remove(GITHUB_SYNC_STORAGE_KEY);
}

export function validateGitHubSyncConfig(config) {
  const normalized = normalizeConfig(config);
  if (!normalized.owner || !normalized.repo) throw new Error('请先填写有效的 GitHub 仓库地址');
  if (!normalized.path) throw new Error('请先填写同步文件路径');
  if (!normalized.token) throw new Error('请先填写 GitHub Token');
  return normalized;
}

export async function hasGitHubPermission() {
  return chrome.permissions.contains({ origins: [GITHUB_API_ORIGIN_PATTERN] });
}

export async function requestGitHubPermission() {
  return chrome.permissions.request({ origins: [GITHUB_API_ORIGIN_PATTERN] });
}

export async function downloadGitHubProfile(configOverride) {
  const config = validateGitHubSyncConfig(configOverride || await loadGitHubSyncConfig());
  if (!await hasGitHubPermission()) throw new Error('尚未授权访问 GitHub API');
  const payload = await readRemoteFile(config);
  if (Array.isArray(payload)) throw new Error('同步路径指向目录，不是 JSON 文件');
  const raw = base64DecodeUtf8(payload.content || '');
  const parsed = parseSyncPayload(raw);
  const profile = parsed?.profile && typeof parsed.profile === 'object' && !Array.isArray(parsed.profile) ? parsed.profile : parsed;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('远端文件不是有效的资料 JSON');
  return {
    config,
    profile,
    fileSha: payload.sha || '',
    htmlUrl: payload.html_url || '',
    syncedAt: String(parsed?.syncedAt || '')
  };
}

export async function uploadGitHubProfile(profile, configOverride) {
  const config = validateGitHubSyncConfig(configOverride || await loadGitHubSyncConfig());
  if (!await hasGitHubPermission()) throw new Error('尚未授权访问 GitHub API');
  let currentSha = '';
  let currentText = '';
  try {
    const current = await readRemoteFile(config);
    if (!Array.isArray(current)) {
      currentSha = current.sha || '';
      currentText = base64DecodeUtf8(current.content || '');
    }
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  const nextLine = JSON.stringify(buildSyncEnvelope(profile));
  const contentText = currentText.trim()
    ? `${currentText.replace(/\s+$/, '')}\n${nextLine}\n`
    : `${nextLine}\n`;

  const body = {
    message: `sync profile from extension ${new Date().toISOString()}`,
    content: base64EncodeUtf8(contentText),
    branch: config.branch
  };
  if (currentSha) body.sha = currentSha;

  const targetPath = encodedContentPath(config.path);
  const payload = await githubRequest(
    config,
    `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${targetPath}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  return {
    config,
    commitSha: payload?.commit?.sha || '',
    fileSha: payload?.content?.sha || '',
    htmlUrl: payload?.content?.html_url || '',
    created: !currentSha
  };
}
