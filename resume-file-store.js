const DATABASE_NAME = 'resume-autofill-file-store';
const DATABASE_VERSION = 1;
const OBJECT_STORE = 'files';
const PRIMARY_RESUME_ID = 'primary-resume';

let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE)) {
        database.createObjectStore(OBJECT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开附件文件仓库'));
    request.onblocked = () => reject(new Error('附件文件仓库被旧页面占用，请关闭插件页面后重试'));
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('附件文件仓库操作失败'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('附件文件仓库事务失败'));
    transaction.onabort = () => reject(transaction.error || new Error('附件文件仓库事务被取消'));
  });
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

export async function saveResumeFile(file, metadata = {}) {
  if (!(file instanceof Blob) || file.size <= 0) throw new Error('不能保存空的简历附件');
  const database = await openDatabase();
  const blob = file.slice(0, file.size, file.type || metadata.type || 'application/octet-stream');
  const record = {
    id: PRIMARY_RESUME_ID,
    name: metadata.name || file.name || 'resume.pdf',
    type: metadata.type || file.type || 'application/octet-stream',
    size: blob.size,
    lastModified: Number(metadata.lastModified || file.lastModified || Date.now()),
    updatedAt: Date.now(),
    blob
  };
  const transaction = database.transaction(OBJECT_STORE, 'readwrite');
  transaction.objectStore(OBJECT_STORE).put(record);
  await transactionDone(transaction);

  const saved = await getResumeFile();
  if (!(saved?.blob instanceof Blob) || saved.blob.size !== record.size || saved.blob.size <= 0) {
    throw new Error('附件写入独立文件仓库后校验失败');
  }
  return saved;
}

export async function getResumeFile() {
  const database = await openDatabase();
  const transaction = database.transaction(OBJECT_STORE, 'readonly');
  return requestResult(transaction.objectStore(OBJECT_STORE).get(PRIMARY_RESUME_ID));
}

export async function removeResumeFile() {
  const database = await openDatabase();
  const transaction = database.transaction(OBJECT_STORE, 'readwrite');
  transaction.objectStore(OBJECT_STORE).delete(PRIMARY_RESUME_ID);
  await transactionDone(transaction);
  await chrome.storage.local.remove('storedResumeFile');
}

export async function migrateLegacyResumeFile() {
  const current = await getResumeFile();
  if (current?.blob?.size) return { record: current, migrated: false, legacyIncomplete: null };

  const { storedResumeFile: legacy = null } = await chrome.storage.local.get('storedResumeFile');
  if (!legacy) return { record: null, migrated: false, legacyIncomplete: null };
  if (!legacy.base64) return { record: null, migrated: false, legacyIncomplete: legacy };

  const blob = base64ToBlob(legacy.base64, legacy.type);
  const record = await saveResumeFile(blob, legacy);
  await chrome.storage.local.remove('storedResumeFile');
  return { record, migrated: true, legacyIncomplete: null };
}
