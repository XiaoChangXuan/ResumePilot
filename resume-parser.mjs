function compact(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[|｜]/g, ' ').replace(/\s+/g, ' ').trim();
}

function capture(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return compact(match[1]);
  }
  return '';
}

function normalizeMonth(value) {
  const match = String(value || '').match(/((?:19|20)\d{2})[年./-]\s*(0?[1-9]|1[0-2])/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : '';
}

function parseDateRange(value) {
  const dates = String(value || '').match(/(?:19|20)\d{2}[年./-]\s*(?:0?[1-9]|1[0-2])/g) || [];
  return {
    startDate: normalizeMonth(dates[0]),
    endDate: /至今|现在|present|current/i.test(value) ? '' : normalizeMonth(dates[1]),
    current: /至今|现在|present|current/i.test(value)
  };
}

function uniqueEntries(entries, identity) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = identity(entry);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeIdentityDocumentType(value) {
  if (/港澳/.test(value)) return '港澳内地通行证';
  if (/台湾|台胞/.test(value)) return '台湾大陆通行证';
  if (/外国人.*(?:永居|永久居留)/.test(value)) return '外国人永居';
  if (/外国护照/.test(value)) return '外国护照';
  if (/身份证/.test(value)) return '身份证';
  if (/护照/.test(value)) return '护照';
  return value;
}

function detectEnglishLevel(text) {
  if (/(?:CET|CTE)\s*[-－]?\s*6|大学英语六级|英语六级/i.test(text)) return 'CET-6';
  if (/(?:CET|CTE)\s*[-－]?\s*4|大学英语四级|英语四级/i.test(text)) return 'CET-4';
  if (/TEM\s*[-－]?\s*8|英语专业八级|专八/i.test(text)) return 'TEM-8';
  if (/TEM\s*[-－]?\s*4|英语专业四级|专四/i.test(text)) return 'TEM-4';
  if (/IELTS|雅思/i.test(text)) return 'IELTS';
  if (/TOEFL|托福/i.test(text)) return 'TOEFL';
  return '';
}

function parseEducation(text) {
  const dateRange = '((?:19|20)\\d{2}[年./-]\\s*(?:0?[1-9]|1[0-2])\\s*[—–~-]+\\s*(?:(?:19|20)\\d{2}[年./-]\\s*(?:0?[1-9]|1[0-2])|至今|现在|Present))';
  const pattern = new RegExp(`([\\u4e00-\\u9fa5·]{2,30}(?:大学|学院))\\s+([^。；;]{2,80}?)\\s+${dateRange}`, 'gi');
  const entries = [];
  let match;
  while ((match = pattern.exec(text))) {
    const school = compact(match[1]);
    let details = compact(match[2]);
    if (/有限公司|有限责任公司/.test(school)) continue;
    const range = parseDateRange(match[3]);
    const gpa = capture(details, [/(?:GPA|绩点)\s*[:：]?\s*([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i]);
    const rawAcademicDegree = capture(details, [/（\s*([^（）]*(?:学硕|专硕|双学士|学士|硕士|博士|MBA)[^（）]*)\s*）/i]);
    const academicDegree = /双学士/.test(rawAcademicDegree) ? '双学士' : /MBA|工商管理硕士/i.test(rawAcademicDegree) ? 'MBA' : /博士/.test(rawAcademicDegree) ? '博士' : /硕士|学硕|专硕/.test(rawAcademicDegree) ? '硕士' : /学士/.test(rawAcademicDegree) ? '学士' : '';
    details = details.replace(/（\s*(?:GPA|绩点)[^）]*）/gi, ' ').replace(/（\s*[^（）]*(?:学硕|专硕|学士|硕士|博士)[^（）]*\s*）/g, ' ');
    const degree = academicDegree === '博士' ? '博士' : academicDegree === '硕士' ? '硕士' : academicDegree === 'MBA' ? 'MBA' : /学士/.test(academicDegree) ? '本科' : '';
    const college = capture(details, [/(?:学院|院系)\s*[:：]?\s*([^，,；;]{2,30})/]);
    const major = compact(details.replace(/(?:学院|院系)\s*[:：]?\s*[^，,；;]{2,30}/, ''));
    const ranking = capture(details, [/(?:专业排名|成绩排名|排名)\s*[:：]?\s*(\d+\s*\/\s*\d+)/i]);
    const rankingPercent = capture(details, [/(?:排名占比|专业排名|成绩排名|前)\s*[:：]?\s*(\d+(?:\.\d+)?\s*%)/i]);
    const studyMode = capture(details, [/(全国普通高等院校全日制|统招专升本|海外留学生|全国普通高等院校非全日制|成人高等教育|非统招专升本|非全日制|全日制|函授|自考|在职)/i]) || '全日制';
    entries.push({ school, college, major, degree, academicDegree, gpa, ranking, rankingPercent, studyMode, ...range });
  }
  return uniqueEntries(entries, (entry) => `${entry.school}|${entry.startDate}|${entry.endDate}`);
}

function companyMatches(text) {
  const pattern = /([\u4e00-\u9fa5A-Za-z0-9（）()·-]{2,60}(?:有限责任公司|有限公司))\s+([^。；;]{2,60}?)\s+((?:19|20)\d{2}[年./-]\s*(?:0?[1-9]|1[0-2])\s*[—–~-]+\s*(?:(?:19|20)\d{2}[年./-]\s*(?:0?[1-9]|1[0-2])|至今|现在|Present))/gi;
  const matches = [];
  let match;
  while ((match = pattern.exec(text))) matches.push({ index: match.index, end: pattern.lastIndex, company: compact(match[1]), title: compact(match[2]), rangeText: match[3] });
  return matches;
}

function parseWork(text) {
  const matches = companyMatches(text);
  const projectSection = text.search(/科研与项目经历|项目经历|research\s+(?:and|&)\s+projects?/i);
  return matches.map((match, index) => {
    const nextStart = matches[index + 1]?.index ?? (projectSection > match.end ? projectSection : text.length);
    const description = compact(text.slice(match.end, nextStart));
    const title = match.title.replace(/^实习经历\s*/, '').trim();
    return {
      type: /实习/.test(title) || /实习经历/.test(text.slice(Math.max(0, match.index - 30), match.index)) ? '实习' : '正式工作',
      company: match.company,
      title,
      department: '',
      ...parseDateRange(match.rangeText),
      description
    };
  });
}

function projectMatches(text) {
  const pattern = /([A-Za-z][A-Za-z0-9-]{1,30})\s*[：:]\s*([^。]{3,150}?)\s+((?:(?:ACL|EMNLP|NeurIPS|ICML|ICLR|AAAI|IJCAI|CVPR|ECCV|KDD|WWW)[^。]{0,60}?)?)\s*((?:19|20)\d{2}[年./-]\s*(?:0?[1-9]|1[0-2])\s*[—–~-]+\s*(?:(?:19|20)\d{2}[年./-]\s*(?:0?[1-9]|1[0-2])|至今|现在|Present))/gi;
  const matches = [];
  let match;
  while ((match = pattern.exec(text))) {
    matches.push({ index: match.index, end: pattern.lastIndex, code: match[1], title: compact(match[2]), venue: compact(match[3]), rangeText: match[4] });
  }
  return matches;
}

function parseProjects(text) {
  const sectionIndex = text.search(/科研与项目经历|项目经历|research\s+(?:and|&)\s+projects?/i);
  const source = sectionIndex >= 0 ? text.slice(sectionIndex) : text;
  const matches = projectMatches(source);
  return matches.map((match, index) => ({
    name: `${match.code}: ${match.title}`,
    role: match.venue,
    ...parseDateRange(match.rangeText),
    description: compact(source.slice(match.end, matches[index + 1]?.index ?? source.length).replace(/\s+[\u4e00-\u9fa5·]{2,6}\s+邮箱\s*[:：].*$/s, ''))
  }));
}

function findName(text, email, phone) {
  const escapedEmail = email ? email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  if (escapedEmail) {
    const nearEmail = text.match(new RegExp(`([\\u4e00-\\u9fa5·]{2,6})\\s+(?:邮箱\\s*[:：]\\s*)?${escapedEmail}`, 'i'));
    if (nearEmail?.[1]) return nearEmail[1];
  }
  const explicit = capture(text, [/(?:姓名|姓\s*名)\s*[:：]\s*([\u4e00-\u9fa5·]{2,6})/i, /(?:name)\s*[:：]\s*([A-Za-z\u4e00-\u9fa5· ]{2,40})/i]);
  if (explicit) return explicit;
  const anchors = [email, phone].filter(Boolean);
  for (const anchor of anchors) {
    const index = text.indexOf(anchor);
    const nearby = text.slice(Math.max(0, index - 40), index);
    const names = nearby.match(/[\u4e00-\u9fa5·]{2,6}/g) || [];
    const candidate = names.reverse().find((value) => !/邮箱|手机|电话|姓名/.test(value));
    if (candidate) return candidate;
  }
  return '';
}

export function inferProfile(rawText) {
  const text = compact(rawText);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const rawPhone = text.match(/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/)?.[0] || '';
  const phone = rawPhone.replace(/[-\s]/g, '').replace(/^\+?86/, '');
  const educationEntries = parseEducation(text).map((entry, index, list) => ({ ...entry, isHighest: index === list.length - 1 ? '是' : '否' }));
  const workEntries = parseWork(text);
  const projectEntries = parseProjects(text);
  const urls = text.match(/https?:\/\/[^\s，。；;]+/gi) || [];
  const gender = capture(text, [/(?:性别|gender)\s*[:：]?\s*(男|女|male|female)/i]).replace(/male/i, '男').replace(/female/i, '女');
  const city = capture(text, [/(?:所在城市|现居地|居住地|地点|location)\s*[:：]\s*([^\s，,；;]{2,30})/i]);
  const summary = capture(text, [/(?:个人简介|个人介绍|自我评价|个人优势)\s*[:：]?\s*(.{20,600}?)(?=工作经历|教育经历|项目经历|技能|专业技能|$)/i]);
  const highestEducation = educationEntries.find((entry) => entry.isHighest === '是') || educationEntries.at(-1) || {};
  const latestWork = workEntries.at(-1) || {};
  const englishLevel = detectEnglishLevel(text);

  return {
    fullName: findName(text, email, rawPhone || phone), gender, phone, email, city, currentResidence: city,
    countryRegion: capture(text, [/(?:国家\s*[/／-]?\s*地区|国家|国籍)\s*[:：]?\s*([^\s，,；;]{2,30})/i]) || (/中国籍|中华人民共和国/i.test(text) ? '中国' : ''),
    studentOrigin: capture(text, [/(?:生源地)\s*[:：]?\s*([^\s，,；;]{2,30})/i]),
    nativePlace: capture(text, [/(?:籍贯|祖籍)\s*[:：]?\s*([^\s，,；;]{2,40})/i]),
    householdRegistration: capture(text, [/(?:户籍|户口所在地)\s*[:：]?\s*([^\s，,；;]{2,40})/i]),
    ethnicity: capture(text, [/(?:民族)\s*[:：]?\s*([^\s，,；;]{1,10})/i]),
    politicalStatus: capture(text, [/(?:政治面貌)\s*[:：]?\s*([^\s，,；;]{2,20})/i]),
    wechat: capture(text, [/(?:微信号|微信|WeChat)\s*[:：]?\s*([A-Za-z0-9_-]{5,30})/i]),
    qq: capture(text, [/(?:QQ号?|腾讯QQ)\s*[:：]?\s*([1-9]\d{4,11})/i]),
    identityDocumentType: normalizeIdentityDocumentType(capture(text, [/(?:证件类别|证件类型)\s*[:：]?\s*(身份证|护照|港澳内地通行证|港澳居民来往内地通行证|台湾大陆通行证|台湾居民来往大陆通行证|外国护照|外国人永居|外国人永久居留身份证)/i])),
    identityDocumentNumber: capture(text, [/(?:证件号码|身份证号|护照号)\s*[:：]?\s*([A-Z0-9()（）-]{5,30})/i]),
    yearsExperience: capture(text, [/(\d{1,2})\s*年(?:工作)?经验/]),
    linkedin: urls.find((url) => /linkedin\.com/i.test(url)) || '',
    github: urls.find((url) => /github\.com/i.test(url)) || '',
    portfolio: urls.find((url) => !/linkedin\.com|github\.com/i.test(url)) || '',
    englishLevel, languageEntries: englishLevel ? [{ name: '英语', proficiency: englishLevel, certificate: englishLevel, score: '' }] : [],
    summary, educationEntries, workEntries, projectEntries,
    school: highestEducation.school || '', college: highestEducation.college || '', major: highestEducation.major || '',
    degree: highestEducation.degree || '', academicDegree: highestEducation.academicDegree || '', graduationDate: highestEducation.endDate || '',
    gpa: highestEducation.gpa || '', ranking: highestEducation.ranking || '', rankingPercent: highestEducation.rankingPercent || '',
    company: latestWork.company || '', currentTitle: latestWork.title || '', department: latestWork.department || '',
    workStartDate: latestWork.startDate || '', workEndDate: latestWork.endDate || '', workDescription: latestWork.description || ''
  };
}
