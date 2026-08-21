(() => {
  const VERSION = '0.9.49';
  const MESSAGE_PROTOCOL = 2;
  if (globalThis.__resumePageAuditVersion === VERSION) return;
  globalThis.__resumePageAuditVersion = VERSION;

  const PANEL_SELECTOR = '.resume-page-audit';
  const AUDIT_UI_SELECTOR = '.resume-page-audit,[data-resume-page-audit-ui]';
  const TARGET_CLASS = 'resume-page-audit-target';
  const OVERLAY_CLASS = 'resume-page-audit-overlay';
  const OVERLAY_TARGET_CLASS = 'resume-page-audit-overlay--target';
  const AUTOFILL_DEBUG_OVERLAY_CLASS = 'resume-autofill-debug-overlay';
  const FILLABLE_FIELD_OPERATION_GROUPS = new Set(['direct-write', 'input-select', 'closed-select']);
  const DEBUG_FILL_OPERATION_GROUPS = FILLABLE_FIELD_OPERATION_GROUPS;
  const PLACEHOLDER_VALUE = /^(?:\u8bf7\u9009\u62e9|\u8bf7\u8f93\u5165|\u9009\u62e9|\u641c\u7d22|select|choose|yyyy|mm|dd|\u2014|-)?$/i;
  const MAX_INTERACTIVE = 1200;
  const MAX_SEMANTIC_TEXTS = 600;
  const MAX_POINTER_SCAN = 15000;
  const INTERACTIVE_SELECTOR = [
    'input', 'textarea', 'select', 'button', 'a', '[contenteditable]:not([contenteditable="false"])',
    '[role="button"]', '[role="textbox"]', '[role="combobox"]', '[role="radio"]',
    '[role="checkbox"]', '[role="switch"]', '[role="slider"]', '[tabindex]', '[onclick]'
  ].join(',');
  const MODULE_TITLE_RE = /(?:上传|简历|个人|基本|基础|联系|求职|教育|学历|学习|就读|校园|实习|工作|项目|经历|经验|实践|语言|外语|英语|技能|证书|获奖|荣誉|附件|附加|补充|兴趣|爱好|组织|作品|家庭|自我|评价|社交|账号|其他|basic|personal|contact|education|academic|school|work|job|intern|project|experience|language|skill|certificate|award|honou?r|attachment|additional|profile)/i;
  const MODULE_TITLE_WORDS_RE = /(?:上传|简历|个人|基本|基础|联系|求职|教育|学历|学习|就读|校园|实习|工作|项目|经历|经验|实践|语言|外语|英语|技能|证书|获奖|荣誉|附件|附加|补充|兴趣|爱好|组织|作品|家庭|自我|评价|社交|账号|其他|basic|personal|contact|education|academic|school|work|job|intern|project|experience|language|skill|certificate|award|honou?r|attachment|additional|profile)/ig;
  let elementMap = new Map();
  let sourceElementMap = new Map();
  let semanticModuleTitleByElement = new WeakMap();
  let semanticZoneByElement = new WeakMap();
  let semanticZoneRootByElement = new WeakMap();
  let semanticLandmarkTitleByElement = new WeakMap();
  let semanticTreeSnapshot = null;
  let overlaySyncFrame = 0;

  const MARK_CLASSES = [
    'resume-page-audit-match',
    'resume-page-audit-kind--field',
    'resume-page-audit-kind--action',
    'resume-page-audit-kind--container',
    'resume-page-audit-adaptation--partial',
    'resume-page-audit-adaptation--unadapted',
    'resume-page-audit-safety--guarded',
    TARGET_CLASS
  ];

  const FIELD_RULES = [
    ['acceptsAdjustment', /\u662f\u5426.*(?:\u53ef)?(?:\u63a5\u53d7|\u670d\u4ece).*(?:\u5de5\u4f5c\u57ce\u5e02|\u5c97\u4f4d|\u804c\u4f4d)?.*(?:\u8c03\u5242|\u8c03\u914d)|(?:\u5de5\u4f5c\u57ce\u5e02|\u5c97\u4f4d|\u804c\u4f4d).*(?:\u8c03\u5242|\u8c03\u914d)|accept.*(?:adjustment|reassignment)/i],
    ['recruitmentSource', /(?:\u6700\u521d|\u4f55\u5904|\u54ea\u91cc|\u4ece\u4f55\u5904).*(?:\u4e86\u89e3|\u5f97\u77e5).*(?:\u6821\u62db|\u62db\u8058|\u804c\u4f4d|\u4fe1\u606f)|recruit(?:ment)?\s*source/i],
    ['englishName', /英文名|英文姓名|拼音姓名|english\s*name|name\s*in\s*english/i],
    ['firstName', /名字|first\s*name|given\s*name/i],
    ['lastName', /姓氏|last\s*name|family\s*name|surname/i],
    ['fullName', /姓名|真实姓名|候选人姓名|申请人姓名|中文名|full\s*name|candidate\s*name|applicant\s*name/i],
    ['gender', /性别|gender|^sex$/i],
    ['birthDate', /出生日期|出生年月|生日|date\s*of\s*birth|birth\s*date|birthday/i],
    ['phone', /手机|联系电话|电话号码|phone|mobile|telephone/i],
    ['email', /邮箱|电子邮件|e-?mail/i],
    ['wechat', /微信号|微信|wechat/i],
    ['qq', /qq(?:号|号码)?/i],
    ['countryRegion', /国家|地区|国籍|country|region|citizenship/i],
    ['city', /城市|工作地点|居住地|location|city|residence/i],
    ['address', /详细地址|居住地址|联系地址|street\s*address|^address/i],
    ['postalCode', /邮编|邮政编码|postal\s*code|zip\s*code/i],
    ['nativePlace', /籍贯|祖籍|native\s*place/i],
    ['householdRegistration', /户籍|户口|household\s*registration|hukou/i],
    ['ethnicity', /民族|ethnicity/i],
    ['politicalStatus', /政治面貌|political\s*status/i],
    ['maritalStatus', /婚姻状况|婚姻状态|婚否|marital\s*status/i],
    ['identityDocumentType', /证件类别|证件类型|document\s*type|id\s*type/i],
    ['identityDocumentNumber', /证件号码|身份证号|护照号|document\s*number|id\s*number|passport\s*number/i],
    ['familyRelationship', /\u4e0e\u672c\u4eba\u5173\u7cfb|\u4e0e\u7533\u8bf7\u4eba\u5173\u7cfb|\u5173\u7cfb|relationship/i],
    ['familyWorkUnit', /\u5de5\u4f5c\u5355\u4f4d|\u5de5\u4f5c\u673a\u6784|\u5355\u4f4d\u540d\u79f0/i],
    ['targetRole', /职位关键词|目标职位|期望职位|申请职位|desired\s*(?:role|position)|target\s*(?:role|position)/i],
    ['desiredCity', /\u671f\u671b\u5de5\u4f5c\u57ce\u5e02|\u610f\u5411\u57ce\u5e02|\u671f\u671b\u57ce\u5e02|desired\s*(?:city|location)/i],
    ['expectedSalary', /期望薪资|期望月薪|薪资要求|expected\s*salary|salary\s*expectation/i],
    ['yearsExperience', /工作年限|工作经验年限|工作经验|years?\s*of\s*experience|work\s*experience/i],
    ['availableDate', /到岗日期|可入职日期|最早入职|available\s*date|start\s*date/i],
    ['educationStartDate', /最高学历入学时间|入学时间|入学日期|enrollment\s*date|matriculation\s*date/i],
    ['graduationDate', /最高学历毕业时间|毕业时间|毕业日期|graduation\s*date/i],
    ['school', /毕业院校|学校名称|学校|院校|university|college|school/i],
    ['college', /学院名称|院系名称|学院|院系|faculty/i],
    ['degree', /最高学历|学历|education\s*level/i],
    ['academicDegree', /所获学位|学位名称|学位|academic\s*degree/i],
    ['rankingPercent', /(?:专业|成绩|班级|年级)?排名(?:百分比|占比|比例)|排名.*(?:前|%)|top\s*\d+\s*%|rank(?:ing)?\s*(?:percent|percentage|ratio)/i],
    ['ranking', /专业排名|成绩排名|class\s*rank|major\s*rank/i],
    ['major', /所学专业|专业名称|专业|field\s*of\s*study|major/i],
    ['gpa', /绩点|gpa/i],
    ['studyMode', /学习形式|培养方式|就读形式|study\s*mode/i],
    ['company', /公司名称|单位名称|雇主|employer|company\s*name/i],
    ['department', /部门名称|工作部门|实习部门|department/i],
    ['campusPosition', /校内任职(?:位)?|校内职务|在校职务|学生干部|campus\s*(?:position|role)/i],
    ['workDescription', /工作内容|实习内容|工作描述|职责描述|responsibilities|job\s*description/i],
    ['campusDescription', /职务描述|校园经历信息|campus\s*description/i],
    ['currentTitle', /当前职位|职位名称|职务|job\s*title|position\s*title/i],
    ['projectName', /项目名称|project\s*name/i],
    ['projectRole', /项目角色|项目职责|project\s*role/i],
    ['projectDescription', /项目描述|项目内容|project\s*description/i],
    ['awardLevel', /奖项级别|获奖级别|award\s*level/i],
    ['awardingOrganization', /颁奖单位|授予单位|颁发机构|发证机构|awarding\s*(?:body|organization)|issuer/i],
    ['awardName', /奖项名称|获奖名称|荣誉名称|award\s*name|honou?r\s*name/i],
    ['certificateName', /职称及职业资格证书|职业资格证书|资格证书|职称|证书名称|certificate\s*name/i],
    ['certificateNumber', /证书编号|证书号码|资格证编号|certificate\s*(?:number|no\.?)/i],
    ['languageName', /语言名称|语言类型|语言|language/i],
    ['languageProficiency', /\u638c\u63e1\u7a0b\u5ea6|\u719f\u7ec3\u7a0b\u5ea6|精通程度|proficiency/i],
    ['languageScore', /\u7b49\u7ea7\u6210\u7ee9|\u8003\u8bd5\u6210\u7ee9|score/i],
    ['englishLevel', /英语水平|英语等级|英文水平|english\s*(?:level|proficiency)/i],
    ['certificateLevel', /\u8bc1\u4e66\u7ea7\u522b|\u8d44\u683c\u7ea7\u522b|certificate\s*level/i],
    ['certificateDate', /\u83b7\u5f97\u65f6\u95f4|\u53d1\u8bc1\u65e5\u671f|\u53d1\u8bc1\u65f6\u95f4|certificate\s*date/i],
    ['awardDate', /\u83b7\u5956\u65f6\u95f4|\u83b7\u5956\u65e5\u671f|award\s*date/i],
    ['computerSkills', /计算机技能|软件技能|computer\s*skills?/i],
    ['github', /github/i],
    ['linkedin', /linkedin/i],
    ['portfolio', /个人网站|作品集|个人主页|portfolio|personal\s*(?:site|website)/i],
    ['summary', /个人介绍|自我介绍|个人优势|自我评价|个人简介|summary|about\s*you|bio/i]
  ];

  const DATE_KEYS = /(?:Date|Start|End|Graduation)$/;
  const OPEN_TEXT_KEYS = new Set([
    'fullName', 'firstName', 'lastName', 'englishName', 'phone', 'email', 'wechat', 'qq',
    'address', 'postalCode', 'identityDocumentNumber', 'company', 'companyName', 'currentTitle', 'campusPosition',
    'projectName', 'projectRole',
    'awardingOrganization', 'awardName', 'certificateName', 'certificateNumber',
    'github', 'linkedin', 'portfolio', 'summary'
  ]);
  const OPEN_TEXT_HINT = /姓名|英文名|英文姓名|拼音姓名|证件(?:号码|编号)|身份证号|护照号|手机|电话|邮箱|地址|邮编|微信|qq|github|linkedin|作品集|个人网站|公司名称|单位名称|项目名称/i;
  const ADD_PATTERN = /添加|新增|继续添加|add\s+(?:another|new)?|create\s+new|(?:^|\s)[+＋](?:\s|$)/i;
  const ADD_NEGATIVE_PATTERN = /添加附件|添加文件|添加到收藏|add\s+file|bookmark/i;

  const FIELD_LABEL_BY_KEY = {
    acceptsAdjustment: '\u662f\u5426\u63a5\u53d7\u8c03\u5242', recruitmentSource: '\u62db\u8058\u4fe1\u606f\u6765\u6e90',
    fullName: '姓名', firstName: '名', lastName: '姓', englishName: '英文名', gender: '性别',
    birthDate: '出生日期', phone: '手机号码', phoneCountryRegion: '\u624b\u673a\u53f7\u7801\u5730\u533a', email: '邮箱', wechat: '微信号', qq: 'QQ号',
    countryRegion: '国家/地区', city: '城市', address: '详细地址', postalCode: '邮政编码',
    nativePlace: '籍贯', householdRegistration: '户籍', ethnicity: '民族', politicalStatus: '政治面貌',
    maritalStatus: '婚姻状况', identityDocumentType: '证件类型', identityDocumentNumber: '证件号码',
    targetRole: '目标职位', expectedSalary: '期望薪资', yearsExperience: '工作年限', availableDate: '到岗日期',
    educationStartDate: '入学时间', graduationDate: '毕业时间', school: '学校名称', college: '学院名称',
    degree: '学历', academicDegree: '学位', major: '专业名称', gpa: 'GPA', ranking: '专业排名', studyMode: '学习形式',
    company: '公司名称', department: '部门名称', campusPosition: '校内任职', currentTitle: '职位名称',
    workStartDate: '工作开始时间', workEndDate: '工作结束时间', workDescription: '工作内容',
    projectName: '项目名称', projectRole: '项目角色', projectStartDate: '项目开始时间',
    projectEndDate: '项目结束时间', projectDescription: '项目描述',
    periodStartDate: '开始时间', periodEndDate: '结束时间',
    awardLevel: '奖项级别', awardingOrganization: '颁奖单位', awardName: '奖项名称',
    certificateName: '证书名称', certificateNumber: '证书编号', languageName: '语言类型',
    englishLevel: '英语水平', computerSkills: '计算机技能', github: 'GitHub', linkedin: 'LinkedIn',
    portfolio: '个人网站/作品集', summary: '个人介绍'
  };

  function cleanText(value) {
    return String(value || '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  }

  function isNoReliableText(value) {
    const text = cleanText(value);
    return !text || /无可靠语[义议]?(?:文字)?/i.test(text) || /鏃犲彲闈犺/i.test(text);
  }

  function removeValidationText(value) {
    return cleanText(value)
      .replace(/(?:必填项?未填写|此项为必填|该项为必填|不能为空|不得为空|必填字段|required|invalid|validation\s*error)/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function looksLikeValidationText(value) {
    const text = cleanText(value);
    return !text || /^(?:必填项?未填写|此项为必填|该项为必填|不能为空|不得为空|必填字段|required|invalid|validation\s*error)$/i.test(text);
  }

  function rawClassName(element) {
    const value = element?.className;
    return typeof value === 'string' ? value : String(value?.baseVal || '');
  }

  function classSummary(element) {
    return rawClassName(element).split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
  }

  function classTokens(element) {
    return rawClassName(element).split(/\s+/).filter(Boolean);
  }

  function isApplyFieldContainer(element) {
    return classTokens(element).some((token) => /^apply-field-/i.test(token))
      && !classTokens(element).some((token) => /^apply-fields-/i.test(token));
  }

  function isFieldContainerExcluded(element) {
    return /(?:^|\s)(?:el-)?form-item__(?:content|control|children)(?:\s|$)|form-item-(?:content|control|children)|FormItem(?:Content|Control|Children)|ant-form-item-control|rocket-form-field-item-control|(?:^|\s)input_box(?:\s|$)|(?:^|\s)apply-fields-/i
      .test(rawClassName(element));
  }

  function isFieldContainerElement(element) {
    if (!(element instanceof Element) || isFieldContainerExcluded(element)) return false;
    if (element.matches('.ud-formily-item')
      && (element.getAttribute('data-form-field-i18n-name') || element.getAttribute('data-form-field-name'))) {
      return true;
    }
    if (isApplyFieldContainer(element)) return true;
    if (classTokens(element).includes('info_box')) return true;
    return element.matches('.atsx-form-item,[class*="form-item"],[class*="FormItem"],[class*="field-item"],[class*="FieldItem"]');
  }

  function closestFieldContainer(element, maxDepth = 10) {
    let node = element;
    for (let depth = 0; node instanceof Element && depth < maxDepth; depth += 1, node = node.parentElement) {
      if (isFieldContainerElement(node)) return node;
      if (node.matches('form,main,body,html')) break;
    }
    return null;
  }

  function visible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
      && Number(style.opacity || 1) > 0.01 && element.getAttribute('aria-hidden') !== 'true'
      && rect.width > 0 && rect.height > 0;
  }

  function interactiveDescendants(element) {
    if (!(element instanceof Element)) return [];
    return [...element.querySelectorAll(INTERACTIVE_SELECTOR)]
      .filter((candidate) => visible(candidate) && !candidate.closest(AUDIT_UI_SELECTOR));
  }

  function ownText(element) {
    if (!(element instanceof Element)) return '';
    return cleanText([...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' '));
  }

  function directGenericTitleText(element, maxLength = 120) {
    if (!(element instanceof Element)) return '';
    const attrText = normalizeFieldLabel([
      element.getAttribute('data-form-field-i18n-name'),
      element.getAttribute('data-form-field-title'),
      element.getAttribute('data-form-field-label'),
      element.getAttribute('aria-label')
    ].filter(Boolean).join(' '));
    if (attrText) return attrText.slice(0, maxLength);
    const own = normalizeFieldLabel(ownText(element));
    if (own) return own.slice(0, maxLength);
    for (const child of [...element.children]) {
      if (!(child instanceof Element) || !visible(child) || hasInteractiveDescendant(child)) continue;
      const identity = `${child.tagName.toLowerCase()} ${rawClassName(child)} ${child.getAttribute('role') || ''}`;
      if (!/^(label|legend|dt|th|h[1-6])\b|label|title|fieldName|heading/i.test(identity)) continue;
      const text = normalizeFieldLabel(child.innerText || child.textContent || '');
      if (text) return text.slice(0, maxLength);
    }
    for (const child of [...element.children]) {
      if (!(child instanceof Element) || !visible(child) || hasInteractiveDescendant(child)) continue;
      const text = normalizeFieldLabel(child.innerText || child.textContent || '');
      if (text && text.length <= maxLength) return text;
    }
    return '';
  }

  function looksLikeAddActionElement(element) {
    if (!(element instanceof Element)) return false;
    const identity = `${element.id || ''} ${rawClassName(element)} ${element.getAttribute('name') || ''}`;
    const text = cleanText(element.innerText || element.textContent || '');
    return /add|addMore|addBtn|addButton|_addButton|apply-form-array-card-add|createFormSection-addBtn/i.test(identity)
      || /^(?:添加|新增|增加|add)$/i.test(text);
  }

  function labelledInteractiveChildCount(element) {
    return [...element.children].filter((child) => child instanceof Element
      && interactiveDescendants(child).length > 0
      && directGenericTitleText(child)).length;
  }

  function isGenericFieldContainerElement(element) {
    if (!(element instanceof Element) || !visible(element)) return false;
    if (element.matches('html,body,main,form,fieldset,section')) return false;
    if (pageBlockPriority(element) > 0 && pageBlockTitle(element)) return false;
    const controls = interactiveDescendants(element);
    if (!controls.length || controls.length > 24) return false;
    if (controls.every(looksLikeAddActionElement)) return false;
    if (!directGenericTitleText(element)) return false;
    if (labelledInteractiveChildCount(element) >= 2) return false;
    return true;
  }

  function closestGenericFieldRoot(element, block, maxDepth = 10) {
    let node = element;
    for (let depth = 0; node instanceof Element && depth < maxDepth; depth += 1, node = node.parentElement) {
      if (node === block || node.matches('form,main,body,html')) break;
      if (isGenericFieldContainerElement(node) && block.contains(node)) return node;
    }
    return null;
  }

  function labelledByText(element) {
    const root = element.getRootNode?.();
    return (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
      .map((id) => root?.getElementById?.(id)?.textContent || document.getElementById(id)?.textContent || '').join(' ');
  }

  function directLabelText(element) {
    const labels = element.labels ? [...element.labels].map((label) => label.textContent || '').join(' ') : '';
    const wrappingLabel = element.closest('label')?.textContent || '';
    const parentLabel = element.parentElement?.querySelector(':scope > label,:scope > legend,:scope > dt,:scope > th')?.textContent || '';
    const definitionTitle = element.closest('dl')?.querySelector(':scope > dt')?.textContent || '';
    let fieldTitle = '';
    let fieldNode = element;
    for (let depth = 0; fieldNode instanceof Element && depth < 7; depth += 1, fieldNode = fieldNode.parentElement) {
      fieldTitle = fieldRootTitle(fieldNode);
      if (fieldTitle) {
        break;
      }
    }
    return cleanText([
      labels,
      labelledByText(element),
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('placeholder'),
      wrappingLabel,
      parentLabel,
      definitionTitle,
      fieldTitle,
      element.getAttribute('data-form-field-i18n-name'),
      element.getAttribute('data-form-field-title'),
      element.getAttribute('data-form-field-label'),
      element.getAttribute('cname'),
      element.getAttribute('ename'),
      element.getAttribute('data-form-field-name'),
      element.getAttribute('inputcolname'),
      element.getAttribute('name'),
      element.id
    ].filter(Boolean).join(' ')).slice(0, 260);
  }

  function normalizeFieldLabel(value) {
    let text = removeValidationText(value)
      .replace(/^[*＊·•]+\s*/, '')
      .replace(/\s*[*＊]+\s*$/, '')
      .replace(/^(?:请输入|请填写|请录入|请选择|选择|搜索)\s*/i, '')
      .replace(/^[：:]+|[：:]+$/g, '')
      .replace(/\s*\((?:必填|required)\)\s*$/i, '')
      .trim();
    if (/^(?:请输入|请填写|请录入|请选择|选择|搜索|YYYY|MM|DD|YYYY[-/.]MM(?:[-/.]DD)?)$/i.test(text)) return '';
    if (/^(?:\(无可靠语义文字\)|无可靠语义文字)$/i.test(text)) return '';
    if (looksLikeValidationText(text)) return '';
    if (text.length > 80) text = text.slice(0, 80);
    return text;
  }

  function fieldLabelDetails(element, matchedKey) {
    const candidates = [];
    const push = (value, source) => {
      const label = normalizeFieldLabel(value);
      if (label) candidates.push({ label, source });
    };

    const definitionTitle = element.closest('dl')?.querySelector(':scope > dt');
    if (definitionTitle) push(definitionTitle.textContent, 'definition-title');
    for (let node = element; node instanceof Element; node = node.parentElement) {
      push(node.getAttribute('data-form-field-i18n-name'), 'formily-i18n-name');
      push(node.getAttribute('data-form-field-title'), 'formily-title');
      push(node.getAttribute('data-form-field-label'), 'formily-label');
      if (isFieldContainerElement(node)) break;
    }
    if (element.labels) [...element.labels].forEach((label) => push(label.textContent, 'associated-label'));
    push(labelledByText(element), 'aria-labelledby');

    let node = element;
    for (let depth = 0; node instanceof Element && depth < 8; depth += 1, node = node.parentElement) {
      if (node.matches('dd') && node.previousElementSibling?.matches('dt')) {
        push(node.previousElementSibling.textContent, 'definition-title');
      }
      const title = node.querySelector([
        ':scope > legend', ':scope > [class*="form-item__title"]', ':scope > [class*="title-"]',
        ':scope > [class*="Title-"]', ':scope > [class$="__title"]', ':scope > [class$="-label"]'
      ].join(','));
      if (title && !title.contains(element)) push(cleanFieldTitleNodeText(title), 'field-title');
    }

    push(element.getAttribute('aria-label'), 'aria-label');
    push(element.getAttribute('cname'), 'cname');
    push(element.getAttribute('ename'), 'ename');
    if (matchedKey && FIELD_LABEL_BY_KEY[matchedKey]) push(FIELD_LABEL_BY_KEY[matchedKey], 'semantic-mapping');
    push(element.getAttribute('placeholder'), 'placeholder');

    return candidates[0] || { label: '', source: 'unknown' };
  }

  function phoenixButtonText(element) {
    if (phoenixButtonSelectRoot(element) !== element) return '';
    return cleanText(element.querySelector('.phoenix-button__content')?.textContent || element.textContent);
  }

  function compoundSubControlSemantic(element, parentLabel, parentKey, kind) {
    if (kind !== 'select-trigger') return null;
    const valueText = phoenixButtonText(element);
    if (!valueText) return null;
    const evidence = `${parentLabel || ''} ${parentKey || ''} ${valueText}`;
    if (/(?:identityDocumentNumber|\u8bc1\u4ef6\u53f7\u7801|\u8eab\u4efd\u8bc1\u53f7|document\s*number|id\s*number)/i.test(evidence)
      && /(?:\u8eab\u4efd\u8bc1|\u62a4\u7167|\u901a\u884c\u8bc1|\u519b\u4eba\u8bc1|\u8b66\u5b98\u8bc1|passport|id)/i.test(valueText)) {
      return {
        key: 'identityDocumentType',
        label: '\u8bc1\u4ef6\u7c7b\u578b',
        source: 'compound-prefix-select',
        role: 'identity-document-type',
        valueText,
        subControlOf: parentLabel || FIELD_LABEL_BY_KEY.identityDocumentNumber || ''
      };
    }
    if (/(?:phone|mobile|telephone|\u624b\u673a|\u7535\u8bdd)/i.test(evidence)
      && /(?:\u4e2d\u56fd\u5927\u9646|\u4e2d\u56fd\u6e2f\u6fb3\u53f0|\u56fd\u5916|\u5927\u9646|\u6e2f\u6fb3\u53f0|\u6d77\u5916|\u5883\u5916)/i.test(valueText)) {
      return {
        key: 'phoneCountryRegion',
        label: FIELD_LABEL_BY_KEY.phoneCountryRegion,
        source: 'compound-prefix-select',
        role: 'phone-country-region',
        valueText,
        subControlOf: parentLabel || FIELD_LABEL_BY_KEY.phone || ''
      };
    }
    return null;
  }

  function stripGeneratedOrdinal(label) {
    return cleanText(label).replace(/\s*[（(]?\d+[）)]?\s*$/, '').trim() || cleanText(label);
  }

  function compareItemsByDom(left, right) {
    const leftElement = elementMap.get(left.ref);
    const rightElement = elementMap.get(right.ref);
    if (!(leftElement instanceof Element) || !(rightElement instanceof Element) || leftElement === rightElement) return 0;
    const position = leftElement.compareDocumentPosition(rightElement);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function assignFieldBindings(items) {
    const datePartSuffix = (item) => {
      if (item.datePart === 'year') return '年';
      if (item.datePart === 'month') return '月';
      if (item.datePart === 'day') return '日';
      return '';
    };
    const rangeRoleSuffix = (item) => {
      if (item.dateMechanism !== 'compound-year-month-select') return '';
      if (item.rangeRole === 'start') return '开始';
      if (item.rangeRole === 'end') return '结束';
      return '';
    };
    const groups = new Map();
    for (const item of items.filter((entry) => entry.elementKind === 'field')) {
      const baseLabel = stripGeneratedOrdinal(item.fieldLabel || FIELD_LABEL_BY_KEY[item.matchedKey] || '未命名字段');
      item.fieldLabel = baseLabel;
      const identity = item.matchedKey || baseLabel.toLowerCase();
      const scope = item.moduleTitle || item.blockTitle || item.context || 'page';
      const groupKey = `${scope}::${identity}::${baseLabel}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(item);
    }
    for (const group of groups.values()) {
      const units = [];
      const unitByKey = new Map();
      group.sort(compareItemsByDom);
      for (const item of group) {
        const unitKey = item.dateMechanism === 'compound-year-month-select' && item.rangeGroup
          ? `compound-date:${item.rangeGroup}:${item.rangeRole || 'single'}:${item.matchedKey || ''}`
          : `control:${item.ref}`;
        if (!unitByKey.has(unitKey)) {
          const unit = { key: unitKey, anchor: item, items: [] };
          unitByKey.set(unitKey, unit);
          units.push(unit);
        }
        unitByKey.get(unitKey).items.push(item);
      }
      units.sort((left, right) => compareItemsByDom(left.anchor, right.anchor));
      units.forEach((unit, index) => {
        const ordinal = index + 1;
        unit.items.sort(compareItemsByDom).forEach((item) => {
          const suffix = datePartSuffix(item);
          const roleSuffix = rangeRoleSuffix(item);
          const repeated = units.length > 1 && !roleSuffix;
          item.fieldIndex = ordinal;
          item.fieldCount = units.length;
          item.displayName = `${repeated ? `${item.fieldLabel}${ordinal}` : item.fieldLabel}${roleSuffix}${suffix}`;
          item.bindingKey = item.matchedKey
            ? `${item.matchedKey}${repeated ? ordinal : ''}${suffix ? suffix === '年' ? 'Year' : suffix === '月' ? 'Month' : 'Day' : ''}`
            : item.displayName;
        });
      });
    }
  }

  function mappingSignalsForElement(element, extra = {}) {
    if (!(element instanceof Element)) return extra;
    const descendantWith = (selector, attr) => element.matches(selector)
      ? element.getAttribute(attr) || ''
      : element.querySelector(selector)?.getAttribute(attr) || '';
    return {
      ...extra,
      placeholder: extra.placeholder || descendantWith('[placeholder]', 'placeholder'),
      ariaLabel: extra.ariaLabel || descendantWith('[aria-label]', 'aria-label'),
      title: extra.title || descendantWith('[title]', 'title'),
      name: extra.name || descendantWith('[name]', 'name'),
      id: extra.id || element.id || '',
      className: extra.className || classSummary(element) || rawClassName(element) || ''
    };
  }

  function resolveProfileMapping(fieldLabel, matchedKey, context = '', moduleTitle = '', signals = {}) {
    const profileSchema = globalThis.ResumeProfileSchema;
    if (!profileSchema) return { path: '', candidates: [], candidateDetails: [], evidence: [], score: 0, strategy: 'schema-missing' };
    const makeResult = (path, candidates = [], evidence = [], baseScore = 0, strategy = '') => {
      const unique = [...new Set(candidates.filter(Boolean))];
      const score = path ? baseScore || 100 : unique.length ? Math.min(baseScore || 60, 75) : 0;
      return {
        path: path || '',
        candidates: unique,
        candidateDetails: unique.map((candidate, index) => ({
          path: candidate,
          score: candidate === path ? score : Math.max(10, score - ((index + 1) * 8)),
          reason: candidate === path ? evidence.join(' + ') || 'selected' : evidence.join(' + ') || 'candidate'
        })),
        evidence,
        score,
        strategy: strategy || (path ? 'legacy-rule' : unique.length ? 'legacy-rule-ambiguous' : 'legacy-rule-unmapped')
      };
    };
    if (typeof profileSchema.resolveMapping === 'function') {
      const scored = profileSchema.resolveMapping({ fieldLabel, matchedKey, context, moduleTitle, signals });
      if (scored?.path || scored?.candidates?.length) {
        return {
          path: scored.path || '',
          candidates: scored.candidates || [],
          candidateDetails: scored.candidateDetails || [],
          evidence: scored.evidence || [],
          score: scored.score || 0,
          strategy: scored.strategy || (scored.path ? 'schema-score' : 'schema-score-ambiguous')
        };
      }
    }
    const normalized = profileSchema.normalizeAlias(fieldLabel);
    let candidates = normalized ? profileSchema.aliasIndex
      .filter((item) => item.normalized === normalized)
      .map((item) => item.path) : [];
    candidates = [...new Set(candidates)];
    const moduleSection = profileSchema.moduleSectionForTitle?.(moduleTitle) || '';
    const highestEducationDerived = {
      degree: 'educationExperiences[highest].degree',
      graduationDate: 'educationExperiences[highest].endDate',
      studyMode: 'educationExperiences[highest].studyMode'
    };
    const derivedPath = highestEducationDerived[matchedKey] || '';
    if (moduleSection === 'basic' && derivedPath) {
      return makeResult(derivedPath, [derivedPath], ['module-basic', 'derived-highest-education', matchedKey].filter(Boolean), 96);
    }
    const moduleAgnosticPaths = {
      acceptsAdjustment: 'jobPreferences.acceptsAdjustment',
      recruitmentSource: 'jobPreferences.recruitmentSource'
    };
    const moduleAgnosticPath = moduleAgnosticPaths[matchedKey] || '';
    if (moduleAgnosticPath) return makeResult(moduleAgnosticPath, [moduleAgnosticPath], ['module-agnostic', matchedKey].filter(Boolean), 94);
    const moduleOverride = moduleSection && matchedKey
      ? profileSchema.moduleFieldOverrides?.[moduleSection]?.[matchedKey] || ''
      : '';
    if (moduleOverride) return makeResult(moduleOverride, [moduleOverride], ['module-override', moduleSection, matchedKey].filter(Boolean), 93);
    if (moduleSection) {
      const contextual = candidates.filter((path) => profileSchema.profilePathInSection?.(path, moduleSection));
      if (contextual.length === 1) return makeResult(contextual[0], contextual, ['exact-alias', 'module-section', moduleSection].filter(Boolean), 90);
      if (contextual.length) candidates = contextual;
    }
    const sectionByContext = {
      education: 'educationExperiences[]', work: 'workExperiences[]', project: 'projectExperiences[]',
      campus: 'campusExperiences[]', practice: 'practiceExperiences[]', certificate: 'certificates[]',
      award: 'awards[]', language: 'languageSkills[]', family: 'familyMembers[]',
      publication: 'publications[]', patent: 'patents[]', skill: 'skills[]', highSchool: 'highSchool',
      attachments: 'attachments'
    };
    const contextPrefix = sectionByContext[context];
    const contextual = contextPrefix ? candidates.filter((path) => path.startsWith(contextPrefix)) : [];
    if (contextual.length === 1) return makeResult(contextual[0], contextual, ['exact-alias', 'context-prefix', context].filter(Boolean), 88);
    if (contextual.length) candidates = contextual;
    const legacyPath = profileSchema.legacyKeyToPath?.[matchedKey] || '';
    if (legacyPath && (!moduleSection || profileSchema.profilePathInSection?.(legacyPath, moduleSection))) {
      return makeResult(legacyPath, [legacyPath], ['legacy-key', matchedKey].filter(Boolean), 82);
    }
    const patternPath = profileSchema.patternRules?.find((rule) => rule.pattern.test(fieldLabel))?.path || '';
    if (patternPath && (!moduleSection || profileSchema.profilePathInSection?.(patternPath, moduleSection))) {
      return makeResult(patternPath, [patternPath], ['pattern-rule'].filter(Boolean), 76);
    }
    return makeResult(candidates.length === 1 ? candidates[0] : '', candidates, ['exact-alias'].filter(Boolean), candidates.length === 1 ? 72 : 60);
  }

  function moduleContextForTitle(moduleTitle) {
    const section = globalThis.ResumeProfileSchema?.moduleSectionForTitle?.(moduleTitle) || '';
    return {
      educationExperiences: 'education',
      workExperiences: 'work',
      projectExperiences: 'project',
      campusExperiences: 'campus',
      practiceExperiences: 'practice',
      certificates: 'certificate',
      awards: 'award',
      languageSkills: 'language',
      familyMembers: 'family',
      publications: 'publication',
      patents: 'patent',
      skills: 'skill',
      highSchool: 'highSchool',
      attachments: 'attachments'
    }[section] || '';
  }

  function remapFieldProfiles(items) {
    for (const item of items.filter((entry) => entry.elementKind === 'field')) {
      const element = sourceElementMap.get(item.ref) || elementMap.get(item.ref);
      const moduleContext = moduleContextForTitle(item.moduleTitle);
      const context = moduleContext || item.context || '';
      const nearestField = element instanceof Element ? closestFieldContainer(element, 12) : null;
      const nearestLabel = nearestField instanceof Element ? stripGeneratedOrdinal(fieldRootTitle(nearestField)) : '';
      const label = item.compoundRole
        ? item.fieldLabel || item.displayName || item.text || ''
        : nearestLabel || item.fieldBlockLabel || item.fieldLabel || item.displayName || item.text || '';
      const isRangeDateEndpoint = item.dateMechanism === 'compound-year-month-select' && Boolean(item.rangeRole);
      const key = item.compoundRole
        ? item.matchedKey || ''
        : isRangeDateEndpoint && item.matchedKey
          ? item.matchedKey
          : matchKey(label, context) || item.matchedKey || '';
      const profileMapping = resolveProfileMapping(label, key, context, item.moduleTitle || '', mappingSignalsForElement(element, {
        text: item.text || '',
        displayName: item.displayName || '',
        fieldLabel: item.fieldLabel || '',
        profilePath: item.profilePath || ''
      }));
      const repeatBinding = element instanceof Element
        ? repeatBindingDetails(element, profileMapping.path, context)
        : { repeatSection: '', repeatIndex: 0, repeatGroup: '' };
      item.context = context || item.context;
      item.matchedKey = key;
      if (!item.compoundRole && label) item.fieldLabel = stripGeneratedOrdinal(label);
      if (!item.compoundRole && nearestLabel) item.fieldBlockLabel = nearestLabel;
      item.profilePath = profileMapping.path;
      item.profilePathCandidates = profileMapping.candidates;
      item.profilePathCandidateDetails = profileMapping.candidateDetails;
      item.mappingEvidence = profileMapping.evidence;
      item.mappingScore = profileMapping.score;
      item.mappingStrategy = profileMapping.strategy;
      item.mappingStatus = profileMapping.path ? 'mapped' : profileMapping.candidates.length ? 'ambiguous' : 'unmapped';
      item.repeatSection = repeatBinding.repeatSection;
      item.repeatIndex = repeatBinding.repeatIndex || item.recordIndex || (profileMapping.path.includes('[]') ? Number(item.fieldIndex || 0) : 0);
      item.repeatGroup = repeatBinding.repeatGroup || (item.repeatSection && item.repeatIndex ? `${item.repeatSection}[${item.repeatIndex - 1}]` : '') || item.repeatGroup || '';
    }
  }

  function actionDescription(element) {
    return cleanText([
      element.getAttribute('aria-label'),
      labelledByText(element),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.id,
      element.innerText || element.textContent
    ].filter(Boolean).join(' ')).slice(0, 260);
  }

  function sectionContext(element) {
    const evidence = [];
    let node = element;
    for (let depth = 0; node instanceof Element && depth < 6; depth += 1, node = node.parentElement) {
      evidence.push(node.id || '', node.getAttribute('name') || '', node.getAttribute('data-testid') || '', classSummary(node));
      const heading = node.querySelector(':scope > legend,:scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > [role="heading"],:scope > [class*="title"],:scope > [class*="Title"]');
      if (heading) evidence.push(heading.textContent || '');
    }
    const text = cleanText(evidence.join(' '));
    if (/教育|学历|学校|院校|education|academic|school/i.test(text)) return 'education';
    if (/校园|校内|社团|学生会|campus/i.test(text)) return 'campus';
    if (/高中|高考|文理科|gaokao|high.?school/i.test(text)) return 'highSchool';
    if (/社会实践|实践经历|social.?practice/i.test(text)) return 'practice';
    if (/论文|期刊|发表|publication|journal/i.test(text)) return 'publication';
    if (/专利|patent/i.test(text)) return 'patent';
    if (/技能|特长|skill/i.test(text)) return 'skill';
    if (/附件|上传|成绩单|证件照|attachment|upload|transcript/i.test(text)) return 'attachments';
    if (/工作|实习|任职|employment|experience|intern|work/i.test(text)) return 'work';
    if (/项目|project/i.test(text)) return 'project';
    if (/奖项|奖励|荣誉|award|honou?r/i.test(text)) return 'award';
    if (/证书|职业资格|certificate/i.test(text)) return 'certificate';
    if (/语言|英语|language|english/i.test(text)) return 'language';
    if (/家庭|亲属|联系人|family|relative|emergency/i.test(text)) return 'family';
    return '';
  }

  function matchKey(text, context = '') {
    const normalized = cleanText(text);
    if (!normalized) return '';
    const direct = FIELD_RULES.find(([, pattern]) => pattern.test(normalized));
    if (direct) return direct[0];
    if (/^(?:经历)?(?:描述|说明|内容|职责)(?:\d+)?$|^description$/i.test(normalized)) {
      const descriptionKeys = {
        work: 'workDescription',
        project: 'projectDescription',
        campus: 'campusDescription',
        practice: 'practiceDescription',
        certificate: 'certificateDescription',
        award: 'awardDescription'
      };
      return descriptionKeys[context] || '';
    }
    if (/开始时间|开始日期|start\s*date/i.test(normalized)) {
      const startKeys = {
        education: 'educationStartDate',
        work: 'workStartDate',
        project: 'projectStartDate',
        campus: 'campusStartDate',
        practice: 'practiceStartDate',
        certificate: 'certificateDate',
        award: 'awardDate'
      };
      return startKeys[context] || 'periodStartDate';
    }
    if (/结束时间|结束日期|毕业时间|end\s*date|graduation\s*date/i.test(normalized)) {
      const endKeys = {
        education: 'graduationDate',
        work: 'workEndDate',
        project: 'projectEndDate',
        campus: 'campusEndDate',
        practice: 'practiceEndDate'
      };
      return endKeys[context] || 'periodEndDate';
    }
    return '';
  }

  function startDateKeyForContext(context = '') {
    return {
      education: 'educationStartDate',
      work: 'workStartDate',
      project: 'projectStartDate',
      campus: 'campusStartDate',
      practice: 'practiceStartDate',
      certificate: 'certificateDate',
      award: 'awardDate'
    }[context] || 'periodStartDate';
  }

  function endDateKeyForContext(context = '') {
    return {
      education: 'graduationDate',
      work: 'workEndDate',
      project: 'projectEndDate',
      campus: 'campusEndDate',
      practice: 'practiceEndDate'
    }[context] || 'periodEndDate';
  }

  function rangeDateKeyForContext(role, context = '') {
    return role === 'end' ? endDateKeyForContext(context) : startDateKeyForContext(context);
  }

  function dateRangeLabelBase(item) {
    return stripGeneratedOrdinal(item.fieldBlockLabel || item.fieldLabel || item.displayName || item.text || '');
  }

  function dateRangeEvidence(item) {
    const element = sourceElementMap.get(item.ref) || elementMap.get(item.ref);
    const values = [
      item.fieldBlockLabel,
      item.fieldLabel,
      item.displayName,
      item.text,
      item.placeholder,
      item.ariaLabel,
      item.name,
      item.id,
      item.class,
      item.domPath
    ];
    if (element instanceof Element) {
      values.push(
        element.getAttribute('placeholder'),
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('name'),
        element.id,
        rawClassName(element)
      );
    }
    return cleanText(values.filter(Boolean).join(' '));
  }

  function hasDateRangeHint(text) {
    return /(?:\u8d77\u6b62|\u5f00\u59cb.*\u7ed3\u675f|\u7ed3\u675f.*\u5f00\u59cb|\u65f6\u95f4\u6bb5|\u65e5\u671f\u8303\u56f4|\u533a\u95f4|range|period|duration|from.*to|start.*end)/i.test(text);
  }

  function hasDateLikeHint(text) {
    return /(?:\u65f6\u95f4|\u65e5\u671f|\u5e74\u6708|\u8d77\u6b62|\u5165\u5b66|\u6bd5\u4e1a|\u5c31\u8bfb(?:\u65f6\u95f4|\u65e5\u671f)?|\u4efb\u804c(?:\u65f6\u95f4|\u65e5\u671f)?|\u5728\u804c(?:\u65f6\u95f4|\u65e5\u671f)?|\u5b9e\u4e60(?:\u65f6\u95f4|\u65e5\u671f)|\u9879\u76ee(?:\u65f6\u95f4|\u65e5\u671f)|\u5de5\u4f5c(?:\u65f6\u95f4|\u65e5\u671f)|\u5b66\u4e60(?:\u65f6\u95f4|\u65e5\u671f)|\u5728\u6821(?:\u65f6\u95f4|\u65e5\u671f)|date|time|period|year|month)/i.test(text);
  }

  function isDateSelectableControl(item) {
    if (item.elementKind !== 'field') return false;
    if (item.rangeRole || item.datePart || item.datePrecision || item.dateMechanism) return true;
    if (DATE_KEYS.test(item.matchedKey || '')) return true;
    if (/date|month|picker/i.test(item.controlKind || '')) return true;
    if (/select|autocomplete|combobox|input|write/i.test(`${item.actionType || ''} ${item.operationGroup || ''} ${item.controlKind || ''}`)) return true;
    const evidence = dateRangeEvidence(item);
    return hasDateLikeHint(evidence);
  }

  function dateRangeRecordScope(item) {
    return item.repeatGroup || item.recordGroup || (item.recordIndex ? `record:${item.recordIndex}` : 'record:0');
  }

  function dateRangeGroupKey(item) {
    const label = dateRangeLabelBase(item).toLowerCase();
    const context = item.context || moduleContextForTitle(item.moduleTitle) || '';
    return [
      item.blockRef || '',
      item.moduleTitle || item.blockTitle || context || 'page',
      item.fieldBlockLabel ? stripGeneratedOrdinal(item.fieldBlockLabel).toLowerCase() : label,
      dateRangeRecordScope(item),
      label
    ].join('::');
  }

  function setInferredDateEndpoint(item, role, datePart, groupKey, precision) {
    const element = sourceElementMap.get(item.ref) || elementMap.get(item.ref);
    const context = item.context || moduleContextForTitle(item.moduleTitle) || sectionContext(sourceElementMap.get(item.ref) || elementMap.get(item.ref)) || '';
    const key = rangeDateKeyForContext(role, context);
    const label = dateRangeLabelBase(item) || FIELD_LABEL_BY_KEY[key] || (role === 'start' ? FIELD_LABEL_BY_KEY.periodStartDate : FIELD_LABEL_BY_KEY.periodEndDate);
    const profileMapping = resolveProfileMapping(label, key, context, item.moduleTitle || '', mappingSignalsForElement(element, {
      text: item.text || '',
      displayName: item.displayName || '',
      fieldLabel: item.fieldLabel || '',
      profilePath: item.profilePath || ''
    }));
    const repeatBinding = element instanceof Element
      ? repeatBindingDetails(element, profileMapping.path, context)
      : { repeatSection: '', repeatIndex: 0, repeatGroup: '' };
    item.context = context || item.context;
    item.fieldLabel = label;
    item.fieldLabelSource = item.fieldLabelSource || 'inferred-date-range';
    item.matchedKey = key;
    item.profilePath = profileMapping.path;
    item.profilePathCandidates = profileMapping.candidates;
    item.profilePathCandidateDetails = profileMapping.candidateDetails;
    item.mappingEvidence = profileMapping.evidence;
    item.mappingScore = profileMapping.score;
    item.mappingStrategy = profileMapping.strategy;
    item.mappingStatus = profileMapping.path ? 'mapped' : profileMapping.candidates.length ? 'ambiguous' : 'unmapped';
    item.repeatSection = repeatBinding.repeatSection || item.repeatSection || '';
    item.repeatIndex = repeatBinding.repeatIndex || item.repeatIndex || item.recordIndex || 0;
    item.repeatGroup = repeatBinding.repeatGroup || item.repeatGroup || '';
    item.rangeRole = role;
    item.rangeGroup = groupKey;
    item.rangeIndex = item.recordIndex || item.rangeIndex || 1;
    item.datePart = datePart;
    item.datePrecision = precision;
    item.dateMechanism = 'compound-year-month-select';
    item.semanticType = 'date';
    if (item.actionType === 'write') {
      item.actionType = 'select-search';
      item.operationGroup = operationGroup(item.actionType);
      item.valueDomain = item.valueDomain === 'open' ? 'closed-local' : item.valueDomain;
      item.interaction = {
        ...item.interaction,
        searchable: true,
        confirmationRequired: true
      };
    }
  }

  function inferCommonDateRanges(items) {
    const fields = items.filter((item) => item.elementKind === 'field' && isDateSelectableControl(item));
    const groups = new Map();
    for (const item of fields) {
      const baseLabel = dateRangeLabelBase(item);
      const evidence = dateRangeEvidence(item);
      if (!baseLabel && !hasDateLikeHint(evidence)) continue;
      const key = dateRangeGroupKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    for (const group of groups.values()) {
      group.sort(compareItemsByDom);
      const evidence = cleanText(group.map(dateRangeEvidence).join(' '));
      const baseLabel = dateRangeLabelBase(group[0]);
      const dateLike = hasDateLikeHint(`${baseLabel} ${evidence}`);
      if (!dateLike) continue;

      const applyTuple = (tuple, parts, precision, rangeKeySuffix) => {
        const anchor = tuple[0] || group[0];
        const groupKey = [
          'inferred-date-range',
          anchor.blockRef || '',
          anchor.moduleTitle || anchor.blockTitle || anchor.context || 'page',
          dateRangeRecordScope(anchor),
          baseLabel || rangeKeySuffix,
          rangeKeySuffix
        ].join(':');
        tuple.forEach((item, index) => {
          const part = parts[index];
          setInferredDateEndpoint(item, part.role, part.datePart, groupKey, precision);
        });
      };

      if (group.length === 4) {
        applyTuple(group, [
          { role: 'start', datePart: 'year' },
          { role: 'start', datePart: 'month' },
          { role: 'end', datePart: 'year' },
          { role: 'end', datePart: 'month' }
        ], 'year-month', 'ym4');
      } else if (group.length > 4 && group.length % 4 === 0) {
        for (let index = 0; index < group.length; index += 4) {
          applyTuple(group.slice(index, index + 4), [
            { role: 'start', datePart: 'year' },
            { role: 'start', datePart: 'month' },
            { role: 'end', datePart: 'year' },
            { role: 'end', datePart: 'month' }
          ], 'year-month', `ym4-${index / 4 + 1}`);
        }
      } else if (group.length === 6) {
        applyTuple(group, [
          { role: 'start', datePart: 'year' },
          { role: 'start', datePart: 'month' },
          { role: 'start', datePart: 'day' },
          { role: 'end', datePart: 'year' },
          { role: 'end', datePart: 'month' },
          { role: 'end', datePart: 'day' }
        ], 'date', 'ymd6');
      } else if (group.length > 6 && group.length % 6 === 0) {
        for (let index = 0; index < group.length; index += 6) {
          applyTuple(group.slice(index, index + 6), [
            { role: 'start', datePart: 'year' },
            { role: 'start', datePart: 'month' },
            { role: 'start', datePart: 'day' },
            { role: 'end', datePart: 'year' },
            { role: 'end', datePart: 'month' },
            { role: 'end', datePart: 'day' }
          ], 'date', `ymd6-${index / 6 + 1}`);
        }
      } else if (group.length === 2 && hasDateRangeHint(`${baseLabel} ${evidence}`)) {
        applyTuple(group, [
          { role: 'start', datePart: '' },
          { role: 'end', datePart: '' }
        ], 'year-month', 'ym2');
      }
    }
  }

  function queryAllDeep(selector) {
    const results = [];
    const roots = [document];
    const visited = new Set();
    while (roots.length) {
      const root = roots.shift();
      if (!root || visited.has(root)) continue;
      visited.add(root);
      for (const element of root.querySelectorAll(selector)) results.push(element);
      for (const host of root.querySelectorAll('*')) {
        if (host.shadowRoot) roots.push(host.shadowRoot);
      }
    }
    return [...new Set(results)];
  }

  function isOpenTextField(element, matchedKey, text) {
    if (!element.matches('input,textarea,[contenteditable]:not([contenteditable="false"])')) return false;
    if (element.disabled || element.readOnly || element.getAttribute('aria-disabled') === 'true'
      || element.getAttribute('aria-readonly') === 'true') return false;
    const type = String(element.type || '').toLowerCase();
    if (element.hasAttribute('list')) return true;
    if (['email', 'tel', 'url', 'text', 'search', 'number', 'password', ''].includes(type)
      && (OPEN_TEXT_KEYS.has(matchedKey) || OPEN_TEXT_HINT.test(text))
      && closedValueEvidence(element).length === 0) return true;
    return false;
  }

  function currentFieldContainer(element) {
    const field = closestFieldContainer(element, 8);
    if (field) return field;
    return element.closest('label') || null;
  }

  function declaredFieldMode(element) {
    const boundary = currentFieldContainer(element);
    let node = element;
    let stringField = false;
    for (let depth = 0; node instanceof Element && depth < 8; depth += 1, node = node.parentElement) {
      const classes = rawClassName(node);
      if (/(?:^|\s)select_info(?:\s|$|-)|sd-Select-container/i.test(classes)) return 'select';
      if (/(?:^|\s)string_info(?:\s|$|-)/i.test(classes)) stringField = true;
      if (node === boundary) break;
    }
    return stringField ? 'string' : '';
  }

  function isPlainEditableTextField(element) {
    if (!element.matches('input,textarea')) return false;
    if (element.disabled || element.readOnly || element.getAttribute('aria-disabled') === 'true'
      || element.getAttribute('aria-readonly') === 'true') return false;
    const type = String(element.type || '').toLowerCase();
    return element instanceof HTMLTextAreaElement
      || ['email', 'tel', 'url', 'text', 'search', 'number', 'password', ''].includes(type);
  }

  function closedValueEvidence(element) {
    const evidence = [];
    const role = String(element.getAttribute('role') || '').toLowerCase();
    if (radioGroupRoot(element) === element) evidence.push('radio-group-options');
    if (element instanceof HTMLSelectElement) evidence.push('native-select');
    if (element.getAttribute('aria-haspopup') === 'listbox'
      && (element.hasAttribute('aria-expanded') || element.getAttribute('aria-controls') || element.getAttribute('aria-owns'))) {
      evidence.push('aria-listbox-popup');
    }
    if (role === 'combobox'
      && (element.getAttribute('aria-controls') || element.getAttribute('aria-owns') || element.hasAttribute('aria-expanded'))) {
      evidence.push('aria-combobox-popup');
    }
    if (declaredFieldMode(element) === 'select') evidence.push('select-info-wrapper');
    const activationHandler = `${element.getAttribute('onfocus') || ''} ${element.getAttribute('onclick') || ''} ${element.getAttribute('onmousedown') || ''}`;
    if ((element.readOnly || element.getAttribute('aria-readonly') === 'true') && cleanText(activationHandler)) {
      evidence.push('readonly-activation-handler');
    }
    const root = selectRoot(element);
    if (root && /select|cascader|dropdown|picker/i.test(rawClassName(root))) {
      evidence.push(root === element ? 'select-component-root' : 'select-component-wrapper');
    }
    return evidence;
  }

  function searchableEvidence(element) {
    const ariaAutocomplete = String(element.getAttribute('aria-autocomplete') || '').toLowerCase();
    const root = selectRoot(element) || element;
    return ariaAutocomplete === 'list' || ariaAutocomplete === 'both'
      || /(?:^|\s)phoenix-select--editable(?:\s|$)/i.test(rawClassName(root))
      || declaredFieldMode(element) === 'select' && isPlainEditableTextField(element)
      || /autocomplete|auto-complete|searchable|filterable|typeahead/i.test(rawClassName(root));
  }

  function radioGroupRoot(element) {
    const group = element.closest('.phoenix-radio-group,.ud__radio-group,[role="radiogroup"],fieldset');
    if (!group || !visible(group)) return null;
    const nativeOption = element.matches('input[type="radio"],[role="radio"]')
      || Boolean(element.closest('label')?.querySelector('input[type="radio"],[role="radio"]'));
    if (group.matches('fieldset') && element !== group && !nativeOption) return null;
    const nativeOptions = group.querySelectorAll('input[type="radio"],[role="radio"]');
    const phoenixOptions = group.querySelectorAll('.phoenix-radio-group__radioItem');
    return nativeOptions.length >= 2 || phoenixOptions.length >= 2 ? group : null;
  }

  function radioGroupOptions(element) {
    const group = radioGroupRoot(element);
    if (!group) return [];
    const phoenixItems = [...group.querySelectorAll('.phoenix-radio-group__radioItem')];
    const optionNodes = phoenixItems.length
      ? phoenixItems
      : [...group.querySelectorAll('input[type="radio"],[role="radio"]')];
    return [...new Set(optionNodes.map((option) => {
      const phoenixText = option.querySelector?.('.phoenix-radio__radio-text')?.textContent || '';
      const udText = option.querySelector?.('.ud__radio__label-content')?.textContent || '';
      const labels = option.labels ? [...option.labels].map((label) => label.textContent || '').join(' ') : '';
      const wrappingLabel = option.closest('label')?.textContent || '';
      return cleanText(phoenixText || udText || labels || wrappingLabel || option.getAttribute('aria-label') || option.textContent);
    }).filter(Boolean))];
  }

  function phoenixRadioOptionText(option) {
    if (!(option instanceof Element)) return '';
    return cleanText(option.querySelector?.('.phoenix-radio__radio-text')?.textContent
      || option.getAttribute?.('aria-label')
      || option.textContent
      || '');
  }

  function phoenixRadioSelectedText(element) {
    if (!(element instanceof Element)) return '';
    const group = element.matches?.('.phoenix-radio-group')
      ? element
      : element.closest?.('.phoenix-radio-group') || element.querySelector?.('.phoenix-radio-group');
    if (!(group instanceof Element) || !visible(group)) return '';
    const options = [...group.querySelectorAll('.phoenix-radio-group__radioItem,.phoenix-radio')];
    const selected = options.find((option) => {
      const className = rawClassName(option);
      return /phoenix-radio--checked|phoenix-radio__circle-wrapper--checked|phoenix-radio__dot--checked/.test(className)
        || option.getAttribute?.('aria-checked') === 'true'
        || Boolean(option.querySelector?.('.phoenix-radio--checked,.phoenix-radio__circle-wrapper--checked,.phoenix-radio__dot--checked,[aria-checked="true"]'));
    });
    return phoenixRadioOptionText(selected);
  }

  function atsxPeriodEndpoint(element, fallbackContext = '') {
    const trigger = element.closest('.atsx-date-picker-period-month-label');
    if (!trigger) return null;
    const dataCy = trigger.getAttribute('data-cy') || '';
    const role = /InputBegin$/i.test(dataCy) ? 'start' : /InputEnd$/i.test(dataCy) ? 'end' : '';
    if (!role) return null;
    const rangeGroup = dataCy.replace(/Input(?:Begin|End)$/i, '');
    const structuralContext = /^education(?:\[|\.|$)/i.test(rangeGroup) ? 'education'
      : /^work(?:\[|\.|$)|^experience(?:\[|\.|$)/i.test(rangeGroup) ? 'work'
      : /^project(?:\[|\.|$)/i.test(rangeGroup) ? 'project' : '';
    const context = structuralContext || fallbackContext;
    const indexMatch = rangeGroup.match(/\[(\d+)\]/);
    return {
      trigger,
      role,
      label: role === 'start' ? '开始时间' : '结束时间',
      key: rangeDateKeyForContext(role, context),
      context,
      rangeGroup,
      rangeIndex: indexMatch ? Number(indexMatch[1]) + 1 : 1,
      datePrecision: 'year-month',
      dateMechanism: 'compound-year-month-select'
    };
  }

  function isAtsxPeriodInternalNoise(element) {
    const period = element.closest('.atsx-date-picker-period-month');
    return Boolean(period && !element.closest('.atsx-date-picker-period-month-label'));
  }

  function yearMonthToken(element) {
    const text = cleanText([
      element.getAttribute?.('placeholder'),
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('title'),
      element.getAttribute?.('data-placeholder')
    ].filter(Boolean).join(' '));
    if (/^(?:年|yyyy|year)$/i.test(text)) return 'year';
    if (/^(?:月|mm|month)$/i.test(text)) return 'month';
    return '';
  }

  function isMokaYearMonthSelect(element) {
    if (!(element instanceof HTMLInputElement) || !visible(element)) return false;
    if (!yearMonthToken(element)) return false;
    const root = selectRoot(element) || element.closest('label,[class*="sd-Input"],[class*="sd-Select"]');
    const classes = `${rawClassName(root)} ${rawClassName(element.closest('label'))} ${rawClassName(element.parentElement)}`;
    return /sd-(?:Input|Select)|select_info|no-adaptive-tooltip/i.test(classes);
  }

  function yearMonthTokenV2(element) {
    const text = cleanText([
      element.getAttribute?.('placeholder'),
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('title'),
      element.getAttribute?.('data-placeholder'),
      element.getAttribute?.('value'),
      element.innerText || element.textContent
    ].filter(Boolean).join(' '));
    if (/^(?:\u5e74|yyyy|year)$/i.test(text)) return 'year';
    if (/^(?:\u6708|mm|month)$/i.test(text)) return 'month';
    return '';
  }

  function isYearMonthControl(element) {
    if (!(element instanceof Element) || !visible(element)) return false;
    if (!yearMonthTokenV2(element)) return false;
    const root = selectRoot(element) || element.closest('label,[class*="sd-Input"],[class*="sd-Select"]') || element;
    const classes = `${rawClassName(root)} ${rawClassName(element.closest('label'))} ${rawClassName(element.parentElement)}`;
    return /sd-(?:Input|Select)|select_info|no-adaptive-tooltip|month|date|picker|select|button/i.test(classes)
      || element.matches('button,[role="button"],[role="combobox"],input');
  }

  function visualRect(element) {
    const target = selectRoot(element) || element;
    return target.getBoundingClientRect();
  }

  function sameVisualRow(left, right) {
    const leftRect = visualRect(left);
    const rightRect = visualRect(right);
    const leftCenter = leftRect.top + leftRect.height / 2;
    const rightCenter = rightRect.top + rightRect.height / 2;
    return Math.abs(leftCenter - rightCenter) <= Math.max(12, Math.min(leftRect.height || 0, rightRect.height || 0) * 0.75);
  }

  function yearMonthInputsOnRow(root, anchor) {
    return [...root.querySelectorAll('input:not([type="hidden"]),button,[role="button"],[role="combobox"]')]
      .filter((input) => input === anchor || isYearMonthControl(input))
      .filter((input) => isYearMonthControl(input) && sameVisualRow(input, anchor))
      .sort((left, right) => visualRect(left).left - visualRect(right).left);
  }

  function mokaYearMonthRow(element) {
    if (!isYearMonthControl(element)) return [];
    let fallback = [];
    for (let node = element.parentElement, depth = 0; node instanceof Element && depth < 10; depth += 1, node = node.parentElement) {
      const row = yearMonthInputsOnRow(node, element);
      if (row.length >= 4) {
        const anchorIndex = Math.max(0, row.indexOf(element));
        const pairStart = anchorIndex % 2 === 0 ? anchorIndex : anchorIndex - 1;
        const start = Math.max(0, Math.min(pairStart, row.length - 4));
        return row.slice(start, start + 4);
      }
      if (row.length >= 2 && !fallback.length) fallback = row.slice(0, 2);
      if (node.matches('form,main,body,html')) break;
    }
    return fallback;
  }

  function mokaYearMonthPairs(row) {
    const pairs = [];
    for (let index = 0; index < row.length - 1; index += 1) {
      if (yearMonthTokenV2(row[index]) !== 'year' || yearMonthTokenV2(row[index + 1]) !== 'month') continue;
      pairs.push({ year: row[index], month: row[index + 1], startIndex: index });
      index += 1;
    }
    return pairs;
  }

  function mokaFieldContainerLabel(element) {
    const field = closestFieldContainer(element, 10) || element.closest('label');
    return field instanceof Element ? stripGeneratedOrdinal(fieldRootTitle(field)) : '';
  }

  function mokaYearMonthLabel(row) {
    const labels = [
      ...row.map(mokaFieldContainerLabel),
      ...row.map((input) => fieldLabelDetails(input, '').label)
    ]
      .map((label) => stripGeneratedOrdinal(label))
      .filter((label) => label && !/^(?:年|月|请选择|选择|YYYY|MM)$/i.test(label));
    return labels.find((label) => /时间|日期|起止|就读|任职|实习|项目|证书|获奖|date|time|period/i.test(label))
      || labels[0] || '';
  }

  function mokaYearMonthRangeGroup(row, context, label) {
    const first = visualRect(row[0]);
    return `moka-year-month:${context || 'date'}:${label || 'range'}:${Math.round(first.top)}:${Math.round(first.left)}`;
  }

  function mokaYearMonthEndpoint(element, fallbackContext = '') {
    const row = mokaYearMonthRow(element);
    if (row.length < 2) return null;
    const pairs = mokaYearMonthPairs(row);
    if (!pairs.length) return null;
    const pairIndex = pairs.findIndex((pair) => pair.year === element || pair.month === element);
    if (pairIndex < 0) return null;
    const datePart = pairs[pairIndex].year === element ? 'year' : 'month';
    const context = fallbackContext || sectionContext(element);
    const label = mokaYearMonthLabel(row);
    const isRange = pairs.length >= 2;
    const role = isRange && pairIndex > 0 ? 'end' : 'start';
    const labelKey = matchKey(label, context);
    const singleDateKey = labelKey || (context === 'certificate' ? 'certificateDate'
      : context === 'award' ? 'awardDate'
        : rangeDateKeyForContext(role, context));
    return {
      trigger: selectRoot(element) || element,
      role: isRange ? role : '',
      label: isRange
        ? label || FIELD_LABEL_BY_KEY[rangeDateKeyForContext(role, context)] || (role === 'start' ? '开始时间' : '结束时间')
        : label || FIELD_LABEL_BY_KEY[singleDateKey] || '时间',
      key: isRange ? rangeDateKeyForContext(role, context) : singleDateKey,
      context,
      rangeGroup: mokaYearMonthRangeGroup(row, context, label),
      rangeIndex: 1,
      datePart,
      datePrecision: 'year-month',
      dateMechanism: 'compound-year-month-select'
    };
  }

  function isMokaYearMonthInternalNoise(element) {
    return false;
  }

  function preciseAddTarget(element) {
    const description = cleanText([
      element.getAttribute('aria-label'), element.getAttribute('title'),
      element.innerText || element.textContent
    ].filter(Boolean).join(' '));
    if (!ADD_PATTERN.test(description) || ADD_NEGATIVE_PATTERN.test(description)) return null;
    const candidates = [element, ...element.querySelectorAll('button,a,[role="button"],[onclick],[tabindex],[aria-label],[title],i,span,svg')]
      .filter((candidate) => {
        if (!visible(candidate)) return false;
        const text = cleanText([
          candidate.getAttribute('aria-label'), candidate.getAttribute('title'),
          candidate.innerText || candidate.textContent
        ].filter(Boolean).join(' '));
        if (!ADD_PATTERN.test(text) || ADD_NEGATIVE_PATTERN.test(text) || text.length > 36) return false;
        const preciseAddClass = /createFormSection-addBtn|addMore-(?:plus|add)|(?:add|plus)[_-]?(?:icon|text|label)/i.test(rawClassName(candidate));
        return preciseAddClass || candidate.matches('button,a,[role="button"],[onclick],[tabindex]')
          || getComputedStyle(candidate).cursor === 'pointer';
      });
    if (!candidates.length) return element;
    return candidates.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return leftRect.width * leftRect.height - rightRect.width * rightRect.height;
    })[0];
  }

  function phoenixButtonSelectRoot(element) {
    const wrapper = element.closest('.phoenix-button__wraper')
      || (element.matches('.phoenix-button') ? element.querySelector(':scope > .phoenix-button__wraper') : null);
    if (!wrapper || !visible(wrapper) || !wrapper.querySelector('.phoenix-button__suffixIcon')) return null;
    const outer = wrapper.closest('.phoenix-button');
    return outer && visible(outer) ? outer : wrapper;
  }

  function phoenixOptionPanelRoot(element) {
    const layer = element.closest('.common-unmodeled-layer');
    if (layer && visible(layer) && layer.querySelector('.phoenix-selectList')) return layer;
    const content = element.closest('.common-unmodeled-layer__layerContent');
    if (content && visible(content) && content.querySelector('.phoenix-selectList')) return content;
    const list = element.closest('.phoenix-selectList');
    return list && visible(list) ? list : null;
  }

  function canonicalInteractiveElement(element) {
    const radioGroup = radioGroupRoot(element);
    if (radioGroup) return radioGroup;
    const phoenixOptionPanel = phoenixOptionPanelRoot(element);
    if (phoenixOptionPanel) return phoenixOptionPanel;
    const phoenixButtonSelect = phoenixButtonSelectRoot(element);
    if (phoenixButtonSelect) return phoenixButtonSelect;
    const atsxDropdown = element.closest('.atsx-date-picker-dropdown');
    if (atsxDropdown && visible(atsxDropdown)) return atsxDropdown;
    const atsxMonthLabel = element.closest('.atsx-date-picker-period-month-label');
    if (atsxMonthLabel && visible(atsxMonthLabel)) return atsxMonthLabel;
    const phoenixDatePicker = element.closest('.phoenix-date-picker');
    if (phoenixDatePicker && visible(phoenixDatePicker)) return phoenixDatePicker;
    const sdMonthPanel = element.closest('[class*="sd-panal-menu-wrapper"]');
    if (sdMonthPanel && visible(sdMonthPanel)
      && sdMonthPanel.querySelector('[class*="sd-basic-year-container"],[class*="sd-basic-year-item"]')) return sdMonthPanel;
    const fieldSelector = [
      'input', 'textarea', 'select', '[contenteditable]:not([contenteditable="false"])',
      '[role="textbox"]', '[role="combobox"]', '[role="radio"]', '[role="checkbox"]',
      '[role="switch"]', '[role="slider"]', '[role="spinbutton"]'
    ].join(',');
    if (element.matches(fieldSelector)) return element;

    const explicitSelector = [
      'button', 'a', 'summary', '[role="button"]', '[role="link"]', '[role="menuitem"]',
      '[role="tab"]', '[onclick]', '[data-action]'
    ].join(',');
    const explicit = element.closest(explicitSelector);
    if (explicit && visible(explicit) && !explicit.closest(AUDIT_UI_SELECTOR)) return explicit;
    if (getComputedStyle(element).cursor !== 'pointer') return element;

    // cursor 会被后代继承。沿连续 pointer 链向上合并，得到一次点击真正对应的卡片/控件根节点。
    let root = element;
    for (let depth = 0; depth < 8; depth += 1) {
      const parent = root.parentElement;
      if (!parent || parent.matches('html,body,main,form') || parent.closest(AUDIT_UI_SELECTOR)) break;
      if (!visible(parent) || getComputedStyle(parent).cursor !== 'pointer') break;
      const explicitChildren = parent.querySelectorAll(explicitSelector);
      if (explicitChildren.length > 1 && !parent.matches(explicitSelector)) break;
      if (cleanText(parent.innerText || parent.textContent).length > 300) break;
      root = parent;
    }
    return root;
  }

  function selectRoot(element) {
    const selector = [
      '.phoenix-select', '.ud__select', '.ud__picker', '[class*="select-container"]', '[class*="Select-container"]',
      '[class*="select-wrapper"]', '[class*="Select-wrapper"]', '[class*="cascader"]',
      '[class*="Cascader"]', '[role="combobox"]'
    ].join(',');
    const boundary = currentFieldContainer(element);
    let node = element;
    for (let depth = 0; node instanceof Element && depth < 8; depth += 1, node = node.parentElement) {
      if (node.matches(selector) && visible(node)) return node;
      if (boundary && node === boundary) break;
    }
    if (element.getAttribute('role') === 'combobox' || element.getAttribute('aria-haspopup') === 'listbox') return element;
    return null;
  }

  function visualTarget(element) {
    const addTarget = preciseAddTarget(element);
    if (addTarget) return addTarget;
    const phoenixButtonSelect = phoenixButtonSelectRoot(element);
    if (phoenixButtonSelect) return phoenixButtonSelect;
    const radioGroup = radioGroupRoot(element);
    if (radioGroup) return radioGroup;
    if (declaredFieldMode(element) === 'string' && isPlainEditableTextField(element)) return element;
    const select = selectRoot(element);
    if (select) return select;
    const labelled = element.closest('label');
    if (labelled && ['radio', 'checkbox'].includes(String(element.type || '').toLowerCase())) return labelled;
    return element;
  }

  function widgetEvidence(element) {
    const root = selectRoot(element) || element.closest('[class*="date"],[class*="Date"],[class*="calendar"],[class*="Calendar"]') || element;
    const evidence = [classSummary(root), root.id || '', root.getAttribute('data-testid') || '', root.getAttribute('data-cy') || ''];
    for (const node of root.querySelectorAll('svg [id],svg use,[data-icon]')) {
      evidence.push(node.id || '', node.getAttribute('href') || '', node.getAttribute('xlink:href') || '', node.getAttribute('data-icon') || '');
      if (evidence.length > 30) break;
    }
    return cleanText(evidence.join(' '));
  }

  function controlKind(element, text, matchedKey) {
    const type = String(element.type || '').toLowerCase();
    const role = String(element.getAttribute('role') || '').toLowerCase();
    const widget = widgetEvidence(element);
    if (element instanceof HTMLCanvasElement) return 'canvas';
    if (radioGroupRoot(element) === element) return 'radio-group';
    if (element.matches('.atsx-upload,.atsx-upload-btn')) return 'file-upload';
    if (element.matches('.ud__picker')) return 'date-trigger';
    if (element.matches('.common-unmodeled-layer,.common-unmodeled-layer__layerContent,.phoenix-selectList')
      && (element.matches('.phoenix-selectList') || element.querySelector('.phoenix-selectList'))) {
      return element.querySelector('.phoenix-selectList--search,input[placeholder="搜索"]')
        ? 'searchable-option-panel' : 'option-panel';
    }
    if (phoenixButtonSelectRoot(element) === element) return 'select-trigger';
    if (element.matches('.atsx-date-picker-dropdown')) return 'month-picker';
    if (element.matches('.atsx-date-picker-period-month-label')) return 'month-trigger';
    if (element.matches('.phoenix-date-picker')) {
      if (element.querySelector('.phoenix-calendar-month-calendar,.phoenix-calendar-month-panel')) return 'month-picker';
      if (element.querySelector('.phoenix-calendar-date-panel,.phoenix-calendar-table')) return 'date-picker';
      return 'date-trigger';
    }
    if (element.matches('[class*="sd-panal-menu-wrapper"]')
      && element.querySelector('[class*="sd-basic-year-container"],[class*="sd-basic-year-item"]')) return 'month-picker';
    if (type === 'file') return 'file-upload';
    if (element.matches('[contenteditable]:not([contenteditable="false"])') || role === 'textbox' && !element.matches('input,textarea')) return 'rich-text';
    if (type === 'range' || role === 'slider') return 'slider';
    if (role === 'spinbutton') return 'stepper';
    if (type === 'radio' || role === 'radio') return 'radio';
    if (type === 'checkbox' || role === 'checkbox' || role === 'switch') return role === 'switch' ? 'switch' : 'checkbox';
    if (element instanceof HTMLSelectElement) return 'native-select';
    if (type === 'date' || type === 'month' || type === 'datetime-local') return 'native-date';
    // 组件已经声明为 string_info 时，只允许当前字段内部的证据参与分类。
    // 外层重复卡片或兄弟字段中的 select_info 不得把它污染成选择控件。
    if (declaredFieldMode(element) === 'string' && isPlainEditableTextField(element)) return 'free-text';
    // 姓名、英文名、证件号码等开放值域文本框优先按“自由写入”判定。
    // autocomplete 只是浏览器自动补全提示，不是封闭值域证据。
    if (isOpenTextField(element, matchedKey, text)) return 'free-text';
    const activationHandler = `${element.getAttribute('onfocus') || ''} ${element.getAttribute('onclick') || ''} ${element.getAttribute('onmousedown') || ''}`;
    const dateSemantic = DATE_KEYS.test(matchedKey)
      || /日期|时间|年月|入学(?:日期|时间)|毕业(?:日期|时间)|date|calendar|setday|yyyy|mm|dd|time[_-]?picker/i.test(`${text} ${widget} ${activationHandler}`);
    const closedEvidence = closedValueEvidence(element);
    if (dateSemantic && isMokaYearMonthSelect(element) && closedEvidence.length > 0) {
      return searchableEvidence(element) ? 'autocomplete' : 'custom-select';
    }
    if (dateSemantic && (element.matches('input,[role="combobox"],[role="button"]') || element.readOnly)) return 'date-trigger';
    if (isPlainEditableTextField(element) && closedEvidence.length === 0) return 'free-text';
    if (closedEvidence.length > 0) {
      return searchableEvidence(element) ? 'autocomplete' : 'custom-select';
    }
    if (element.matches('textarea,[role="textbox"]')) return 'free-text';
    if (element instanceof HTMLInputElement) return 'free-text';
    const description = actionDescription(element);
    if (ADD_PATTERN.test(description) && !ADD_NEGATIVE_PATTERN.test(description)) return 'add-action';
    if (element.matches('summary')) return 'disclosure';
    if (element.matches('button,[role="button"],[role="menuitem"],[role="tab"]')) return 'button';
    if (element.matches('a,[role="link"]')) return 'link';
    if (getComputedStyle(element).cursor === 'pointer' && !['listbox', 'radiogroup', 'group'].includes(role)) return 'button';
    return 'custom-interactive';
  }

  function fieldControl(kind) {
    return ['file-upload', 'rich-text', 'slider', 'stepper', 'radio', 'radio-group', 'checkbox', 'switch', 'native-select', 'native-date', 'date-trigger', 'date-picker', 'month-trigger', 'month-picker', 'select-trigger', 'option-panel', 'searchable-option-panel', 'autocomplete', 'custom-select', 'free-text'].includes(kind);
  }

  function elementKind(kind) {
    if (fieldControl(kind)) return 'field';
    if (['add-action', 'disclosure', 'button', 'link'].includes(kind)) return 'action';
    return 'container';
  }

  function cardinality(element, kind) {
    if (kind === 'radio-group') return 'single';
    if (element.multiple || element.getAttribute('aria-multiselectable') === 'true') return 'multi';
    if (kind === 'checkbox') {
      const group = element.closest('fieldset,[role="group"],[role="listbox"]');
      if (group && group.querySelectorAll('input[type="checkbox"],[role="checkbox"]').length > 1) return 'multi';
    }
    return 'single';
  }

  function editability(element, kind = '') {
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') return 'disabled';
    if (['native-date', 'date-trigger', 'date-picker', 'month-trigger', 'month-picker', 'select-trigger', 'option-panel'].includes(kind)) return 'selectable';
    if (kind === 'searchable-option-panel') return 'editable';
    if (['native-select', 'custom-select', 'radio', 'radio-group', 'checkbox', 'switch'].includes(kind)
      && !searchableEvidence(element)) return 'selectable';
    if (element.readOnly || element.getAttribute('aria-readonly') === 'true') {
      if (['native-select', 'custom-select', 'date-trigger', 'date-picker', 'month-trigger', 'month-picker'].includes(kind)) return 'selectable';
      return 'readonly';
    }
    return 'editable';
  }

  function actionType(element, family, kind, matchedKey, text) {
    const state = editability(element, kind);
    if (family === 'field') {
      if (!['editable', 'selectable'].includes(state)) return 'none';
      if (kind === 'file-upload') return 'upload';
      if (kind === 'rich-text') return 'set-content';
      if (kind === 'slider' || kind === 'stepper') return 'adjust';
      if (cardinality(element, kind) === 'multi') return 'select-multi';
      if (kind === 'checkbox' || kind === 'switch') return 'toggle';
      if (kind === 'native-date' || kind === 'date-trigger' || kind === 'date-picker' || kind === 'month-trigger' || kind === 'month-picker') {
        const range = /(?:Start|End)$/.test(matchedKey) && /至|起止|范围|range|period/i.test(text);
        return range ? 'select-steps' : 'select';
      }
      if (kind === 'custom-select' && /^(?:nativePlace|householdRegistration|currentResidence)$/.test(matchedKey)) return 'select-steps';
      if (kind === 'searchable-option-panel') return 'select-search';
      if (kind === 'select-trigger' || kind === 'option-panel') return 'select';
      if (kind === 'autocomplete') return 'select-search';
      if (['native-select', 'custom-select', 'radio', 'radio-group'].includes(kind)) return 'select';
      return kind === 'free-text' ? 'write' : 'none';
    }
    if (family === 'container') return 'none';
    if (kind === 'add-action') return 'structure-add';
    if (/删除|移除|delete|remove/i.test(text)) return 'structure-remove';
    if (/提交|投递|申请|保存|下一步|完成|submit|apply|save|next|finish/i.test(text)) return 'submit';
    if (/重置|清空|reset|clear/i.test(text)) return 'reset';
    if (/取消|返回|cancel|back/i.test(text)) return 'cancel';
    if (kind === 'disclosure' || element.hasAttribute('aria-expanded')) return element.getAttribute('aria-expanded') === 'true' ? 'collapse' : 'expand';
    if (kind === 'link' || element.getAttribute('role') === 'tab') return 'navigate';
    return 'click';
  }

  function valueDomain(element, family, action, kind) {
    if (family !== 'field' || action === 'none') return 'none';
    if (action === 'upload') return 'file';
    if (action === 'toggle') return 'boolean';
    if (action === 'adjust' || ['number', 'range'].includes(String(element.type || '').toLowerCase())) return 'numeric';
    if (action === 'select-search') {
      const controls = element.getAttribute('aria-controls');
      return controls && document.getElementById(controls) ? 'closed-local' : 'closed-remote';
    }
    if (['select', 'select-multi', 'select-steps'].includes(action)) return 'closed-local';
    if (kind === 'free-text' || kind === 'rich-text') return 'open';
    return 'none';
  }

  function operationGroup(action) {
    if (['write', 'set-content'].includes(action)) return 'direct-write';
    if (action === 'select-search') return 'input-select';
    if (['select', 'select-multi', 'select-steps'].includes(action)) return 'closed-select';
    if (action === 'upload') return 'upload';
    if (action === 'none') return 'no-action';
    return 'click';
  }

  function semanticType(element, matchedKey, kind, text) {
    const type = String(element.type || '').toLowerCase();
    if (kind === 'native-date' || kind === 'date-trigger' || kind === 'date-picker' || kind === 'month-trigger' || kind === 'month-picker' || DATE_KEYS.test(matchedKey)) return 'date';
    if (type === 'email' || matchedKey === 'email') return 'email';
    if (type === 'tel' || matchedKey === 'phone') return 'phone';
    if (/salary|amount|薪资|金额/i.test(`${matchedKey} ${text}`)) return 'amount';
    if (kind === 'file-upload') return 'resume-file';
    if (['checkbox', 'switch', 'radio', 'radio-group', 'select-trigger', 'option-panel', 'searchable-option-panel'].includes(kind)) return 'choice';
    if (kind === 'rich-text') return 'rich-text';
    if (['slider', 'stepper'].includes(kind)) return 'numeric';
    return matchedKey ? 'profile-field' : 'unknown';
  }

  function classification(element, kind, action, matchedKey, text) {
    const evidence = [];
    let reasonCode = 'CONTROL_SEMANTICS';
    if (action === 'write' && kind === 'free-text') {
      reasonCode = isOpenTextField(element, matchedKey, text) ? 'OPEN_TEXT_SEMANTIC' : 'PLAIN_EDITABLE_TEXT';
      evidence.push(`native-${element.tagName.toLowerCase()}`);
      evidence.push(`type-${String(element.type || 'text').toLowerCase()}`);
      evidence.push('editable');
      evidence.push('no-closed-value-evidence');
      if (matchedKey) evidence.push(`semantic-${matchedKey}`);
      if (declaredFieldMode(element) === 'string') evidence.push('string-info-wrapper');
      if (element.hasAttribute('autocomplete')) evidence.push('autocomplete-ignored-as-browser-hint');
    } else if (['select', 'select-search', 'select-multi', 'select-steps'].includes(action)) {
      const readonlySelection = Boolean(element.readOnly || element.getAttribute('aria-readonly') === 'true')
        && ['custom-select', 'date-trigger', 'date-picker', 'month-trigger', 'month-picker'].includes(kind);
      reasonCode = readonlySelection ? 'READONLY_SELECTION_TRIGGER' : 'CLOSED_VALUE_EVIDENCE';
      evidence.push(...closedValueEvidence(element));
      if (readonlySelection) evidence.push('readonly-blocks-typing', 'selection-changes-value');
      if (element instanceof HTMLSelectElement) evidence.push('options-required');
      if (kind === 'month-picker') evidence.push('calendar-year-month-grid', 'input-disabled-or-absent');
      if (kind === 'select-trigger') evidence.push('phoenix-button-caret-trigger');
      if (kind === 'option-panel') evidence.push('fixed-option-list', 'no-search-input');
      if (kind === 'searchable-option-panel') evidence.push('option-list', 'popup-search-input');
    } else {
      evidence.push(`kind-${kind}`);
    }
    return { reasonCode, evidence: [...new Set(evidence)] };
  }

  function interactionPlan(element, action, matchedKey) {
    const steps = [];
    if (action === 'select-steps') {
      if (/nativePlace|Registration|Residence/i.test(matchedKey)) {
        steps.push(
          { id: 'level-1', action: 'select', dependsOn: [] },
          { id: 'level-2', action: 'select', dependsOn: ['level-1'] },
          { id: 'level-3', action: 'select', dependsOn: ['level-2'] },
          { id: 'confirm', action: 'confirm', dependsOn: ['level-3'] }
        );
      } else {
        steps.push(
          { id: 'start', action: 'select', dependsOn: [] },
          { id: 'end', action: 'select', dependsOn: ['start'] },
          { id: 'confirm', action: 'confirm', dependsOn: ['end'] }
        );
      }
    } else if (['structure-add', 'structure-remove', 'expand', 'collapse'].includes(action)) {
      steps.push({ id: 'activate', action: 'click', dependsOn: [] });
      if (action === 'structure-remove') steps.push({ id: 'confirm', action: 'confirm', dependsOn: ['activate'] });
      steps.push({ id: 'rescan', action: 'rescan-page', dependsOn: [action === 'structure-remove' ? 'confirm' : 'activate'] });
    }
    return {
      multiStep: steps.length > 0,
      steps,
      searchable: action === 'select-search' || element.getAttribute('aria-autocomplete') === 'list',
      confirmationRequired: ['select-steps', 'structure-remove'].includes(action) || element.getAttribute('aria-haspopup') === 'dialog'
    };
  }

  function safety(action, text) {
    if (['structure-remove', 'reset'].includes(action) || /注销|永久删除|delete\s+account/i.test(text)) {
      return { level: 'dangerous', reasonCode: 'DANGEROUS_ACTION', reason: '该操作可能删除或清空页面数据' };
    }
    if (['submit', 'navigate', 'cancel'].includes(action)) {
      return { level: 'guarded', reasonCode: 'SIDE_EFFECT_ACTION', reason: '该操作可能提交数据、离开页面或推进流程' };
    }
    if (action === 'click') {
      return { level: 'guarded', reasonCode: 'AMBIGUOUS_ACTION', reason: '按钮副作用尚不明确' };
    }
    return { level: 'normal', reasonCode: '', reason: '' };
  }

  function adaptation(element, kind, action, state, safetyResult) {
    if (state === 'readonly') return { status: 'adapted', reasonCode: 'READONLY', reason: '只读展示字段，无需操作' };
    if (state === 'disabled') return { status: 'adapted', reasonCode: 'DISABLED', reason: '禁用字段，无需操作' };
    if (safetyResult.level !== 'normal') return { status: 'adapted', reasonCode: safetyResult.reasonCode, reason: safetyResult.reason };
    if (kind === 'canvas') return { status: 'unadapted', reasonCode: 'CANVAS_RENDERED', reason: '控件由 Canvas 绘制，无法读取标准 DOM 语义' };
    if (kind === 'rich-text') return { status: 'partial', reasonCode: 'UNSUPPORTED_RICH_TEXT', reason: '已识别富文本，但编辑器协议需要进一步解析' };
    if (kind === 'slider' || kind === 'stepper') return { status: 'partial', reasonCode: 'UNSUPPORTED_ADJUSTMENT', reason: '已识别数值调节控件，但操作轨迹仍需适配' };
    if (/virtual|virtualized/i.test(rawClassName(element))) return { status: 'partial', reasonCode: 'VIRTUAL_LIST', reason: '可能使用虚拟滚动，当前 DOM 中候选项可能不完整' };
    if (action === 'select-search' && !element.getAttribute('aria-controls')) {
      return { status: 'partial', reasonCode: 'DYNAMIC_OPTIONS', reason: '候选项可能需要输入或展开后异步加载' };
    }
    if (kind === 'custom-interactive' || action === 'none' && kind !== 'free-text') {
      return { status: 'unadapted', reasonCode: 'CUSTOM_NO_SEMANTIC', reason: '发现可交互元素，但缺少可靠的标准语义' };
    }
    return { status: 'adapted', reasonCode: '', reason: '' };
  }

  function dateShape(element, kind, text) {
    if (!['native-date', 'date-trigger', 'date-picker', 'month-trigger', 'month-picker'].includes(kind)) return { precision: '', mechanism: '' };
    const type = String(element.type || '').toLowerCase();
    const evidence = `${text} ${widgetEvidence(element)}`;
    const precision = kind === 'date-picker' ? 'year-month-day'
      : kind === 'month-trigger' || kind === 'month-picker' || type === 'month' || /年月|year.?month|yyyy\W*mm/i.test(evidence)
      ? 'year-month' : type === 'date' || /年月日|yyyy\W*mm\W*dd|date/i.test(evidence) ? 'year-month-day' : 'unknown-date';
    const mechanism = kind === 'date-picker' ? 'custom-date-calendar'
      : ['month-trigger', 'month-picker'].includes(kind) ? 'custom-month-calendar'
      : type === 'date' || type === 'month' || type === 'datetime-local'
        ? 'browser-native-picker' : element.readOnly ? 'custom-calendar-or-list' : 'free-date-text';
    return { precision, mechanism };
  }

  function requirement(element) {
    if (element.required || element.getAttribute('aria-required') === 'true') return 'required';
    const nearby = `${directLabelText(element)} ${element.parentElement?.textContent || ''}`;
    return /[*＊]|必填|required/i.test(nearby) ? 'required' : 'not-marked-required';
  }

  function domPath(element) {
    const parts = [];
    let node = element;
    for (let depth = 0; node instanceof Element && depth < 4; depth += 1, node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) part += `#${node.id}`;
      else if (node.getAttribute('name')) part += `[name="${node.getAttribute('name')}"]`;
      else if (node.getAttribute('role')) part += `[role="${node.getAttribute('role')}"]`;
      parts.unshift(part);
    }
    return parts.join(' > ');
  }

  function isRepeatRecordCardElement(element) {
    return element instanceof Element
      && classTokens(element).some((token) => /^apply-form-array-card(?:__|$)/i.test(token));
  }

  function closestRepeatRecordCard(element, maxDepth = 12) {
    let node = element;
    for (let depth = 0; node instanceof Element && depth < maxDepth; depth += 1, node = node.parentElement) {
      if (isRepeatRecordCardElement(node)) return node;
      if (node.matches('form,main,body,html')) break;
    }
    return null;
  }

  function normalizedSignatureLabel(value) {
    return cleanText(value).toLowerCase().replace(/[\s:：*＊()[\]（）【】]+/g, '').replace(/\d+$/, '');
  }

  function recordFieldSignature(root) {
    if (!(root instanceof Element) || !hasInteractiveDescendant(root)) return [];
    const roots = pageFieldRoots(root);
    const labels = roots.map((field) => normalizedSignatureLabel(fieldRootTitle(field)))
      .filter(Boolean);
    if (labels.length) return labels;
    const fallback = normalizedSignatureLabel(fieldRootTitle(root));
    return fallback ? [fallback] : [];
  }

  function signatureSimilarity(left, right) {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    if (!leftSet.size || !rightSet.size) return 0;
    let overlap = 0;
    for (const item of leftSet) if (rightSet.has(item)) overlap += 1;
    return overlap / Math.max(leftSet.size, rightSet.size);
  }

  function genericRepeatRecordDetails(element) {
    let node = element.parentElement;
    for (let depth = 0; node instanceof Element && depth < 10; depth += 1, node = node.parentElement) {
      if (node.matches('form,main,body,html')) break;
      if (pageBlockLooksLikeModule(node)) break;
      if (!(node.parentElement instanceof Element)) continue;
      const signature = recordFieldSignature(node);
      if (!signature.length) continue;
      const siblings = [...node.parentElement.children].filter((sibling) => sibling instanceof Element
        && visible(sibling)
        && hasInteractiveDescendant(sibling)
        && signatureSimilarity(signature, recordFieldSignature(sibling)) >= 0.5);
      if (siblings.length < 2 || !siblings.includes(node)) continue;
      const index = siblings.indexOf(node) + 1;
      return {
        recordIndex: index,
        recordTotal: siblings.length,
        recordGroup: index ? `${domPath(node.parentElement)}::record[${index - 1}]` : ''
      };
    }
    return { recordIndex: 0, recordTotal: 0, recordGroup: '' };
  }

  function repeatRecordDetails(element) {
    const card = closestRepeatRecordCard(element);
    if (!(card instanceof Element) || !(card.parentElement instanceof Element)) {
      return genericRepeatRecordDetails(element);
    }
    const siblings = [...card.parentElement.children].filter(isRepeatRecordCardElement);
    const index = siblings.indexOf(card) + 1;
    if (!index || siblings.length < 2) return genericRepeatRecordDetails(element);
    return {
      recordIndex: index,
      recordTotal: siblings.length,
      recordGroup: index ? `${domPath(card.parentElement)}::record[${index - 1}]` : ''
    };
  }

  function repeatBindingDetails(element, profilePath = '', context = '') {
    if (!profilePath.includes('[]')) return { repeatSection: '', repeatIndex: 0, repeatGroup: '' };
    const evidence = [];
    let node = element;
    for (let depth = 0; node instanceof Element && depth < 10; depth += 1, node = node.parentElement) {
      evidence.push(node.getAttribute('data-cy') || '', node.getAttribute('name') || '', node.id || '', node.getAttribute('data-testid') || '');
    }
    const text = evidence.join(' ');
    const sectionName = profilePath.split('[]')[0];
    const aliases = {
      educationExperiences: ['education', 'academic'], workExperiences: ['work', 'experience', 'employment', 'intern'],
      campusExperiences: ['campus'], projectExperiences: ['project'], practiceExperiences: ['practice'],
      languageSkills: ['language'], certificates: ['certificate'], awards: ['award', 'honor', 'honour'],
      publications: ['publication', 'paper'], patents: ['patent'], familyMembers: ['family', 'relative']
    };
    const names = aliases[sectionName] || [context, sectionName];
    let index = -1;
    for (const name of names.filter(Boolean)) {
      const match = text.match(new RegExp(`${name}(?:Entries?)?(?:\\[|\\.|_|-)(\\d+)`, 'i'));
      if (match) { index = Number(match[1]); break; }
    }
    return {
      repeatSection: sectionName,
      repeatIndex: index >= 0 ? index + 1 : 0,
      repeatGroup: index >= 0 ? `${sectionName}[${index}]` : ''
    };
  }

  function normalizeModuleTitleText(value, maxLength = 120) {
    return cleanText(value)
      .replace(/^\s*\d+[.、]\s*/, '')
      .replace(/\s+(?:添加|新增|取消|保存|编辑|修改|删除)$/i, '')
      .replace(/(?:（必填）|\(必填\)|必填)$/g, '')
      .slice(0, maxLength);
  }

  function looksLikeModuleTitleText(value) {
    const text = normalizeModuleTitleText(value, 120);
    return Boolean(text && text.length <= 80 && MODULE_TITLE_RE.test(text));
  }

  function semanticIdentity(element) {
    if (!(element instanceof Element)) return '';
    return [
      element.tagName.toLowerCase(),
      element.id || '',
      rawClassName(element),
      element.getAttribute('role') || '',
      element.getAttribute('name') || '',
      element.getAttribute('data-testid') || '',
      element.getAttribute('data-test') || ''
    ].filter(Boolean).join(' ');
  }

  function looksLikeEmptyStateTitle(value) {
    return /^(?:无|没有|暂无).{0,24}(?:经历|经验|信息|内容)$/.test(normalizeModuleTitleText(value, 80));
  }

  function looksLikeNavigationText(value) {
    const text = cleanText(value);
    if (!text) return false;
    const numbered = text.match(/(?:^|\s)\d+[.、]?\s*[\u4e00-\u9fffA-Za-z]{2,16}/g) || [];
    const moduleWords = text.match(MODULE_TITLE_WORDS_RE) || [];
    return numbered.length >= 4 || new Set(moduleWords.map((item) => item.toLowerCase())).size >= 5;
  }

  function semanticLooksLikeModuleTitle(value) {
    const text = normalizeModuleTitleText(value, 120);
    return Boolean(text && text.length <= 80 && !looksLikeEmptyStateTitle(text)
      && !looksLikeNavigationText(text) && MODULE_TITLE_RE.test(text));
  }

  function semanticLooksLikeShortTitle(value) {
    const text = normalizeModuleTitleText(value, 120);
    if (!text || looksLikeEmptyStateTitle(text) || looksLikeNavigationText(text)) return false;
    if (/^(?:required|invalid|error|\*+|必填|未填写|请选择|请输入)$/i.test(text)) return false;
    return text.length <= 32;
  }

  function semanticHidden(element) {
    if (!(element instanceof Element)) return true;
    const tag = element.tagName.toLowerCase();
    const style = String(element.getAttribute('style') || '').replace(/\s+/g, '').toLowerCase();
    return ['script', 'style', 'noscript', 'template', 'meta', 'link'].includes(tag)
      || /(?:resume-page-audit|__resumePageAudit|resume-audit|aminer-ai-extension-root|extension-root|chrome-extension)/i.test(semanticIdentity(element))
      || element.hasAttribute('hidden')
      || String(element.getAttribute('type') || '').toLowerCase() === 'hidden'
      || element.getAttribute('aria-hidden') === 'true'
      || style.includes('display:none')
      || style.includes('visibility:hidden')
      || !visible(element);
  }

  function semanticControl(element) {
    if (semanticHidden(element)) return false;
    const tag = element.tagName.toLowerCase();
    const role = String(element.getAttribute('role') || '').toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag)) return true;
    if (element.getAttribute('contenteditable') === 'true') return true;
    if (['textbox', 'combobox', 'radio', 'checkbox', 'switch', 'slider', 'spinbutton'].includes(role)) return true;
    const identity = semanticIdentity(element);
    return /(?:^|[\s_-])(?:input|select|radio|checkbox|textarea|upload|picker|cascader|date|datepicker|button|btn|combobox|switch|slider)(?:$|[\s_-])/i.test(identity)
      || /(?:phoenix|el|ant|atsx|ud)(?:__|-)[\w-]*(?:input|select|radio|checkbox|textarea|upload|picker|cascader|date|button|btn|combobox|switch|slider)/i.test(identity);
  }

  function semanticInteractive(element, isControl) {
    if (isControl) return true;
    if (semanticHidden(element)) return false;
    const tag = element.tagName.toLowerCase();
    const role = String(element.getAttribute('role') || '').toLowerCase();
    if (['a', 'details', 'summary', 'option'].includes(tag)) return true;
    if (element.hasAttribute('onclick') || element.hasAttribute('tabindex')) return true;
    if (['button', 'link', 'menuitem', 'option', 'radio', 'checkbox', 'switch', 'tab', 'textbox', 'combobox', 'slider', 'spinbutton', 'searchbox'].includes(role)) return true;
    return /(?:add[-_]?btn|addmore|remove[-_]?btn|delete[-_]?btn|edit[-_]?btn|save[-_]?btn|cancel[-_]?btn|operate|action|btn)/i.test(semanticIdentity(element))
      && /(?:添加|新增|删除|编辑|保存|取消|修改)/i.test(cleanText(element.innerText || element.textContent).slice(0, 40));
  }

  function semanticExplicitZone(element) {
    if (!(element instanceof Element)) return '';
    const tag = element.tagName.toLowerCase();
    const role = String(element.getAttribute('role') || '').toLowerCase();
    if (tag === 'head') return 'head';
    if (tag === 'header') return 'header';
    if (tag === 'nav') return 'nav';
    if (tag === 'aside') return 'sidebar';
    if (tag === 'main') return 'main';
    if (tag === 'footer') return 'footer';
    if (tag === 'dialog' || ['dialog', 'alertdialog', 'tooltip', 'menu', 'listbox'].includes(role)) return 'overlay';
    const identity = semanticIdentity(element);
    if (semanticLooksLikeFooter(element, identity)) return 'footer';
    if (/(?:modal|dialog|popup|popover|tooltip|dropdown|overlay|cascader|picker|popper|select[-_]?menu|select[-_]?dropdown)/i.test(identity)) return 'overlay';
    if (/(?:\bnav\b|nav[-_]|navbar|nav-bar|\bmenu\b|menu[-_]|\btabs?\b|tabs?[-_]|\bsteps?\b|steps?[-_]|breadcrumb)/i.test(identity)) return 'nav';
    if (/(?:sidebar|aside|sider|drawer|side[-_]?(?:bar|nav|menu))/i.test(identity)) return 'sidebar';
    if (/(?:header|top|masthead)/i.test(identity)) return 'header';
    if (/(?:main|content|container|page|form|resume|apply|delivery)/i.test(identity)) return 'main';
    return '';
  }

  function semanticStrongLandmarkZone(element, zone) {
    if (!(element instanceof Element)) return false;
    const tag = element.tagName.toLowerCase();
    const role = String(element.getAttribute('role') || '').toLowerCase();
    const identity = semanticIdentity(element);
    if (zone === 'head') return tag === 'head';
    if (zone === 'header') {
      return tag === 'header' || role === 'banner'
        || /(?:^|[\s_-])(?:topbar|top-bar|masthead|nav-header|global[-_\s]?header|site[-_\s]?header|page[-_\s]?header|app[-_\s]?header)(?:$|[\s_-])/i.test(identity);
    }
    if (zone === 'nav') return tag === 'nav' || role === 'navigation';
    if (zone === 'sidebar') return tag === 'aside' || role === 'complementary';
    if (zone === 'main') return tag === 'main' || role === 'main';
    if (zone === 'footer') return tag === 'footer' || role === 'contentinfo';
    if (zone === 'overlay') return tag === 'dialog' || ['dialog', 'alertdialog'].includes(role);
    return false;
  }

  function semanticInsideFieldComponent(element) {
    for (let node = element.parentElement; node instanceof Element; node = node.parentElement) {
      const tag = node.tagName.toLowerCase();
      const identity = semanticIdentity(node);
      if (/(?:form[-_]?item|field|input[_-]?box|info[_-]?box|ant-form-item|el-form-item|ud-formily-item|rocket-form-field|apply-field|apply-fields|input|select|textarea|picker|cascader|upload)/i.test(identity)) {
        return true;
      }
      if (tag === 'body' || tag === 'main' || ['section', 'fieldset', 'form'].includes(tag)
        || /(?:section|module|block|panel|card|send_box|createFormSection|applyFormModuleWrapper|cv-module|apply-block|resumeEditForm|apply-form)/i.test(identity)) {
        return false;
      }
    }
    return false;
  }

  function semanticInsideFormPage(element) {
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const tag = node.tagName.toLowerCase();
      const identity = semanticIdentity(node);
      if (/(?:resumeEditForm|saasResumeEditForm|resumeFormPage|apply-form|complete-form|atsx-form|form-root|wrapper-editor|STFormContainer|apply-block|job-form)/i.test(identity)) {
        return true;
      }
      if (tag === 'body' || tag === 'header' || tag === 'nav' || tag === 'footer') return false;
    }
    return false;
  }

  function semanticShouldUseExplicitZone(element, explicitZone, inheritedZone) {
    if (!explicitZone) return false;
    if (['head', 'main', 'overlay'].includes(explicitZone)) return true;
    if (semanticStrongLandmarkZone(element, explicitZone)) return true;
    if (['header', 'nav', 'sidebar', 'footer'].includes(explicitZone) && semanticInsideFieldComponent(element)) return false;
    if (explicitZone === 'header' && semanticInsideFormPage(element)) return false;
    if (explicitZone === 'header' && inheritedZone === 'main') {
      return false;
    }
    return true;
  }

  function semanticLooksLikeFooter(element, identity = semanticIdentity(element)) {
    const text = cleanText(element.innerText || element.textContent || '').slice(0, 500);
    const legalPattern = /(?:copyright|copy[-_ ]?right|beian|icp|legal|polic(?:y|ies)|privacy|terms|版权所有|备案|公网安备|隐私政策|用户协议|©)/i;
    if (legalPattern.test(identity)) {
      return true;
    }
    if (!/(?:^|[\s_-])(?:footer|site-footer|page-footer|global-footer)(?:$|[\s_-])/i.test(identity)) {
      return false;
    }
    const hasEditable = Boolean(element.querySelector('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]'));
    if (hasEditable) return false;
    const buttonText = cleanText([...element.querySelectorAll('button, [role="button"]')]
      .map((button) => button.innerText || button.textContent || '')
      .join(' '));
    return legalPattern.test(text)
      || !/(?:提交|保存|暂存|取消|预览|下一步|上一步|submit|save|cancel|preview|next|back)/i.test(buttonText);
  }

  function semanticStructuralZone(zone) {
    return ['head', 'header', 'nav', 'sidebar', 'footer'].includes(zone);
  }

  function semanticSurfaceZone(zone) {
    return zone === 'overlay';
  }

  function semanticSurfaceTitle(zone) {
    return zone === 'overlay' ? '浮层' : '';
  }

  function semanticLandmarkTitle(item) {
    const zone = item?.zone || '';
    if (zone === 'head') return '文档 head';
    if (zone === 'header') return '页头';
    if (zone === 'footer') return '页脚';
    if (zone === 'sidebar') return '侧边栏';
    if (zone === 'nav') {
      const text = cleanText(item.text || '');
      if (/首页\s*\/|breadcrumb|面包屑/i.test(`${text} ${semanticIdentity(item.element)}`)) return '面包屑导航';
      if (/(?:申请信息|上传|个人信息|教育|工作|项目|实习|附件|授权|更新说明)/.test(text)) return '模块目录';
      return '导航栏';
    }
    return semanticSurfaceTitle(zone) || zone || '';
  }

  function semanticPruneOverlappingStructures(candidates) {
    const isWeakNavWrapper = (item) => {
      if (!item || item.zone !== 'nav') return false;
      const own = cleanText(item.ownText || '');
      if (own) return false;
      return candidates.some((other) => other !== item
        && other.zone === 'nav'
        && item.element.contains(other.element)
        && other.interactiveCount >= Math.max(1, item.interactiveCount * 0.4));
    };
    return candidates.filter((item) => {
      const structuralAncestor = candidates.find((other) => other !== item
        && semanticStructuralZone(other.zone)
        && other.element.contains(item.element));
      if (structuralAncestor
        && ['header', 'nav', 'sidebar', 'footer'].includes(structuralAncestor.zone)
        && !isWeakNavWrapper(structuralAncestor)) return false;
      const descendants = candidates.filter((other) => other !== item && item.element.contains(other.element));
      if (isWeakNavWrapper(item)) return false;
      if (['head', 'footer', 'nav'].includes(item.zone)) return true;
      if (!descendants.length) return true;
      const strongest = descendants
        .slice()
        .sort((left, right) => (
          (right.controlCount * 4 + right.interactiveCount * 2 + right.text.length)
          - (left.controlCount * 4 + left.interactiveCount * 2 + left.text.length)
        ))[0];
      if (!strongest) return true;
      const own = cleanText(item.ownText || '');
      const sameSignal = cleanText(item.text || '') === cleanText(strongest.text || '')
        || (strongest.controlCount > 0 && strongest.controlCount >= Math.max(1, item.controlCount * 0.8));
      if (item.zone === 'sidebar' && descendants.some((other) => other.zone === 'nav')) return false;
      if (item.zone === 'header' && !own && sameSignal && descendants.some((other) => other.zone === 'nav')) return false;
      return true;
    });
  }

  function semanticTitleFromTitleNode(item) {
    const direct = normalizeModuleTitleText(item.ownText);
    if (semanticLooksLikeShortTitle(direct)) return direct;
    for (const child of item.children) {
      if (child.hidden || child.control || /(?:title_text|describe|description|help|tip|remark|note|unloadTip)/i.test(semanticIdentity(child.element))) continue;
      const own = normalizeModuleTitleText(child.ownText);
      if (semanticLooksLikeShortTitle(own)) return own;
      const nested = semanticTitleFromTitleNode(child);
      if (semanticLooksLikeShortTitle(nested)) return nested;
    }
    const text = normalizeModuleTitleText(item.text);
    if (semanticLooksLikeShortTitle(text)) return text;
    return semanticLooksLikeModuleTitle(text) ? text : '';
  }

  function semanticTitleFromNode(item) {
    for (const attr of ['aria-label', 'data-title', 'title', 'name']) {
      const text = normalizeModuleTitleText(item.element.getAttribute(attr) || '');
      if (semanticLooksLikeModuleTitle(text)) return text;
    }
    const direct = normalizeModuleTitleText(item.ownText);
    if (semanticLooksLikeModuleTitle(direct)) return direct;
    if (item.heading) {
      const text = semanticTitleFromTitleNode(item);
      if (semanticLooksLikeModuleTitle(text)) return text;
    }
    for (const child of item.children) {
      if (child.hidden) continue;
      if (child.heading || /(?:title|heading|legend|label|send_title|section-title|module-title|blockTitle|divider-title)/i.test(semanticIdentity(child.element))) {
        const text = semanticTitleFromTitleNode(child);
        if (semanticLooksLikeShortTitle(text) || semanticLooksLikeModuleTitle(text)) return text;
        const nested = semanticTitleFromNode(child);
        if (nested) return nested;
      }
      if (child.controlCount) continue;
    }
    return '';
  }

  function buildPageSemanticTree() {
    const root = document.documentElement || document.body;
    const nodes = [];
    const build = (element, parent, depth, inheritedZone) => {
      const tag = element.tagName.toLowerCase();
      const explicitZone = semanticExplicitZone(element);
      const zone = semanticShouldUseExplicitZone(element, explicitZone, inheritedZone)
        ? explicitZone
        : (inheritedZone || 'body');
      const hidden = semanticHidden(element) || Boolean(parent?.hidden);
      const control = semanticControl(element);
      const interactive = semanticInteractive(element, control);
      const item = {
        element,
        parent,
        children: [],
        depth,
        zone,
        tag,
        ownText: ownText(element),
        text: '',
        title: '',
        hidden,
        control,
        interactive,
        heading: /^h[1-6]$/.test(tag) || tag === 'legend' || element.getAttribute('role') === 'heading',
        fieldLike: false,
        titleLike: false,
        moduleShellLike: false,
        controlCount: 0,
        interactiveCount: 0,
        fieldLikeCount: 0,
        titleLikeCount: 0,
        moduleShellCount: 0,
        zoneRoot: null
      };
      nodes.push(item);
      for (const child of [...element.children]) {
        item.children.push(build(child, item, depth + 1, zone));
      }
      item.text = cleanText([item.ownText, ...item.children.map((child) => child.text)].filter(Boolean).join(' ')).slice(0, 500);
      const identity = semanticIdentity(element);
      item.fieldLike = !hidden && !control && (
        /(?:form[-_]?item|field|input[_-]?box|info[_-]?box|ant-form-item|el-form-item|ud-formily-item|rocket-form-field|apply-field)/i.test(identity)
        || element.hasAttribute('data-form-field-name')
        || element.hasAttribute('data-form-field-i18n-name')
      );
      item.titleLike = !hidden && !control && !item.children.some((child) => child.control)
        && (item.heading || /(?:title|heading|legend|label|send_title|section-title|module-title|blockTitle|divider-title)/i.test(identity))
        && semanticLooksLikeModuleTitle(item.ownText || item.text);
      item.moduleShellLike = !hidden && !control && (
        ['section', 'fieldset', 'form'].includes(tag)
        || /(?:section|module|block|panel|card|send_box|createFormSection|applyFormModuleWrapper|cv-module|apply-block)/i.test(identity)
      );
      item.controlCount = (control ? 1 : 0) + item.children.reduce((sum, child) => sum + child.controlCount, 0);
      item.interactiveCount = (interactive ? 1 : 0) + item.children.reduce((sum, child) => sum + child.interactiveCount, 0);
      item.fieldLikeCount = (item.fieldLike ? 1 : 0) + item.children.reduce((sum, child) => sum + child.fieldLikeCount, 0);
      item.titleLikeCount = (item.titleLike ? 1 : 0) + item.children.reduce((sum, child) => sum + child.titleLikeCount, 0);
      item.moduleShellCount = (item.moduleShellLike ? 1 : 0) + item.children.reduce((sum, child) => sum + child.moduleShellCount, 0);
      item.title = semanticTitleFromNode(item);
      return item;
    };
    const tree = { root: build(root, null, 0, semanticExplicitZone(root) || 'document'), nodes };
    assignSemanticNavZones(tree);
    assignSemanticMainZone(tree);
    assignSemanticZoneRoots(tree);
    return tree;
  }

  function semanticLooksLikeModuleNav(item) {
    if (!item || item.hidden || item.control || item.fieldLikeCount > 0) return false;
    if (['html', 'body'].includes(item.tag)) return false;
    if (!['document', 'body', 'main', 'sidebar'].includes(item.zone)) return false;
    if (item.moduleShellLike && semanticModuleTitle(item)) return false;
    if (semanticInsideContentModule(item)) return false;
    const identity = semanticIdentity(item.element);
    if (/(?:form|field|input|textarea|editor|upload|resumeEditForm|createFormSection)/i.test(identity)) return false;
    const words = cleanText(item.text || '').match(MODULE_TITLE_WORDS_RE) || [];
    const uniqueWords = new Set(words.map((word) => word.toLowerCase()));
    return uniqueWords.size >= 3 && (item.interactiveCount >= 2 || item.titleLikeCount >= 2 || item.controlCount >= 1);
  }

  function semanticInsideContentModule(item) {
    for (let parent = item?.parent; parent; parent = parent.parent) {
      if (['head', 'header', 'nav', 'sidebar', 'footer', 'overlay'].includes(parent.zone)) return false;
      if (parent.moduleShellLike && semanticModuleTitle(parent)) {
        return true;
      }
    }
    return false;
  }

  function assignSemanticNavZones(tree) {
    const candidates = tree.nodes
      .filter(semanticLooksLikeModuleNav)
      .sort((left, right) => left.depth - right.depth);
    for (const item of candidates) {
      if (item.children.some((child) => child.zone === 'nav')) continue;
      if (item.parent && item.parent.zone === 'nav') continue;
      const mark = (node) => {
        if (['document', 'body', 'main', 'sidebar'].includes(node.zone)) node.zone = 'nav';
        node.children.forEach(mark);
      };
      mark(item);
    }
  }

  function assignSemanticMainZone(tree) {
    const candidates = tree.nodes
      .filter((item) => ['body', 'main'].includes(item.zone)
        && !['html', 'body'].includes(item.tag)
        && !item.hidden
        && item.controlCount >= 2)
      .sort((left, right) => (
        (right.controlCount * 4 + right.fieldLikeCount * 3 + right.titleLikeCount * 2 - right.depth)
        - (left.controlCount * 4 + left.fieldLikeCount * 3 + left.titleLikeCount * 2 - left.depth)
      ));
    const main = candidates[0];
    if (!main) return;
    const mark = (item) => {
      if (item.zone === 'body') item.zone = 'main';
      item.children.forEach(mark);
    };
    mark(main);
  }

  function assignSemanticZoneRoots(tree) {
    const visit = (item, currentRoot) => {
      const startsZone = !item.parent || item.parent.zone !== item.zone;
      const nextRoot = startsZone ? item : currentRoot;
      item.zoneRoot = nextRoot || item;
      item.children.forEach((child) => visit(child, item.zoneRoot));
    };
    visit(tree.root, tree.root);
  }

  function cacheSemanticZoneMaps(tree) {
    semanticZoneByElement = new WeakMap();
    semanticZoneRootByElement = new WeakMap();
    semanticLandmarkTitleByElement = new WeakMap();
    for (const item of tree.nodes) {
      semanticZoneByElement.set(item.element, item.zone);
      semanticZoneRootByElement.set(item.element, item.zoneRoot?.element || item.element);
      if (semanticStructuralZone(item.zone) && item.zoneRoot === item) {
        semanticLandmarkTitleByElement.set(item.element, semanticLandmarkTitle(item));
      }
    }
  }

  function semanticStructureContextForElement(element) {
    if (!(element instanceof Element)) return null;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const zone = semanticZoneByElement.get(node);
      const root = semanticZoneRootByElement.get(node) || node;
      const rootZone = semanticZoneByElement.get(root) || zone;
      if (root instanceof Element && semanticStructuralZone(rootZone)) {
        return {
          zone: rootZone,
          title: semanticLandmarkTitleByElement.get(root) || semanticLandmarkTitle({ zone: rootZone, text: cleanText(root.innerText || root.textContent), element: root })
        };
      }
    }
    return null;
  }

  function semanticSurfaceContextForElement(element) {
    if (!(element instanceof Element)) return null;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const zone = semanticZoneByElement.get(node);
      const root = semanticZoneRootByElement.get(node) || node;
      const rootZone = semanticZoneByElement.get(root) || zone;
      if (semanticSurfaceZone(rootZone)) {
        return { zone: rootZone, title: semanticSurfaceTitle(rootZone) };
      }
    }
    return null;
  }

  function semanticDirectTitleChild(item) {
    for (const child of item.children) {
      if (child.hidden) continue;
      if (child.titleLike || child.heading || /(?:title|heading|legend|label|send_title|section-title|module-title|blockTitle|divider-title)/i.test(semanticIdentity(child.element))) {
        if (child.title || semanticTitleFromTitleNode(child)) return child;
      }
      if (child.title && child.controlCount === 0) return child;
    }
    return null;
  }

  function semanticModuleTitle(item) {
    if (item.title) return item.title;
    const titleChild = semanticDirectTitleChild(item);
    return titleChild?.title || '';
  }

  function semanticDescendantModuleShellCount(item, limit = 2) {
    let count = 0;
    const stack = [...item.children];
    while (stack.length) {
      const child = stack.pop();
      if (!child || child.hidden || child.control) continue;
      if (child.moduleShellLike && child.controlCount && semanticModuleTitle(child)) {
        count += 1;
        if (count >= limit) return count;
        continue;
      }
      stack.push(...child.children);
    }
    return count;
  }

  function semanticHasModuleChild(item) {
    let count = 0;
    for (const child of item.children) {
      if (!child.hidden && child.controlCount && semanticModuleTitle(child)) count += 1;
    }
    return count >= 2;
  }

  function semanticPageBlockRoots() {
    let tree;
    try {
      tree = buildPageSemanticTree();
    } catch {
      semanticZoneByElement = new WeakMap();
      semanticZoneRootByElement = new WeakMap();
      semanticLandmarkTitleByElement = new WeakMap();
      semanticTreeSnapshot = null;
      return [];
    }
    cacheSemanticZoneMaps(tree);
    const selected = [];
    for (const item of tree.nodes) {
      if (['html', 'head', 'body'].includes(item.tag) || item.hidden || item.control) continue;
      if (['head', 'header', 'nav', 'sidebar', 'footer', 'overlay'].includes(item.zone)) continue;
      const title = semanticModuleTitle(item);
      if (!title) continue;
      if (item.fieldLike) continue;
      if (item.controlCount === 0 && item.interactiveCount === 0 && item.fieldLikeCount === 0) continue;
      if (semanticDescendantModuleShellCount(item) >= 2) continue;
      const titleChild = semanticDirectTitleChild(item);
      if (!item.moduleShellLike && !titleChild) continue;
      if (!item.moduleShellLike && item.controlCount === 0 && item.interactiveCount === 0) continue;
      const isEmptyActionModule = Boolean(titleChild && item.interactiveCount > 0
        && semanticLooksLikeModuleTitle(title)
        && /(?:添加|新增|删除|编辑|保存|取消|修改)/i.test(item.text));
      if (!item.moduleShellLike && item.controlCount < 2 && item.fieldLikeCount === 0 && !isEmptyActionModule) continue;
      if (item.fieldLike && item.fieldLikeCount <= 1) continue;
      if (semanticHasModuleChild(item) && !item.moduleShellLike) continue;
      if (selected.some((ancestor) => ancestor.element.contains(item.element))) continue;
      selected.push(item);
    }
    const roots = selected
      .map((item) => {
        semanticModuleTitleByElement.set(item.element, semanticModuleTitle(item));
        return item.element;
      })
      .sort((left, right) => {
        if (left === right) return 0;
        const position = left.compareDocumentPosition(right);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
    semanticTreeSnapshot = summarizeSemanticTreeForCopy(tree, selected);
    return roots;
  }

  function summarizeSemanticTreeForCopy(tree, selectedModules = []) {
    const compactCounts = (counts) => {
      const entries = Object.entries(counts).filter(([, value]) => Number(value) > 0);
      return entries.length ? Object.fromEntries(entries) : undefined;
    };
    const compactObject = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
      return true;
    }));
    const shortText = (value, maxLength = 120) => cleanText(value || '').slice(0, maxLength);
    const noisyLabel = (value) => {
      const text = shortText(value, 80);
      return !text
        || /^(?:\*+|required|invalid|error|请选择|请选择.*|请输入|请输入.*|必填项未填写\d*|必填|未填写|请选择|选择|0|\/\s*\d+|\d+\s*\/\s*\d+)$/i.test(text);
    };
    const directLabel = (item, maxDepth = 3) => {
      if (!item || maxDepth < 0) return '';
      for (const attr of ['aria-label', 'data-title', 'title', 'placeholder', 'name']) {
        const text = shortText(item.element.getAttribute(attr) || '');
        if (!noisyLabel(text)) return text;
      }
      const title = shortText(item.title || semanticModuleTitle(item) || '');
      if (!noisyLabel(title)) return title;
      const own = shortText(item.ownText || '');
      if (!noisyLabel(own)) return own;
      for (const child of item.children) {
        if (child.hidden || child.control || child.interactive) continue;
        const text = directLabel(child, maxDepth - 1);
        if (!noisyLabel(text)) return text;
      }
      const fallback = shortText(item.text || '', 80);
      return noisyLabel(fallback) ? '' : fallback;
    };
    const signalKind = (item) => {
      if (item.fieldLike) return 'field';
      if (semanticSurfaceZone(item.zone)) {
        if (item.zoneRoot === item) return 'surface';
        if (!item.control && !item.interactive) return '';
      }
      if (item.titleLike || item.heading) return 'title';
      if (item.control) {
        const tag = item.tag;
        const role = String(item.element.getAttribute('role') || '').toLowerCase();
        if (tag === 'button' || role === 'button' || /(?:button|btn|upload|remove|delete|add)/i.test(semanticIdentity(item.element))) return 'action';
        return 'control';
      }
      if (item.interactive) return 'action';
      if (semanticSurfaceZone(item.zone)) return 'surface';
      return '';
    };
    const nodeIds = new WeakMap();
    tree.nodes.forEach((item, index) => nodeIds.set(item, `n${index + 1}`));
    const zones = {};
    for (const item of tree.nodes) {
      const zone = zones[item.zone] ||= {
        nodeCount: 0,
        controlCount: 0,
        interactiveCount: 0,
        fieldLikeCount: 0,
        titleLikeCount: 0,
        moduleShellCount: 0
      };
      zone.nodeCount += 1;
      if (item.control) zone.controlCount += 1;
      if (item.interactive) zone.interactiveCount += 1;
      if (item.fieldLike) zone.fieldLikeCount += 1;
      if (item.titleLike) zone.titleLikeCount += 1;
      if (item.moduleShellLike) zone.moduleShellCount += 1;
    }
    for (const [zone, counts] of Object.entries(zones)) {
      zones[zone] = { nodeCount: counts.nodeCount, ...(compactCounts({
        controlCount: counts.controlCount,
        interactiveCount: counts.interactiveCount,
        fieldLikeCount: counts.fieldLikeCount,
        titleLikeCount: counts.titleLikeCount,
        moduleShellCount: counts.moduleShellCount
      }) || {}) };
    }
    const structureBlockItems = semanticPruneOverlappingStructures(tree.nodes
      .filter((item) => !item.hidden
        && semanticStructuralZone(item.zone)
        && item.zoneRoot === item
        && !['html', 'body'].includes(item.tag)
        && (item.text || item.controlCount || item.interactiveCount || item.tag === 'head')))
      .filter((item) => !selectedModules.some((moduleItem) => moduleItem !== item && moduleItem.element.contains(item.element)));
    const contentBlockItems = selectedModules.map((item) => ({
      item,
      kind: 'content',
      title: semanticModuleTitle(item)
    }));
    const pageBlockEntries = [
      ...structureBlockItems.map((item) => ({
        item,
        kind: item.zone,
        title: semanticLandmarkTitle(item)
      })),
      ...contentBlockItems
    ].sort((left, right) => {
      if (left.item.element === right.item.element) return 0;
      const position = left.item.element.compareDocumentPosition(right.item.element);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    const pageBlockSet = new Set(pageBlockEntries.map((entry) => entry.item));
    const collectSignals = (root, limit = 120) => {
      const signals = [];
      const seen = new Set();
      let truncated = false;
      const addSignal = (item, kind) => {
        const label = directLabel(item);
        if (!label) return;
        const labelKey = cleanText(label).toLowerCase();
        const dedupeKind = kind === 'control' ? 'action' : kind;
        const key = ['surface', 'title', 'action'].includes(dedupeKind)
          ? `${dedupeKind}|${labelKey}`
          : `${dedupeKind}|${labelKey}|${nodeIds.get(item)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const flags = compactObject({
          floating: semanticSurfaceZone(item.zone) || undefined,
          zoneRoot: semanticSurfaceZone(item.zone) && item.zoneRoot === item || undefined
        });
        const signal = compactObject({
          kind,
          label,
          nodeId: nodeIds.get(item),
          tag: item.tag,
          path: domPath(item.element),
          class: classSummary(item.element) || undefined,
          flags,
          counts: compactCounts({
            controls: item.controlCount,
            interactive: item.interactiveCount,
            fields: item.fieldLikeCount,
            titles: item.titleLikeCount
          })
        });
        signals.push(signal);
      };
      const walk = (item) => {
        if (!item || item.hidden || signals.length >= limit) {
          if (signals.length >= limit) truncated = true;
          return;
        }
        if (item !== root && pageBlockSet.has(item)) return;
        if (item !== root) {
          const kind = signalKind(item);
          if (kind) {
            addSignal(item, kind);
            if (kind === 'field') return;
          }
        }
        for (const child of item.children) walk(child);
      };
      for (const child of root.children) walk(child);
      return { signals, truncated };
    };
    const pageBlocks = pageBlockEntries.map((entry, index) => {
      const collected = collectSignals(entry.item);
      const own = shortText(entry.item.ownText || '', 120);
      return compactObject({
        index: index + 1,
        kind: entry.kind,
        title: entry.title,
        nodeId: nodeIds.get(entry.item),
        zone: entry.item.zone,
        path: domPath(entry.item.element),
        class: classSummary(entry.item.element) || undefined,
        ownText: own && own !== entry.title ? own : undefined,
        counts: compactCounts({
          controls: entry.item.controlCount,
          interactive: entry.item.interactiveCount,
          fields: entry.item.fieldLikeCount,
          titles: entry.item.titleLikeCount,
          moduleShells: entry.item.moduleShellCount
        }),
        items: collected.signals,
        truncated: collected.truncated || undefined
      });
    });
    const compactNodeCount = 1 + pageBlocks.length + pageBlocks.reduce((sum, block) => sum + (block.items?.length || 0), 0);
    let truncated = false;
    if (pageBlocks.some((block) => block.truncated)) truncated = true;

    return {
      version: VERSION,
      page: { host: location.host, pathname: location.pathname, title: document.title },
      rawDomNodeCount: tree.nodes.length,
      nodeCount: compactNodeCount,
      truncated,
      zones,
      tree: {
        kind: 'page',
        title: document.title || location.host,
        children: pageBlocks
      }
    };
  }

  function titleCandidateText(node, maxLength = 120) {
    if (!(node instanceof Element)) return '';
    const own = normalizeModuleTitleText(ownText(node), maxLength);
    if (own && (own.length <= 32 || looksLikeModuleTitleText(own))) return own;
    for (const child of [...node.children]) {
      if (!(child instanceof Element) || !visible(child) || hasInteractiveDescendant(child)) continue;
      if (/title_text|describe|description|help|tip|remark|note/i.test(rawClassName(child))) continue;
      const childOwn = normalizeModuleTitleText(ownText(child), maxLength);
      if (childOwn && (childOwn.length <= 32 || looksLikeModuleTitleText(childOwn))) return childOwn;
      const nested = titleCandidateText(child, maxLength);
      if (nested) return nested;
    }
    const text = normalizeModuleTitleText(node.innerText || node.textContent || '', maxLength);
    if (text.includes(' ')) {
      const prefix = normalizeModuleTitleText(text.split(' ')[0], maxLength);
      if (prefix && (prefix.length <= 32 || looksLikeModuleTitleText(prefix))) return prefix;
    }
    return looksLikeModuleTitleText(text) ? text : '';
  }

  function firstText(root, selectors, maxLength = 180) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (!node || node.contains(root)) continue;
      const text = titleCandidateText(node, maxLength) || cleanText(node.innerText || node.textContent);
      if (text) return text.slice(0, maxLength);
    }
    return '';
  }

  function cleanFieldTitleNodeText(node, maxLength = 120) {
    if (!(node instanceof Element)) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll([
      '[class*="error"]', '[class*="Error"]', '[class*="invalid"]', '[class*="Invalid"]',
      '[class*="required"]', '[class*="Required"]', '[class*="asterisk"]', '[class*="Asterisk"]',
      '[class*="describe"]', '[class*="Describe"]', '[class*="help"]', '[class*="Help"]',
      '[class*="tip"]', '[class*="Tip"]', '[role="alert"]'
    ].join(',')).forEach((child) => child.remove());
    return normalizeFieldLabel(clone.textContent || '').slice(0, maxLength);
  }

  function firstFieldTitleText(root, selectors, maxLength = 120) {
    for (const selector of selectors) {
      const nodes = [...root.querySelectorAll(selector)];
      for (const node of nodes) {
        if (!node || node.contains(root)) continue;
        const text = cleanFieldTitleNodeText(node, maxLength);
        if (text) return text;
      }
    }
    return '';
  }

  function pageBlockPriority(element) {
    const classes = rawClassName(element);
    const navId = element.getAttribute('data-nav-id') || '';
    if (element.querySelector('#special_field_fast_upload_resume,[id*="fast_upload_resume"],[id*="upload_resume"]')) return 5;
    if (/(?:^|\s)send_box(?:\s|$)/i.test(classes) && element.querySelector(':scope > .send_title')) return 5;
    if (element.querySelector(':scope > [class*="sc-efQSVx"]')) return 4;
    if (element.querySelector(':scope > [class*="divider-title_title"]')) return 4;
    if (element.querySelector(':scope > [class*="title-wrapper"],:scope > [class*="modules-title"]')) return 4;
    if (/(?:^|\s)cv-module(?:\s|$)/i.test(classes) && element.querySelector(':scope [class*="modules-title"]')) return 4;
    if (/(?:^|\s)applyFormModuleWrapper-windows(?:\s|$)/i.test(classes)) return 4;
    if (/apply-block/i.test(classes) || /^block[-_]/i.test(navId) || /[-_]block[-_]/i.test(navId)) return 4;
    if (/createFormSection[-_]container/i.test(classes)) return 4;
    if (/form[-_]?block|block[-_]?item|section[-_]?block|createFormSection/i.test(classes)) return 3;
    if (/form[-_]?section|apply[-_]?section|section[-_]?item/i.test(classes)) return 2;
    if (element.matches('fieldset,section,form,[role="region"]') && pageBlockTitle(element)) return 1;
    return 0;
  }

  function pageBlockTitle(element) {
    const semanticTitle = semanticModuleTitleByElement.get(element);
    if (semanticTitle) return semanticTitle;
    return firstText(element, [
      ':scope > .send_title',
      ':scope > [class*="send_title"]',
      ':scope > [class*="divider-title_title"]',
      ':scope > [class*="blockTitle"]',
      ':scope > [class*="BlockTitle"]',
      ':scope [id="special_field_fast_upload_resume"]',
      ':scope [id*="fast_upload_resume"]',
      ':scope [id*="upload_resume"]',
      ':scope > [class*="sc-efQSVx"]',
      ':scope [class*="modules-title"] [class*="title"]',
      ':scope [class*="modules-title"]',
      ':scope [class*="applyFormModuleWrapper-title"] [class*="applyFormModuleWrapper-text"]',
      ':scope [class*="applyFormModuleWrapper-title"]',
      ':scope [class*="applyFormModuleWrapper-text"]',
      ':scope [class*="title-wrapper"] [class*="title"]',
      ':scope [class*="createFormSection-title"]',
      ':scope > [class*="sectionTitle"]',
      ':scope > [class*="SectionTitle"]',
      ':scope > legend',
      ':scope > h1',
      ':scope > h2',
      ':scope > h3',
      ':scope > h4',
      ':scope > [role="heading"]',
      ':scope > [class*="title"]',
      ':scope > [class*="Title"]'
    ]) || cleanText(element.getAttribute('aria-label') || element.getAttribute('data-title') || element.getAttribute('name') || '');
  }

  function pageBlockLooksLikeModule(element) {
    const title = pageBlockTitle(element);
    if (!title) return false;
    if (globalThis.ResumeProfileSchema?.moduleSectionForTitle?.(title)) return true;
    if (MODULE_TITLE_RE.test(title)) return true;
    return /上传简历|快速解析|个人信息|基本信息|家庭|求职意向|教育|学历|实习|工作|经历|在校|项目|任务|语言|外语|获奖|证书|附件|其他信息|自我评价/i.test(title);
  }

  function pageBlockRootForCandidate(element) {
    const identity = `${element.id || ''} ${rawClassName(element)}`;
    if (/special_field_fast_upload_resume|fast_upload_resume|upload_resume/i.test(identity)) {
      let node = element.parentElement;
      for (let depth = 0; node instanceof Element && depth < 7; depth += 1, node = node.parentElement) {
        if (node.querySelector('input[type="file"]')) return node;
      }
    }
    if (/sc-efQSVx/.test(identity) && element.parentElement) return element.parentElement;
    if (/ux-standard-form|(?:^|\s)form(?:\s|$)|form-item/i.test(identity) || element.matches?.('.ux-standard-form,.form[name],[class*="form-item"]')) {
      let node = element;
      for (let depth = 0; node instanceof Element && depth < 10; depth += 1, node = node.parentElement) {
        if (node.querySelector(':scope > [class*="sc-efQSVx"],:scope > [class*="title-wrapper"],:scope > [class*="modules-title"]')) return node;
      }
    }
    return element;
  }

  function hasInteractiveDescendant(element) {
    return Boolean(element.querySelector(INTERACTIVE_SELECTOR));
  }

  function pageBlockRoots() {
    const semanticRoots = semanticPageBlockRoots();
    if (semanticRoots.length) return semanticRoots;
    const selector = [
      '[data-nav-id^="block-"]',
      '[data-nav-id*="-block"]',
      '#special_field_fast_upload_resume',
      '[id*="fast_upload_resume"]',
      '[id*="upload_resume"]',
      '.send_box',
      '[class*="send_box"]',
      '[class*="sc-efQSVx"]',
      '.ux-standard-form',
      '.form[name]',
      '[class*="cv-module"]',
      '[class*="applyFormModuleWrapper-windows"]',
      '[class*="apply-block"]',
      '[class*="createFormSection-container"]',
      '[class*="createFormSection"]',
      '[class*="form-block"]',
      '[class*="FormBlock"]',
      '[class*="form-section"]',
      '[class*="FormSection"]',
      'fieldset',
      'section',
      'form',
      'section[aria-label]',
      '[role="region"][aria-label]'
    ].join(',');
    const candidates = [...new Set(queryAllDeep(selector).map(pageBlockRootForCandidate))]
      .filter((element) => visible(element) && !element.closest(AUDIT_UI_SELECTOR)
        && pageBlockPriority(element) > 0 && (hasInteractiveDescendant(element) || pageBlockTitle(element)));
    const moduleLikeChildCount = (element) => candidates.filter((other) => other !== element
      && element.contains(other) && pageBlockLooksLikeModule(other)).length;
    return candidates
      .filter((element) => {
        const priority = pageBlockPriority(element);
        const looksLikeModule = pageBlockLooksLikeModule(element);
        const aggregateWrapper = moduleLikeChildCount(element) >= 2;
        const hasBetterChild = candidates.some((other) => other !== element && element.contains(other)
          && (
            pageBlockPriority(other) > priority
            || pageBlockPriority(other) === priority && (pageBlockLooksLikeModule(other) || !looksLikeModule)
            || aggregateWrapper && pageBlockLooksLikeModule(other)
          ));
        const hasSameOrBetterParent = candidates.some((other) => other !== element && other.contains(element)
          && !moduleLikeChildCount(other)
          && (
            pageBlockPriority(other) > priority && !looksLikeModule
            || pageBlockPriority(other) === priority && pageBlockLooksLikeModule(other) && !looksLikeModule
          ));
        return !hasBetterChild && !hasSameOrBetterParent;
      })
      .sort((left, right) => {
        if (left === right) return 0;
        const position = left.compareDocumentPosition(right);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
  }

  function fieldRootTitle(element) {
    const attrTitle = normalizeFieldLabel([
      element.getAttribute?.('data-form-field-i18n-name'),
      element.getAttribute?.('data-form-field-title'),
      element.getAttribute?.('data-form-field-label')
    ].filter(Boolean).join(' '));
    if (attrTitle) return attrTitle;
    return firstFieldTitleText(element, [
      ':scope [id="special_field_fast_upload_resume"]',
      ':scope [id*="fast_upload_resume"]',
      ':scope [id*="upload_resume"]',
      ':scope > [class*="title-"]',
      ':scope > [class*="Title-"]',
      ':scope > [class*="form-item__title"]',
      ':scope > [class*="FormItemTitle"]',
      ':scope [class*="ud-formily-item-label"] label',
      ':scope [class*="ud-formily-item-label"]',
      ':scope [class*="form-item-label"] label',
      ':scope [class*="form-item__text"]',
      ':scope [class*="FormItemLabel"] label',
      ':scope [class*="fieldName"]',
      ':scope [class*="FieldName"]',
      ':scope > [class*="title"]',
      ':scope > [class*="Title"]',
      ':scope > label',
      ':scope > legend',
      ':scope > dt',
      ':scope > [role="heading"]'
    ], 120) || directGenericTitleText(element, 120);
  }

  function inferredFieldRoot(element, block) {
    const known = closestFieldContainer(element, 12) || element.closest('label');
    if (known && block.contains(known)) return known;
    const generic = closestGenericFieldRoot(element, block, 12);
    if (generic) return generic;
    if (element.matches('input[type="file"]') && block.querySelector('input[type="file"]')) return block;
    return null;
  }

  function pageFieldRoots(block) {
    const explicit = [...block.querySelectorAll([
      '[class*="apply-field"]',
      '.info_box',
      '.ud-formily-item',
      '[data-form-field-i18n-name]',
      '[data-form-field-name]',
      '[class*="form-item"]',
      '[class*="FormItem"]',
      '[class*="field-item"]',
      '[class*="FieldItem"]'
    ].join(','))].filter((element) => visible(element) && hasInteractiveDescendant(element) && isFieldContainerElement(element));
    const roots = explicit.length ? explicit : [...block.querySelectorAll('input,textarea,select,[contenteditable]:not([contenteditable="false"]),button,[role="button"],[role="combobox"]')]
      .map((element) => inferredFieldRoot(element, block))
      .filter((element) => element instanceof Element && block.contains(element));
    return [...new Set(roots)].filter((element) => !roots.some((other) => other !== element && element.contains(other)));
  }

  function fieldDescriptionText(field) {
    const texts = [...field.querySelectorAll([
      '[class*="describe"]',
      '[class*="Describe"]',
      '[class*="help"]',
      '[class*="Help"]',
      '[class*="tip"]',
      '[class*="Tip"]',
      'small'
    ].join(','))]
      .map((node) => cleanText(node.innerText || node.textContent))
      .filter(Boolean);
    return [...new Set(texts)].slice(0, 4);
  }

  function summarizeFieldInputs(field) {
    return [...field.querySelectorAll('input,textarea,select,[role="combobox"],[contenteditable]:not([contenteditable="false"]),.phoenix-button')]
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.type || '',
        role: element.getAttribute('role') || '',
        id: element.id || '',
        name: element.getAttribute('name') || '',
        placeholder: element.getAttribute('placeholder') || '',
        accept: element.getAttribute('accept') || '',
        autocomplete: element.getAttribute('autocomplete') || '',
        readonly: Boolean(element.readOnly || element.getAttribute('aria-readonly') === 'true'),
        disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true')
      }));
  }

  function controlsInside(root, items) {
    return items.filter((item) => {
      const target = elementMap.get(item.ref);
      const source = sourceElementMap.get(item.ref);
      return target instanceof Element && root.contains(target)
        || source instanceof Element && root.contains(source);
    });
  }

  function parsePageBlocks(items) {
    const blocks = pageBlockRoots().map((block, blockIndex) => {
      const ref = `b${blockIndex + 1}`;
      elementMap.set(ref, block);
      const blockControls = controlsInside(block, items);
      const fields = pageFieldRoots(block).map((field, fieldIndex) => {
        const fieldControls = controlsInside(field, items);
        if (!fieldControls.length) return null;
        const label = fieldRootTitle(field) || fieldControls.find((item) => item.fieldLabel)?.fieldLabel
          || fieldControls.find((item) => item.text)?.text || '';
        const record = repeatRecordDetails(field);
        return {
          ref: `${ref}f${fieldIndex + 1}`,
          label,
          recordIndex: record.recordIndex,
          recordTotal: record.recordTotal,
          recordGroup: record.recordGroup,
          required: Boolean(field.querySelector('[class*="required"],[aria-required="true"],input[required],textarea[required],select[required]')),
          descriptions: fieldDescriptionText(field),
          inputs: summarizeFieldInputs(field),
          controlRefs: fieldControls.map((item) => item.ref),
          controlKinds: [...new Set(fieldControls.map((item) => item.controlKind).filter(Boolean))],
          operationGroups: [...new Set(fieldControls.map((item) => item.operationGroup).filter(Boolean))],
          domPath: domPath(field),
          class: classSummary(field)
        };
      }).filter(Boolean);
      return {
        ref,
        navId: block.getAttribute('data-nav-id') || '',
        title: pageBlockTitle(block) || `Block ${blockIndex + 1}`,
        context: sectionContext(block),
        fieldCount: fields.length,
        requiredFieldCount: fields.filter((field) => field.required).length,
        controlRefs: blockControls.map((item) => item.ref),
        fields,
        class: classSummary(block),
        domPath: domPath(block)
      };
    });

    const blockByRef = new Map(blocks.map((block) => [block.ref, block]));
    const fieldByControlRef = new Map();
    for (const block of blocks) {
      for (const field of block.fields) {
        for (const controlRef of field.controlRefs) fieldByControlRef.set(controlRef, { block, field });
      }
    }
    for (const item of items) {
      const target = sourceElementMap.get(item.ref) || elementMap.get(item.ref);
      const surface = semanticSurfaceContextForElement(target);
      if (surface) {
        item.surfaceZone = surface.zone;
        item.surfaceTitle = surface.title;
      }
      const structure = semanticStructureContextForElement(target);
      if (structure) {
        item.structureZone = structure.zone;
        item.structureTitle = structure.title;
        item.blockTitle = structure.title;
        item.moduleTitle = structure.title;
        item.blockNavId = structure.zone;
        item.fieldBlockLabel = '';
        continue;
      }
      const fieldMatch = fieldByControlRef.get(item.ref);
      if (fieldMatch) {
        item.blockRef = fieldMatch.block.ref;
        item.blockTitle = fieldMatch.block.title;
        item.blockNavId = fieldMatch.block.navId;
        item.fieldBlockLabel = fieldMatch.field.label;
        item.recordIndex ||= fieldMatch.field.recordIndex || 0;
        item.recordTotal ||= fieldMatch.field.recordTotal || 0;
        item.repeatGroup ||= fieldMatch.field.recordGroup || '';
        continue;
      }
      const block = blocks.find((candidate) => {
        const blockElement = elementMap.get(candidate.ref);
        return blockElement instanceof Element && target instanceof Element && blockElement.contains(target);
      });
      if (blockByRef.has(block?.ref)) {
        item.blockRef = block.ref;
        item.blockTitle = block.title;
        item.blockNavId = block.navId;
        item.fieldBlockLabel = '';
      }
    }
    return blocks;
  }

  function summarizePageModules(blocks) {
    return blocks.map((block) => {
      const labelCounts = new Map();
      for (const field of block.fields) {
        const label = stripGeneratedOrdinal(field.label || '未命名字段');
        field.label = label;
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }
      const seen = new Map();
      const labels = [...labelCounts.entries()].map(([label, count]) => ({ label, count }));
      for (const field of block.fields) {
        const count = labelCounts.get(field.label) || 1;
        const index = (seen.get(field.label) || 0) + 1;
        seen.set(field.label, index);
        field.repeatIndex = index;
        field.repeatTotal = count;
        field.displayLabel = count > 1 ? `${field.label}${index}` : field.label;
      }
      const structuralRecordCount = Math.max(0, ...block.fields.map((field) => field.recordTotal || 0));
      const recordCount = structuralRecordCount || Math.max(0, ...labels.map((item) => item.count));
      const repeatedLabels = labels.filter((item) => item.count > 1);
      return {
        ref: block.ref,
        module: block.title,
        field_count: block.fields.length,
        record_count: recordCount,
        repeated_label_count: repeatedLabels.length,
        labels,
        repeated_labels: repeatedLabels
      };
    });
  }

  function selectedTextFromElement(element) {
    if (!(element instanceof Element)) return '';
    const phoenixRadioText = phoenixRadioSelectedText(element);
    if (phoenixRadioText) return phoenixRadioText;
    const selector = [
      '[aria-checked="true"]',
      '[aria-selected="true"]',
      'input:checked',
      'option:checked',
      '.is-selected',
      '.is-active',
      '.selected',
      '.checked',
      '[class*="selected"]',
      '[class*="Selected"]',
      '[class*="checked"]',
      '[class*="Checked"]',
      '[class*="in-checked-path"]'
    ].join(',');
    const selected = element.matches(selector) ? element : element.querySelector(selector);
    if (!selected || !visible(selected)) return '';
    if (selected.matches?.('input[type="checkbox"],input[type="radio"]')) {
      return cleanText(directLabelText(selected) || selected.value || 'checked');
    }
    return cleanText(selected.textContent || selected.value || selected.getAttribute?.('aria-label') || '');
  }

  function selectedValueCandidates(element) {
    if (!(element instanceof Element)) return [];
    const selector = [
      '.phoenix-button__content',
      '.phoenix-select__singleValue',
      '.phoenix-select__multipleValue',
      '.phoenix-select__tag',
      '.phoenix-select__tipEle',
      '.phoenix-select__calcEle',
      '.phoenix-select__placeHolder',
      '.ant-select-selection-item',
      '.ant-select-selection-selected-value',
      '.atsx-select-selection-item',
      '.atsx-select-selection-selected-value',
      '.el-select__selected-item',
      '.el-select__tags-text',
      '.el-cascader__tags .el-tag__content',
      '.mtd-select-selected-value',
      '.ud__select-selection-item',
      '.ud__select-selected-item',
      '[class*="display-value"]',
      '[class*="DisplayValue"]',
      '[class*="selected-value"]',
      '[class*="SelectedValue"]',
      '[class*="selectedValue"]',
      '[class*="singleValue"]',
      '[class*="SingleValue"]',
      '[class*="selection-item"]',
      '[class*="SelectionItem"]',
      '[class*="selector-item"]',
      '[class*="SelectorItem"]',
      '[class*="select-selection-item"]',
      '[class*="SelectSelectionItem"]'
    ].join(',');
    return [
      ...(element.matches(selector) ? [element] : []),
      ...element.querySelectorAll(selector)
    ].filter((node, index, nodes) => nodes.indexOf(node) === index && visible(node));
  }

  function displayedValueFromElement(element) {
    if (!(element instanceof Element)) return '';
    const values = selectedValueCandidates(element)
      .map((node) => cleanText(node.textContent || node.value || node.getAttribute?.('title') || node.getAttribute?.('aria-label') || ''))
      .filter(Boolean);
    return cleanText([...new Set(values)].join(' / '));
  }

  function directControlCurrentValue(element) {
    if (!(element instanceof Element)) return '';
    if (element.matches('select')) {
      const selectedOptions = [...element.selectedOptions || []].map((option) => cleanText(option.textContent || option.value)).filter(Boolean);
      return cleanText(selectedOptions.join(' / ') || element.value);
    }
    if (element.matches('input[type="checkbox"],input[type="radio"]')) {
      return element.checked ? cleanText(directLabelText(element) || element.value || 'checked') : '';
    }
    if (element.matches('input,textarea')) return cleanText(element.value);
    if (element.matches('[contenteditable]:not([contenteditable="false"])')) return cleanText(element.textContent);
    return '';
  }

  function shouldReadSyntheticValueWithEmptyControls(element) {
    const classes = rawClassName(element);
    const role = String(element.getAttribute('role') || '').toLowerCase();
    return role === 'combobox'
      || element.getAttribute('aria-haspopup') === 'listbox'
      || selectRoot(element) === element
      || /select|cascader|dropdown|picker|calendar|date|phoenix|ant-select|el-select|mtd-select|ud__select|atsx-select|sd-Select/i.test(classes);
  }

  function hasScopedCurrentValueRoot(element) {
    if (!(element instanceof Element)) return false;
    const scopedRoot = selectRoot(element) || phoenixButtonSelectRoot(element) || radioGroupRoot(element);
    if (!(scopedRoot instanceof Element)) return false;
    const fieldRoot = currentFieldContainer(element);
    return scopedRoot !== fieldRoot;
  }

  function rawCurrentControlValue(element) {
    if (!(element instanceof Element)) return '';
    const directValue = directControlCurrentValue(element);
    if (directValue || element.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return directValue;
    const descendantControls = [...element.querySelectorAll('input,textarea,select,[contenteditable]:not([contenteditable="false"])')]
      .filter((control) => control instanceof Element && control.type !== 'hidden');
    const descendantInputValue = descendantControls
      .map((control) => directControlCurrentValue(control))
      .find(Boolean) || '';
    if (descendantControls.length && !descendantInputValue && !shouldReadSyntheticValueWithEmptyControls(element)) return '';
    return descendantInputValue
      || selectedTextFromElement(element)
      || displayedValueFromElement(element)
      || cleanText(element.getAttribute('aria-valuetext') || element.getAttribute('data-value') || element.getAttribute('value') || '');
  }

  function normalizeCurrentControlValue(value, item = {}) {
    const text = cleanText(value);
    if (!text || PLACEHOLDER_VALUE.test(text)) return '';
    const labels = [item.fieldLabel, item.displayName].map(cleanText).filter(Boolean);
    if (labels.some((label) => label === text)) return '';
    return text;
  }

  function readCurrentControlValue(item) {
    const source = sourceElementMap.get(item.ref);
    const target = elementMap.get(item.ref);
    const useFieldContainer = !hasScopedCurrentValueRoot(source) && !hasScopedCurrentValueRoot(target);
    const candidates = [...new Set([
      source,
      target,
      source instanceof Element ? selectRoot(source) : null,
      target instanceof Element ? selectRoot(target) : null,
      source instanceof Element ? phoenixButtonSelectRoot(source) : null,
      target instanceof Element ? phoenixButtonSelectRoot(target) : null,
      useFieldContainer && source instanceof Element ? currentFieldContainer(source) : null,
      useFieldContainer && target instanceof Element ? currentFieldContainer(target) : null
    ].filter((candidate) => candidate instanceof Element))];
    for (const candidate of candidates) {
      const value = normalizeCurrentControlValue(rawCurrentControlValue(candidate), item);
      if (value) return value;
    }
    return normalizeCurrentControlValue(item.currentValue || '', item);
  }

  function annotateCurrentValues(items) {
    const stats = { fillable: 0, filled: 0, empty: 0 };
    for (const item of items) {
      if (item.elementKind !== 'field' || !FILLABLE_FIELD_OPERATION_GROUPS.has(item.operationGroup)) continue;
      stats.fillable += 1;
      const currentValue = readCurrentControlValue(item);
      item.currentValue = currentValue;
      item.hasCurrentValue = Boolean(currentValue);
      item.currentValueState = currentValue ? 'filled' : 'empty';
      if (currentValue) stats.filled += 1;
      else stats.empty += 1;
    }
    return stats;
  }

  function recordElement(element, index) {
    const target = visualTarget(element);
    const preliminaryText = directLabelText(element) || actionDescription(element);
    const inferredContext = sectionContext(element);
    const detectedRangeEndpoint = atsxPeriodEndpoint(element, inferredContext) || mokaYearMonthEndpoint(element, inferredContext);
    const rangeEndpoint = detectedRangeEndpoint?.internal ? null : detectedRangeEndpoint;
    const context = rangeEndpoint?.context || inferredContext;
    const matchedKey = rangeEndpoint?.key || matchKey(preliminaryText, context);
    const kind = controlKind(element, preliminaryText, matchedKey);
    const family = elementKind(kind);
    const inheritedLabelDetails = family === 'field' && !rangeEndpoint ? fieldLabelDetails(element, matchedKey) : null;
    const compoundSemantic = family === 'field'
      ? compoundSubControlSemantic(element, inheritedLabelDetails?.label || preliminaryText, matchedKey, kind)
      : null;
    const fieldText = family === 'field' ? (rangeEndpoint?.label || directLabelText(element)) : '';
    const text = family === 'field'
      ? fieldText || (['month-trigger', 'month-picker'].includes(kind) ? '年月选择器' : kind === 'date-picker' ? '日期选择器' : '')
      : actionDescription(element);
    const finalKey = family === 'field' ? (compoundSemantic?.key || rangeEndpoint?.key || matchKey(text, context)) : '';
    const labelDetails = family === 'field'
      ? compoundSemantic ? { label: compoundSemantic.label, source: compoundSemantic.source } : rangeEndpoint ? { label: rangeEndpoint.label, source: 'range-endpoint' } : fieldLabelDetails(element, finalKey)
      : { label: '', source: '' };
    const profileMapping = family === 'field'
      ? resolveProfileMapping(labelDetails.label, finalKey, context, '', mappingSignalsForElement(element, {
        text,
        displayName: labelDetails.label || text || '',
        fieldLabel: labelDetails.label || '',
        placeholder: element.getAttribute('placeholder') || ''
      }))
      : { path: '', candidates: [], candidateDetails: [], evidence: [], score: 0, strategy: '' };
    const repeatBinding = repeatBindingDetails(element, profileMapping.path, context);
    const recordBinding = repeatRecordDetails(element);
    const action = actionType(element, family, kind, finalKey, text);
    const state = editability(element, kind);
    const safetyResult = safety(action, text);
    const adaptationResult = adaptation(element, kind, action, state, safetyResult);
    const interaction = interactionPlan(element, action, finalKey);
    const classificationResult = classification(element, kind, action, finalKey, text);
    const date = rangeEndpoint?.datePrecision
      ? { precision: rangeEndpoint.datePrecision, mechanism: rangeEndpoint.dateMechanism }
      : dateShape(element, kind, text);
    const rect = target.getBoundingClientRect();
    const ref = `i${index + 1}`;
    elementMap.set(ref, target);
    sourceElementMap.set(ref, element);
    return {
      ref,
      elementKind: family,
      actionType: action,
      operationGroup: operationGroup(action),
      valueDomain: valueDomain(element, family, action, kind),
      cardinality: cardinality(element, kind),
      editability: state,
      availability: /conditional|condition-field|depends-on/i.test(rawClassName(target)) ? 'conditional' : 'available',
      semanticType: semanticType(element, finalKey, kind, text),
      classification: classificationResult,
      interaction,
      adaptation: adaptationResult,
      safety: safetyResult,
      controlKind: kind,
      mappingStatus: profileMapping.path ? 'mapped' : profileMapping.candidates.length ? 'ambiguous' : 'unmapped',
      matchedKey: finalKey,
      profilePath: profileMapping.path,
      profilePathCandidates: profileMapping.candidates,
      profilePathCandidateDetails: profileMapping.candidateDetails,
      mappingEvidence: profileMapping.evidence,
      mappingScore: profileMapping.score,
      mappingStrategy: profileMapping.strategy,
      repeatSection: repeatBinding.repeatSection,
      repeatIndex: repeatBinding.repeatIndex || recordBinding.recordIndex,
      repeatGroup: repeatBinding.repeatGroup || recordBinding.recordGroup,
      recordIndex: recordBinding.recordIndex,
      recordTotal: recordBinding.recordTotal,
      fieldLabel: labelDetails.label,
      fieldLabelSource: labelDetails.source,
      options: kind === 'radio-group' ? radioGroupOptions(element) : [],
      compoundRole: compoundSemantic?.role || '',
      subControlOf: compoundSemantic?.subControlOf || '',
      currentValue: compoundSemantic?.valueText || '',
      rangeRole: rangeEndpoint?.role || '',
      rangeGroup: rangeEndpoint?.rangeGroup || '',
      rangeIndex: rangeEndpoint?.rangeIndex || 0,
      datePart: rangeEndpoint?.datePart || '',
      requirement: family === 'field' ? requirement(element) : '',
      datePrecision: date.precision,
      dateMechanism: date.mechanism,
      text: text || '(无可靠语义文字)',
      context,
      tag: element.tagName.toLowerCase(),
      type: element.type || '',
      role: element.getAttribute('role') || '',
      name: element.name || '',
      id: element.id || '',
      placeholder: element.placeholder || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      ariaLabelledby: element.getAttribute('aria-labelledby') || '',
      ariaExpanded: element.getAttribute('aria-expanded') || '',
      readonly: Boolean(element.readOnly || element.getAttribute('aria-readonly') === 'true'),
      selectable: state === 'selectable',
      disabled: state === 'disabled',
      class: classSummary(target),
      domPath: domPath(target),
      sourceDomPath: target === element ? '' : domPath(element),
      bounds: {
        left: Math.round(rect.left), top: Math.round(rect.top),
        width: Math.round(rect.width), height: Math.round(rect.height)
      }
    };
  }

  function clearElementMarks() {
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((overlay) => overlay.remove());
    queryAllDeep(`[data-resume-page-audit-ref],.${MARK_CLASSES.join(',.')}`).forEach((element) => {
      element.classList.remove(...MARK_CLASSES);
      delete element.dataset.resumePageAuditRef;
    });
  }

  function clearAudit() {
    document.querySelector(PANEL_SELECTOR)?.remove();
    clearElementMarks();
    clearAutofillDebugOverlay();
  }

  function choiceGroups() {
    return queryAllDeep('fieldset,[role="radiogroup"],[role="group"],.phoenix-radio-group')
      .filter(visible)
      .map((group, index) => {
        const phoenixOptions = radioGroupOptions(group);
        const options = [...group.querySelectorAll('input[type="radio"],input[type="checkbox"],[role="radio"],[role="checkbox"]')].filter(visible);
        if (phoenixOptions.length >= 2) {
          return {
            index,
            title: fieldLabelDetails(group, matchKey(directLabelText(group), sectionContext(group))).label,
            cardinality: 'single',
            options: phoenixOptions.map((text) => ({ text, tag: 'div', role: '', type: 'radio' }))
          };
        }
        if (options.length < 2) return null;
        return {
          index,
          title: cleanText(group.querySelector('legend,[role="heading"],[class*="title"],[class*="label"]')?.textContent || group.getAttribute('aria-label') || ''),
          cardinality: options.some((option) => String(option.type || '').toLowerCase() === 'checkbox' || option.getAttribute('role') === 'checkbox') ? 'multi' : 'single',
          options: options.map((option) => ({ text: directLabelText(option), tag: option.tagName.toLowerCase(), role: option.getAttribute('role') || '', type: option.type || '' }))
        };
      }).filter(Boolean);
  }

  function pageLimitations() {
    const limitations = [];
    const iframes = queryAllDeep('iframe');
    if (iframes.some((frame) => {
      try { return frame.src && new URL(frame.src, location.href).origin !== location.origin; } catch { return true; }
    })) limitations.push({ reasonCode: 'IFRAME_CROSS_ORIGIN', count: iframes.length, reason: '页面包含 iframe；跨域 iframe 内部字段无法由当前页面脚本读取' });
    const shadowHosts = queryAllDeep('*').filter((element) => element.shadowRoot);
    if (shadowHosts.length) limitations.push({ reasonCode: 'SHADOW_DOM', count: shadowHosts.length, reason: '已扫描开放 Shadow DOM；封闭 Shadow DOM 仍无法读取' });
    const canvases = queryAllDeep('canvas').filter(visible);
    if (canvases.length) limitations.push({ reasonCode: 'CANVAS_RENDERED', count: canvases.length, reason: '页面包含可见 Canvas，内部交互无法通过标准 DOM 解析' });
    return limitations;
  }

  function dimensionCounts(items) {
    return items.reduce((counts, item) => {
      const dimensions = {
        elementKind: item.elementKind,
        operationGroup: item.operationGroup,
        actionType: item.actionType,
        valueDomain: item.valueDomain,
        cardinality: item.cardinality,
        editability: item.editability,
        availability: item.availability,
        adaptation: item.adaptation.status,
        mapping: item.mappingStatus
      };
      for (const [axis, value] of Object.entries(dimensions)) {
        counts[axis] ||= {};
        counts[axis][value] = (counts[axis][value] || 0) + 1;
      }
      return counts;
    }, {});
  }

  function mergeCompoundInteractions(items) {
    const removedRefs = new Set();
    let mergedOverlaps = 0;

    // 年月面板通常挂在 body 的 Portal 中。优先按 data-cy，其次按屏幕距离与日期触发框合并。
    const dateTriggers = items.filter((item) => item.elementKind === 'field' && ['date-trigger', 'month-trigger'].includes(item.controlKind));
    for (const panel of items.filter((item) => item.elementKind === 'field' && ['date-picker', 'month-picker'].includes(item.controlKind))) {
      const panelTarget = elementMap.get(panel.ref);
      if (!(panelTarget instanceof Element) || !dateTriggers.length) continue;
      const panelRect = panelTarget.getBoundingClientRect();
      const panelCy = panelTarget.querySelector('[data-cy$="Dropdown"]')?.getAttribute('data-cy')
        || panelTarget.getAttribute('data-cy') || '';
      const exactTrigger = panelCy
        ? dateTriggers.find((item) => {
          const target = elementMap.get(item.ref);
          return target?.getAttribute?.('data-cy') === panelCy.replace(/Dropdown$/, '');
        })
        : null;
      const trigger = exactTrigger || [...dateTriggers].sort((left, right) => {
        const leftRect = elementMap.get(left.ref)?.getBoundingClientRect?.();
        const rightRect = elementMap.get(right.ref)?.getBoundingClientRect?.();
        const distance = (rect) => rect
          ? Math.abs(rect.left - panelRect.left) + Math.abs(rect.bottom - panelRect.top)
          : Number.POSITIVE_INFINITY;
        return distance(leftRect) - distance(rightRect);
      })[0];
      if (!trigger) continue;
      trigger.controlKind = panel.controlKind;
      trigger.actionType = 'select';
      trigger.valueDomain = 'closed-local';
      trigger.editability = 'selectable';
      trigger.selectable = true;
      trigger.datePrecision = panel.datePrecision;
      trigger.dateMechanism = panel.dateMechanism;
      trigger.interaction = { ...trigger.interaction, searchable: false, confirmationRequired: true };
      trigger.classification = {
        reasonCode: panel.controlKind === 'month-picker' ? 'READONLY_MONTH_PICKER_TRIGGER' : 'READONLY_DATE_PICKER_TRIGGER',
        evidence: ['non-typing-trigger', panel.controlKind, 'selection-changes-value']
      };
      removedRefs.add(panel.ref);
      mergedOverlaps += 1;
    }

    // Phoenix button 选择器的输入能力由打开后的完整弹层决定：有搜索框则可输入，否则只能点选。
    const selectTriggers = items.filter((item) => item.elementKind === 'field' && item.controlKind === 'select-trigger');
    const usedSelectTriggers = new Set();
    for (const panel of items.filter((item) => item.elementKind === 'field'
      && ['option-panel', 'searchable-option-panel'].includes(item.controlKind))) {
      const panelTarget = elementMap.get(panel.ref);
      if (!(panelTarget instanceof Element) || !selectTriggers.length) continue;
      const panelRect = panelTarget.getBoundingClientRect();
      const trigger = [...selectTriggers]
        .filter((item) => !usedSelectTriggers.has(item.ref))
        .sort((left, right) => {
          const leftRect = elementMap.get(left.ref)?.getBoundingClientRect?.();
          const rightRect = elementMap.get(right.ref)?.getBoundingClientRect?.();
          const distance = (rect) => rect
            ? Math.abs(rect.left - panelRect.left) + Math.abs(rect.bottom - panelRect.top)
            : Number.POSITIVE_INFINITY;
          return distance(leftRect) - distance(rightRect);
        })[0];
      if (!trigger) continue;
      const searchable = panel.controlKind === 'searchable-option-panel';
      trigger.controlKind = searchable ? 'autocomplete' : 'custom-select';
      trigger.actionType = searchable ? 'select-search' : 'select';
      trigger.valueDomain = 'closed-local';
      trigger.editability = searchable ? 'editable' : 'selectable';
      trigger.selectable = !searchable;
      trigger.interaction = { ...trigger.interaction, searchable, confirmationRequired: true };
      trigger.classification = {
        reasonCode: searchable ? 'POPUP_SEARCHABLE_OPTIONS' : 'POPUP_FIXED_OPTIONS',
        evidence: searchable
          ? ['phoenix-button-trigger', 'popup-search-input', 'option-list']
          : ['phoenix-button-trigger', 'fixed-option-list', 'no-search-input']
      };
      removedRefs.add(panel.ref);
      usedSelectTriggers.add(trigger.ref);
      mergedOverlaps += 1;
    }

    for (const field of items.filter((item) => item.elementKind === 'field')) {
      if (removedRefs.has(field.ref)) continue;
      const fieldTarget = elementMap.get(field.ref);
      if (!(fieldTarget instanceof Element)) continue;
      const relatedClicks = items.filter((item) => {
        if (item.elementKind !== 'action' || item.actionType !== 'click' || removedRefs.has(item.ref)) return false;
        const actionTarget = elementMap.get(item.ref);
        return actionTarget instanceof Element && actionTarget !== fieldTarget
          && (actionTarget.contains(fieldTarget) || fieldTarget.contains(actionTarget));
      });
      if (!relatedClicks.length) continue;

      // 外层点击区域包住可写 input：这是一个“输入 + 候选列表确认”的复合控件，不能拆成点击和写入两条。
      const wrapperClick = relatedClicks.some((item) => {
        const actionTarget = elementMap.get(item.ref);
        return actionTarget instanceof Element && actionTarget.contains(fieldTarget);
      });
      const preserveOpenText = wrapperClick
        && field.actionType === 'write'
        && field.controlKind === 'free-text'
        && isOpenTextField(fieldTarget, field.matchedKey, `${field.text || ''} ${field.fieldLabel || ''} ${field.displayName || ''}`);
      if (wrapperClick && field.actionType === 'write' && !preserveOpenText) {
        field.actionType = 'select-search';
        field.valueDomain = 'closed-local';
        field.controlKind = 'autocomplete';
        field.interaction = {
          ...field.interaction,
          searchable: true,
          confirmationRequired: true
        };
        field.classification = {
          reasonCode: 'TEXT_INPUT_WITH_CLICKABLE_LIST_TRIGGER',
          evidence: ['editable-text-input', 'overlapping-click-wrapper', 'option-selection-required']
        };
        field.adaptation = {
          status: 'partial',
          reasonCode: 'DYNAMIC_OPTIONS',
          reason: '可输入字段与候选列表触发区属于同一复合控件，最终值需要从列表确认'
        };
      } else if (preserveOpenText) {
        field.valueDomain = 'open';
        field.classification = {
          ...field.classification,
          reasonCode: field.classification?.reasonCode || 'OPEN_TEXT_SEMANTIC',
          evidence: [...new Set([...(field.classification?.evidence || []), 'overlapping-click-wrapper-ignored'])]
        };
      } else if (wrapperClick && field.actionType === 'none' && field.readonly) {
        field.actionType = 'select';
        field.valueDomain = 'closed-local';
        field.controlKind = 'custom-select';
        field.editability = 'selectable';
        field.selectable = true;
        field.interaction = { ...field.interaction, searchable: false, confirmationRequired: true };
        field.classification = {
          reasonCode: 'READONLY_SELECTION_TRIGGER',
          evidence: ['readonly-text-trigger', 'overlapping-click-wrapper', 'selection-changes-value']
        };
      }
      for (const click of relatedClicks) removedRefs.add(click.ref);
      mergedOverlaps += relatedClicks.length;
    }
    return {
      items: items.filter((item) => !removedRefs.has(item.ref)),
      mergedOverlaps
    };
  }

  function enforceOperationInvariants(items) {
    const selectionKinds = new Set([
      'native-select', 'custom-select', 'native-date', 'date-trigger', 'date-picker',
      'month-trigger', 'month-picker', 'radio', 'radio-group', 'checkbox', 'switch'
    ]);
    for (const item of items) {
      if (item.elementKind !== 'field' || !item.readonly) continue;
      const target = elementMap.get(item.ref);
      const activationHandler = target instanceof Element
        ? `${target.getAttribute('onfocus') || ''} ${target.getAttribute('onclick') || ''} ${target.getAttribute('onmousedown') || ''}`
        : '';
      if (!selectionKinds.has(item.controlKind) && !cleanText(activationHandler)) continue;
      item.actionType = item.cardinality === 'multi' ? 'select-multi' : 'select';
      item.valueDomain = 'closed-local';
      item.editability = 'selectable';
      item.selectable = true;
      item.classification = {
        reasonCode: 'READONLY_SELECTION_TRIGGER',
        evidence: ['readonly-blocks-typing', 'selection-trigger-present', 'selection-changes-value']
      };
      if (item.adaptation.reasonCode === 'READONLY') {
        item.adaptation = { status: 'adapted', reasonCode: '', reason: '' };
      }
    }
  }

  function diagnosePage() {
    clearAudit();
    elementMap = new Map();
    sourceElementMap = new Map();
    semanticModuleTitleByElement = new WeakMap();
    semanticZoneByElement = new WeakMap();
    semanticZoneRootByElement = new WeakMap();
    semanticLandmarkTitleByElement = new WeakMap();
    semanticTreeSnapshot = null;
    const selector = [
      'input', 'textarea', 'select', '[contenteditable]:not([contenteditable="false"])', 'button', 'a', 'summary', 'canvas',
      '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="combobox"]',
      '[role="radio"]', '[role="checkbox"]', '[role="switch"]', '[role="menuitem"]',
      '[role="slider"]', '[role="spinbutton"]', '[role="tab"]', '[role="listbox"]', '[role="radiogroup"]',
      '.phoenix-radio-group', '.phoenix-radio-group__radioItem', '.phoenix-radio',
      '[tabindex]', '[onclick]', '[aria-haspopup]', '[aria-controls]', '[aria-expanded]', '[data-action]',
      '.atsx-date-picker-period-month-label',
      '.atsx-date-picker-dropdown',
      '.phoenix-date-picker', '.phoenix-calendar-month-calendar',
      '.phoenix-button', '.phoenix-button__wraper', '.phoenix-button__suffixIcon', '.phoenix-select', '.phoenix-selectList',
      '.ud__select', '.ud__picker', '.ud__radio-group', '.ud__checkbox-group', '.atsx-upload',
      '[class*="sd-panal-menu-wrapper"]', '[class*="sd-basic-year-container"]', '[class*="sd-basic-year-item"]',
      '.createFormSection-addBtn', '[class*="addMore-plus"]', '[class*="addMore-add"]',
      '.el-select', '.ant-select', '.arco-select', '.ivu-select', '.el-cascader', '.ant-cascader',
      '.el-date-editor', '.ant-picker', '.arco-picker', '.el-upload', '.ant-upload'
    ].join(',');
    const allElements = queryAllDeep('*');
    const semanticCandidates = queryAllDeep(selector);
    const pointerPool = allElements.slice(0, MAX_POINTER_SCAN);
    const pointerCandidates = pointerPool.filter((element) => visible(element)
      && cleanText(element.innerText || element.textContent).length <= 180
      && getComputedStyle(element).cursor === 'pointer');
    const raw = [...new Set([...semanticCandidates, ...pointerCandidates])]
      .filter((element) => visible(element) && !element.closest(AUDIT_UI_SELECTOR)
        && !isAtsxPeriodInternalNoise(element)
        && !isMokaYearMonthInternalNoise(element));
    const canonicalCandidates = [...new Set(raw.map(canonicalInteractiveElement))];
    const seen = new Set();
    const interactive = canonicalCandidates.filter((element) => {
      const target = visualTarget(element);
      if (seen.has(target)) return false;
      seen.add(target);
      return true;
    });
    const provisionalItems = interactive.slice(0, MAX_INTERACTIVE).map(recordElement);
    const withoutWrapperContainers = provisionalItems.filter((item) => {
      if (item.elementKind !== 'container') return true;
      const container = elementMap.get(item.ref);
      if (!(container instanceof Element)) return true;
      return !provisionalItems.some((other) => {
        if (other === item || other.elementKind === 'container') return false;
        const child = elementMap.get(other.ref);
        return child instanceof Element && child !== container && container.contains(child);
      });
    });
    const mergedInteractions = mergeCompoundInteractions(withoutWrapperContainers);
    const items = mergedInteractions.items.filter((item) => {
      const reliableText = item.elementKind === 'field' ? item.fieldLabel || item.text : item.text;
      return !isNoReliableText(reliableText);
    });
    enforceOperationInvariants(items);
    for (const item of items) item.operationGroup = operationGroup(item.actionType);
    assignFieldBindings(items);
    const blocks = parsePageBlocks(items);
    const moduleSummary = summarizePageModules(blocks);
    const moduleByBlockRef = new Map(moduleSummary.map((module) => [module.ref, module]));
    for (const item of items) {
      const module = moduleByBlockRef.get(item.blockRef);
      item.moduleTitle = module?.module || item.blockTitle || item.context || '';
    }
    inferCommonDateRanges(items);
    assignFieldBindings(items);
    remapFieldProfiles(items);
    assignFieldBindings(items);
    const currentValueStats = annotateCurrentValues(items);
    const textCandidates = queryAllDeep('label,legend,h1,h2,h3,h4,h5,h6,dt,th,[role="heading"],[aria-label]')
      .filter((element) => visible(element) && !element.closest(AUDIT_UI_SELECTOR));
    const semanticTexts = textCandidates.slice(0, MAX_SEMANTIC_TEXTS).map((element, index) => {
      const ref = `t${index + 1}`;
      elementMap.set(ref, element);
      return {
        ref,
        text: cleanText(`${element.getAttribute('aria-label') || ''} ${element.textContent}`).slice(0, 180) || '(无可靠语义文字)',
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || '',
        class: classSummary(element),
        domPath: domPath(element)
      };
    }).filter((item) => !isNoReliableText(item.text));
    const limitations = pageLimitations();
    return {
      schemaVersion: 2,
      version: VERSION,
      mode: 'audit-only',
      privacy: { readsInputValues: true, readsInputValuesScope: 'fillable-controls-only', readsLocalResumeData: false, performsPageActions: false },
      page: { host: location.host, pathname: location.pathname, title: document.title },
      counts: {
        interactive: items.length,
        rawInteractiveCandidates: raw.length,
        collapsedDuplicates: Math.max(0, raw.length - items.length),
        mergedInteractionOverlaps: mergedInteractions.mergedOverlaps,
        semanticTexts: textCandidates.length,
        blocks: blocks.length,
        choiceGroups: choiceGroups().length,
        iframes: queryAllDeep('iframe').length,
        shadowHosts: allElements.filter((element) => element.shadowRoot).length,
        dimensions: dimensionCounts(items)
      },
      truncated: {
        interactive: interactive.length > MAX_INTERACTIVE,
        semanticTexts: textCandidates.length > MAX_SEMANTIC_TEXTS,
        pointerScan: allElements.length > MAX_POINTER_SCAN
      },
      limitations,
      currentValueStats,
      iframes: queryAllDeep('iframe').map((frame) => ({
        title: frame.title || '',
        name: frame.name || '',
        srcHost: (() => { try { return new URL(frame.src, location.href).host; } catch { return ''; } })()
      })),
      controls: items.filter((item) => item.elementKind === 'field'),
      blocks,
      moduleSummary,
      semanticTree: semanticTreeSnapshot,
      pageStructure: { blocks },
      fieldBindings: items.filter((item) => item.elementKind === 'field').map((item) => ({
        ref: item.ref,
        fieldLabel: item.fieldLabel,
        displayName: item.displayName,
        bindingKey: item.bindingKey,
        fieldIndex: item.fieldIndex,
        fieldCount: item.fieldCount,
        matchedKey: item.matchedKey,
        profilePath: item.profilePath,
        profilePathCandidates: item.profilePathCandidates,
        profilePathCandidateDetails: item.profilePathCandidateDetails || [],
        mappingEvidence: item.mappingEvidence || [],
        mappingScore: item.mappingScore || 0,
        mappingStrategy: item.mappingStrategy || '',
        repeatSection: item.repeatSection,
        repeatIndex: item.repeatIndex,
        repeatGroup: item.repeatGroup,
        recordIndex: item.recordIndex || 0,
        recordTotal: item.recordTotal || 0,
        blockRef: item.blockRef || '',
        blockTitle: item.blockTitle || '',
        moduleTitle: item.moduleTitle || '',
        blockNavId: item.blockNavId || '',
        fieldBlockLabel: item.fieldBlockLabel || '',
        context: item.context,
        operationGroup: item.operationGroup,
        options: item.options,
        compoundRole: item.compoundRole,
        subControlOf: item.subControlOf,
        ...(Object.prototype.hasOwnProperty.call(item, 'hasCurrentValue') ? {
          hasCurrentValue: item.hasCurrentValue,
          currentValueState: item.currentValueState || 'empty'
        } : {}),
        currentValue: item.currentValue,
        rangeRole: item.rangeRole,
        rangeGroup: item.rangeGroup,
        rangeIndex: item.rangeIndex,
        datePart: item.datePart
      })),
      choiceGroups: choiceGroups(),
      interactiveElements: items,
      semanticTexts,
      semanticTextsPurpose: '辅助识别文本；字段与代值名称请以 fieldBindings 或 controls[].displayName 为准'
    };
  }

  function markItem(item) {
    const target = elementMap.get(item.ref);
    if (!(target instanceof Element) || !target.isConnected) return;
    createOverlay(item.ref, false);
  }

  function positionOverlay(overlay, target) {
    const rect = target.getBoundingClientRect();
    overlay.style.left = `${Math.round(rect.left)}px`;
    overlay.style.top = `${Math.round(rect.top)}px`;
    overlay.style.width = `${Math.max(2, Math.round(rect.width))}px`;
    overlay.style.height = `${Math.max(2, Math.round(rect.height))}px`;
  }

  function createOverlay(ref, targetMode) {
    const target = elementMap.get(ref);
    if (!(target instanceof Element) || !target.isConnected) return null;
    const overlay = document.createElement('div');
    overlay.className = `${OVERLAY_CLASS}${targetMode ? ` ${OVERLAY_TARGET_CLASS}` : ''}`;
    overlay.dataset.resumePageAuditOverlayRef = ref;
    positionOverlay(overlay, target);
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function clearAutofillDebugOverlay() {
    document.querySelectorAll(`.${AUTOFILL_DEBUG_OVERLAY_CLASS}`).forEach((overlay) => overlay.remove());
  }

  function debugOverlayKindForStatus(status = '') {
    const value = cleanText(status).toLowerCase();
    if (['filled', 'kept-existing'].includes(value)) return 'success';
    if (['write-verify-failed', 'existing-different', 'manual-review', 'filled-needs-review'].includes(value)
      || /mismatch|different|review|verify/i.test(value)) return 'mismatch';
    if (value === 'unmapped') return 'unmapped';
    return 'failed';
  }

  function compactDebugOverlayText(value, limit = 80) {
    const text = cleanText(value);
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  }

  function debugOverlayStatusLabel(kind, status) {
    if (kind === 'success') return 'OK';
    if (kind === 'mismatch') return 'MISMATCH';
    if (kind === 'unmapped') return 'UNMAPPED';
    return cleanText(status) || 'FAILED';
  }

  function createAutofillDebugOverlay(ref, kind, label, title = '') {
    const overlay = createOverlay(ref, false);
    if (!overlay) return null;
    overlay.classList.add(AUTOFILL_DEBUG_OVERLAY_CLASS, `${AUTOFILL_DEBUG_OVERLAY_CLASS}--${kind}`);
    overlay.dataset.resumeAutofillDebugKind = kind;
    overlay.title = title;
    const badge = document.createElement('span');
    badge.className = `${AUTOFILL_DEBUG_OVERLAY_CLASS}__label`;
    badge.textContent = compactDebugOverlayText(label);
    overlay.appendChild(badge);
    return overlay;
  }

  function debugDetailKey(item = {}) {
    return [
      item.profilePath || '',
      item.repeatIndex || 0,
      item.operation || item.legacyType || item.operationGroup || '',
      item.compoundRole || '',
      item.matchedKey || '',
      item.field || item.displayName || ''
    ].join('|');
  }

  function showAutofillDebugOverlay(payload = {}) {
    clearAutofillDebugOverlay();
    const report = payload.report || {};
    const controls = Array.isArray(report.controls) ? report.controls : [];
    const details = Array.isArray(payload.details) ? payload.details : [];
    const detailByRef = new Map();
    const detailByKey = new Map();
    for (const detail of details) {
      if (!detail || typeof detail !== 'object') continue;
      if (detail.ref) detailByRef.set(detail.ref, detail);
      const key = debugDetailKey(detail);
      const bucket = detailByKey.get(key) || [];
      bucket.push(detail);
      detailByKey.set(key, bucket);
    }
    const takeDetail = (item) => {
      const byRef = detailByRef.get(item.ref);
      if (byRef) return byRef;
      const bucket = detailByKey.get(debugDetailKey(item));
      return bucket?.shift?.() || null;
    };
    const usedRefs = new Set();
    let success = 0;
    let mismatch = 0;
    let failed = 0;
    let unmapped = 0;

    for (const item of controls) {
      if (!DEBUG_FILL_OPERATION_GROUPS.has(item.operationGroup)) continue;
      if (!item.profilePath) {
        const label = `${debugOverlayStatusLabel('unmapped')} ${item.displayName || item.fieldLabel || item.text || item.ref}`;
        createAutofillDebugOverlay(item.ref, 'unmapped', label, `${item.ref}\n${item.operationGroup || ''}\nunmapped`);
        usedRefs.add(item.ref);
        unmapped += 1;
        continue;
      }
      const detail = takeDetail(item);
      const status = detail?.status || 'not-processed';
      const kind = debugOverlayKindForStatus(status);
      const field = detail?.field || item.displayName || item.fieldLabel || item.text || item.ref;
      const label = `${debugOverlayStatusLabel(kind, status)} ${field}`;
      const title = [
        item.ref,
        item.profilePath,
        `status: ${status}`,
        detail?.reason ? `reason: ${detail.reason}` : '',
        detail?.desired ? `desired: ${detail.desired}` : '',
        detail?.after ? `after: ${detail.after}` : ''
      ].filter(Boolean).join('\n');
      createAutofillDebugOverlay(item.ref, kind, label, title);
      usedRefs.add(item.ref);
      if (detail?.ref) usedRefs.add(detail.ref);
      if (kind === 'success') success += 1;
      else if (kind === 'mismatch') mismatch += 1;
      else failed += 1;
    }

    for (const detail of details) {
      if (!detail?.ref || usedRefs.has(detail.ref)) continue;
      const kind = debugOverlayKindForStatus(detail.status);
      const label = `${debugOverlayStatusLabel(kind, detail.status)} ${detail.field || detail.ref}`;
      const title = [
        detail.ref,
        detail.profilePath,
        `status: ${detail.status || ''}`,
        detail.reason ? `reason: ${detail.reason}` : '',
        detail.desired ? `desired: ${detail.desired}` : '',
        detail.after ? `after: ${detail.after}` : ''
      ].filter(Boolean).join('\n');
      if (createAutofillDebugOverlay(detail.ref, kind, label, title)) {
        usedRefs.add(detail.ref);
        if (kind === 'success') success += 1;
        else if (kind === 'mismatch') mismatch += 1;
        else failed += 1;
      }
    }

    scheduleOverlaySync();
    return { ok: true, success, mismatch, failed, unmapped, total: success + mismatch + failed + unmapped };
  }

  function syncOverlayPositions() {
    overlaySyncFrame = 0;
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((overlay) => {
      const target = elementMap.get(overlay.dataset.resumePageAuditOverlayRef);
      // 页面 hover 重渲染并替换节点时，保留最后位置，不让蓝框突然消失。
      if (target instanceof Element && target.isConnected) positionOverlay(overlay, target);
    });
  }

  function scheduleOverlaySync() {
    if (overlaySyncFrame) return;
    overlaySyncFrame = requestAnimationFrame(syncOverlayPositions);
  }

  window.addEventListener('scroll', scheduleOverlaySync, true);
  window.addEventListener('resize', scheduleOverlaySync);

  function showAuditPanel(report) {
    document.querySelector(PANEL_SELECTOR)?.remove();
    const elementKindLabels = { field: '填写元素', action: '动作元素', container: '交互区域' };
    const actionTypeLabels = {
      write: '直接写入', 'select-search': '输入并从列表选择', select: '从列表选择', 'select-multi': '从列表多选',
      'select-steps': '分步骤选择', toggle: '点击切换', adjust: '调节控件', upload: '上传文件',
      'set-content': '写入富文本', none: '无需操作', click: '点击', submit: '提交/主操作', 'structure-add': '添加一组内容',
      'structure-remove': '删除结构', expand: '展开', collapse: '折叠', navigate: '导航跳转',
      reset: '点击重置', cancel: '点击取消/返回', 'other-action': '点击'
    };
    const operationGroupLabels = {
      'direct-write': '直接写入',
      'input-select': '输入并从列表选择',
      'closed-select': '从列表选择',
      click: '点击',
      upload: '上传文件',
      'no-action': '只读/禁用'
    };
    const mappingLabels = { mapped: '已映射', ambiguous: '待确认', unmapped: '未映射' };
    const currentValueStateLabels = { filled: '已有值', empty: '空值' };
    const fieldItems = report.interactiveElements.filter((item) => item.elementKind === 'field');
    const currentValueItems = fieldItems.filter((item) => Object.prototype.hasOwnProperty.call(item, 'hasCurrentValue'));
    const interactiveByRef = new Map(report.interactiveElements.map((item) => [item.ref, item]));
    const mappingCounts = fieldItems.reduce((counts, item) => {
      counts[item.mappingStatus] = (counts[item.mappingStatus] || 0) + 1;
      return counts;
    }, {});
    const layoutIndexByRef = new Map((report.moduleSummary || []).map((layout, index) => [layout.ref, index]));
    const layoutIndexByName = new Map((report.moduleSummary || []).map((layout, index) => [layout.module, index]));
    const layoutNameForItem = (item) => item.structureTitle || item.moduleTitle || item.blockTitle || item.context || '';
    const parentLayoutForItem = (item) => item.structureTitle || item.blockTitle || item.moduleTitle || item.context || '';
    const hasCurrentValueAttribute = (item) => Object.prototype.hasOwnProperty.call(item, 'hasCurrentValue');
    const currentValuePreview = (item, limit = 72) => {
      const text = cleanText(item.currentValue || '');
      return text.length > limit ? `${text.slice(0, limit)}...` : text;
    };
    const currentValueLabel = (item) => {
      if (!hasCurrentValueAttribute(item)) return '';
      return item.hasCurrentValue ? `当前已有：${currentValuePreview(item)}` : '当前为空';
    };
    const attributesForItem = (item) => [
      item.surfaceTitle,
      layoutNameForItem(item) ? '' : '布局未识别'
    ].filter(Boolean);
    const siblingLayoutsForItem = (item) => {
      if (item.structureTitle) return '';
      const layoutName = layoutNameForItem(item);
      if (!layoutName) return '';
      const layouts = report.moduleSummary || [];
      const index = layoutIndexByRef.has(item.blockRef)
        ? layoutIndexByRef.get(item.blockRef)
        : layoutIndexByName.get(layoutName);
      if (index === undefined) return '';
      return [
        layouts[index - 1]?.module ? `前：${layouts[index - 1].module}` : '',
        layouts[index + 1]?.module ? `后：${layouts[index + 1].module}` : ''
      ].filter(Boolean).join('，');
    };
    const mappingTarget = (item) => {
      if (item.elementKind !== 'field') return '非填写字段';
      if (item.profilePath) return item.profilePath;
      if (item.profilePathCandidates?.length) return item.profilePathCandidates.join(' / ');
      return item.matchedKey || '未映射';
    };
    const compactItemPayload = (item) => ({
      ref: item.ref,
      label: item.elementKind === 'field' ? (item.displayName || item.fieldLabel || item.text) : item.text,
      parentLayout: parentLayoutForItem(item),
      layout: layoutNameForItem(item),
      siblingLayouts: siblingLayoutsForItem(item),
      category: elementKindLabels[item.elementKind] || item.elementKind,
      attributes: attributesForItem(item),
      operation: operationGroupLabels[item.operationGroup] || item.operationGroup || '',
      actionType: actionTypeLabels[item.actionType] || item.actionType || '',
      mappingStatus: item.elementKind === 'field' ? (mappingLabels[item.mappingStatus] || item.mappingStatus) : '非填写字段',
      mappedField: item.elementKind === 'field' ? mappingTarget(item) : '',
      mappingScore: item.elementKind === 'field' ? item.mappingScore || 0 : undefined,
      mappingStrategy: item.elementKind === 'field' ? item.mappingStrategy || '' : undefined,
      mappingEvidence: item.elementKind === 'field' ? item.mappingEvidence || [] : undefined,
      profilePathCandidateDetails: item.elementKind === 'field' ? item.profilePathCandidateDetails || [] : undefined,
      hasCurrentValue: hasCurrentValueAttribute(item) ? item.hasCurrentValue : undefined,
      currentValueState: item.currentValueState || undefined,
      currentValue: hasCurrentValueAttribute(item) ? item.currentValue || '' : undefined,
      matchedKey: item.matchedKey || '',
      recordIndex: item.recordIndex || 0,
      recordTotal: item.recordTotal || 0,
      datePart: item.datePart === 'year' ? '年' : item.datePart === 'month' ? '月' : item.datePart || '',
      rangeRole: item.rangeRole === 'start' ? '开始' : item.rangeRole === 'end' ? '结束' : item.rangeRole || ''
    });
    const copyText = async (value) => {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      if (!ok) throw new Error('copy failed');
    };
    const copyRowInfo = (item, row) => {
      const payload = compactItemPayload(item);
      copyText(JSON.stringify(payload, null, 2)).then(() => {
        row.dataset.copyState = 'copied';
        window.setTimeout(() => {
          if (row.isConnected) delete row.dataset.copyState;
        }, 900);
      }).catch(() => {
        row.dataset.copyState = 'failed';
        window.setTimeout(() => {
          if (row.isConnected) delete row.dataset.copyState;
        }, 900);
      });
    };
    const copySemanticTree = (button) => {
      const payload = report.semanticTree || {
        version: report.version,
        page: report.page,
        error: 'semantic tree was not generated'
      };
      copyText(JSON.stringify(payload, null, 2)).then(() => {
        const original = button.textContent;
        button.textContent = '已复制';
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = original;
        }, 900);
      }).catch(() => {
        const original = button.textContent;
        button.textContent = '复制失败';
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = original;
        }, 900);
      });
    };
    const copyFilteredRows = (button) => {
      const rows = [...list.querySelectorAll('[data-ref]')].filter((row) => !row.hidden);
      const payload = rows
        .map((row) => interactiveByRef.get(row.dataset.ref))
        .filter(Boolean)
        .map(compactItemPayload);
      copyText(JSON.stringify(payload, null, 2)).then(() => {
        const original = button.textContent;
        button.textContent = payload.length ? `已复制 ${payload.length}` : '已复制 0';
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = original;
        }, 900);
      }).catch(() => {
        const original = button.textContent;
        button.textContent = '复制失败';
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = original;
        }, 900);
      });
    };
    const layoutLabels = Object.fromEntries([
      ...(report.moduleSummary || []).map((layout) => layout.module),
      ...report.interactiveElements.map(layoutNameForItem)
    ].filter(Boolean).map((layout) => [layout, layout]));

    const panel = document.createElement('aside');
    panel.className = 'resume-page-audit';
    const header = document.createElement('div');
    header.className = 'resume-page-audit__header';
    const title = document.createElement('div');
    title.innerHTML = `<strong>页面解析</strong><small>版本 ${report.version} · 默认只显示关键识别信息</small>`;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', '关闭页面解析');
    close.addEventListener('click', clearAudit);
    header.append(title, close);

    const dimensions = report.counts.dimensions;
    const summary = document.createElement('div');
    summary.className = 'resume-page-audit__summary';
    summary.textContent = `发现 ${report.counts.interactive} 个可见交互元素：填写 ${dimensions.elementKind?.field || 0}，动作 ${dimensions.elementKind?.action || 0}，交互区域 ${dimensions.elementKind?.container || 0}。字段映射：已映射 ${mappingCounts.mapped || 0}，待确认 ${mappingCounts.ambiguous || 0}，未映射 ${mappingCounts.unmapped || 0}。`;
    if (report.currentValueStats?.fillable) {
      const stats = report.currentValueStats;
      summary.textContent += ` 当前可填字段：已有值 ${stats.filled || 0}，空 ${stats.empty || 0}。`;
    }
    const highlightNotice = document.createElement('div');
    highlightNotice.className = 'resume-page-audit__notice';
    highlightNotice.textContent = '点击列表行会复制该行关键信息，并在原页面定位高亮该元素；不会填写、不提交。';

    const axisValue = (item, axis) => {
      if (axis === 'mappingStatus') return item.elementKind === 'field' ? item.mappingStatus : 'not-field';
      if (axis === 'currentValueState') return item.currentValueState || 'not-fillable';
      if (axis === 'layoutTitle') return layoutNameForItem(item);
      return item[axis];
    };
    const filterGroups = [
      ['elementKind', '元素', elementKindLabels],
      ['operationGroup', '操作', operationGroupLabels],
      ['mappingStatus', '映射', mappingLabels],
      ['currentValueState', '当前值', currentValueStateLabels],
      ['layoutTitle', '布局', layoutLabels]
    ];
    const filters = document.createElement('div');
    filters.className = 'resume-page-audit__filters';
    for (const [axis, captionText, labels] of filterGroups) {
      const group = document.createElement('div');
      group.className = 'resume-page-audit__filter-group';
      const caption = document.createElement('span');
      caption.textContent = captionText;
      group.appendChild(caption);
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'is-active';
      all.dataset.axis = axis;
      const isMappingAxis = axis === 'mappingStatus';
      const isCurrentValueAxis = axis === 'currentValueState';
      all.dataset.value = isMappingAxis ? '__field-all' : isCurrentValueAxis ? '__current-value-all' : '';
      const axisItems = isMappingAxis ? fieldItems : isCurrentValueAxis ? currentValueItems : report.interactiveElements;
      all.textContent = `${isMappingAxis ? '全部字段' : isCurrentValueAxis ? '全部可填' : '全部'} ${axisItems.length}`;
      group.appendChild(all);
      for (const [value, label] of Object.entries(labels)) {
        const count = axisItems.filter((item) => axisValue(item, axis) === value).length;
        if (!count) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.axis = axis;
        button.dataset.value = value;
        button.textContent = `${label} ${count}`;
        group.appendChild(button);
      }
      filters.appendChild(group);
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'resume-page-audit__toolbar';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = '搜索字段、布局、映射路径';
    const copyTree = document.createElement('button');
    copyTree.type = 'button';
    copyTree.textContent = '复制结构树';
    copyTree.title = '复制当前页面解析出的语义结构树 JSON';
    copyTree.addEventListener('click', () => copySemanticTree(copyTree));
    const copyFiltered = document.createElement('button');
    copyFiltered.type = 'button';
    copyFiltered.textContent = '复制筛选结果';
    copyFiltered.title = '复制当前搜索和筛选后仍显示的元素 JSON';
    copyFiltered.addEventListener('click', () => copyFilteredRows(copyFiltered));
    toolbar.append(search, copyFiltered, copyTree);

    const list = document.createElement('div');
    list.className = 'resume-page-audit__list';
    for (const item of report.interactiveElements) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `resume-page-audit__row resume-page-audit__row--${item.elementKind} resume-page-audit__row--${item.adaptation.status}`;
      row.dataset.elementKind = item.elementKind;
      row.dataset.operationGroup = item.operationGroup;
      row.dataset.actionType = item.actionType;
      row.dataset.adaptation = item.adaptation.status;
      row.dataset.editability = item.editability;
      row.dataset.mappingStatus = item.elementKind === 'field' ? item.mappingStatus : 'not-field';
      row.dataset.layoutTitle = layoutNameForItem(item);
      row.dataset.surfaceTitle = item.surfaceTitle || '';
      row.dataset.currentValueState = item.currentValueState || '';
      row.dataset.ref = item.ref;
      row.dataset.search = `${item.ref} ${item.text} ${item.fieldLabel || ''} ${item.displayName || ''} ${item.bindingKey || ''} ${layoutNameForItem(item)} ${parentLayoutForItem(item)} ${siblingLayoutsForItem(item)} ${attributesForItem(item).join(' ')} ${item.currentValue || ''} ${item.currentValueState || ''} ${item.matchedKey || ''} ${item.profilePath || ''} ${(item.profilePathCandidates || []).join(' ')} ${(item.mappingEvidence || []).join(' ')} ${(item.profilePathCandidateDetails || []).map((detail) => `${detail.path} ${detail.reason} ${detail.score}`).join(' ')} ${item.mappingScore || ''} ${item.mappingStrategy || ''} ${item.controlKind || ''} ${operationGroupLabels[item.operationGroup] || ''} ${actionTypeLabels[item.actionType] || ''}`.toLowerCase();
      const head = document.createElement('span');
      head.className = 'resume-page-audit__row-head';
      const currentValueBadge = hasCurrentValueAttribute(item) ? `<em>${item.hasCurrentValue ? '已有值' : '空值'}</em>` : '';
      head.innerHTML = `<b>${item.ref}</b><em>${elementKindLabels[item.elementKind] || item.elementKind}</em>${item.elementKind === 'field' ? `<em>${mappingLabels[item.mappingStatus] || item.mappingStatus}</em>` : ''}${currentValueBadge}<code>${operationGroupLabels[item.operationGroup] || item.operationGroup}</code>`;
      const label = document.createElement('span');
      label.className = 'resume-page-audit__row-text';
      label.textContent = item.elementKind === 'field' ? (item.displayName || item.fieldLabel || item.text) : item.text;
      const meta = document.createElement('span');
      meta.className = 'resume-page-audit__row-meta';
      meta.textContent = [
        parentLayoutForItem(item) ? `父布局：${parentLayoutForItem(item)}` : '',
        layoutNameForItem(item) ? `所属布局：${layoutNameForItem(item)}` : '',
        siblingLayoutsForItem(item) ? `相邻布局：${siblingLayoutsForItem(item)}` : '',
        attributesForItem(item).length ? `属性：${attributesForItem(item).join('，')}` : '',
        `操作：${operationGroupLabels[item.operationGroup] || item.operationGroup || '未识别'}`,
        actionTypeLabels[item.actionType] && actionTypeLabels[item.actionType] !== operationGroupLabels[item.operationGroup] ? `细分：${actionTypeLabels[item.actionType]}` : '',
        item.elementKind === 'field' ? `映射：${mappingLabels[item.mappingStatus] || item.mappingStatus}` : '',
        item.elementKind === 'field' ? `字段：${mappingTarget(item)}` : '',
        item.recordTotal > 1 ? `记录：${item.recordIndex || '-'} / ${item.recordTotal}` : '',
        item.datePart ? `日期部分：${item.datePart === 'year' ? '年' : item.datePart === 'month' ? '月' : item.datePart}` : '',
        item.rangeRole ? `范围：${item.rangeRole === 'start' ? '开始' : item.rangeRole === 'end' ? '结束' : item.rangeRole}` : ''
      ].filter(Boolean).join(' · ');
      if (item.elementKind === 'field') {
        const mappingMeta = [
          item.mappingScore ? `Mapping score: ${item.mappingScore}` : '',
          item.mappingStrategy ? `Mapping strategy: ${item.mappingStrategy}` : '',
          item.mappingEvidence?.length ? `Mapping evidence: ${item.mappingEvidence.join(', ')}` : ''
        ].filter(Boolean).join(' | ');
        if (mappingMeta) meta.textContent = [meta.textContent, mappingMeta].filter(Boolean).join(' | ');
      }
      if (currentValueLabel(item)) meta.textContent = [currentValueLabel(item), meta.textContent].filter(Boolean).join(' | ');
      const path = document.createElement('small');
      path.textContent = item.elementKind === 'field'
        ? `页面标签：${item.fieldLabel || item.text || '-'}`
        : `页面文字：${item.text || '-'}`;
      row.append(head, label, meta, path);
      row.addEventListener('click', () => {
        copyRowInfo(item, row);
        const target = elementMap.get(item.ref);
        if (!(target instanceof Element) || !target.isConnected) return;
        document.querySelectorAll(`.${OVERLAY_TARGET_CLASS}`).forEach((overlay) => overlay.remove());
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
        requestAnimationFrame(() => createOverlay(item.ref, true));
      });
      list.appendChild(row);
    }

    const activeFilters = {};
    const applyFilters = () => {
      const query = search.value.trim().toLowerCase();
      const hasExplicitFilter = Boolean(query) || Object.values(activeFilters).some(Boolean);
      clearElementMarks();
      list.querySelectorAll('[data-search]').forEach((row) => {
        const dimensionsMatch = Object.entries(activeFilters).every(([axis, value]) => {
          if (!value) return true;
          if (axis === 'mappingStatus' && value === '__field-all') return row.dataset.elementKind === 'field';
          if (axis === 'currentValueState' && value === '__current-value-all') return Boolean(row.dataset.currentValueState);
          return row.dataset[axis] === value;
        });
        row.hidden = !(dimensionsMatch && (!query || row.dataset.search.includes(query)));
        if (hasExplicitFilter && !row.hidden) markItem(interactiveByRef.get(row.dataset.ref));
      });
    };
    search.addEventListener('input', applyFilters);
    filters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-axis]');
      if (!button) return;
      const axis = button.dataset.axis;
      activeFilters[axis] = button.dataset.value;
      filters.querySelectorAll(`[data-axis="${axis}"]`).forEach((item) => item.classList.toggle('is-active', item === button));
      applyFilters();
    });
    panel.append(header, summary, highlightNotice, filters, toolbar, list);
    document.documentElement.appendChild(panel);
    search.focus();
  }

  globalThis.ResumePageAuditApi = {
    version: VERSION,
    diagnosePage,
    getTarget: (ref) => elementMap.get(ref) || null,
    getSource: (ref) => sourceElementMap.get(ref) || null,
    showAutofillDebugOverlay,
    clearAutofillDebugOverlay,
    isVisible: visible,
    cleanText
  };

  function normalizedMessageType(message) {
    const type = cleanText(message?.type);
    if (message?.protocol === MESSAGE_PROTOCOL && type.endsWith('_V2')) return type.replace(/_V2$/, '');
    return type;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (globalThis.__resumePageAuditVersion !== VERSION) return;
    const type = normalizedMessageType(message);
    if (type === 'RESUME_PAGE_AUDIT_SHOW') {
      const report = diagnosePage();
      if (message?.showPanel !== false) showAuditPanel(report);
      sendResponse(report);
      return;
    }
    if (type === 'RESUME_PAGE_AUDIT_CLEAR') {
      clearAudit();
      sendResponse({ ok: true, version: VERSION });
      return;
    }
    if (type === 'RESUME_AUTOFILL_DEBUG_OVERLAY_CLEAR') {
      clearAutofillDebugOverlay();
      sendResponse({ ok: true, version: VERSION });
      return;
    }
  });
})();
