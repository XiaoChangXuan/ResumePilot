const form = document.querySelector('#profileForm');
const state = document.querySelector('#saveState');
const parseResult = document.querySelector('#parseResult');
const resumeFileState = document.querySelector('#resumeFileState');
const textPreview = document.querySelector('#textPreview');
const resumeInput = document.querySelector('#resumeInput');
const resumeDrop = document.querySelector('#resumeDrop');
import { inferProfile } from './resume-parser.mjs';
import { migrateLegacyResumeFile, removeResumeFile, saveResumeFile } from './resume-file-store.js';
import { AI_GATEWAY_URL, clearAIConfig, loadAIConfig, requestAIGatewayPermission, saveAIConfig } from './ai-client.js';

function setState(text, saved = false) {
  state.textContent = text;
  state.className = saved ? 'save-state saved' : 'save-state';
}

function showParseResult(text, error = false) {
  parseResult.textContent = text;
  parseResult.className = error ? 'parse-result error' : 'parse-result show';
}

const entryKinds = ['family', 'education', 'work', 'project', 'certificate', 'language'];

const aiConfigForm = document.querySelector('#aiConfigForm');
const aiGatewayUrl = document.querySelector('#aiGatewayUrl');
const aiModel = document.querySelector('#aiModel');
const aiApiKey = document.querySelector('#aiApiKey');
const aiConfigState = document.querySelector('#aiConfigState');

function setAIConfigState(text, kind = '') {
  aiConfigState.textContent = text;
  aiConfigState.className = `ai-config-state${kind ? ` ${kind}` : ''}`;
}

async function loadAISettings() {
  const config = await loadAIConfig();
  aiGatewayUrl.value = AI_GATEWAY_URL;
  aiModel.value = config.model;
  aiApiKey.value = config.apiKey;
  const complete = Boolean(config.model && config.apiKey);
  setAIConfigState(complete ? '已保存；可用于候选选择和缺失文本生成' : '尚未完整配置', complete ? 'saved' : '');
}

const DIRECT_ADMINISTRATIONS = /^(?:北京市|上海市|天津市|重庆市|香港特别行政区|澳门特别行政区)$/;

function splitLocationPath(value) {
  const raw = String(value || '').replace(/[\s,，/／>]+/g, '').trim();
  if (!raw) return [];
  const parts = raw.match(/.+?(?:特别行政区|自治区|自治州|省|市|地区|盟|区|县|旗)(?=.+|$)/g) || [];
  const consumed = parts.join('');
  const remainder = raw.startsWith(consumed) ? raw.slice(consumed.length) : '';
  if (remainder) parts.push(remainder);
  return parts.length ? parts : [raw];
}

function nativePlaceLevels(profile = {}) {
  const explicit = [profile.nativePlaceProvince, profile.nativePlaceCity, profile.nativePlaceDistrict].map((value) => String(value || '').trim());
  if (explicit.some(Boolean)) return explicit;
  const parsed = splitLocationPath(profile.nativePlace);
  const province = parsed[0] || '';
  if (DIRECT_ADMINISTRATIONS.test(province) && parsed.length === 2) return [province, province, parsed[1]];
  return [province, parsed[1] || '', parsed[2] || ''];
}

function normalizeEnglishLevel(value) {
  const text = String(value || '').trim();
  if (/^(?:c[et]{2}|cet)\s*[-－]?\s*6$|大学英语六级|英语六级|^六级$/i.test(text)) return 'CET-6';
  if (/^(?:c[et]{2}|cet)\s*[-－]?\s*4$|大学英语四级|英语四级|^四级$/i.test(text)) return 'CET-4';
  if (/^tem\s*[-－]?\s*8$|英语专业八级|^专八$/i.test(text)) return 'TEM-8';
  if (/^tem\s*[-－]?\s*4$|英语专业四级|^专四$/i.test(text)) return 'TEM-4';
  return text;
}

function readEntries(kind) {
  return [...document.querySelectorAll(`.entry[data-kind="${kind}"]`)]
    .map((entry) => Object.fromEntries([...entry.querySelectorAll('[data-field]')].map((field) => [field.dataset.field, field.value.trim()])))
    .filter((entry) => Object.values(entry).some(Boolean));
}

function profileFromForm() {
  const profile = Object.fromEntries(new FormData(form).entries());
  const nativePlaceParts = [profile.nativePlaceProvince, profile.nativePlaceCity, profile.nativePlaceDistrict]
    .map((value) => String(value || '').trim()).filter(Boolean);
  profile.nativePlace = nativePlaceParts.filter((value, index) => index === 0 || value !== nativePlaceParts[index - 1]).join('');
  for (const kind of entryKinds) profile[`${kind}Entries`] = readEntries(kind);
  profile.englishLevel = normalizeEnglishLevel(profile.englishLevel);
  if (profile.educationEntries.length) {
    profile.educationEntries = profile.educationEntries.map((entry) => ({
      ...entry,
      isHighest: entry.isHighest === 'yes' ? '是' : entry.isHighest === 'no' ? '否' : entry.isHighest
    }));
    const explicitHighest = profile.educationEntries.some((entry) => entry.isHighest === '是');
    if (!explicitHighest) profile.educationEntries = profile.educationEntries.map((entry, index) => ({ ...entry, isHighest: index === profile.educationEntries.length - 1 ? '是' : '否' }));
    const highestIndex = profile.educationEntries.findIndex((entry) => entry.isHighest === '是');
    if (highestIndex >= 0) {
      profile.educationEntries[highestIndex] = {
        ...profile.educationEntries[highestIndex],
        degree: profile.degree || profile.educationEntries[highestIndex].degree,
        endDate: profile.graduationDate || profile.educationEntries[highestIndex].endDate
      };
    }
  }

  if (profile.englishLevel) {
    const englishIndex = profile.languageEntries.findIndex((entry) => /^(?:英语|英文|english)$/i.test(entry.name || ''));
    const englishEntry = {
      name: '英语',
      proficiency: profile.englishLevel,
      certificate: profile.englishLevel,
      listeningSpeaking: profile.englishListeningSpeaking || '',
      readingWriting: profile.englishReadingWriting || '',
      score: ''
    };
    if (englishIndex >= 0) profile.languageEntries[englishIndex] = { ...profile.languageEntries[englishIndex], ...englishEntry };
    else profile.languageEntries.unshift(englishEntry);
  }

  const education = profile.educationEntries.find((entry) => entry.isHighest === '是') || profile.educationEntries.at(-1) || {};
  const work = profile.workEntries[0] || {};
  const family = profile.familyEntries[0] || {};
  const project = profile.projectEntries[0] || {};
  const certificate = profile.certificateEntries[0] || {};
  const language = profile.languageEntries.find((entry) => /^(?:英语|英文|english)$/i.test(entry.name || '')) || profile.languageEntries[0] || {};
  return {
    ...profile,
    school: education.school || '', college: education.college || '', major: education.major || '', degree: profile.degree || education.degree || '',
    academicDegree: education.academicDegree || '', studyMode: education.studyMode || '', isHighestEducation: education.isHighest || '', educationStartDate: education.startDate || '',
    graduationDate: profile.graduationDate || education.endDate || '', gpa: education.gpa || '', ranking: education.ranking || '', rankingPercent: education.rankingPercent || '',
    company: work.company || '', currentTitle: work.title || '', department: work.department || '', workStartDate: work.startDate || '',
    workEndDate: work.endDate || '', workDescription: work.description || '', workType: work.type || '',
    familyName: family.name || '', familyRelationship: family.relationship || '', familyPhone: family.phone || '',
    familyWorkplace: family.workplace || '', familyOccupation: family.occupation || '',
    projectName: project.name || '', projectRole: project.role || '', projectStartDate: project.startDate || '',
    projectEndDate: project.endDate || '', projectDescription: project.description || '',
    certificateName: certificate.name || '', certificateDate: certificate.date || '', certificateNumber: certificate.number || '',
    certificateIssuer: certificate.issuer || '', certificateLevel: certificate.level || '',
    certificateDescription: certificate.description || '', englishLevel: profile.englishLevel || normalizeEnglishLevel(language.certificate || language.proficiency),
    englishListeningSpeaking: profile.englishListeningSpeaking || language.listeningSpeaking || '', englishReadingWriting: profile.englishReadingWriting || language.readingWriting || '',
    languageName: language.name || '', languageProficiency: language.proficiency || '', languageCertificate: language.certificate || '', languageScore: language.score || '',
    languageListeningSpeaking: language.listeningSpeaking || '', languageReadingWriting: language.readingWriting || ''
  };
}

function addEntry(kind, value = {}) {
  const template = document.querySelector(`#${kind}Template`);
  const container = document.querySelector(`#${kind}Entries`);
  const entry = template.content.firstElementChild.cloneNode(true);
  for (const field of entry.querySelectorAll('[data-field]')) {
    let fieldValue = value[field.dataset.field] || '';
    if (kind === 'education' && field.dataset.field === 'isHighest') {
      fieldValue = fieldValue === 'yes' ? '是' : fieldValue === 'no' ? '否' : fieldValue;
    }
    if (kind === 'education' && field.dataset.field === 'academicDegree') {
      fieldValue = /双学士/.test(fieldValue) ? '双学士' : /MBA|工商管理硕士/i.test(fieldValue) ? 'MBA' : /博士/.test(fieldValue) ? '博士' : /硕士|学硕|专硕/.test(fieldValue) ? '硕士' : /学士/.test(fieldValue) ? '学士' : '';
    }
    if (kind === 'education' && field.dataset.field === 'degree') {
      fieldValue = /MBA|工商管理硕士/i.test(fieldValue) ? 'MBA' : /博士/.test(fieldValue) ? '博士' : /硕士|研究生|学硕|专硕/.test(fieldValue) ? '硕士' : /本科|学士/.test(fieldValue) ? '本科' : /大专|专科/.test(fieldValue) ? '大专' : /高中/.test(fieldValue) ? '高中' : /中专/.test(fieldValue) ? '中专' : /初中/.test(fieldValue) ? '初中及以下' : '';
    }
    field.value = fieldValue;
  }
  entry.querySelector('[data-remove]').addEventListener('click', () => {
    entry.remove();
    renumberEntries(kind);
    setState('有未保存的修改');
  });
  entry.querySelectorAll('[data-field]').forEach((field) => field.addEventListener('input', () => setState('有未保存的修改')));
  container.appendChild(entry);
  renumberEntries(kind);
  return entry;
}

function renumberEntries(kind) {
  [...document.querySelectorAll(`.entry[data-kind="${kind}"]`)].forEach((entry, index) => {
    const labels = { family: '家庭成员', education: '教育经历', work: '实习 / 工作经历', project: '项目经历', certificate: '证书', language: '语言情况' };
    entry.querySelector('.entry-head strong').textContent = `${labels[kind]} ${index + 1}`;
  });
}

function populateForm(profile = {}, onlyEmpty = false) {
  const savedEnglish = profile.languageEntries?.find((entry) => /^(?:英语|英文|english)$/i.test(entry.name || ''));
  const [nativePlaceProvince, nativePlaceCity, nativePlaceDistrict] = nativePlaceLevels(profile);
  profile = {
    ...profile,
    nativePlaceProvince: profile.nativePlaceProvince || nativePlaceProvince,
    nativePlaceCity: profile.nativePlaceCity || nativePlaceCity,
    nativePlaceDistrict: profile.nativePlaceDistrict || nativePlaceDistrict,
    englishLevel: normalizeEnglishLevel(profile.englishLevel || savedEnglish?.certificate || savedEnglish?.proficiency || '')
    , englishListeningSpeaking: profile.englishListeningSpeaking || savedEnglish?.listeningSpeaking || ''
    , englishReadingWriting: profile.englishReadingWriting || savedEnglish?.readingWriting || ''
  };
  let filled = 0;
  for (const element of form.elements) {
    if (!element.name || !Object.hasOwn(profile, element.name)) continue;
    if (onlyEmpty && element.value.trim()) continue;
    const nextValue = profile[element.name] ?? '';
    if (nextValue !== '') {
      element.value = nextValue;
      filled += 1;
    }
  }
  if (!onlyEmpty) {
    for (const kind of entryKinds) {
      document.querySelector(`#${kind}Entries`).replaceChildren();
      let values = profile[`${kind}Entries`] || [];
      if (!values.length && kind === 'education' && (profile.school || profile.major || profile.degree)) {
        values = [{ school: profile.school, major: profile.major, degree: profile.degree, academicDegree: profile.academicDegree, studyMode: profile.studyMode, endDate: profile.graduationDate, gpa: profile.gpa, ranking: profile.ranking, rankingPercent: profile.rankingPercent }];
      }
      if (!values.length && kind === 'work' && (profile.company || profile.currentTitle || profile.workDescription)) {
        values = [{ company: profile.company, title: profile.currentTitle, startDate: profile.workStartDate, endDate: profile.workEndDate, description: profile.workDescription }];
      }
      if (values.length) values.forEach((value) => addEntry(kind, value));
      else addEntry(kind);
    }
  } else {
    for (const kind of entryKinds) {
      const values = profile[`${kind}Entries`] || [];
      if (!values.length) continue;
      const existing = readEntries(kind);
      if (!existing.length) {
        document.querySelector(`#${kind}Entries`).replaceChildren();
        values.forEach((value) => addEntry(kind, value));
        filled += values.reduce((total, value) => total + Object.values(value).filter(Boolean).length, 0);
      }
    }
  }
  return filled;
}

async function loadProfile() {
  const { profile = {} } = await chrome.storage.local.get('profile');
  populateForm(profile);
  setState(Object.keys(profile).length ? '已载入本地资料' : '尚未保存', Boolean(Object.keys(profile).length));
}

async function readPdfText(bytes) {
  const pdfjs = await import(chrome.runtime.getURL('libs/pdf.min.mjs'));
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.mjs');
  const documentTask = pdfjs.getDocument({ data: bytes });
  const pdf = await documentTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages.join('\n');
}

async function readDocxText(bytes) {
  const archive = await JSZip.loadAsync(bytes);
  const entry = archive.file('word/document.xml');
  if (!entry) throw new Error('DOCX 中没有找到正文内容');
  const xml = await entry.async('string');
  const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
  return [...documentXml.getElementsByTagNameNS('*', 'p')]
    .map((paragraph) => [...paragraph.getElementsByTagNameNS('*', 't')].map((node) => node.textContent).join(''))
    .filter(Boolean)
    .join('\n');
}

async function extractText(file, bytes) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return readPdfText(bytes);
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) return readDocxText(bytes);
  if (name.endsWith('.txt') || file.type.startsWith('text/')) return new TextDecoder('utf-8').decode(bytes);
  throw new Error('暂只支持 PDF、DOCX 和 TXT');
}

function clean(value) {
  return String(value || '').replace(/[|｜]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanDocumentText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[|｜]/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

async function saveOriginalResume(file) {
  await saveResumeFile(file);
  await chrome.storage.local.remove('storedResumeFile');
}

async function updateResumeFileState() {
  const { record: file, migrated, legacyIncomplete } = await migrateLegacyResumeFile();
  if (!file) {
    resumeFileState.textContent = legacyIncomplete?.name
      ? `旧附件记录不完整：${legacyIncomplete.name}（请重新导入，文件将另存到独立附件仓库）`
      : '尚未保存简历附件';
    resumeFileState.className = 'resume-file-state';
    return;
  }
  resumeFileState.className = 'resume-file-state saved';
  resumeFileState.replaceChildren(document.createTextNode(
    `${migrated ? '旧附件已迁移并' : ''}保存到独立附件仓库：${file.name}（${Math.ceil(file.blob.size / 1024)} KB）`
  ));
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '删除附件';
  button.addEventListener('click', async () => {
    await removeResumeFile();
    await updateResumeFileState();
  });
  resumeFileState.appendChild(button);
}

async function handleResume(file) {
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    showParseResult('文件超过 50 MB。请压缩简历或使用更小的 PDF/DOCX。', true);
    return;
  }
  showParseResult(`正在本地解析 ${file.name}…`);
  try {
    if (document.querySelector('#keepResumeFile').checked) {
      await saveOriginalResume(file);
      await updateResumeFileState();
    }
    // PDF.js 可能转移传入 ArrayBuffer 的所有权；解析始终使用单独副本，绝不复用已保存附件的 Blob。
    const parseBytes = new Uint8Array(await file.arrayBuffer());
    const text = cleanDocumentText(await extractText(file, parseBytes));
    if (text.length < 30) throw new Error('没有提取到足够文字；如果是扫描版 PDF，需要先进行 OCR');
    const inferred = inferProfile(text);
    const recognized = Object.fromEntries(Object.entries(inferred).filter(([, value]) => Array.isArray(value) ? value.length : value));
    const filled = populateForm(recognized, true);
    await chrome.storage.local.set({ profile: profileFromForm() });
    textPreview.querySelector('pre').textContent = text.slice(0, 15000);
    textPreview.hidden = false;
    const collectionKeys = new Set(['educationEntries', 'workEntries', 'projectEntries', 'certificateEntries', 'languageEntries', 'familyEntries']);
    const baseFields = Object.entries(recognized).filter(([key, value]) => !collectionKeys.has(key) && !Array.isArray(value)).length;
    const sections = [
      inferred.educationEntries?.length ? `教育 ${inferred.educationEntries.length} 段` : '',
      inferred.workEntries?.length ? `工作/实习 ${inferred.workEntries.length} 段` : '',
      inferred.projectEntries?.length ? `项目 ${inferred.projectEntries.length} 段` : '',
      inferred.certificateEntries?.length ? `证书 ${inferred.certificateEntries.length} 项` : '',
      inferred.languageEntries?.length ? `语言 ${inferred.languageEntries.length} 项` : ''
    ].filter(Boolean);
    showParseResult(`解析完成：识别到基础资料 ${baseFields} 项${sections.length ? `，${sections.join('，')}` : ''}；新填入 ${filled} 个空白值。请逐项检查并补充缺失内容。`);
    setState('解析结果已保存，请检查', true);
    await updateResumeFileState();
  } catch (error) {
    showParseResult(`解析失败：${error.message}`, true);
  } finally {
    resumeInput.value = '';
  }
}

form.addEventListener('input', () => setState('有未保存的修改'));
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await chrome.storage.local.set({ profile: profileFromForm() });
  setState('保存成功', true);
});

resumeInput.addEventListener('change', (event) => handleResume(event.target.files[0]));
for (const eventName of ['dragenter', 'dragover']) {
  resumeDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    resumeDrop.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  resumeDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    resumeDrop.classList.remove('dragging');
  });
}
resumeDrop.addEventListener('drop', (event) => handleResume(event.dataTransfer.files[0]));
document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
  addEntry(button.dataset.add);
  setState('有未保存的修改');
}));

document.querySelector('#exportButton').addEventListener('click', () => {
  const data = JSON.stringify(profileFromForm(), null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'resume-autofill-profile.json';
  anchor.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#importInput').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const profile = JSON.parse(await file.text());
    if (!profile || Array.isArray(profile) || typeof profile !== 'object') throw new Error('格式错误');
    populateForm(profile);
    await chrome.storage.local.set({ profile: profileFromForm() });
    setState('导入并保存成功', true);
  } catch {
    setState('导入失败：不是有效的 JSON 资料文件');
  } finally {
    event.target.value = '';
  }
});

document.querySelector('#clearProfile').addEventListener('click', async () => {
  if (!confirm('确定清空保存在这个 Chrome 中的全部求职资料吗？简历附件不会被删除。')) return;
  form.reset();
  await chrome.storage.local.remove('profile');
  setState('资料已清空');
});

aiConfigForm.addEventListener('input', () => setAIConfigState('AI 配置有未保存的修改'));
aiConfigForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const model = aiModel.value.trim();
  const apiKey = aiApiKey.value.trim();
  if (!model || !apiKey) {
    setAIConfigState(`请补充${!model ? '模型名' : 'API Key'}`, 'error');
    return;
  }
  try {
    const permitted = await requestAIGatewayPermission();
    await saveAIConfig({ model, apiKey });
    setAIConfigState(permitted ? '保存成功；已启用候选选择和缺失文本生成' : '配置已保存，但未授权访问 AI 网关', permitted ? 'saved' : 'error');
  } catch (error) {
    setAIConfigState(`保存失败：${error?.message || error}`, 'error');
  }
});

document.querySelector('#toggleAiApiKey').addEventListener('click', (event) => {
  const showing = aiApiKey.type === 'text';
  aiApiKey.type = showing ? 'password' : 'text';
  event.currentTarget.textContent = showing ? '显示' : '隐藏';
  event.currentTarget.setAttribute('aria-label', showing ? '显示 API Key' : '隐藏 API Key');
});

document.querySelector('#clearAiConfig').addEventListener('click', async () => {
  if (!confirm('确定清除保存在当前 Chrome 中的模型名和 API Key 吗？')) return;
  await clearAIConfig();
  aiModel.value = '';
  aiApiKey.value = '';
  aiApiKey.type = 'password';
  document.querySelector('#toggleAiApiKey').textContent = '显示';
  setAIConfigState('AI 配置已清除');
});

textPreview.hidden = true;
await Promise.all([loadProfile(), updateResumeFileState(), loadAISettings()]);
