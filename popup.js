const $ = (selector) => document.querySelector(selector);
const result = $('#result');
const PAGE_MESSAGE_PROTOCOL = 2;
const PAGE_SCRIPTS = ['profile-schema.js', 'content.js'];
const FILL_SCRIPTS = ['profile-schema.js', 'content.js', 'complex-controls.js', 'autofill.js'];
let lastLogUrl = '';

function revokeLastLogUrl() {
  if (!lastLogUrl) return;
  URL.revokeObjectURL(lastLogUrl);
  lastLogUrl = '';
}

function timestampForFile() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function makeLogUrl(text) {
  revokeLastLogUrl();
  const blob = new Blob([String(text || '')], { type: 'text/plain;charset=utf-8' });
  lastLogUrl = URL.createObjectURL(blob);
  return lastLogUrl;
}

function showResult({ message, error = false, info = false, logText = '', logName = 'resume-autofill-log.txt' }) {
  result.textContent = '';
  result.className = `result ${error ? 'error' : info ? 'info' : 'show'}`;
  const line = document.createElement('div');
  line.textContent = message;
  result.appendChild(line);
  if (!logText) {
    revokeLastLogUrl();
    return;
  }
  if (logText) {
    const linkLine = document.createElement('div');
    const link = document.createElement('a');
    link.href = makeLogUrl(logText);
    link.download = logName;
    link.textContent = '下载 txt 日志';
    linkLine.appendChild(link);
    result.appendChild(linkLine);
  }
}

function errorLog(title, error) {
  return [
    title,
    `时间：${new Date().toLocaleString()}`,
    '',
    error?.stack || error?.message || String(error)
  ].join('\n');
}

function errorSummary(error, limit = 160) {
  const text = String(error?.message || error || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '未知错误';
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function responseLog(title, summary, payload) {
  return [
    title,
    `时间：${new Date().toLocaleString()}`,
    '',
    summary || '',
    '',
    '原始结果：',
    JSON.stringify(payload || {}, null, 2)
  ].join('\n');
}

async function activeHttpTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/i.test(tab.url || '')) {
    throw new Error('请先打开一个普通 HTTP 或 HTTPS 网页。');
  }
  return tab;
}

async function injectPageScripts(tabId, scripts) {
  await chrome.scripting.executeScript({ target: { tabId }, files: scripts });
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
}

async function sendToPage(message, scripts = PAGE_SCRIPTS) {
  const tab = await activeHttpTab();
  const pageMessage = {
    ...message,
    type: `${message.type}_V2`,
    protocol: PAGE_MESSAGE_PROTOCOL
  };
  let firstError = null;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, pageMessage);
    if (response === undefined) throw new Error('页面审计脚本尚未加载');
    return response;
  } catch (error) {
    firstError = error;
    await injectPageScripts(tab.id, scripts);
    try {
      const response = await chrome.tabs.sendMessage(tab.id, pageMessage);
      if (response === undefined) throw new Error('Page audit script is not loaded or is out of date. Reload the extension and refresh the page.');
      return response;
    } catch (secondError) {
      throw new Error([
        '页面脚本通信失败',
        `首次发送：${errorSummary(firstError)}`,
        `注入后重试：${errorSummary(secondError)}`
      ].join('；'));
    }
  }
}

$('#profileButton').addEventListener('click', () => chrome.runtime.openOptionsPage());

async function loadProfile() {
  const key = globalThis.ResumeProfileSchema?.storageKey || 'resumeProfileV1';
  const stored = await chrome.storage.local.get(key);
  const record = stored[key];
  const profile = record?.data && typeof record.data === 'object' ? record.data : record;
  if (!profile || typeof profile !== 'object') throw new Error('还没有保存个人资料，请先点击“编辑我的个人资料”。');
  return profile;
}

function reportSummary(report) {
  const dimensions = report.counts?.dimensions || {};
  const fieldItems = report.interactiveElements?.filter((item) => item.elementKind === 'field') || [];
  const mappingCounts = fieldItems.reduce((counts, item) => {
    counts[item.mappingStatus] = (counts[item.mappingStatus] || 0) + 1;
    return counts;
  }, {});
  return [
    `共发现 ${report.counts?.interactive || 0} 个可见交互元素。`,
    `填写元素 ${dimensions.elementKind?.field || 0}，动作元素 ${dimensions.elementKind?.action || 0}，交互区域 ${dimensions.elementKind?.container || 0}。`,
    `字段映射：已映射 ${mappingCounts.mapped || 0}，待确认 ${mappingCounts.ambiguous || 0}，未映射 ${mappingCounts.unmapped || 0}。`
  ].join('\n');
}

function structureSummary(items = []) {
  if (!items.length) return '没有需要补齐的重复经历模块。';
  return items.map((item) => {
    const status = item.status || 'unknown';
    const detected = item.after ?? 0;
    const planned = item.plannedAfter ?? detected;
    const countText = planned > detected
      ? `目标 ${item.desired ?? 0}，原有 ${item.before ?? 0}，检测到 ${detected}，顺序处理到 ${planned}`
      : `目标 ${item.desired ?? 0}，原有 ${item.before ?? 0}，现在 ${detected}`;
    const profileText = Number.isFinite(item.profileEffective) || Number.isFinite(item.profileTotal)
      ? `，资料有效 ${item.profileEffective ?? 0}/${item.profileTotal ?? 0}`
      : '';
    const anchorText = item.profileAnchorValues?.length ? `，资料条目 ${item.profileAnchorValues.join('；')}` : '';
    const sampleText = item.profileSampleFields?.length ? `，样例字段 ${item.profileSampleFields.join('；')}` : '';
    const addText = item.addActionFound === true
      ? `，添加按钮 ${item.addActionRef || '已匹配'}${item.addActionText ? `「${item.addActionText}」` : ''}`
      : item.addActionFound === false
        ? '，添加按钮 未匹配'
        : '';
    const reason = item.reason ? `：${item.reason}` : '';
    return `${item.label || item.section}：${countText}${profileText}${anchorText}${sampleText}${addText}，状态 ${status}${reason}`;
  }).join('\n');
}

function compactPopupText(value, limit = 90) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function dynamicNodeLine(node) {
  const label = compactPopupText(node.text || node.value || node.placeholder || node.data || '', 70);
  const score = Number.isFinite(node.score) ? `/${node.score}` : '';
  const role = node.role ? ` ${node.role}` : '';
  return `#${node.index} ${node.kind || node.tag}${role}${score}${label ? `「${label}」` : ''}`;
}

function dynamicDomText(dom) {
  if (!dom || typeof dom !== 'object') return '';
  const triggerText = dom.trigger ? dynamicNodeLine(dom.trigger) : '无触发器信息';
  const roots = (dom.roots || []).slice(0, 3).map((root) => {
    const nodes = (root.nodes || [])
      .filter((node) => ['option', 'radio', 'checkbox', 'tab', 'input', 'button'].includes(node.kind))
      .slice(0, 14)
      .map(dynamicNodeLine)
      .join('；');
    const rootName = compactPopupText([root.role, root.classHint, root.text].filter(Boolean).join(' '), 110);
    return `root${root.index} ${root.tag}${rootName ? `「${rootName}」` : ''}${nodes ? `\n  元素：${nodes}` : ''}`;
  }).join('\n');
  const candidates = (dom.candidates || []).slice(0, 8).map((item) => `${item[0]}(${item[1]})`).join('、');
  return [
    `目标：${dom.target || ''}${dom.key ? `，key：${dom.key}` : ''}`,
    `触发：${triggerText}`,
    roots,
    candidates ? `候选评分：${candidates}` : ''
  ].filter(Boolean).join('\n');
}

function dynamicDomSummary(items = []) {
  const failures = items.filter((item) => item.dynamicDom).slice(0, 3);
  if (!failures.length) return '';
  return failures.map((item, index) => [
    `${index + 1}. ${item.field || item.ref} → ${item.profilePath || ''}（${item.status}${item.reason ? `：${item.reason}` : ''}）`,
    dynamicDomText(item.dynamicDom)
  ].join('\n')).join('\n\n');
}

function msText(ms) {
  const value = Number(ms || 0);
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function fillProgressSummary(response = {}) {
  const stats = response.progress?.currentEmpty;
  if (stats && Number(stats.total || 0) > 0) {
    const skipped = Number(stats.skipped || 0);
    return `空值字段：已处理或跳过 ${stats.processed || 0}/${stats.total || 0}${skipped ? `，未映射跳过 ${skipped}` : ''}`;
  }
  if (stats && Number(stats.total || 0) === 0) return '空值字段：当前页没有需要补写的空值字段';
  const totals = response.totals || {};
  if (Number(totals.required || 0) > 0) return `字段：完成 ${totals.completed || 0}/${totals.required || 0}`;
  return '字段：没有需要处理的字段';
}

function fillCompletionMessage(response = {}) {
  if (response.canceled) return '已暂停/取消本次填写。';
  const totals = response.totals || {};
  const stats = response.progress?.currentEmpty;
  if (response.complete) {
    if (stats && Number(stats.total || 0) > 0) {
      return `填写完成：已处理或跳过 ${stats.processed || 0}/${stats.total || 0}。`;
    }
    if (stats && Number(stats.total || 0) === 0) {
      return '填写完成：当前页没有需要补写的空值字段。';
    }
    if (Number(totals.required || 0) > 0) {
      return `填写完成：${totals.completed || 0}/${totals.required || 0}。`;
    }
    return '填写完成：当前页没有需要处理的字段。';
  }
  return `填写已结束，还有 ${totals.omitted || 0} 个字段需要检查。`;
}

function performanceSummary(performance) {
  if (!performance || typeof performance !== 'object') return '';
  const lines = [];
  if (performance.stages?.length) {
    lines.push(`阶段耗时：${performance.stages.map((stage) => `${stage.name} ${msText(stage.ms)}`).join('，')}`);
  }
  if (performance.fieldStats) {
    const stats = performance.fieldStats;
    lines.push(`字段扫描：页面字段 ${stats.totalControls || 0}，映射可填 ${stats.mappedFillable || 0}，空值待填 ${stats.currentEmptyMapped || 0}，已有值跳过 ${stats.currentFilledMapped || 0}，未映射跳过 ${stats.unmappedSkipped || 0}`);
  }
  if (performance.byOperation?.length) {
    lines.push(`操作耗时：${performance.byOperation.map((item) => `${item.operation || 'unknown'} ${item.count || 0}项/${msText(item.ms)}`).join('，')}`);
  }
  if (performance.byComponent?.length) {
    lines.push(`组件耗时：\n${performance.byComponent.slice(0, 10).map((item) => {
      const slowest = item.slowestField || item.slowestRef ? `，最慢 ${item.slowestField || item.slowestRef} ${msText(item.maxMs)}` : '';
      return `${item.component || 'unknown'}（${item.operation || 'unknown'}）：${item.count || 0}项，总 ${msText(item.ms)}，平均 ${msText(item.avgMs)}${slowest}`;
    }).join('\n')}`);
  }
  if (performance.slowFields?.length) {
    lines.push(`最慢字段：\n${performance.slowFields.slice(0, 10).map((item) => `${item.field || item.ref} → ${item.profilePath || ''}（${item.controlKind || item.operation || item.legacyType || ''}，${msText(item.ms)}，${item.status || ''}${item.reason ? `：${item.reason}` : ''}）`).join('\n')}`);
  }
  if (performance.slowSteps?.length) {
    lines.push(`最慢组件步骤：\n${performance.slowSteps.slice(0, 15).map((item) => {
      const meta = [
        item.phase ? `phase=${item.phase}` : '',
        item.ok === undefined ? '' : `ok=${item.ok}`,
        item.timeout ? `timeout=${item.timeout}` : '',
        item.trustedTimeout ? `trustedTimeout=${item.trustedTimeout}` : '',
        item.error ? `error=${item.error}` : ''
      ].filter(Boolean).join(', ');
      return `${item.field || item.ref || ''} → ${item.profilePath || ''} | ${item.component || item.controlKind || item.legacyType || item.operation || ''}.${item.step || ''} | ${msText(item.ms)}${meta ? ` | ${meta}` : ''}`;
    }).join('\n')}`);
  }
  return lines.join('\n');
}

function debugTraceSummary(debug) {
  if (!debug?.enabled) return '';
  const entries = Array.isArray(debug.entries) ? debug.entries : [];
  const fieldResults = entries.filter((item) => item.event === 'field-result');
  const suspicious = fieldResults.filter((item) => !['filled', 'kept-existing'].includes(item.status || '')).slice(-12);
  const recent = entries.slice(-24);
  const lines = [
    `Debug run: ${debug.runId || ''}`,
    `Trace entries: ${entries.length}; field results: ${fieldResults.length}; suspicious: ${suspicious.length}`
  ];
  if (suspicious.length) {
    lines.push('Suspicious fields:');
    lines.push(suspicious.map((item) => [
      item.stage || item.operation || '',
      item.field || item.ref || '',
      item.profilePath || '',
      item.status || '',
      item.reason || '',
      item.ms ? `${item.ms}ms` : ''
    ].filter(Boolean).join(' | ')).join('\n'));
  }
  if (recent.length) {
    lines.push('Recent trace:');
    lines.push(recent.map((item) => [
      item.event,
      item.stage || item.operation || '',
      item.field || item.ref || '',
      item.status || '',
      item.reason || ''
    ].filter(Boolean).join(' | ')).join('\n'));
  }
  return lines.join('\n');
}

function fillSummary(response) {
  if (response.canceled) {
    const performance = performanceSummary(response.performance);
    const debug = debugTraceSummary(response.debug);
    return [`已取消本次填写。`, response.message || '', debug ? `Debug trace:\n${debug}` : '', performance ? `执行统计：\n${performance}` : ''].filter(Boolean).join('\n');
  }
  const totals = response.totals || {};
  const lines = [
    `填写完成：${response.complete ? '是' : '否'}`,
    `字段：完成 ${totals.completed || 0}/${totals.required || 0}，实际写入 ${totals.filled || 0}，待审核 ${totals.manualReview || 0}，遗漏 ${totals.omitted || 0}`,
    `经历段数：\n${structureSummary(response.structures || [])}`
  ];
  const progress = fillProgressSummary(response);
  if (progress) lines.splice(1, 0, progress);
  if (response.sequential?.length) lines.push(`顺序填写：\n${structureSummary(response.sequential)}`);
  if (response.omissions?.length) {
    lines.push(`前 8 个遗漏：\n${response.omissions.slice(0, 8).map((item) => `${item.field || item.ref} → ${item.profilePath || ''}（${item.status}${item.reason ? `：${item.reason}` : ''}）`).join('\n')}`);
  }
  const dynamic = dynamicDomSummary(response.omissions || []);
  if (dynamic) lines.push(`动态弹层摘要：\n${dynamic}`);
  const debug = debugTraceSummary(response.debug);
  if (debug) lines.push(`Debug trace:\n${debug}`);
  const performance = performanceSummary(response.performance);
  if (performance) lines.push(`执行统计：\n${performance}`);
  return lines.join('\n');
}

$('#auditButton').addEventListener('click', async () => {
  const button = $('#auditButton');
  button.disabled = true;
  button.textContent = '…';
  const debug = Boolean($('#debugInput')?.checked);
  try {
    const report = await sendToPage({ type: 'RESUME_PAGE_AUDIT_SHOW' });
    const summary = `${reportSummary(report)}\n详细结果已显示在网页右侧。`;
    showResult({
      message: '解析完成，详细结构已显示在页面右侧。',
      info: true,
      logText: debug ? responseLog('页面解析日志', summary, report) : '',
      logName: `resume-page-audit-${timestampForFile()}.txt`
    });
  } catch (error) {
    const reason = errorSummary(error);
    showResult({
      message: debug ? `页面解析失败：${reason}。详细原因已写入日志。` : `页面解析失败：${reason}。`,
      error: true,
      logText: debug ? errorLog('页面解析失败', error) : '',
      logName: `resume-page-audit-error-${timestampForFile()}.txt`
    });
  } finally {
    button.disabled = false;
    button.textContent = '解';
  }
});

$('#debugInput')?.addEventListener('change', async (event) => {
  if (event.target.checked) return;
  try {
    await sendToPage({ type: 'RESUME_AUTOFILL_DEBUG_OVERLAY_CLEAR' }, PAGE_SCRIPTS);
  } catch (_) {}
});

$('#fillButton').addEventListener('click', async () => {
  const button = $('#fillButton');
  button.disabled = true;
  button.textContent = '正在填写…';
  let debug = Boolean($('#debugInput')?.checked);
  try {
    const profile = await loadProfile();
    const overwrite = Boolean($('#overwriteInput')?.checked);
    debug = Boolean($('#debugInput')?.checked);
    const response = await sendToPage({ type: 'RESUME_PROFILE_FILL_CURRENT_PAGE', profile, overwrite, debug }, FILL_SCRIPTS);
    if (!response?.ok && response?.debug?.enabled) {
      const trace = debugTraceSummary(response.debug);
      throw new Error([response.error || '填写当前页面失败', trace ? `Debug trace:\n${trace}` : ''].filter(Boolean).join('\n'));
    }
    if (!response?.ok) throw new Error(response?.error || '填写当前页面失败');
    const summary = fillSummary(response);
    const message = fillCompletionMessage(response);
    showResult({
      message,
      error: !response.complete && !response.canceled,
      logText: debug ? responseLog('当前页面填写日志', summary, response) : '',
      logName: `resume-autofill-${timestampForFile()}.txt`
    });
  } catch (error) {
    const reason = errorSummary(error);
    showResult({
      message: debug ? `填写当前页面失败：${reason}。详细原因已写入日志。` : `填写当前页面失败：${reason}。`,
      error: true,
      logText: debug ? errorLog('填写当前页面失败', error) : '',
      logName: `resume-autofill-error-${timestampForFile()}.txt`
    });
  } finally {
    button.disabled = false;
    button.textContent = '填写当前页面';
  }
});

window.addEventListener('unload', revokeLastLogUrl);
