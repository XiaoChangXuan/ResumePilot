const schema = globalThis.ResumeProfileSchema;
const form = document.querySelector('#profileForm');
const saveState = document.querySelector('#saveState');
const stats = document.querySelector('#profileStats');
const nav = document.querySelector('#sectionNav');
const entryTemplate = document.querySelector('#entryTemplate');
const resumePdfInput = document.querySelector('#resumePdfInput');
const resumeAttachmentInput = document.querySelector('#resumeAttachmentInput');
const parseResult = document.querySelector('#parseResult');
const resumeFileState = document.querySelector('#resumeFileState');
const textPreview = document.querySelector('#textPreview');
const FILE_DB_NAME = 'resume-profile-files-v1';
const FILE_STORE = 'files';
let currentProfile = emptyProfile();
let dirty = false;

function emptyProfile() {
  const profile = {};
  for (const section of schema.sections) profile[section.key] = section.repeatable ? [] : {};
  return profile;
}

function normalizeProfile(value = {}) {
  const profile = emptyProfile();
  for (const section of schema.sections) {
    if (section.repeatable) profile[section.key] = Array.isArray(value[section.key]) ? value[section.key] : [];
    else profile[section.key] = value[section.key] && typeof value[section.key] === 'object' ? value[section.key] : {};
  }
  return profile;
}

function markDirty() {
  dirty = true;
  saveState.textContent = '有未保存的修改';
  saveState.className = 'save-state dirty';
  updateStats();
}

function setSavedState(text = '已保存到当前浏览器') {
  dirty = false;
  saveState.textContent = text;
  saveState.className = 'save-state saved';
}

function fieldPath(section, field) {
  return `${section.key}${section.repeatable ? '[]' : ''}.${field.key}`;
}

function createInput(section, field, value = '', entryIndex = -1) {
  const label = document.createElement('label');
  label.className = `field${field.wide || field.type === 'textarea' ? ' wide' : ''}`;
  label.dataset.search = [field.label, ...(field.aliases || []), fieldPath(section, field)].join(' ').toLowerCase();

  const title = document.createElement('span');
  title.append(document.createTextNode(field.label));
  if (field.required) {
    const required = document.createElement('span');
    required.className = 'required-mark';
    required.textContent = ' *';
    title.appendChild(required);
  }
  if (field.sensitive) {
    const sensitive = document.createElement('span');
    sensitive.className = 'sensitive-mark';
    sensitive.textContent = ' 本机敏感资料';
    title.appendChild(sensitive);
  }
  label.appendChild(title);

  let input;
  if (field.type === 'textarea') {
    input = document.createElement('textarea');
    input.rows = 4;
  } else if (field.type === 'select') {
    input = document.createElement('select');
    for (const optionValue of field.options || ['']) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue || '请选择 / 留空';
      input.appendChild(option);
    }
  } else {
    input = document.createElement('input');
    input.type = field.type || 'text';
  }

  input.dataset.section = section.key;
  input.dataset.field = field.key;
  if (entryIndex >= 0) input.dataset.entry = String(entryIndex);
  if (field.required) input.required = true;
  if (field.min !== undefined) input.min = String(field.min);
  if (field.max !== undefined) input.max = String(field.max);
  if (field.step !== undefined) input.step = String(field.step);

  if (field.type === 'file') {
    input.dataset.filePath = `${section.key}.${field.key}`;
    if (field.accept) input.accept = field.accept;
    input.multiple = Boolean(field.multiple);
    input.addEventListener('change', markDirty);
    label.append(input, createFileRecords(field));
  } else {
    input.value = value ?? '';
    input.addEventListener('input', markDirty);
    input.addEventListener('change', markDirty);
    label.appendChild(input);
  }
  return label;
}

function attachmentRecords(field) {
  const value = currentProfile.attachments?.[field.key];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function createFileRecords(field) {
  const records = document.createElement('div');
  records.className = 'file-records';
  for (const metadata of attachmentRecords(field)) {
    const row = document.createElement('div');
    row.className = 'file-record';
    const size = metadata.size ? `${Math.ceil(metadata.size / 1024)} KB` : '仅有元数据';
    row.appendChild(document.createTextNode(`${metadata.name || '未命名文件'} · ${size}`));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '删除';
    remove.addEventListener('click', async () => {
      if (!confirm(`确认删除本地附件“${metadata.name || '未命名文件'}”？`)) return;
      currentProfile = collectProfile();
      if (metadata.storageKey) await deleteStoredFile(metadata.storageKey);
      const remaining = attachmentRecords(field).filter((item) => item.storageKey !== metadata.storageKey);
      currentProfile.attachments[field.key] = field.multiple ? remaining : null;
      await persistProfile(currentProfile);
      render();
      setSavedState('附件已删除');
    });
    row.appendChild(remove);
    records.appendChild(row);
  }
  return records;
}

function createRepeatEntry(section, value = {}) {
  const container = document.querySelector(`#entries-${section.key}`);
  const entry = entryTemplate.content.firstElementChild.cloneNode(true);
  entry.dataset.section = section.key;
  const grid = entry.querySelector('.field-grid');
  const index = container.querySelectorAll('.entry').length;
  for (const field of section.fields) grid.appendChild(createInput(section, field, value[field.key], index));
  entry.querySelector('.remove-entry').addEventListener('click', () => {
    entry.remove();
    renumberEntries(section);
    markDirty();
  });
  container.querySelector('.empty-entries')?.remove();
  container.appendChild(entry);
  renumberEntries(section);
}

function renumberEntries(section) {
  const container = document.querySelector(`#entries-${section.key}`);
  const entries = [...container.querySelectorAll('.entry')];
  entries.forEach((entry, index) => {
    entry.querySelector('.entry-head strong').textContent = `${section.itemTitle || section.title} ${index + 1}`;
    entry.querySelectorAll('[data-entry]').forEach((input) => { input.dataset.entry = String(index); });
  });
  if (!entries.length && !container.querySelector('.empty-entries')) {
    const empty = document.createElement('div');
    empty.className = 'empty-entries';
    empty.textContent = `尚未添加${section.itemTitle || section.title}`;
    container.appendChild(empty);
  }
}

function renderSection(section) {
  const sectionElement = document.createElement('section');
  sectionElement.className = 'profile-section';
  sectionElement.id = `section-${section.key}`;
  sectionElement.dataset.search = [section.title, section.description || '', ...section.fields.flatMap((field) => [field.label, ...(field.aliases || [])])].join(' ').toLowerCase();
  const heading = document.createElement('div');
  heading.className = 'section-heading';
  const copy = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = section.title;
  copy.appendChild(title);
  if (section.description) {
    const description = document.createElement('p');
    description.textContent = section.description;
    copy.appendChild(description);
  }
  heading.appendChild(copy);

  if (section.repeatable) {
    const add = document.createElement('button');
    add.className = 'add-entry';
    add.type = 'button';
    add.textContent = `＋ 添加${section.itemTitle || section.title}`;
    add.addEventListener('click', () => { createRepeatEntry(section); markDirty(); });
    heading.appendChild(add);
  }
  sectionElement.appendChild(heading);

  if (section.repeatable) {
    const entries = document.createElement('div');
    entries.className = 'entries';
    entries.id = `entries-${section.key}`;
    sectionElement.appendChild(entries);
  } else {
    const grid = document.createElement('div');
    grid.className = 'field-grid';
    for (const field of section.fields) grid.appendChild(createInput(section, field, currentProfile[section.key]?.[field.key]));
    sectionElement.appendChild(grid);
  }
  form.appendChild(sectionElement);

  if (section.repeatable) {
    for (const value of currentProfile[section.key] || []) createRepeatEntry(section, value);
    renumberEntries(section);
  }
}

function render() {
  form.replaceChildren();
  nav.replaceChildren();
  for (const section of schema.sections) {
    renderSection(section);
    const link = document.createElement('a');
    link.href = `#section-${section.key}`;
    link.textContent = section.title;
    nav.appendChild(link);
  }
  updateStats();
  applyFieldSearch();
  updateResumeFileState();
}

function collectProfile() {
  const profile = emptyProfile();
  profile.attachments = structuredClone(currentProfile.attachments || {});
  for (const section of schema.sections) {
    if (section.key === 'attachments') continue;
    if (section.repeatable) {
      profile[section.key] = [...document.querySelectorAll(`.entry[data-section="${section.key}"]`)].map((entry) => {
        const item = {};
        for (const input of entry.querySelectorAll('[data-field]')) item[input.dataset.field] = input.value.trim();
        return item;
      }).filter((item) => Object.values(item).some(Boolean));
    } else {
      profile[section.key] = {};
      for (const input of document.querySelectorAll(`[data-section="${section.key}"][data-field]`)) {
        if (input.type !== 'file') profile[section.key][input.dataset.field] = input.value.trim();
      }
    }
  }
  return profile;
}

function countValues(value) {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countValues(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countValues(item), 0);
  return String(value || '').trim() ? 1 : 0;
}

function updateStats() {
  const profile = form.children.length ? collectProfile() : currentProfile;
  const repeated = schema.sections.filter((section) => section.repeatable)
    .reduce((sum, section) => sum + (profile[section.key]?.length || 0), 0);
  stats.textContent = `已填写 ${countValues(profile)} 项 · 重复经历 ${repeated} 条 · 映射规则 ${schema.aliasIndex.length + (schema.patternRules?.length || 0)} 条`;
}

function openFileDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE, { keyPath: 'storageKey' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putStoredFile(record) {
  const db = await openFileDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE, 'readwrite');
    transaction.objectStore(FILE_STORE).put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function deleteStoredFile(storageKey) {
  const db = await openFileDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE, 'readwrite');
    transaction.objectStore(FILE_STORE).delete(storageKey);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function clearStoredFiles() {
  const db = await openFileDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE, 'readwrite');
    transaction.objectStore(FILE_STORE).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

function attachmentField(fieldKey) {
  return schema.sections.find((section) => section.key === 'attachments')?.fields.find((field) => field.key === fieldKey) || null;
}

function fileSizeText(size) {
  return size ? `${Math.ceil(size / 1024)} KB` : '未知大小';
}

function setToolState(node, text, kind = '') {
  if (!node) return;
  node.textContent = text;
  node.className = `tool-state${kind ? ` ${kind}` : ''}`;
}

async function saveAttachmentField(fieldKey, file) {
  const field = attachmentField(fieldKey);
  if (!field) throw new Error(`没有找到附件字段：${fieldKey}`);
  if (!(file instanceof File) || !file.size) throw new Error('不能保存空文件');

  const profile = collectProfile();
  profile.attachments = structuredClone(currentProfile.attachments || {});
  let records = field.multiple ? attachmentRecords(field) : [];
  if (!field.multiple) {
    for (const old of attachmentRecords(field)) if (old.storageKey) await deleteStoredFile(old.storageKey);
    records = [];
  }
  const storageKey = `attachments.${field.key}:${crypto.randomUUID()}`;
  const metadata = { storageKey, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, savedAt: new Date().toISOString() };
  await putStoredFile({ ...metadata, blob: file });
  records.push(metadata);
  profile.attachments[field.key] = field.multiple ? records : records.at(-1);
  currentProfile = normalizeProfile(profile);
  currentProfile.attachments = profile.attachments;
  await persistProfile(currentProfile);
  render();
  setSavedState('简历附件已保存');
  updateResumeFileState();
  return metadata;
}

function updateResumeFileState() {
  if (!resumeFileState) return;
  const record = currentProfile.attachments?.resume;
  if (!record) {
    setToolState(resumeFileState, '尚未保存简历附件');
    return;
  }
  resumeFileState.className = 'tool-state saved';
  resumeFileState.replaceChildren(document.createTextNode(`${record.name || '未命名文件'} · ${fileSizeText(record.size)}`));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '删除';
  remove.addEventListener('click', async () => {
    if (!confirm(`确认删除本地简历附件“${record.name || '未命名文件'}”？`)) return;
    const profile = collectProfile();
    profile.attachments = structuredClone(currentProfile.attachments || {});
    if (record.storageKey) await deleteStoredFile(record.storageKey);
    profile.attachments.resume = null;
    currentProfile = normalizeProfile(profile);
    currentProfile.attachments = profile.attachments;
    await persistProfile(currentProfile);
    render();
    setSavedState('简历附件已删除');
    updateResumeFileState();
  });
  resumeFileState.appendChild(remove);
}

async function readPdfText(bytes) {
  const pdfjs = await import(chrome.runtime.getURL('libs/pdf.min.mjs'));
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.mjs');
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages.join('\n');
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

function locationLevels(value) {
  const parsed = splitLocationPath(value);
  const province = parsed[0] || '';
  if (DIRECT_ADMINISTRATIONS.test(province) && parsed.length === 2) return [province, province, parsed[1]];
  return [province, parsed[1] || '', parsed[2] || ''];
}

function mergeEmptyProfileValues(target, source) {
  const merged = normalizeProfile(target);
  merged.attachments = structuredClone(target.attachments || {});
  let filled = 0;
  for (const section of schema.sections) {
    const sourceValue = source[section.key];
    if (section.key === 'attachments') continue;
    if (section.repeatable) {
      const targetRecords = Array.isArray(merged[section.key]) ? merged[section.key] : [];
      const sourceRecords = Array.isArray(sourceValue) ? sourceValue.filter((item) => Object.values(item || {}).some(Boolean)) : [];
      if (!targetRecords.length && sourceRecords.length) {
        merged[section.key] = structuredClone(sourceRecords);
        filled += sourceRecords.reduce((sum, item) => sum + Object.values(item || {}).filter(Boolean).length, 0);
      }
      continue;
    }
    for (const field of section.fields) {
      const currentValue = String(merged[section.key]?.[field.key] || '').trim();
      const nextValue = sourceValue?.[field.key];
      if (!currentValue && nextValue !== undefined && String(nextValue).trim()) {
        merged[section.key][field.key] = nextValue;
        filled += 1;
      }
    }
  }
  return { merged, filled };
}

function parsedProfileFromLegacy(inferred) {
  const profile = migrateLegacyProfile(inferred);
  const nativePlace = inferred.nativePlace || '';
  const [province, city, district] = locationLevels(nativePlace);
  if (nativePlace || inferred.nativePlaceProvince || inferred.nativePlaceCity || inferred.nativePlaceDistrict) {
    profile.basic.nativePlace = profile.basic.nativePlace || nativePlace;
    profile.basic.nativePlaceProvince = inferred.nativePlaceProvince || province;
    profile.basic.nativePlaceCity = inferred.nativePlaceCity || city;
    profile.basic.nativePlaceDistrict = inferred.nativePlaceDistrict || district;
  }
  return normalizeProfile(profile);
}

async function handleResumePdf(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    setToolState(parseResult, '请上传 PDF 文件。', 'error');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    setToolState(parseResult, '文件超过 50 MB，请换一个更小的 PDF。', 'error');
    return;
  }
  setToolState(parseResult, `正在本地解析 ${file.name}…`);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = cleanDocumentText(await readPdfText(bytes));
    if (text.length < 30) throw new Error('没有提取到足够文字；扫描版 PDF 需要先 OCR');
    const { inferProfile } = await import(chrome.runtime.getURL('resume-parser.mjs'));
    const inferred = inferProfile(text);
    const parsedProfile = parsedProfileFromLegacy(inferred);
    const { merged, filled } = mergeEmptyProfileValues(collectProfile(), parsedProfile);
    currentProfile = merged;
    render();
    markDirty();
    if (textPreview) {
      textPreview.querySelector('pre').textContent = text.slice(0, 15000);
      textPreview.hidden = false;
    }
    const sections = [
      parsedProfile.educationExperiences?.length ? `教育 ${parsedProfile.educationExperiences.length} 段` : '',
      parsedProfile.workExperiences?.length ? `工作/实习 ${parsedProfile.workExperiences.length} 段` : '',
      parsedProfile.projectExperiences?.length ? `项目 ${parsedProfile.projectExperiences.length} 段` : '',
      parsedProfile.certificates?.length ? `证书 ${parsedProfile.certificates.length} 项` : '',
      parsedProfile.languageSkills?.length ? `语言 ${parsedProfile.languageSkills.length} 项` : ''
    ].filter(Boolean);
    setToolState(parseResult, `解析完成：新填入 ${filled} 个空白值${sections.length ? `，识别到${sections.join('，')}` : ''}。请检查后保存。`, 'saved');
  } catch (error) {
    setToolState(parseResult, `解析失败：${error.message}`, 'error');
  } finally {
    resumePdfInput.value = '';
  }
}

async function savePendingFiles(profile) {
  profile.attachments ||= {};
  for (const input of document.querySelectorAll('input[type="file"][data-file-path]')) {
    if (!input.files?.length) continue;
    const field = schema.sections.find((section) => section.key === 'attachments')?.fields.find((item) => item.key === input.dataset.field);
    if (!field) continue;
    let records = field.multiple ? attachmentRecords(field) : [];
    if (!field.multiple) {
      for (const old of attachmentRecords(field)) if (old.storageKey) await deleteStoredFile(old.storageKey);
    }
    for (const file of input.files) {
      const storageKey = `${input.dataset.filePath}:${crypto.randomUUID()}`;
      const metadata = { storageKey, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, savedAt: new Date().toISOString() };
      await putStoredFile({ ...metadata, blob: file });
      records.push(metadata);
    }
    profile.attachments[field.key] = field.multiple ? records : records.at(-1);
  }
  return profile;
}

async function persistProfile(profile) {
  const record = { schemaVersion: schema.schemaVersion, updatedAt: new Date().toISOString(), data: profile };
  await chrome.storage.local.set({ [schema.storageKey]: record });
}

async function saveProfile() {
  if (!form.reportValidity()) return;
  const buttons = [document.querySelector('#saveButton'), document.querySelector('#saveFooter')];
  buttons.forEach((button) => { button.disabled = true; button.textContent = '正在保存…'; });
  try {
    currentProfile = await savePendingFiles(collectProfile());
    await persistProfile(currentProfile);
    render();
    setSavedState();
  } catch (error) {
    saveState.textContent = `保存失败：${error.message}`;
    saveState.className = 'save-state dirty';
  } finally {
    buttons[0].disabled = false;
    buttons[0].textContent = '保存全部资料';
    buttons[1].disabled = false;
    buttons[1].textContent = '保存全部资料';
  }
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let node = target;
  parts.forEach((part, index) => {
    if (part.includes('[]')) return;
    if (index === parts.length - 1) node[part] = value;
    else node = node[part] ||= {};
  });
}

function migrateLegacyProfile(legacy = {}) {
  const profile = emptyProfile();
  for (const [key, path] of Object.entries(schema.legacyKeyToPath)) {
    if (!legacy[key] || path.includes('[]')) continue;
    setPath(profile, path, legacy[key]);
  }
  profile.educationExperiences = (legacy.educationEntries || []).map((item) => ({
    schoolName: item.school || '', collegeName: item.college || '', major: item.major || '', degree: item.degree || '',
    academicDegree: item.academicDegree || '', studyMode: item.studyMode || '', isHighest: item.isHighest || '',
    startDate: item.startDate || '', endDate: item.endDate || '', gpa: item.gpa || '', ranking: item.ranking || '', rankingPercent: item.rankingPercent || ''
  }));
  profile.workExperiences = (legacy.workEntries || []).map((item) => ({
    type: item.type || '', companyName: item.company || '', jobTitle: item.title || '', department: item.department || '',
    startDate: item.startDate || '', endDate: item.endDate || '', description: item.description || ''
  }));
  profile.projectExperiences = (legacy.projectEntries || []).map((item) => ({ name: item.name || '', role: item.role || '', startDate: item.startDate || '', endDate: item.endDate || '', description: item.description || '' }));
  profile.familyMembers = (legacy.familyEntries || []).map((item) => ({ name: item.name || '', relationship: item.relationship || '', phone: item.phone || '', workUnit: item.workplace || '', jobTitle: item.occupation || '' }));
  profile.certificates = (legacy.certificateEntries || []).map((item) => ({ name: item.name || '', date: item.date || '', number: item.number || '', level: item.level || '', issuer: item.issuer || '', description: item.description || '' }));
  profile.languageSkills = (legacy.languageEntries || []).map((item) => ({ language: item.name || '', proficiency: item.proficiency || '', certificate: item.certificate || '', score: item.score || '', listeningSpeaking: item.listeningSpeaking || '', readingWriting: item.readingWriting || '' }));
  return profile;
}

async function loadProfile() {
  const stored = await chrome.storage.local.get([schema.storageKey, 'profile']);
  if (stored[schema.storageKey]?.data) {
    currentProfile = normalizeProfile(stored[schema.storageKey].data);
    setSavedState('已载入本地资料');
  } else if (stored.profile && Object.keys(stored.profile).length) {
    currentProfile = normalizeProfile(migrateLegacyProfile(stored.profile));
    await persistProfile(currentProfile);
    setSavedState('已迁移旧版个人资料');
  } else {
    currentProfile = emptyProfile();
    saveState.textContent = '尚未保存资料';
    saveState.className = 'save-state';
  }
  render();
}

function applyFieldSearch() {
  const query = document.querySelector('#fieldSearch').value.trim().toLowerCase();
  for (const section of document.querySelectorAll('.profile-section')) {
    let visibleFields = 0;
    for (const field of section.querySelectorAll('.field')) {
      const matched = !query || field.dataset.search.includes(query);
      field.hidden = !matched;
      if (matched) visibleFields += 1;
    }
    section.hidden = Boolean(query && !visibleFields && !section.dataset.search.includes(query));
  }
}

function renderAliases() {
  const query = document.querySelector('#aliasSearch').value.trim().toLowerCase();
  const list = document.querySelector('#aliasList');
  list.replaceChildren();
  for (const item of schema.aliasIndex.filter((entry) => !query || `${entry.alias} ${entry.path}`.toLowerCase().includes(query))) {
    const row = document.createElement('div');
    row.className = 'alias-row';
    const alias = document.createElement('span');
    alias.textContent = item.alias;
    const path = document.createElement('code');
    path.textContent = item.path;
    row.append(alias, path);
    list.appendChild(row);
  }
  for (const rule of schema.patternRules || []) {
    const label = `语义模式：${rule.pattern.source}`;
    if (query && !`${label} ${rule.path}`.toLowerCase().includes(query)) continue;
    const row = document.createElement('div');
    row.className = 'alias-row';
    const alias = document.createElement('span');
    alias.textContent = label;
    const path = document.createElement('code');
    path.textContent = rule.path;
    row.append(alias, path);
    list.appendChild(row);
  }
}

document.querySelector('#saveButton').addEventListener('click', saveProfile);
document.querySelector('#saveFooter').addEventListener('click', saveProfile);
document.querySelector('#fieldSearch').addEventListener('input', applyFieldSearch);
document.querySelector('#showAliases').addEventListener('click', () => { renderAliases(); document.querySelector('#aliasDialog').showModal(); });
document.querySelector('#closeAliases').addEventListener('click', () => document.querySelector('#aliasDialog').close());
document.querySelector('#aliasSearch').addEventListener('input', renderAliases);
resumePdfInput?.addEventListener('change', (event) => handleResumePdf(event.target.files?.[0]));
resumeAttachmentInput?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    setToolState(resumeFileState, `正在保存 ${file.name}…`);
    const metadata = await saveAttachmentField('resume', file);
    setToolState(resumeFileState, `${metadata.name} · ${fileSizeText(metadata.size)}`, 'saved');
    updateResumeFileState();
  } catch (error) {
    setToolState(resumeFileState, `保存失败：${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
});

document.querySelector('#exportButton').addEventListener('click', () => {
  const record = { schemaVersion: schema.schemaVersion, exportedAt: new Date().toISOString(), attachmentsNotice: '附件二进制保存在本地 IndexedDB，本 JSON 只包含附件元数据。', data: collectProfile() };
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `resume-profile-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

document.querySelector('#importInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    const data = imported.data || imported;
    const existingAttachments = currentProfile.attachments;
    currentProfile = normalizeProfile(data);
    currentProfile.attachments = existingAttachments || {};
    render();
    markDirty();
    saveState.textContent = 'JSON 已导入；请检查后保存（本地附件保持不变）';
  } catch (error) {
    saveState.textContent = `导入失败：${error.message}`;
    saveState.className = 'save-state dirty';
  } finally {
    event.target.value = '';
  }
});

document.querySelector('#clearButton').addEventListener('click', async () => {
  if (!confirm('确认清空全部个人资料和本地附件？此操作无法撤销。')) return;
  await chrome.storage.local.remove([schema.storageKey, 'profile']);
  await clearStoredFiles();
  currentProfile = emptyProfile();
  render();
  saveState.textContent = '资料与附件已清空';
  saveState.className = 'save-state';
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
});

loadProfile().catch((error) => {
  saveState.textContent = `载入失败：${error.message}`;
  saveState.className = 'save-state dirty';
});
