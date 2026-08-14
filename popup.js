import { migrateLegacyResumeFile } from './resume-file-store.js';

const $ = (selector) => document.querySelector(selector);
const resultEl = $('#result');
const fillButton = $('#fillButton');
const uploadResumeButton = $('#uploadResumeButton');

function showResult(message, isError = false) {
  resultEl.textContent = message;
  resultEl.className = isError ? 'result error' : 'result show';
}

async function getProfile() {
  const { profile = {} } = await chrome.storage.local.get('profile');
  return profile;
}

async function getStoredResumeFile() {
  const { record, legacyIncomplete } = await migrateLegacyResumeFile();
  return { record, legacyIncomplete };
}

function encodeBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function makeUploadPayload(record) {
  const bytes = new Uint8Array(await record.blob.arrayBuffer());
  if (!bytes.length) throw new Error('独立附件仓库中的文件为空，请重新导入 PDF');
  return {
    name: record.name,
    type: record.type || record.blob.type || 'application/octet-stream',
    size: bytes.length,
    lastModified: record.lastModified,
    base64: encodeBase64(bytes)
  };
}

async function updateProfileStatus() {
  const [profile, resumeState] = await Promise.all([
    getProfile(),
    getStoredResumeFile()
  ]);
  const { record: resumeFile, legacyIncomplete } = resumeState;
  const coreFields = [profile.fullName, profile.phone, profile.email].filter(Boolean).length;
  if (coreFields === 3) {
    $('#profileStatus').textContent = `资料已就绪：${profile.fullName}`;
    fillButton.disabled = false;
  } else {
    $('#profileStatus').textContent = '请先填写姓名、手机和邮箱';
    $('#profileStatus').classList.add('warn');
    fillButton.disabled = true;
  }
  const completeResume = Boolean(resumeFile?.name && resumeFile?.blob?.size > 0);
  $('#resumeStatus').textContent = completeResume
    ? `已保存附件：${resumeFile.name}（独立仓库 ${Math.ceil(resumeFile.blob.size / 1024)} KB）`
    : legacyIncomplete?.name
      ? `旧附件记录不完整：${legacyIncomplete.name}（请重新导入）`
      : '未保存简历附件；仍可填写文字字段';
  uploadResumeButton.disabled = !completeResume;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToPage(message) {
  const tab = await getActiveTab();
  if (!tab?.id || !/^https?:/i.test(tab.url || '')) {
    throw new Error('当前页面不允许插件填写，请打开普通网页后重试。');
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    if (response === undefined) throw new Error('页面中没有对应版本的填写脚本');
    return response;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

uploadResumeButton.addEventListener('click', async () => {
  uploadResumeButton.disabled = true;
  fillButton.disabled = true;
  uploadResumeButton.textContent = '正在上传并等待网站解析…';
  showResult('阶段 1/5：正在读取本地保存的简历…');
  try {
    const { record } = await getStoredResumeFile();
    if (!record?.blob?.size) {
      showResult('1. 本地简历：读取失败\n原因：独立附件仓库中没有完整文件；请在“编辑我的资料”中重新选择并导入 PDF。', true);
      return;
    }
    const resumeFile = await makeUploadPayload(record);
    showResult(`阶段 1/5：已读取 ${resumeFile.name}，正在定位网页上传框…`);
    const summary = await sendToPage({
      type: 'RESUME_AUTOFILL_UPLOAD_ONLY_V2',
      resumeFile,
      overwrite: $('#overwrite').checked
    });
    if (!summary.resumeStored) {
      showResult(`1. 本地简历：传送到网页脚本失败\n原因：${summary.reason || '网页脚本没有收到附件正文。'}`, true);
      return;
    }
    const stages = [
      `1. 本地简历：${summary.resumeStored ? `已读取 ${summary.fileName || ''}` : '没有保存'}`,
      `2. 文件上传框：${summary.targetFound ? `已找到${summary.targetKind === 'parse' ? '“快速解析简历”入口' : summary.targetKind === 'attachment' ? '“简历附件”入口' : '简历入口'}（页面共有 ${summary.totalFileInputs || 0} 个文件框）` : `未找到（页面共有 ${summary.totalFileInputs || 0} 个文件框）`}`,
      `3. 放入文件：${summary.injected ? '成功' : '失败'}`,
      `4. 触发网站：${summary.dropFallback ? '已追加拖拽 drop 事件' : summary.injected ? '已触发 input/change' : '未触发'}`,
      `5. 网站解析：${summary.accepted ? (summary.completed ? `已响应并稳定（等待 ${Math.ceil((summary.waitedMs || 0) / 1000)} 秒）` : '已响应，但等待解析超时') : '没有观察到网站接收或解析'}`
    ];
    const candidates = (summary.candidates || []).length
      ? `\n发现的上传入口：\n${summary.candidates.map((candidate) => `- ${candidate.kind === 'parse' ? '快速解析' : candidate.kind === 'attachment' ? '普通附件' : '简历'}：${candidate.text.slice(0, 80)}`).join('\n')}`
      : '';
    if (summary.accepted) {
      showResult(`${stages.join('\n')}${candidates}\n\n现在可以点击“② 补充填写当前页面”。`);
    } else {
      const reason = summary.reason ? `\n原因：${summary.reason}` : '';
      showResult(`${stages.join('\n')}${candidates}${reason}`, true);
    }
  } catch (error) {
    showResult(`上传流程失败：${error.message || error}`, true);
  } finally {
    const { record } = await getStoredResumeFile();
    uploadResumeButton.disabled = !record?.blob?.size;
    fillButton.disabled = false;
    uploadResumeButton.textContent = '① 先上传并解析简历';
  }
});

fillButton.addEventListener('click', async () => {
  fillButton.disabled = true;
  fillButton.textContent = '正在识别并填写…';
  try {
    const profile = await getProfile();
    const summary = await sendToPage({
      type: 'RESUME_AUTOFILL_FILL',
      profile,
      overwrite: $('#overwrite').checked
    });
    const examples = [];
    if (summary.details?.unmatched?.length) examples.push(`未识别示例：${summary.details.unmatched.slice(0, 3).join('、')}`);
    if (summary.details?.missingData?.length) examples.push(`资料为空示例：${summary.details.missingData.slice(0, 3).join('、')}`);
    if (summary.details?.unsupported?.length) examples.push(`控件不兼容示例：${summary.details.unsupported.slice(0, 3).join('、')}`);
    const sectionText = `${summary.sectionsAdded ? `已新增经历表单 ${summary.sectionsAdded} 段；` : ''}${summary.sectionAddFailed ? `仍缺少经历表单 ${summary.sectionAddFailed} 段；` : ''}`;
    const sectionPlan = (summary.sectionPlan || []).length
      ? `\n重复区块检查：${summary.sectionPlan.map((item) => `${item.label} 资料${item.desired}段/原有${item.existing}段/新增${item.added}段/最终${item.final}段`).join('；')}`
      : '';
    const timingText = summary.timings?.totalMs !== undefined
      ? `\n耗时：总计 ${(summary.timings.totalMs / 1000).toFixed(1)} 秒（新增区块 ${(summary.timings.sectionSetupMs / 1000).toFixed(1)} 秒，快速字段 ${((summary.timings.fastFieldsMs || 0) / 1000).toFixed(1)} 秒，动态控件 ${(summary.timings.controlsMs / 1000).toFixed(1)} 秒）`
      : '';
    const slowText = (summary.slowFields || []).length
      ? `\n最慢字段：${summary.slowFields.slice(0, 5).map((item) => `${item.field}→${item.key} ${(item.ms / 1000).toFixed(2)}秒${item.ok ? '' : '（失败）'}`).join('；')}`
      : '';
    showResult(`补填完成：已填写 ${summary.filled} 项；${sectionText}跳过已有内容 ${summary.existing} 项；未识别字段 ${summary.unmatched} 项；资料为空 ${summary.missingData || 0} 项；控件不兼容 ${summary.unsupported || 0} 项。${sectionPlan}${timingText}${slowText}${examples.length ? `\n${examples.join('\n')}` : ''}`);
  } catch (error) {
    showResult(error.message || '填写失败，请刷新页面后重试。', true);
  } finally {
    fillButton.disabled = false;
    fillButton.textContent = '② 补充填写当前页面';
  }
});

$('#optionsButton').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#diagnoseButton').addEventListener('click', async () => {
  try {
    const diagnosis = await sendToPage({ type: 'RESUME_AUTOFILL_DIAGNOSE' });
    await navigator.clipboard.writeText(JSON.stringify(diagnosis, null, 2));
    showResult(`诊断信息已复制：检测到 ${diagnosis.controls.length} 个控件、${diagnosis.iframes.length} 个 iframe。它不包含输入值和本地简历资料，请粘贴给我分析。`);
  } catch (error) {
    showResult(`复制诊断信息失败：${error.message}`, true);
  }
});
$('#clearButton').addEventListener('click', async () => {
  try {
    await sendToPage({ type: 'RESUME_AUTOFILL_CLEAR' });
    showResult('已清除页面上的颜色标记，已写入的内容不会被删除。');
  } catch (error) {
    showResult(error.message, true);
  }
});

updateProfileStatus();
