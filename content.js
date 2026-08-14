(() => {
  const CONTENT_SCRIPT_VERSION = '0.6.50';
  if (globalThis.__resumeAutofillLoadedVersion === CONTENT_SCRIPT_VERSION) return;
  globalThis.__resumeAutofillLoadedVersion = CONTENT_SCRIPT_VERSION;
  globalThis.__resumeAutofillLoaded = true;

  const FILLED_CLASS = 'resume-autofill-filled';
  const UNMATCHED_CLASS = 'resume-autofill-unmatched';
  const MISSING_CLASS = 'resume-autofill-missing';
  const FAILED_CLASS = 'resume-autofill-failed';
  const EXISTING_CLASS = 'resume-autofill-existing';
  const IGNORED_CLASS = 'resume-autofill-ignored';
  const INTERACTION_TIMEOUT = 1200;
  const INTERACTION_CLOSE_TIMEOUT = 1000;
  let interactionBlocked = '';
  let interactionWarnings = [];
  const GENERIC_PLACEHOLDER = /^(?:请输入|请选择|请填写|选择|输入|select|please\s+(?:select|enter)|nope|new_password|年|月|日|yyyy|mm|dd)?$/i;
  const FIELD_CONTAINER_HINT = /field|form.?item|control.?item|question|row|cell/i;
  const LABEL_HINT = /label|title|caption|name|prompt/i;
  let semanticContainerCache = new WeakMap();
  let labelTextCache = new WeakMap();
  let sectionContextCache = new WeakMap();
  let auditElementMap = new Map();

  const rules = [
    { key: 'familyName', patterns: [/家庭成员.*姓名/, /父母.*姓名/, /紧急联系人(?!.*(?:电话|手机))/, /联系人.*姓名/, /family.*name/] },
    { key: 'relativesEmployed', patterns: [/是否.*(?:亲属|亲戚|家属).*(?:任职|工作|就职)/, /(?:亲属|亲戚|家属).*(?:在本公司|本集团|应聘单位|公司内).*(?:任职|工作|就职)/, /relative.*(?:employ|work).*(?:company|organi[sz]ation)?/i] },
    { key: 'familyRelationship', patterns: [/家庭成员.*关系/, /与本人关系/, /亲属关系/, /relationship/] },
    { key: 'familyPhone', patterns: [/家庭成员.*(?:电话|手机)/, /父母.*(?:电话|手机)/, /紧急联系(?:电话|手机)/, /联系人.*(?:电话|手机)/, /emergency.*phone/] },
    { key: 'familyWorkplace', patterns: [/家庭成员.*工作单位/, /父母.*工作单位/, /联系人.*工作单位/] },
    { key: 'familyOccupation', patterns: [/家庭成员.*职业/, /父母.*职业/, /联系人.*职业/] },
    { key: 'email', patterns: [/邮箱/, /电子邮件/, /e[- ]?mail/] },
    { key: 'phone', patterns: [/手机/, /手机号/, /联系电话/, /电话号码/, /phone/, /mobile/, /telephone/] },
    { key: 'firstName', patterns: [/名(?:字)?\s*first/, /first\s*name/, /given\s*name/] },
    { key: 'lastName', patterns: [/姓\s*last/, /last\s*name/, /family\s*name/, /surname/] },
    { key: 'englishName', patterns: [/英文名/, /英文姓名/, /拼音姓名/, /english\s*name/, /name\s*in\s*english/] },
    { key: 'fullName', patterns: [/姓名/, /真实姓名/, /候选人姓名/, /应聘者姓名/, /申请人姓名/, /中文名/, /full\s*name/, /candidate\s*name/, /applicant\s*name/, /^name$/] },
    { key: 'gender', patterns: [/性别/, /gender/, /^sex$/] },
    { key: 'birthDate', patterns: [/出生日期/, /出生年月/, /生日/, /date\s*of\s*birth/, /birth\s*date/, /birthday/] },
    { key: 'countryRegion', patterns: [/^国家\s*[/／-]?\s*地区$/, /^国家$/, /^国籍$/, /country\s*[/／-]?\s*region/, /country\s*(?:of\s*)?(?:residence|citizenship)?/] },
    { key: 'desiredCity', patterns: [/期望城市/, /意向(?:工作)?城市/, /意向工作地点/, /期望工作地点/, /desired\s*(city|location)/, /preferred\s*location/] },
    { key: 'currentResidence', patterns: [/现居地/, /现居住地/, /当前居住地/, /current.*residence/] },
    { key: 'ethnicity', patterns: [/民族/, /\bethnicity\b/] },
    { key: 'city', patterns: [/所在城市/, /当前城市/, /居住城市/, /城市/, /\bcity\b/, /current\s*location/] },
    { key: 'address', patterns: [/详细地址/, /居住地址/, /联系地址/, /street\s*address/, /^address/] },
    { key: 'postalCode', patterns: [/邮编/, /邮政编码/, /postal\s*code/, /zip\s*code/] },
    { key: 'height', patterns: [/身高/, /height/] },
    { key: 'weight', patterns: [/体重/, /weight/] },
    { key: 'studentOrigin', patterns: [/生源地/, /student.*origin/] },
    { key: 'nativePlaceProvince', patterns: [/(?:籍贯|祖籍).*(?:省(?:份|级)?(?:\s|$|[)）\]】/／-])|省\s*[/／-]\s*直辖市)/, /(?:省份|省级|省\s*[/／-]\s*直辖市).*(?:籍贯|祖籍)/, /native\s*place.*province/] },
    { key: 'nativePlaceDistrict', patterns: [/(?:籍贯|祖籍).*(?:区(?:\s*[/／-]?\s*县)?(?:\s|$|[)）\]】/／-])|县区)/, /(?:区县|县区|区\s*[/／-]\s*县).*(?:籍贯|祖籍)/, /native\s*place.*(?:district|county)/] },
    { key: 'nativePlaceCity', patterns: [/(?:籍贯|祖籍).*(?:市(?:\s*[/／-]?\s*地区)?(?:\s|$|[)）\]】/／-])|城市)/, /(?:城市|市级|市\s*[/／-]\s*地区).*(?:籍贯|祖籍)/, /native\s*place.*city/] },
    { key: 'nativePlace', patterns: [/籍贯/, /祖籍/, /native\s*place/] },
    { key: 'householdRegistration', patterns: [/户籍所在地/, /户口所在地/, /^户籍$/, /household.*registration/, /hukou/] },
    { key: 'politicalStatus', patterns: [/政治面貌/, /political.*status/] },
    { key: 'maritalStatus', patterns: [/婚姻状况/, /婚姻状态/, /^婚否$/, /marital.*status/] },
    { key: 'wechat', patterns: [/微信号/, /^微信$/, /wechat/] },
    { key: 'qq', patterns: [/qq(?:号|号码)?/i, /腾讯qq/i] },
    { key: 'identityDocumentType', patterns: [/证件类别/, /证件类型/, /身份证件类型/, /document.*type/, /id.*type/] },
    { key: 'identityDocumentNumber', patterns: [/证件号码/, /证件编号/, /身份证号(?:码)?/, /护照号(?:码)?/, /document.*number/, /id.*number/, /passport.*number/] },
    { key: 'targetRole', patterns: [/目标职位/, /期望职位/, /意向职位/, /申请职位/, /desired\s*(role|position)/, /target\s*(role|position)/] },
    { key: 'expectedSalary', patterns: [/期望薪资/, /期望月薪/, /薪资要求/, /expected\s*salary/, /salary\s*expectation/] },
    { key: 'yearsExperience', patterns: [/工作年限/, /工作经验年限/, /years?\s*of\s*experience/] },
    { key: 'availableDate', patterns: [/到岗日期/, /预计可到岗时间/, /可入职日期/, /最早入职/, /available\s*(date|from)/, /start\s*date/] },
    { key: 'jobStatus', patterns: [/求职状态/, /当前状态/, /在职状态/, /employment\s*status/] },
    { key: 'school', patterns: [/毕业院校/, /学校名称/, /学校/, /院校/, /university/, /college/, /school/] },
    { key: 'college', patterns: [/学院名称/, /院系名称/, /^学院$/, /^院系$/, /faculty/] },
    { key: 'isHighestEducation', patterns: [/是否最高学历/, /最高学历.*(?:是|否)/, /is.*highest.*education/] },
    { key: 'highestDegree', patterns: [/^最高学历$/, /最高教育程度/, /highest\s*education(?:\s*level)?/] },
    { key: 'degree', patterns: [/最高学历/, /学历/, /education\s*level/] },
    { key: 'academicDegree', patterns: [/所获学位/, /学位名称/, /^学位$/, /academic\s*degree/, /^degree$/] },
    { key: 'major', patterns: [/所学专业/, /专业名称/, /专业/, /field\s*of\s*study/, /major/] },
    { key: 'educationStartDate', patterns: [/教育.*开始时间/, /入学时间/, /education.*start/] },
    { key: 'highestGraduationDate', patterns: [/最高学历.*毕业(?:日期|时间)/, /最高学历.*毕业年份/, /highest.*graduation/] },
    { key: 'graduationDate', patterns: [/毕业日期/, /毕业时间/, /graduation\s*(date|year)/] },
    { key: 'gpa', patterns: [/绩点/, /\bgpa\b/] },
    { key: 'rankingPercent', patterns: [/排名占比/, /排名百分比/, /专业排名比例/, /成绩排名比例/, /rank.*percent/, /percentile/] },
    { key: 'ranking', patterns: [/专业排名/, /成绩排名/, /class.*rank/, /major.*rank/] },
    { key: 'studyMode', patterns: [/学习形式/, /培养方式/, /就读形式/, /study.*mode/] },
    { key: 'company', patterns: [/当前公司/, /最近公司/, /公司名称/, /单位名称/, /雇主/, /employer/, /company\s*name/] },
    { key: 'currentTitle', patterns: [/当前职位/, /最近职位/, /职位名称/, /职务/, /job\s*title/, /position\s*title/] },
    { key: 'department', patterns: [/部门名称/, /^部门$/, /工作部门/, /实习部门/, /department/] },
    { key: 'workType', patterns: [/经历类型/, /工作性质/, /实习类型/, /employment.*type/] },
    { key: 'workStartDate', patterns: [/工作开始时间/, /入职时间/, /入职日期/, /employment\s*start/, /work\s*start/] },
    { key: 'workEndDate', patterns: [/工作结束时间/, /离职时间/, /离职日期/, /employment\s*end/, /work\s*end/] },
    { key: 'workDescription', patterns: [/工作内容/, /实习内容/, /工作描述/, /职责描述/, /工作职责/, /responsibilities/, /job\s*description/] },
    { key: 'projectName', patterns: [/项目名称/, /project.*name/] },
    { key: 'projectRole', patterns: [/项目角色/, /项目职责/, /项目中职责/, /project.*role/] },
    { key: 'projectStartDate', patterns: [/项目.*开始时间/, /project.*start/] },
    { key: 'projectEndDate', patterns: [/项目.*结束时间/, /project.*end/] },
    { key: 'projectDescription', patterns: [/项目描述/, /项目内容/, /project.*description/] },
    { key: 'certificateName', patterns: [/证书名称/, /技能证书/, /资格证书/, /奖项名称/, /荣誉名称/, /资质名称/, /certificate.*(?:name|title)/, /award.*(?:name|title)/, /honou?r.*(?:name|title)/] },
    { key: 'certificateDate', patterns: [/证书.*获得时间/, /获证时间/, /发证日期/, /颁发日期/, /获奖时间/, /奖项时间/, /certificate.*date/, /award.*date/] },
    { key: 'certificateNumber', patterns: [/证书编号/, /证书号码/, /资格证编号/, /certificate.*(?:number|no\.?)/] },
    { key: 'certificateIssuer', patterns: [/证书.*颁发机构/, /颁发单位/, /发证机构/, /发证单位/, /颁奖单位/, /issuing.*organization/, /award.*organization/] },
    { key: 'certificateLevel', patterns: [/奖项级别/, /获奖级别/, /证书级别/, /荣誉级别/, /award.*level/, /certificate.*level/] },
    { key: 'certificateDescription', patterns: [/证书描述/, /certificate.*description/] },
    { key: 'languageName', patterns: [/语言名称/, /语言类型/, /^语言$/, /language/] },
    { key: 'englishLevel', patterns: [/英语水平/, /英语等级/, /英文水平/, /英文等级/, /大学英语等级/, /english.*(?:level|proficiency)/] },
    { key: 'englishListeningSpeaking', patterns: [/英语.*(?:听说|听力.*口语|口语.*听力)/, /英文.*(?:听说|听力.*口语|口语.*听力)/, /english.*(?:listening.*speaking|speaking.*listening|oral)/] },
    { key: 'englishReadingWriting', patterns: [/英语.*(?:读写|阅读.*写作|写作.*阅读)/, /英文.*(?:读写|阅读.*写作|写作.*阅读)/, /english.*(?:reading.*writing|writing.*reading)/] },
    { key: 'languageProficiency', patterns: [/语言.*熟练程度/, /语言能力/, /外语水平/, /language.*proficiency/] },
    { key: 'languageCertificate', patterns: [/语言.*证书/, /语言考试/, /language.*certificate/] },
    { key: 'languageScore', patterns: [/语言.*成绩/, /语言.*分数/, /language.*score/] },
    { key: 'computerLevel', patterns: [/计算机等级/, /计算机证书/, /computer.*level/, /computer.*certificate/] },
    { key: 'computerProficiency', patterns: [/计算机.*熟练程度/, /computer.*proficiency/] },
    { key: 'computerSkills', patterns: [/计算机技能/, /计算机能力/, /软件技能/, /computer.*skills?/] },
    { key: 'linkedin', patterns: [/linkedin/] },
    { key: 'github', patterns: [/github/] },
    { key: 'portfolio', patterns: [/个人网站/, /作品集/, /个人主页/, /portfolio/, /personal\s*(site|website)/, /website/] },
    { key: 'summary', patterns: [/个人介绍/, /自我介绍/, /个人优势/, /自我评价/, /自我描述/, /个人简介/, /summary/, /about\s*you/, /bio/] },
    { key: 'needsSponsorship', patterns: [/签证担保/, /visa\s*sponsorship/, /require.*sponsorship/] },
    { key: 'workAuthorized', patterns: [/合法工作资格/, /工作授权/, /authorized\s*to\s*work/, /work\s*authorization/] },
    { key: 'remoteOk', patterns: [/接受远程/, /远程办公/, /willing.*remote/, /remote\s*work/] },
    { key: 'relocateOk', patterns: [/接受搬迁/, /接受调动/, /willing.*relocat/, /relocation/] }
    , { key: 'healthStatus', patterns: [/^健康状况$/, /^身体状况$/, /身体健康情况/, /health\s*(?:status|condition)/] }
    , { key: 'mentalIllness', patterns: [/是否.*(?:精神疾病|精神病史|精神障碍)/, /有无.*(?:精神疾病|精神病史|精神障碍)/, /mental.*(?:illness|disease|disorder|history)/] }
    , { key: 'acceptsAdjustment', patterns: [/是否.*服从.*(?:调剂|调配|分配)/, /服从调剂/, /服从调配/, /接受.*(?:岗位)?调配/, /accept.*(?:adjustment|reassignment)/] }
    , { key: 'acceptsRotation', patterns: [/是否.*(?:接受|服从).*(?:轮岗|岗位轮换)/, /是否轮岗/, /接受轮岗/, /job\s*rotation|rotational\s*(?:role|program)/] }
  ];

  const ignoredText = /搜索|search|职位关键字|请输入[^ ]*关键字|keyword|验证码|captcha|密码|password|确认密码|用户名|username|优惠码|coupon|推荐码|referral\s*code|^至今(?:\s|$)|同步更新在线简历|^授权文本$|隐私政策|用户协议/i;

  function visible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
      && Number(style.opacity || 1) > 0.01 && element.getAttribute('aria-hidden') !== 'true'
      && rect.width > 0 && rect.height > 0;
  }

  function interactiveDescription(element) {
    return cleanText([
      element?.getAttribute?.('aria-label'), element?.getAttribute?.('title'),
      element?.getAttribute?.('name'), element?.getAttribute?.('data-action'),
      element?.getAttribute?.('data-testid'), element?.textContent
    ].filter(Boolean).join(' '));
  }

  function interactionHint(element) {
    if (!(element instanceof Element) || !visible(element)) return false;
    if (element.matches('button,a,input,select,textarea,summary,label,[role="button"],[role="option"],[role="menuitem"],[role="gridcell"],[role="treeitem"],[role="radio"],[role="checkbox"],[tabindex],[onclick],[data-value],[data-key]')) return true;
    const style = getComputedStyle(element);
    return style.cursor === 'pointer' || style.cursor === 'text';
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\*/g, ' ')
      .replace(/必填项?未填写|此项必填|不能为空|校验失败|格式错误|请输入|请选择|nope|new_password/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function meaningfulHint(value) {
    const text = cleanText(value);
    return text && !GENERIC_PLACEHOLDER.test(text) ? text : '';
  }

  function controlNodes(root) {
    return [...root.querySelectorAll('input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="combobox"]')]
      .filter((node, index, list) => list.indexOf(node) === index);
  }

  function directSemanticLabels(container, element) {
    const candidates = [];
    for (const node of container.querySelectorAll('label, legend, dt, th, [role="heading"], [class]')) {
      if (node === element || node.contains(element)) continue;
      const className = String(node.className || '');
      const explicit = /^(LABEL|LEGEND|DT|TH)$/.test(node.tagName) || node.getAttribute('role') === 'heading' || LABEL_HINT.test(className);
      if (!explicit) continue;
      const text = cleanText(node.textContent);
      if (text && text.length <= 100 && !GENERIC_PLACEHOLDER.test(text) && !/^(?:至今|当前|present|currently)$/i.test(text)) candidates.push(text);
    }
    return candidates;
  }

  function semanticContainer(element) {
    if (semanticContainerCache.has(element)) return semanticContainerCache.get(element);
    let fallback = element.parentElement;
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 16; depth += 1, ancestor = ancestor.parentElement) {
      const controls = controlNodes(ancestor);
      if (!controls.includes(element) && !ancestor.contains(element)) continue;
      const labels = directSemanticLabels(ancestor, element);
      const hinted = FIELD_CONTAINER_HINT.test(String(ancestor.className || ''));
      if (labels.length && (hinted || controls.length <= 6)) {
        semanticContainerCache.set(element, ancestor);
        return ancestor;
      }
      if (controls.length <= 6) fallback = ancestor;
      if (controls.length > 16) break;
    }
    semanticContainerCache.set(element, fallback);
    return fallback;
  }

  function labelText(element) {
    if (labelTextCache.has(element)) return labelTextCache.get(element);
    const pieces = [
      meaningfulHint(element.getAttribute('aria-label')),
      meaningfulHint(element.getAttribute('aria-placeholder')),
      meaningfulHint(element.getAttribute('data-label')),
      meaningfulHint(element.getAttribute('data-field')),
      meaningfulHint(element.getAttribute('data-name')),
      meaningfulHint(element.placeholder),
      meaningfulHint(element.name),
      meaningfulHint(element.id)
    ];
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) pieces.push(document.getElementById(id)?.innerText);
    }
    if (element.id) {
      try { pieces.push(document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText); } catch {}
    }
    pieces.push(cleanText(element.closest('label')?.innerText));
    const container = semanticContainer(element);
    if (container) pieces.push(...directSemanticLabels(container, element));
    const previous = element.previousElementSibling;
    if (previous?.matches('label, legend, span, [class*="label"], [class*="Label"]') && previous.innerText?.length < 80) pieces.push(previous.innerText);
    const result = [...new Set(pieces.map(cleanText).filter(Boolean))].join(' ').toLowerCase().slice(0, 500);
    labelTextCache.set(element, result);
    return result;
  }

  function semanticSectionKind(value) {
    const text = cleanText(value);
    return /education|educational|academic|schooling|教育|学习经历/i.test(text) ? 'education'
      : /employment|intern(?:ship)?|work(?:experience)?|career|实习|工作经历|职业经历/i.test(text) ? 'work'
        : /project|research|项目|科研/i.test(text) ? 'project'
          : /certificate|award|honou?r|证书|奖项|表彰|奖励|荣誉/i.test(text) ? 'certificate'
            : /language|语言|外语/i.test(text) ? 'language'
              : /family|relative|emergency.?contact|家庭|父母|紧急联系人/i.test(text) ? 'family'
                : /basic|personal|个人信息|基本信息/i.test(text) ? 'basic' : '';
  }

  function sectionContext(element) {
    if (sectionContextCache.has(element)) return sectionContextCache.get(element);
    // 动态表单经常没有可见区块标题，但 name/data-cy/id 会保留
    // project[0].startDate、education.1.school 等结构语义。优先使用这些属性。
    let cueNode = element;
    for (let depth = 0; cueNode instanceof Element && depth < 9; depth += 1, cueNode = cueNode.parentElement) {
      const cue = ['name', 'id', 'data-cy', 'data-testid', 'data-field', 'data-name', 'aria-label']
        .map((attribute) => cueNode.getAttribute(attribute) || '').join(' ');
      const context = semanticSectionKind(cue);
      if (context && context !== 'basic') {
        sectionContextCache.set(element, context);
        return context;
      }
    }
    let ancestor = semanticContainer(element)?.parentElement || element.parentElement;
    for (let depth = 0; ancestor && depth < 10; depth += 1, ancestor = ancestor.parentElement) {
      const children = [...ancestor.children];
      const containingIndex = children.findIndex((child) => child.contains(element));
      const candidates = children.flatMap((child, childIndex) => {
        if (child.contains(element)) return [];
        const shortStructuralTitle = childIndex < containingIndex && controlNodes(child).length === 0 && cleanText(child.textContent).length <= 60;
        if (shortStructuralTitle || /^H[1-6]$/.test(child.tagName) || child.getAttribute('role') === 'heading' || /block.?title|section.?title|heading/i.test(String(child.className || ''))) return [child];
        return [...child.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"],[class*="blockTitle"],[class*="block-title"],[class*="sectionTitle"],[class*="section-title"]')];
      });
      for (const candidate of candidates) {
        const text = cleanText(candidate.textContent).slice(0, 100);
        const context = semanticSectionKind(text);
        if (context) {
          sectionContextCache.set(element, context);
          return context;
        }
      }
    }
    sectionContextCache.set(element, '');
    return '';
  }

  function contextualKey(text, context) {
    const exact = cleanText(text).toLowerCase();
    if (/排名占比|排名百分比|排名比例|rank.*percent|percentile/i.test(exact)) return 'rankingPercent';
    if (/专业排名|成绩排名|排名（?%?）?|major\s*rank|class\s*rank/i.test(exact)) return 'ranking';
    if (/gpa|绩点/i.test(exact)) return 'gpa';
    if (/学院名称|院系名称|^学院$|^院系$|faculty|school\s*faculty/i.test(exact)) return 'college';
    const start = /^(?:开始时间|开始日期|起始时间|入学时间)$/i.test(exact);
    const end = /^(?:结束时间|结束日期|截止时间|毕业时间|毕业日期)$/i.test(exact);
    if (context === 'education') {
      if (/是否最高学历/.test(exact)) return 'isHighestEducation';
      if (/(?:^|\s)学位$|所获学位|学位名称/.test(exact)) return 'academicDegree';
      if (/(?:^|\s)学历$|最高学历/.test(exact)) return 'degree';
      if (start) return 'educationStartDate';
      if (end) return 'graduationDate';
      if (/^(?:就读时间|起止时间|在校时间|学习时间)$/i.test(exact)) return 'educationDateRange';
    }
    if (context === 'work') {
      if (start) return 'workStartDate';
      if (end) return 'workEndDate';
      if (/^(?:起止时间|任职时间|工作时间|实习时间)$/i.test(exact)) return 'workDateRange';
      if (/^(?:职责|工作内容|实习内容)$/i.test(exact)) return 'workDescription';
    }
    if (context === 'project') {
      if (start) return 'projectStartDate';
      if (end) return 'projectEndDate';
      if (/^(?:起止时间|项目时间)$/i.test(exact)) return 'projectDateRange';
      if (/^(?:职责|角色)$/i.test(exact)) return 'projectRole';
      if (/^描述$/i.test(exact)) return 'projectDescription';
    }
    if (context === 'certificate') {
      if (/^(?:证书名称|奖项名称|荣誉名称|奖项)$/i.test(exact)) return 'certificateName';
      if (/^(?:获得时间|获奖时间|证书时间|奖项时间|发证日期|颁发日期)$/i.test(exact)) return 'certificateDate';
      if (/^(?:证书编号|证书号码|资格证编号)$/i.test(exact)) return 'certificateNumber';
      if (/^(?:发证机构|发证单位|颁发机构|颁发单位|颁奖单位)$/i.test(exact)) return 'certificateIssuer';
      if (/^(?:奖项级别|获奖级别|证书级别|荣誉级别)$/i.test(exact)) return 'certificateLevel';
      if (/^(?:简述|描述|证书描述|奖项描述)$/i.test(exact)) return 'certificateDescription';
    }
    if (context === 'family') {
      if (/^(?:姓名|成员姓名|联系人姓名|亲属姓名)$/i.test(exact)) return 'familyName';
      if (/^(?:关系|与本人关系|亲属关系)$/i.test(exact)) return 'familyRelationship';
      if (/^(?:电话|手机|联系电话|手机号码)$/i.test(exact)) return 'familyPhone';
      if (/^(?:工作单位|所在单位)$/i.test(exact)) return 'familyWorkplace';
      if (/^(?:职业|职务)$/i.test(exact)) return 'familyOccupation';
    }
    if (context === 'language') {
      if (/^(?:语言|语言名称|语言类型)$/i.test(exact)) return 'languageName';
      if (/听说|听力.*口语|口语.*听力/i.test(exact)) return 'languageListeningSpeaking';
      if (/读写|阅读.*写作|写作.*阅读/i.test(exact)) return 'languageReadingWriting';
      if (/熟练|能力|等级/i.test(exact)) return 'languageProficiency';
      if (/分数|成绩/i.test(exact)) return 'languageScore';
    }
    return '';
  }

  function matchKey(text, context = '') {
    if (!text || ignoredText.test(text)) return null;
    return contextualKey(text, context) || rules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)))?.key || null;
  }

  function placeholderLike(value) {
    const text = String(value || '').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || GENERIC_PLACEHOLDER.test(text)) return true;
    const compact = text.replace(/[\s_—–:：|()（）\[\]【】<>《》]+/g, '').replace(/^-+|-+$/g, '');
    if (/^(?:请输入|请选择|请填写|请选择后填写|选择|输入|未选择|未设置|暂无|待选择|select|choose|please(?:select|enter)|none|null)$/i.test(compact)) return true;
    if (/^(?:请输入|请选择|请填写|选择)(?:[^，。；;]{0,24})$/i.test(compact)) return true;
    if (/^(?:yyyy|yy|mm|dd|年|月|日)(?:[-/.](?:yyyy|yy|mm|dd|年|月|日)){0,2}$/i.test(compact)) return true;
    return false;
  }

  function nativeSelectHasMeaningfulValue(element) {
    const option = element.selectedOptions?.[0] || element.options?.[element.selectedIndex];
    if (!option || element.selectedIndex < 0) return false;
    const shown = `${option.value || ''} ${option.textContent || ''}`.trim();
    if (!option.value || option.disabled || ['-1', 'null', 'undefined'].includes(String(option.value).toLowerCase())
      || placeholderLike(option.value) || placeholderLike(option.textContent) || placeholderLike(shown)) return false;
    // 浏览器会在页面初始化时自动选中第一个 option。没有 selected
    // 属性的这种值是组件默认值，不是用户或网站已保存的内容。
    if (element.selectedIndex === 0 && !option.defaultSelected) return false;
    return true;
  }

  function controlReadback(element, trigger = null) {
    if (!(element instanceof Element)) return '';
    if (element instanceof HTMLSelectElement) {
      const option = element.selectedOptions?.[0];
      return cleanText(option ? `${option.textContent || ''}${option.value && option.value !== option.textContent ? ` [${option.value}]` : ''}` : '');
    }
    if (element.type === 'radio' || element.type === 'checkbox') {
      if (!element.checked) return '未选中';
      return cleanText(element.closest('label')?.textContent || element.value || '已选中');
    }
    const ownRaw = String(element.value ?? (element.isContentEditable ? element.textContent : '')).trim();
    if (ownRaw && !placeholderLike(ownRaw)) return cleanText(ownRaw).slice(0, 120);
    const selected = trigger?.querySelector?.('[aria-selected="true"],[aria-checked="true"],[class*="selected-value"],[class*="SelectedValue"],[class*="singleValue"],[class*="SingleValue"]');
    const shownRaw = String(selected?.textContent || trigger?.textContent || '').trim();
    return placeholderLike(shownRaw) ? '' : cleanText(shownRaw).slice(0, 120);
  }

  function hasValue(element) {
    if (element.type === 'checkbox' || element.type === 'radio') return element.checked;
    const trigger = customSelectTrigger(element);
    if (element instanceof HTMLSelectElement) return nativeSelectHasMeaningfulValue(element);
    const ownRaw = String(element.value ?? (element.isContentEditable ? element.textContent : '')).trim();
    const own = cleanText(ownRaw);
    if (ownRaw && !placeholderLike(ownRaw)) {
      const declaredDefault = cleanText(element.getAttribute('data-default-value') || element.getAttribute('data-default') || '');
      if (!declaredDefault || normalizedExactText(own) !== normalizedExactText(declaredDefault)) return true;
    }
    if (!trigger) return false;
    return customTriggerHasSelection(trigger);
  }

  function customTriggerHasSelection(trigger) {
    if (!(trigger instanceof Element)) return false;
    const selected = trigger.querySelector(
      '[aria-selected="true"], [class*="display-value"], [class*="DisplayValue"], [class*="selected-value"], [class*="SelectedValue"], [class*="singleValue"], [class*="SingleValue"], [class*="calcEle"], [class*="selected-item"], [class*="selection-item"]'
    );
    const shownRaw = String(selected?.textContent || '').trim();
    const shown = cleanText(shownRaw);
    const declaredDefault = cleanText(
      selected?.getAttribute?.('data-default-value') || selected?.getAttribute?.('data-default')
      || trigger.getAttribute('data-default-value') || trigger.getAttribute('data-default') || ''
    );
    if (shown && !placeholderLike(shownRaw)
      && (!declaredDefault || normalizedExactText(shown) !== normalizedExactText(declaredDefault))) return true;
    const visiblePlaceholder = [...trigger.querySelectorAll('[class*="placeholder" i],[data-placeholder]')]
      .some((node) => visible(node) && placeholderLike(node.textContent || node.getAttribute('data-placeholder')));
    if (visiblePlaceholder) return false;
    const fallbackRaw = String(trigger.textContent || '').trim();
    const fallback = cleanText(fallbackRaw);
    return Boolean(fallback && !placeholderLike(fallbackRaw) && !/^[+＋]\d{1,4}$/.test(fallback)
      && (!declaredDefault || normalizedExactText(fallback) !== normalizedExactText(declaredDefault)));
  }

  function setNativeValue(element, value) {
    if (element instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter ? setter.call(element, value) : (element.value = value);
    } else if (element instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter ? setter.call(element, value) : (element.value = value);
    } else {
      element.value = value;
    }
    for (const type of ['input', 'change', 'blur']) element.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function normalizedChoices(value) {
    const rankingFraction = String(value || '').match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
    if (rankingFraction && Number(rankingFraction[2]) > 0) {
      const percent = Number(rankingFraction[1]) / Number(rankingFraction[2]) * 100;
      const bucket = [5, 10, 20, 30, 50].find((limit) => percent <= limit);
      if (bucket) return [String(value), `前${bucket}%`, `top ${bucket}%`, `${bucket}%`];
      return [String(value), '其他', 'other'];
    }
    if (value === 'yes' || value === '是') return ['是', 'yes', 'true', '同意', '接受', '可以', '已授权'];
    if (value === 'no' || value === '否') return ['否', 'no', 'false', '不同意', '不接受', '不可以', '不需要'];
    if (value === '男') return ['男', 'male', 'man'];
    if (value === '女') return ['女', 'female', 'woman'];
    if (value === '不披露') return ['不披露', 'prefer not', 'decline', '不愿透露'];
    if (value === '无') return ['无', '否', '没有', '无此情况', '不存在', 'none', 'no'];
    if (value === '有') return ['有', '是', '存在', 'yes'];
    if (value === '健康') return ['健康', '身体健康', '良好', 'healthy', 'good'];
    if (/^(?:身份证|居民身份证|中华人民共和国居民身份证)$/.test(value)) return ['身份证', '居民身份证', '中华人民共和国居民身份证'];
    if (/^(?:护照|中国护照)$/.test(value)) return ['护照', '中国护照'];
    if (/^(?:港澳内地通行证|港澳居民来往内地通行证)$/.test(value)) return ['港澳内地通行证', '港澳居民来往内地通行证'];
    if (/^(?:台湾大陆通行证|台湾居民来往大陆通行证)$/.test(value)) return ['台湾大陆通行证', '台湾居民来往大陆通行证', '台胞证'];
    if (/^(?:外国人永居|外国人永久居留身份证|外国人永久居留证)$/.test(value)) return ['外国人永居', '外国人永久居留身份证', '外国人永久居留证'];
    if (value === '全国普通高等院校全日制') return ['全国普通高等院校全日制', '普通高等院校全日制', '统招全日制'];
    if (value === '全国普通高等院校非全日制') return ['全国普通高等院校非全日制', '普通高等院校非全日制', '非全日制'];
    if (value === '本科') return ['本科', '大学本科', 'bachelor', "bachelor's degree"];
    if (/^(?:硕士|硕士研究生|研究生硕士)$/.test(value)) return ['硕士', '硕士研究生', '研究生', 'master', "master's degree"];
    if (value === '博士') return ['博士', 'phd', 'doctorate', 'doctoral'];
    if (value === '大专') return ['大专', '专科', 'associate'];
    if (value === '学士') return ['学士', '学士学位', 'bachelor', "bachelor's degree"];
    if (value === '双学士') return ['双学士', '双学士学位', '双学位', 'double bachelor'];
    if (value === 'MBA') return ['MBA', '工商管理硕士'];
    if (value === '高中') return ['高中', '普通高中', 'high school'];
    if (value === '中专') return ['中专', '中等专业学校', 'secondary vocational'];
    if (value === '初中及以下') return ['初中及以下', '初中', '初级中学', 'junior high'];
    if (/^(?:中国|中华人民共和国|china|chinese)$/i.test(value)) return ['中国', '中华人民共和国', '中国大陆', 'China', 'Chinese'];
    if (/非全日制|在职|part.?time/i.test(value)) return [String(value), '非全日制', '在职', '非统招'];
    if (/全日制|统招|full.?time/i.test(value)) return [String(value), '全日制', '统招', '普通全日制', '全国普通高等院校全日制'];
    if (/(?:cet|cte)\s*[-－]?\s*6|大学英语六级|英语六级|^六级$/i.test(value)) return ['CET-6', 'CET6', 'CTE6', '大学英语六级', '英语六级', '六级'];
    if (/(?:cet|cte)\s*[-－]?\s*4|大学英语四级|英语四级|^四级$/i.test(value)) return ['CET-4', 'CET4', 'CTE4', '大学英语四级', '英语四级', '四级'];
    if (/tem\s*[-－]?\s*8|英语专业八级|专八/i.test(value)) return ['TEM-8', 'TEM8', '英语专业八级', '专八'];
    if (/tem\s*[-－]?\s*4|英语专业四级|专四/i.test(value)) return ['TEM-4', 'TEM4', '英语专业四级', '专四'];
    return [String(value)];
  }

  function choiceConflict(text, value) {
    const option = cleanText(text).toLowerCase();
    const target = cleanText(value).toLowerCase();
    if (/硕士|master/.test(target) && /博士|doctor|ph\.?d|本科|bachelor|专科|大专|associate/.test(option)) return true;
    if (/博士|doctor|ph\.?d/.test(target) && /硕士|master|本科|bachelor|专科|大专|associate/.test(option)) return true;
    if (/本科|bachelor/.test(target) && /博士|doctor|ph\.?d|硕士|master|专科|大专|associate/.test(option)) return true;
    if (/专科|大专|associate/.test(target) && /博士|doctor|ph\.?d|硕士|master|本科|bachelor/.test(option)) return true;
    const targetNonFullTime = /非全日制|part.?time|在职/.test(target);
    const optionNonFullTime = /非全日制|part.?time|在职/.test(option);
    if (targetNonFullTime !== optionNonFullTime && /全日制|full.?time/.test(`${target} ${option}`)) return true;
    const targetNonUnified = /非统招/.test(target);
    const optionNonUnified = /非统招/.test(option);
    if (targetNonUnified !== optionNonUnified && /统招/.test(`${target} ${option}`)) return true;
    return false;
  }

  function choiceMatchScore(text, value) {
    const optionText = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!optionText || choiceConflict(optionText, value)) return 0;
    let best = 0;
    const rawTarget = cleanText(value).toLowerCase();
    if (/硕士|master/.test(rawTarget) && /硕士|master|研究生/.test(optionText)) best = Math.max(best, 94);
    if (/博士|doctor|ph\.?d/.test(rawTarget) && /博士|doctor|ph\.?d/.test(optionText)) best = Math.max(best, 94);
    if (/非全日制|part.?time|在职/.test(rawTarget) && /非全日制|part.?time|在职/.test(optionText)) best = Math.max(best, 94);
    if (!/非全日制|part.?time|在职/.test(rawTarget) && /全日制|full.?time|统招/.test(rawTarget)
      && !/非全日制|part.?time|在职|非统招/.test(optionText) && /全日制|full.?time|统招/.test(optionText)) best = Math.max(best, 92);
    for (const candidate of normalizedChoices(value)) {
      const normalized = candidate.toLowerCase();
      if (/^\d+$/.test(normalized)) {
        const numberMatch = optionText.match(/^0*(\d+)(?:\s*[年月日号])?$/);
        if (numberMatch && Number(numberMatch[1]) === Number(normalized)) best = Math.max(best, 100);
        continue;
      }
      const simplify = (item) => item
        .replace(/[·•\s_-]/g, '')
        .replace(/(?:壮族|回族|满族|汉族|民族)$/i, (matched) => matched)
        .replace(/(?:省|市|地区|特别行政区)$/i, '');
      const left = simplify(optionText);
      const right = simplify(normalized);
      if (left.includes('非全日制') !== right.includes('非全日制') && left.includes('全日制') && right.includes('全日制')) continue;
      if (left.includes('非统招专升本') !== right.includes('非统招专升本') && left.includes('统招专升本') && right.includes('统招专升本')) continue;
      if (left.includes('外国护照') !== right.includes('外国护照') && left.includes('护照') && right.includes('护照')) continue;
      if (optionText === normalized) best = Math.max(best, 100);
      else if (left === right) best = Math.max(best, 98);
      else if (left.startsWith(right) || left.endsWith(right)) best = Math.max(best, 92 - Math.min(12, left.length - right.length));
      else if (left.includes(right)) best = Math.max(best, 84 - Math.min(14, left.length - right.length));
      else if (right.includes(left) && left.length >= 2) best = Math.max(best, 72 - Math.min(12, right.length - left.length));
    }
    return Math.max(0, best);
  }

  function choiceMatches(text, value) {
    return choiceMatchScore(text, value) >= 60;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function activateOption(option) {
    if (!(option instanceof Element) || !option.isConnected) return false;
    // 候选面板有时被渲染在包裹输入框的 <label> 内。点击候选会先触发组件事件，
    // 随后 label 的默认动作又点击一次输入框，把刚关闭的面板重新打开。
    // 仅阻止这种默认动作，不停止事件冒泡，React/Vue 的委托监听仍可收到 click。
    const ownerLabel = option.closest('label');
    const labelControl = ownerLabel?.querySelector('input,textarea,select,[contenteditable="true"],[role="combobox"]');
    if (ownerLabel && ownerLabel !== option && labelControl && !option.contains(labelControl)) {
      ownerLabel.addEventListener('click', (event) => event.preventDefault(), { capture: true, once: true });
    }
    if (typeof PointerEvent === 'function') {
      option.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 }));
    }
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    if (typeof PointerEvent === 'function') {
      option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse', button: 0 }));
    }
    option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    // HTML、SVG 和自定义元素统一派发冒泡 click，避免页面环境中缺少 click() 方法。
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: window }));
    return true;
  }

  async function trustedClick(option) {
    if (!(option instanceof Element) || !option.isConnected || !visible(option)) return { ok: false, error: '候选不可见' };
    try { option.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch { option.scrollIntoView(); }
    await wait(30);
    if (!option.isConnected || !visible(option)) return { ok: false, error: '滚动后候选已失效' };
    const rect = option.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return { ok: false, error: '候选无法滚动到视口内' };
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(option === hit || option.contains(hit) || hit.contains(option))) {
      const blocker = hit ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}` : '未知元素';
      return { ok: false, error: `候选中心被 ${blocker} 遮挡` };
    }
    try {
      return await chrome.runtime.sendMessage({ type: 'RESUME_AUTOFILL_TRUSTED_CLICK', point: { x, y } });
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  }

  function clickOutsideControl(trigger) {
    const target = trigger?.closest('form,[role="form"]')
      || document.querySelector('main,#root,#app,[class*="application"],[class*="Application"]')
      || document.body;
    activateOption(target);
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const EventType = type.startsWith('pointer') && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
      document.dispatchEvent(new EventType(type, { bubbles: true, button: 0, pointerType: 'mouse' }));
    }
  }

  async function commitControl(element, trigger) {
    await wait(15);
    clickOutsideControl(trigger);
    await wait(10);
    for (const target of [...new Set([element, trigger].filter((node) => node?.isConnected))]) {
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (element?.isConnected && typeof element.focus === 'function') {
      try { element.focus({ preventScroll: true }); } catch { element.focus(); }
      await wait(10);
      element.blur();
    } else if (trigger?.isConnected && typeof trigger.blur === 'function') {
      trigger.blur();
    }
    await wait(15);
  }

  async function commitAutocomplete(element) {
    await wait(10);
    element.dispatchEvent(new Event('change', { bubbles: true }));
    if (element.isConnected && typeof element.blur === 'function') element.blur();
    await wait(10);
    clickOutsideControl(element);
    await wait(10);
  }

  function fillSelect(element, value) {
    const option = [...element.options]
      .map((item) => ({ item, score: choiceMatchScore(`${item.text} ${item.value}`.trim(), value) }))
      .filter(({ score }) => score >= 60)
      .sort((left, right) => right.score - left.score)[0]?.item;
    if (!option) return false;
    element.value = option.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function fillChoice(element, value) {
    const candidates = normalizedChoices(value).map((item) => item.toLowerCase());
    const text = labelText(element);
    const ownValue = `${element.value || ''} ${element.closest('label')?.innerText || ''}`.toLowerCase();
    if (!candidates.some((candidate) => ownValue === candidate || ownValue.includes(candidate))) return false;
    if (!element.checked) element.click();
    return true;
  }

  function customSelectTrigger(element) {
    if (element instanceof HTMLSelectElement) return null;
    const roleTrigger = element.closest('[role="combobox"]');
    if (roleTrigger) return roleTrigger;
    const candidates = [];
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 5; depth += 1, ancestor = ancestor.parentElement) {
      const semantics = `${ancestor.getAttribute('aria-haspopup') || ''} ${ancestor.getAttribute('role') || ''} ${ancestor.className || ''}`;
      if (/listbox|combobox|select|dropdown|picker/i.test(semantics) && controlNodes(ancestor).length <= 2) candidates.push(ancestor);
    }
    if (candidates.length) return candidates[candidates.length - 1];
    if (element.getAttribute('aria-haspopup') === 'listbox' || element.readOnly && /请选择|select|年|月|日/i.test(element.placeholder || '')) return element;
    return null;
  }

  function fillResultTarget(element) {
    if (!(element instanceof Element)) return element;
    return element.closest('.phoenix-select') || customSelectTrigger(element) || element;
  }

  function markFillResult(element, className) {
    const target = fillResultTarget(element);
    if (target instanceof Element) target.classList.add(className);
    return target;
  }

  const OPTION_SELECTORS = [
    '[role="option"]', '[aria-selected]', '[role="listbox"] li', '[role="menu"] li',
    '[class*="option"]', '[class*="Option"]', '[class*="dropdown"] li', '[class*="Dropdown"] li',
    '[class*="menu"] li', '[class*="Menu"] li', '[class*="item"]', '[class*="Item"]',
    '[class*="Select-common-item"]', '[class*="select-common-item"]',
    '[class*="list-item-container"]', '[class*="item-text-label"]',
    '[class*="area-item-container"]', '[class*="area-text-label"]',
    '[class*="Tag-container"]', '[class*="Tag-text"]',
    '[class*="Select-pointer"]', '[class*="select-pointer"]', '[role="gridcell"]', '[role="treeitem"]'
  ];

  const OVERLAY_SELECTOR = [
    '[role="listbox"]', '[role="dialog"]', '[role="menu"]', '[role="tree"]', '[role="grid"]',
    '[aria-modal="true"]', '[class*="dropdown"]', '[class*="Dropdown"]', '[class*="popup"]',
    '[class*="Popup"]', '[class*="popover"]', '[class*="Popover"]', '[class*="calendar"]',
    '[class*="Calendar"]', '[class*="picker"]', '[class*="Picker"]', '[class*="cascad"]',
    '[class*="Cascad"]', '[class*="overlay"]', '[class*="Overlay"]',
    '[class*="common-unmodeled-layer"]', '[class*="phoenix-date-picker"]',
    '[class*="main-selector-container"]', '[class*="area-selector-container"]'
  ].join(',');

  function beginDynamicInteraction(trigger) {
    // 只记录可能成为弹层/候选的节点。对 body * 逐个调用 getComputedStyle/rect 会强制大型表单
    // 反复布局，是复杂控件多时出现分钟级耗时的主要原因之一。
    const snapshotSelector = `${OVERLAY_SELECTOR},${OPTION_SELECTORS.join(',')},button,li,[tabindex],[data-value],[data-key]`;
    const beforeVisible = new WeakSet([...document.querySelectorAll(snapshotSelector)].filter(visible));
    const changed = new Set();
    const added = new Set();
    const roots = new Set();
    let revision = 0;
    const remember = (node) => {
      if (!(node instanceof Element) || node === trigger) return;
      changed.add(node);
      revision += 1;
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) added.add(node);
          remember(node);
        });
        if (mutation.type === 'childList') remember(mutation.target);
        if (mutation.type === 'attributes') remember(mutation.target);
        if (mutation.removedNodes.length) revision += 1;
      }
    });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'aria-expanded', 'aria-selected', 'aria-checked']
    });
    return {
      trigger, beforeVisible, changed, added, roots, observer,
      get revision() { return revision; },
      stop() { observer.disconnect(); }
    };
  }

  function interactionRelated(session, node) {
    if (!(node instanceof Element) || !visible(node) || node.contains(session.trigger)) return false;
    if ([...session.roots].some((root) => root === node || root.contains(node))) return true;
    if (!session.beforeVisible.has(node)) return true;
    return [...session.changed].some((changed) => changed === node || changed.contains(node) || node.contains(changed));
  }

  function rememberInteractionRoot(session, node) {
    if (!(node instanceof Element)) return null;
    let root = node.closest(OVERLAY_SELECTOR);
    const dynamicInsideTrigger = root && session.trigger?.contains(root)
      && (!session.beforeVisible.has(root) || [...session.added].some((added) => added === root || added.contains(root)));
    if (!root || root.contains(session.trigger) || (session.trigger?.contains(root) && !dynamicInsideTrigger)) {
      const containingChanges = [...session.changed].filter((changed) => changed === node || changed.contains(node));
      root = containingChanges.find((candidate) => candidate.parentElement === document.body)
        || containingChanges.find((candidate) => candidate !== node)
        || containingChanges[0]
        || node;
    }
    if (root !== document.body && root !== document.documentElement && !root.contains(session.trigger)
      && (!session.trigger?.contains(root) || dynamicInsideTrigger)) session.roots.add(root);
    return root;
  }

  function discoverInteractionRoots(session) {
    for (const node of session.added) {
      if (!(node instanceof Element) || !node.isConnected || !visible(node) || node.contains(session.trigger)) continue;
      if (node.matches(OVERLAY_SELECTOR)) session.roots.add(node);
      for (const semantic of node.querySelectorAll(OVERLAY_SELECTOR)) {
        if (visible(semantic) && !semantic.contains(session.trigger)) session.roots.add(semantic);
      }
    }
    for (const node of session.changed) {
      if (!(node instanceof Element) || !visible(node)
        || session.trigger?.contains(node) || node.contains(session.trigger)) continue;
      if (node.matches(OVERLAY_SELECTOR)) session.roots.add(node);
      else if (node !== document.body && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (style.position === 'fixed' || style.position === 'absolute') session.roots.add(node);
      }
    }
    return [...session.roots].filter((root) => root.isConnected && visible(root));
  }

  function interactionOptions(session, value) {
    const roots = discoverInteractionRoots(session);
    const rootNodes = roots.flatMap((root) => [
      ...root.querySelectorAll(`${OPTION_SELECTORS.join(',')},button,li,[tabindex],[data-value],[data-key],*`)
    ]);
    // 已定位弹层时只扫描弹层内部。全页扫描会在大型招聘表单上重复遍历数千节点。
    const fallbackRoots = roots.length ? roots : [...session.added, ...session.changed]
      // 内嵌式下拉经常让“触发器 + 候选面板”共享同一个动态祖先。
      // 祖先包含 trigger 并不代表它不能承载本次新增的候选项。
      .filter((node) => node instanceof Element && node !== session.trigger && node.isConnected && visible(node))
      .slice(-12);
    const semantic = roots.length ? [] : fallbackRoots.flatMap((root) => [
      ...(root.matches?.(`${OPTION_SELECTORS.join(',')},button,li,[tabindex],[data-value],[data-key]`) ? [root] : []),
      ...root.querySelectorAll(`${OPTION_SELECTORS.join(',')},button,li,[tabindex],[data-value],[data-key]`)
    ]);
    const exactText = fallbackRoots.flatMap((root) => [root, ...root.querySelectorAll('*')]).filter((node) => {
      const text = cleanText(node.innerText || node.textContent);
      return text && text.length <= 100 && choiceMatches(text, value);
    });
    const candidates = [...new Set([...rootNodes, ...semantic, ...exactText])]
      .map(optionTextNode)
      .filter((node) => node && (roots.some((root) => root.contains(node)) || interactionRelated(session, node)))
      .filter((node) => choiceMatches(node.innerText || node.textContent, value))
      .filter((node) => !/menu.?header|group.?keyword|group.?title/i.test(String(node.className || '')))
      .filter((node) => !node.disabled && node.getAttribute('aria-disabled') !== 'true');
    const leaves = candidates.filter((candidate) => !candidates.some((other) => {
      return other !== candidate && candidate.contains(other) && cleanText(candidate.textContent) === cleanText(other.textContent);
    }));
    const optionObjects = [...new Set(leaves.map((node) => clickableAutocompleteTarget(node, session.trigger, session) || node))]
      .filter((node) => !/menu.?header|group.?keyword|group.?title/i.test(String(node.className || '')));
    for (const option of optionObjects) rememberInteractionRoot(session, option);
    return optionObjects.sort((left, right) =>
      choiceMatchScore(right.innerText || right.textContent, value) - choiceMatchScore(left.innerText || left.textContent, value)
    );
  }

  async function waitForInteractionOption(session, value, timeout = 650) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const option = interactionOptions(session, value)[0];
      if (option) return option;
      discoverInteractionRoots(session);
      await wait(30);
    }
    return null;
  }

  async function waitForInteractionChange(session, previousRevision, timeout = 700) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (session.revision !== previousRevision) return true;
      await wait(40);
    }
    return false;
  }

  async function waitForCandidateOutcome(session, option, element, expectedValue, timeout = 180) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (selectionSatisfied(session.trigger, element, expectedValue)
        || candidateSelected(option)
        || !option.isConnected
        || !visible(option)) return true;
      await wait(25);
    }
    return selectionSatisfied(session.trigger, element, expectedValue)
      || candidateSelected(option)
      || !option.isConnected
      || !visible(option);
  }

  function candidateSelected(node) {
    let current = node;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      if (current.getAttribute('aria-selected') === 'true' || current.getAttribute('aria-checked') === 'true') return true;
      if (/selected|checked|active|chosen/i.test(String(current.className || ''))) return true;
      if (current.querySelector?.('[class*="RadioChecked"]:not([class*="RadioUnchecked"]),[class*="radio-checked"]')) return true;
    }
    return false;
  }

  async function activateInteractionCandidate(session, option, element, expectedValue) {
    const targets = [...new Set([
      option,
      option.querySelector('[class*="Menu-content-item"],[class*="menu-content-item"],[class*="Menu-content"],[class*="menu-content"]'),
      [...option.querySelectorAll('[class*="option-label"],[class*="Option-label"],[class*="optionLabel"],[class*="OptionLabel"]')]
        .find((node) => choiceMatches(node.textContent, expectedValue))
    ].filter(Boolean))];
    for (const target of targets) {
      activateOption(target);
      if (await waitForCandidateOutcome(session, option, element, expectedValue)) return true;
    }
    const trusted = await trustedClick(option);
    if (trusted?.ok) {
      if (await waitForCandidateOutcome(session, option, element, expectedValue, 450)) return true;
    }
    if (!trusted?.ok && trusted?.error) fillFailureReasons.set(element, `浏览器级点击失败：${trusted.error}`);
    return false;
  }

  function openInteractionRoots(session) {
    return discoverInteractionRoots(session).filter((root) => root.isConnected && visible(root));
  }

  function confirmationButton(session) {
    const roots = openInteractionRoots(session);
    for (const root of roots) {
      const button = panelAction(root, /^(?:确定|确认|完成|应用|选择|保存|ok|confirm|done|apply)$/i);
      if (button) return button;
    }
    return null;
  }

  function panelAction(panel, pattern) {
    if (!(panel instanceof Element)) return null;
    const candidates = [...panel.querySelectorAll('button,[role="button"],a,[tabindex],[class*="button__content"],[class*="button-content"]')]
      .filter(visible)
      .filter((node) => pattern.test(cleanText(node.textContent)));
    const leaf = candidates.find((node) => ![...node.children].some((child) => pattern.test(cleanText(child.textContent))))
      || candidates[0];
    if (!leaf) return null;
    const clickable = leaf.closest('button,[role="button"],a,[tabindex],[class*="button__wraper"],[class*="button-wrapper"],[class~="phoenix-button"]');
    return clickable && panel.contains(clickable) ? clickable : leaf;
  }

  function explicitConfirmationPanel(session) {
    const roots = discoverInteractionRoots(session);
    const candidates = [...new Set(roots.flatMap((root) => {
      const parent = root.closest('[role="dialog"],[aria-modal="true"],[class*="main-selector-container"],[class*="area-selector-container"],[class*="common-unmodeled-layer__layerContent"]');
      return [root, parent].filter(Boolean);
    }))];
    return candidates.find((panel) => {
      if (!panel.isConnected || !visible(panel) || panel.contains(session.trigger)) return false;
      const search = panel.querySelector('input[type="search"],input[placeholder*="搜索" i],input[placeholder*="search" i],[class*="search"] input');
      const rows = panel.querySelector('[role="option"],[role="radio"],[class*="list-item-container"],[class*="item-text-label"],[class*="area-item-container"],[class*="area-text-label"]');
      const confirm = panelAction(panel, /^(?:确定|确认|完成|应用|选择|ok|confirm|done|apply)$/i);
      return Boolean(search && rows && confirm);
    }) || null;
  }

  async function waitForExplicitConfirmationPanel(session, timeout = 260) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const panel = explicitConfirmationPanel(session);
      if (panel) return panel;
      await wait(30);
    }
    return explicitConfirmationPanel(session);
  }

  function explicitPanelRows(panel, value) {
    const nodes = [...panel.querySelectorAll('[role="option"],[role="radio"],[class*="list-item-container"],[class*="item-text-label"],[class*="area-item-container"],[class*="area-text-label"]')]
      .filter(visible)
      .filter((node) => !node.closest('[class*="resize-triggers"],[class*="expand-trigger"],[class*="contract-trigger"]'))
      .filter((node) => choiceMatches(node.innerText || node.textContent, value));
    const rows = [...new Set(nodes.map((node) => {
      return node.closest('[role="option"],[role="radio"],[class*="list-item-container"],[class*="area-item-container"]') || node;
    }))].filter((node) => panel.contains(node));
    return rows.sort((left, right) =>
      choiceMatchScore(right.innerText || right.textContent, value) - choiceMatchScore(left.innerText || left.textContent, value)
    );
  }

  function explicitPanelSelectedCount(panel) {
    const text = cleanText(panel.querySelector('[class*="select-data-num"],[class*="selected-count"],[class*="selection-count"]')?.textContent);
    const match = text.match(/(\d+)\s*\/\s*(\d+)/) || text.match(/(?:已选|selected)\D*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function currentExplicitPanelRow(panel, value, fallback = null) {
    return explicitPanelRows(panel, value)[0]
      || (fallback?.isConnected && panel.contains(fallback) ? fallback : null);
  }

  function explicitPanelRadio(row) {
    return row?.querySelector('svg[class*="RadioChecked"],svg[class*="RadioUnchecked"],[class*="radio-checked"],[class*="radio-unchecked"],[role="radio"],input[type="radio"]') || null;
  }

  function explicitPanelRadioChecked(row) {
    if (!row) return false;
    return Boolean(row.querySelector('svg[class*="RadioChecked"]:not([class*="RadioUnchecked"]),[class*="radio-checked"]:not([class*="radio-unchecked"]),[role="radio"][aria-checked="true"],input[type="radio"]:checked'));
  }

  function explicitPanelSelected(panel, row, value, countBefore = null) {
    const liveRow = currentExplicitPanelRow(panel, value, row);
    const radio = explicitPanelRadio(liveRow);
    // 面板明确提供 RadioUnchecked/RadioChecked 时，只认真实勾选图标。
    // 搜索文字、右侧摘要或已选计数都不能替代这一状态。
    if (radio) return explicitPanelRadioChecked(liveRow);
    if (candidateSelected(liveRow)) return true;
    const selectedSummary = panel.querySelector('[class*="select-data-container"],[class*="selected-data-container"],[class*="selection-summary"]');
    if (selectedSummary && choiceMatches(selectedSummary.innerText || selectedSummary.textContent, value)) return true;
    const currentCount = explicitPanelSelectedCount(panel);
    return countBefore !== null && currentCount !== null && currentCount > countBefore;
  }

  async function waitForExplicitPanelSelection(panel, row, value, countBefore, timeout = 360) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (!panel.isConnected) return false;
      if (explicitPanelSelected(panel, row, value, countBefore)) return true;
      await wait(35);
    }
    return explicitPanelSelected(panel, row, value, countBefore);
  }

  async function chooseExplicitPanelRow(session, panel, row, element, value) {
    rememberInteractionRoot(session, row);
    const countBefore = explicitPanelSelectedCount(panel);
    const clickTargets = () => {
      const liveRow = currentExplicitPanelRow(panel, value, row);
      if (!liveRow) return [];
      const text = [...liveRow.querySelectorAll('[class*="item-text-label"],[class*="area-text-label"],label,span,div')]
        .find((node) => normalizedChoices(value).map(normalizedExactText).includes(normalizedExactText(node.textContent)));
      const radio = explicitPanelRadio(liveRow);
      const radioContainer = radio?.closest('[class*="icon-container"],[class*="radio"],[role="radio"],label');
      return [...new Set([radio, radioContainer, liveRow, text].filter(Boolean))];
    };
    for (const target of clickTargets()) {
      activateOption(target);
      if (await waitForExplicitPanelSelection(panel, row, value, countBefore)) return true;
    }
    // 合成事件无效时，依次对当前的圆圈、圆圈容器、整行和文字执行浏览器级点击。
    for (const target of clickTargets()) {
      const trusted = await trustedClick(target);
      if (trusted?.ok && await waitForExplicitPanelSelection(panel, row, value, countBefore, 800)) return true;
      if (!trusted?.ok && trusted?.error) fillFailureReasons.set(element, `浏览器级点击失败：${trusted.error}`);
    }
    return false;
  }

  async function fillExplicitConfirmationSelect(session, panel, element, trigger, value, searchValue = value) {
    // 搜索确认式选择器统一先搜索。虚拟列表只渲染视口附近的行，直接扫描初始 DOM
    // 会把“目标尚未渲染”误判为“没有该选项”。
    const search = panel.querySelector('input[type="search"],input[placeholder*="搜索" i],input[placeholder*="search" i],[class*="search"] input');
    if (search instanceof HTMLInputElement || search instanceof HTMLTextAreaElement) {
      setFocusedInputValue(search, String(searchValue));
      search.dispatchEvent(new Event('change', { bubbles: true }));
    }
    let row = null;
    const started = Date.now();
    while (!row && Date.now() - started < INTERACTION_TIMEOUT) {
      row = explicitPanelRows(panel, value)[0] || null;
      if (!row) await wait(55);
    }
    // 少数组件没有可写搜索框；仅在这种情况下回退到当前已渲染列表。
    if (!row && !(search instanceof HTMLInputElement || search instanceof HTMLTextAreaElement)) {
      row = explicitPanelRows(panel, value)[0] || null;
    }
    if (!row) {
      fillFailureReasons.set(element, `确认式选择弹层中没有找到“${value}”`);
      await settleDynamicInteraction(session, element, '确认式选择弹层', false);
      return false;
    }

    const selected = explicitPanelSelected(panel, row, value)
      || await chooseExplicitPanelRow(session, panel, row, element, value);
    if (!selected) {
      if (!fillFailureReasons.get(element)) fillFailureReasons.set(element, `找到了“${value}”候选行，但 RadioUnchecked 没有变成 RadioChecked`);
      await settleDynamicInteraction(session, element, '确认式选择弹层', false);
      return false;
    }

    const confirm = panelAction(panel, /^(?:确定|确认|完成|应用|选择|ok|confirm|done|apply)$/i);
    if (!confirm) {
      fillFailureReasons.set(element, '候选项已经选中，但没有找到确认按钮');
      await settleDynamicInteraction(session, element, '确认式选择弹层', false);
      return false;
    }
    activateOption(confirm);
    let closed = await waitForInteractionClosed(session, 280);
    if (!closed && confirm.isConnected && visible(confirm)) {
      const trusted = await trustedClick(confirm);
      if (!trusted?.ok && trusted?.error) fillFailureReasons.set(element, `确认按钮的浏览器级点击失败：${trusted.error}`);
      closed = await waitForInteractionClosed(session, 450);
    }
    if (!closed) {
      fillFailureReasons.set(element, '候选项已经选中，但点击确认后弹层仍未关闭');
      await settleDynamicInteraction(session, element, '确认式选择弹层', false);
      return false;
    }

    session.stop();
    await commitControl(element, trigger);
    const confirmed = selectionSatisfied(trigger, element, value);
    if (!confirmed) fillFailureReasons.set(element, '确认弹层已关闭，但字段回读值与目标值不一致');
    if (confirmed) trigger.classList.add(FILLED_CLASS);
    return confirmed;
  }

  async function waitForInteractionClosed(session, timeout = INTERACTION_CLOSE_TIMEOUT) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (!openInteractionRoots(session).length) return true;
      await wait(60);
    }
    return !openInteractionRoots(session).length;
  }

  async function settleDynamicInteraction(session, element, reasonLabel = '动态弹层', allowConfirm = true) {
    discoverInteractionRoots(session);
    let closed = !openInteractionRoots(session).length;
    // 一次性发出最可能关闭弹层的动作，再用一个短窗口观察结果；不再串行等待五轮。
    if (!closed && allowConfirm) activateOption(confirmationButton(session));
    if (!closed) {
      clickOutsideControl(session.trigger || element);
      if (element?.isConnected && typeof element.blur === 'function') element.blur();
      const target = document.activeElement || session.trigger || element || document.body;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
      closed = await waitForInteractionClosed(session, 260);
    }
    if (!closed) {
      const roots = openInteractionRoots(session).slice(0, 3).map((root) => {
        const className = String(root.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return `${root.tagName.toLowerCase()}${className ? `.${className}` : ''}`;
      }).join('、');
      const warning = `${reasonLabel}选择后仍未关闭${roots ? `（残留：${roots}）` : ''}`;
      interactionWarnings.push(warning);
    }
    session.stop();
    return closed;
  }

  function optionTextNode(node) {
    if (!node || /^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(node.tagName)) return null;
    const text = cleanText(node.innerText || node.textContent);
    if (!text || text.length > 100 || GENERIC_PLACEHOLDER.test(text)) return null;
    return node;
  }

  function visibleOptions(trigger, beforeVisible = new Set()) {
    const semantic = [...document.querySelectorAll(OPTION_SELECTORS.join(','))].filter((node) => !beforeVisible.has(node));
    const newlyVisible = [...document.querySelectorAll('li, button, [tabindex], [data-value], [data-key]')]
      .filter((node) => !beforeVisible.has(node));
    const candidates = [...new Set([...semantic, ...newlyVisible])]
      .map(optionTextNode)
      .filter((option) => option && visible(option) && !trigger?.contains(option) && !option.contains(trigger));
    return candidates.filter((candidate) => !candidates.some((other) => {
      return other !== candidate && candidate.contains(other) && cleanText(candidate.textContent) === cleanText(other.textContent);
    }));
  }

  function visibleInteractiveSnapshot() {
    return new Set([...document.querySelectorAll(OPTION_SELECTORS.join(','))].filter(visible));
  }

  const AUTOCOMPLETE_KEYS = new Set([
    'school', 'college', 'major', 'company', 'currentTitle', 'department',
    'projectName', 'certificateName'
  ]);
  const fillFailureReasons = new WeakMap();
  const fillFailureObserved = new WeakMap();

  function setFocusedInputValue(element, value) {
    element.focus();
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter ? setter.call(element, value) : (element.value = value);
    try {
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(value) }));
    } catch {
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function captureFillState(element, trigger = null) {
    fillFailureReasons.delete(element);
    fillFailureObserved.delete(element);
    return {
      value: 'value' in element ? String(element.value || '') : '',
      text: element.isContentEditable ? element.textContent || '' : '',
      checked: 'checked' in element ? Boolean(element.checked) : null,
      hadValue: hasValue(element),
      triggerText: cleanText(trigger?.textContent || '')
    };
  }

  async function rollbackFailedControl(element, trigger, snapshot) {
    if (!snapshot || !(element instanceof Element)) return false;
    const liveTrigger = trigger instanceof Element && trigger.isConnected ? trigger : fillResultTarget(element);
    if (!fillFailureObserved.has(element)) {
      fillFailureObserved.set(element, controlReadback(element, liveTrigger) || '操作后仍为空');
    }
    // If this run started from an empty custom selector, clear any candidate that the
    // component accepted before the final validation failed.
    if (!snapshot.hadValue && liveTrigger instanceof Element) {
      const clear = liveTrigger.querySelector([
        '[class*="clearIcon"]', '[class*="clear-icon"]', '[class*="ClearIcon"]',
        '[aria-label*="清除"]', '[aria-label*="clear" i]', '[title*="清除"]', '[title*="clear" i]'
      ].join(','));
      if (clear && visible(clear)) {
        activateOption(clear);
        await wait(80);
        if (hasValue(element)) await trustedClick(clear);
      }
    }
    if (element instanceof HTMLSelectElement) {
      element.value = snapshot.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (!element.disabled) setFocusedInputValue(element, snapshot.value);
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.blur();
    } else if (element.isContentEditable) {
      element.textContent = snapshot.text;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (snapshot.checked !== null && 'checked' in element && element.checked !== snapshot.checked) {
      element.checked = snapshot.checked;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await wait(40);
    return snapshot.hadValue ? String(element.value || '') === snapshot.value : !hasValue(element);
  }

  function normalizedExactText(value) {
    return cleanText(value).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  }

  function exactTextNodes(value, excluded = new Set()) {
    const target = normalizedExactText(value);
    if (!target) return [];
    return [...document.querySelectorAll('body *')]
      .filter((node) => !excluded.has(node) && visible(node) && !/^(INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE)$/.test(node.tagName))
      .filter((node) => normalizedExactText(node.innerText || node.textContent) === target)
      .filter((node) => ![...node.children].some((child) => visible(child) && normalizedExactText(child.innerText || child.textContent) === target));
  }

  function clickableAutocompleteTarget(textNode, element, session = null) {
    if (!textNode || element.contains(textNode) || textNode.contains(element)) return null;
    const explicit = textNode.closest('button,a,label,[role="option"],[role="menuitem"],[role="treeitem"],[role="radio"],[tabindex],[data-value],[data-key],[onclick],[class*="list-item-container"],[class*="Select-common-item"],[class*="select-common-item"],[class*="Select-pointer"],[class*="select-pointer"],[class*="Tag-container"]');
    if (explicit && !explicit.contains(element) && (!session || interactionRelated(session, explicit))) return explicit;
    if (session) {
      const root = [...session.roots].find((candidate) => candidate.isConnected && candidate.contains(textNode));
      if (root) {
        let row = textNode;
        for (let depth = 0; row.parentElement && row.parentElement !== root && depth < 6; depth += 1) {
          const parent = row.parentElement;
          const parentText = cleanText(parent.innerText || parent.textContent);
          if (parentText.length > 240) break;
          row = parent;
        }
        if (row !== root && !row.contains(element)) return row;
      }
    }
    // 无语义候选通常使用事件委托；点击候选文字节点会冒泡到候选对象。
    return textNode;
  }

  function autocompleteConfirmed(element, value, clicked) {
    if (normalizedExactText(element.value) !== normalizedExactText(value)) return false;
    if (!clicked?.isConnected || !visible(clicked)) return true;
    let node = clicked;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      if (node.getAttribute('aria-selected') === 'true' || node.getAttribute('aria-checked') === 'true') return true;
      if (/selected|checked|active|chosen|highlight/i.test(String(node.className || ''))) return true;
    }
    const expanded = element.getAttribute('aria-expanded')
      || element.closest('[aria-expanded]')?.getAttribute('aria-expanded');
    if (expanded === 'false') return true;
    return false;
  }

  async function fillAutocompleteText(element, value, key) {
    if (!AUTOCOMPLETE_KEYS.has(key) || !(element instanceof HTMLInputElement) || element.readOnly) return false;
    const session = beginDynamicInteraction(element);
    setFocusedInputValue(element, String(value));

    const matchedNode = await waitForInteractionOption(session, value);
    if (!matchedNode) {
      const dynamicEvidence = discoverInteractionRoots(session).length > 0
        || [...session.added, ...session.changed].some((node) => {
          if (!(node instanceof Element) || node === element || !node.isConnected || !visible(node)) return false;
          const text = interactiveDescription(node);
          return text && text.length <= 240 && !node.contains(element);
        });
      if (!dynamicEvidence) {
        // 学校、公司、专业等字段并不总是自动完成控件。页面完全没有产生候选层时，
        // 交回普通文本输入路径；只有确实出现候选但没有目标值时才判定失败。
        session.stop();
        return null;
      }
      fillFailureReasons.set(element, `动态候选弹层中没有找到与“${value}”匹配的候选对象`);
      await settleDynamicInteraction(session, element, '自动完成弹层');
      return false;
    }

    const option = clickableAutocompleteTarget(matchedNode, element, session);
    if (!option) {
      fillFailureReasons.set(element, `找到“${value}”，但未识别到可点击的候选节点`);
      await settleDynamicInteraction(session, element, '自动完成弹层');
      return false;
    }
    rememberInteractionRoot(session, option);
    const activated = await activateInteractionCandidate(session, option, element, value);
    if (!activated) {
      fillFailureReasons.set(element, `找到了“${value}”候选对象，但点击后页面没有发生变化`);
      await settleDynamicInteraction(session, element, '自动完成弹层');
      return false;
    }
    await commitAutocomplete(element);
    const closed = await settleDynamicInteraction(session, element, '自动完成弹层');
    const confirmed = closed && autocompleteConfirmed(element, value, option);
    if (!confirmed) fillFailureReasons.set(element, closed ? `已点击“${value}”，但字段没有确认选中状态` : interactionBlocked);
    return confirmed;
  }

  function selectedText(trigger, element) {
    return cleanText(`${element.value || ''} ${trigger?.textContent || ''}`);
  }

  function selectionSatisfied(trigger, element, value) {
    if (trigger instanceof Element) {
      const selected = trigger.querySelector('[aria-selected="true"],[aria-checked="true"],[class*="selected-value"],[class*="SelectedValue"],[class*="singleValue"],[class*="SingleValue"],[class*="display-value"],[class*="DisplayValue"],[class*="calcEle"],[class*="selected-item"],[class*="selection-item"]');
      const selectedShown = cleanText(selected?.textContent || '');
      if (selectedShown && choiceMatches(selectedShown, value)) return true;
      if (!customTriggerHasSelection(trigger)) return false;
      const triggerShown = cleanText(trigger.textContent || '');
      return Boolean(triggerShown && choiceMatches(triggerShown, value));
    }
    const shown = selectedText(trigger, element);
    return Boolean(shown && choiceMatches(shown, value));
  }

  const CASCADE_LOCATION_KEYS = new Set(['nativePlace', 'studentOrigin', 'householdRegistration', 'currentResidence', 'city', 'desiredCity']);

  function locationChoicePath(value) {
    const source = cleanText(value);
    const separated = source.split(/[\s,，/／>]+/).map((part) => part.trim()).filter(Boolean);
    if (separated.length > 1) return separated;
    const raw = source.replace(/[\s,，/／>]+/g, '');
    if (!raw) return [];
    const pieces = raw.match(/.+?(?:特别行政区|自治区|省|市|自治州|地区|盟|区|县|旗)(?=.+|$)/g) || [];
    const consumed = pieces.join('');
    const remainder = raw.startsWith(consumed) ? raw.slice(consumed.length) : '';
    if (remainder) pieces.push(remainder);
    return pieces.length > 1 ? pieces : [raw];
  }

  function selectTargets(key, value, preferLeaf = false) {
    if (CASCADE_LOCATION_KEYS.has(key)) {
      const path = locationChoicePath(value);
      return preferLeaf && path.length ? [path.at(-1)] : path;
    }
    return [String(value)];
  }

  function explicitSelectorSearchValue(key, target) {
    if (!CASCADE_LOCATION_KEYS.has(key)) {
      return String(target);
    }
    // 地区搜索框使用叶子行政区关键词过滤；候选匹配仍使用带行政区后缀的完整叶子名称。
    return String(target).replace(/(?:特别行政区|自治州|地区|盟|市|区|县|旗)$/u, '') || String(target);
  }

  function interactionOptionPreview(session) {
    const roots = discoverInteractionRoots(session);
    const texts = roots.flatMap((root) => [...root.querySelectorAll(OPTION_SELECTORS.join(','))])
      .filter(visible)
      .map((node) => cleanText(node.innerText || node.textContent))
      .filter((text) => text && text.length <= 50 && !GENERIC_PLACEHOLDER.test(text));
    return [...new Set(texts)].slice(0, 8);
  }

  async function findBestCustomSelectOption(session, element, target) {
    const editable = !element.readOnly && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement);
    if (!editable) return { option: await waitForInteractionOption(session, target), preview: interactionOptionPreview(session) };
    const queries = [...new Set([String(target), ...normalizedChoices(target)])]
      .filter((query) => query && query.length <= 80)
      .slice(0, 5);
    // Phase 1: use the component's own search/filter behavior. Alias queries let
    // “硕士” find “硕士研究生”, and long study-mode names fall back to “全日制”.
    for (const query of queries) {
      setFocusedInputValue(element, query);
      const option = await waitForInteractionOption(session, target, 380);
      if (option) return { option, preview: interactionOptionPreview(session), query };
    }
    // Phase 2: clear the search so the full currently rendered option list becomes
    // visible, then rank every candidate by guarded similarity instead of guessing.
    setFocusedInputValue(element, '');
    await wait(100);
    const option = await waitForInteractionOption(session, target, 520);
    return { option, preview: interactionOptionPreview(session), query: '' };
  }

  async function fillCustomSelect(element, value, key = '') {
    const trigger = customSelectTrigger(element);
    if (!trigger) return false;
    const snapshot = captureFillState(element, trigger);
    const session = beginDynamicInteraction(trigger);
    activateOption(trigger);
    // 可编辑地区控件先直接搜索最末级区/县；只读级联控件则保留
    // 完整路径，依次点击省 → 市 → 区/县。
    const editableLocation = CASCADE_LOCATION_KEYS.has(key)
      && !element.readOnly && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement);
    const fullLocationTargets = selectTargets(key, value, false);
    let targets = selectTargets(key, value, editableLocation);
    let locationFallbackUsed = false;
    const explicitPanel = await waitForExplicitConfirmationPanel(session);
    if (explicitPanel) {
      const target = targets.at(-1) || String(value);
      let confirmed = await fillExplicitConfirmationSelect(
        session, explicitPanel, element, trigger, target, explicitSelectorSearchValue(key, target)
      );
      if (!confirmed && controlValueSatisfied(element, trigger, target, key)) {
        confirmed = true;
        fillFailureReasons.delete(element);
      }
      if (!confirmed) await rollbackFailedControl(element, trigger, snapshot);
      return confirmed;
    }
    let selectedAny = false;
    for (let level = 0; level < targets.length; level += 1) {
      const target = targets[level];
      const match = await findBestCustomSelectOption(session, element, target);
      const option = match.option;
      if (!option) {
        if (editableLocation && !locationFallbackUsed && fullLocationTargets.length > 1) {
          // 输入区/县后没有可确认候选，说明该组件虽然有 input，但不支持
          // 跨级搜索。不直接判失败，清空搜索后改用省 → 市 → 区/县。
          locationFallbackUsed = true;
          targets = fullLocationTargets;
          setFocusedInputValue(element, '');
          activateOption(trigger);
          await wait(100);
          level = -1;
          continue;
        }
        const preview = match.preview.length ? `；当前候选：${match.preview.join(' / ')}` : '';
        const locationStrategy = editableLocation
          ? (locationFallbackUsed ? '；已尝试直接搜索区/县并回退到省→市→区/县逐级选择' : '；已尝试直接搜索最末级区/县')
          : '';
        fillFailureReasons.set(element, `搜索别名并检查下拉候选后仍没有找到安全匹配项${locationStrategy}${preview}`);
        await settleDynamicInteraction(session, element, '下拉弹层');
        await rollbackFailedControl(element, trigger, snapshot);
        return false;
      }
      let activated = await activateInteractionCandidate(session, option, element, target);
      if (!activated && controlValueSatisfied(element, trigger, target, key)) {
        activated = true;
        fillFailureReasons.delete(element);
      }
      if (!activated) {
        if (editableLocation && !locationFallbackUsed && fullLocationTargets.length > 1) {
          locationFallbackUsed = true;
          targets = fullLocationTargets;
          setFocusedInputValue(element, '');
          activateOption(trigger);
          await wait(100);
          level = -1;
          continue;
        }
        if (!fillFailureReasons.get(element)) {
          fillFailureReasons.set(element, `找到了“${target}”候选行，DOM 点击和浏览器级点击后字段仍未回读到该值`);
        }
        await settleDynamicInteraction(session, element, '下拉弹层');
        await rollbackFailedControl(element, trigger, snapshot);
        return false;
      }
      selectedAny = true;
    }
    await commitControl(element, trigger);
    const closed = await settleDynamicInteraction(session, element, '下拉弹层');
    const confirmed = selectedAny && closed
      && (selectionSatisfied(trigger, element, value) || selectionSatisfied(trigger, element, targets.at(-1))
        || controlValueSatisfied(element, trigger, value, key));
    if (!confirmed) {
      const locationStrategy = editableLocation
        ? (locationFallbackUsed ? '（已尝试区/县直接搜索和省→市→区/县逐级选择）' : '（已尝试区/县直接搜索）')
        : '';
      fillFailureReasons.set(element, closed ? `候选项已点击，但字段回读值与目标值不一致${locationStrategy}` : interactionBlocked);
    }
    if (confirmed) trigger.classList.add(FILLED_CLASS);
    if (!confirmed) await rollbackFailedControl(element, trigger, snapshot);
    return confirmed;
  }

  async function fillCustomDate(element, value) {
    const trigger = customSelectTrigger(element);
    if (!trigger) return false;
    const session = beginDynamicInteraction(trigger);
    try {
    const structuralDatePanel = () => {
      const candidates = new Set([
        ...discoverInteractionRoots(session),
        ...document.querySelectorAll('[role="dialog"],[role="grid"],[aria-modal="true"]')
      ]);
      const dynamicSeeds = [...session.added, ...session.changed].slice(-30);
      for (const seed of dynamicSeeds) {
        let node = seed instanceof Element ? seed : seed?.parentElement;
        for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
          if (node !== document.body && node !== document.documentElement) candidates.add(node);
        }
      }
      return [...candidates]
        .filter((root) => root instanceof Element && visible(root))
        .map((root) => {
          const nodes = [root, ...root.querySelectorAll('button,[role="button"],[role="gridcell"],[role="option"],[tabindex],td,li,div,span')]
            .filter(visible)
            .map((node) => cleanText(`${node.getAttribute('aria-label') || ''} ${node.textContent}`))
            .filter((text) => text && text.length <= 24);
          const description = `${root.getAttribute('aria-label') || ''} ${root.getAttribute('role') || ''} ${root.className || ''}`;
          const years = nodes.filter((text) => /(?:19|20)\d{2}(?:年)?/.test(text)).length;
          const months = nodes.filter((text) => /^(?:0?[1-9]|1[0-2]|一|二|三|四|五|六|七|八|九|十|十一|十二)月?$/.test(text)).length;
          const days = nodes.filter((text) => /^(?:[1-9]|[12]\d|3[01])(?:日|号)?$/.test(text)).length;
          const score = (/calendar|date|日期|日历|年月/i.test(description) ? 5 : 0)
            + (years ? 3 : 0) + (months >= 3 ? 3 : 0) + (days >= 7 ? 4 : 0);
          const rect = root.getBoundingClientRect();
          return { root, score, area: rect.width * rect.height };
        })
        .filter((item) => item.score >= 6)
        .sort((left, right) => right.score - left.score || left.area - right.area)[0]?.root || null;
    };
    const dateOverlay = () => {
      const roots = discoverInteractionRoots(session);
      return roots.find((root) => root.matches?.('[class*="basic-selector-year"],[class*="phoenix-calendar"]')
        || root.querySelector('[class*="basic-selector-year"],[class*="phoenix-calendar"]'))
        || [...document.querySelectorAll('[class*="Dropdown-dropdown"],[class*="dropdown-dropdown"],.common-unmodeled-layer,.phoenix-date-picker,.phoenix-date-picker__wrap,.phoenix-calendar')]
          .find((root) => visible(root) && (root.matches?.('[class*="basic-selector-year"],[class*="phoenix-calendar"]')
            || root.querySelector('[class*="basic-selector-year"],[class*="phoenix-calendar"]')
            || /calendar|date|panal/i.test(String(root.className || ''))))
        || structuralDatePanel();
    };
    const waitForDateOverlay = async (timeout = 260) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const panel = dateOverlay();
        if (panel) return panel;
        await wait(30);
      }
      return dateOverlay() || null;
    };
    const label = element.closest('label,[class*="picker-input"],[class*="Picker-input"]');
    const icon = label?.querySelector('[class*="calendar"],[class*="Calendar"],[class*="picker-addon"],[class*="Picker-addon"]');
    const openTargets = [...new Set([element, label, icon, trigger].filter(Boolean))];
    let openedPanel = null;
    for (const target of openTargets) {
      activateOption(target);
      openedPanel = await waitForDateOverlay(260);
      if (openedPanel) break;
    }
    if (!openedPanel) {
      for (const target of openTargets) {
        const trusted = await trustedClick(target);
        if (trusted?.ok) openedPanel = await waitForDateOverlay(400);
        if (openedPanel) break;
      }
    }
    if (!openedPanel) {
      fillFailureReasons.set(element, '已点击日期输入框、日期标签和日历图标，但没有出现日期弹层');
      session.stop();
      return false;
    }
    rememberInteractionRoot(session, openedPanel);
    const match = String(value).match(/((?:19|20)\d{2})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?/);
    if (!match) {
      fillFailureReasons.set(element, `资料日期“${value}”无法解析为年月日`);
      return false;
    }
    // 完整日期不能走普通“精确文本候选”捷径。日历网格、顶部输入或其他隐藏节点
    // 可能恰好出现目标文本，但那不等于控件已经完成年/月/日选择。
    async function waitUntil(test, timeout = 700) {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const result = test();
        if (result) return result;
        await wait(35);
      }
      return test() || null;
    }
    async function fastComponentClick(target, changed) {
      if (!target) return false;
      activateOption(target);
      if (await waitUntil(changed, 90)) return true;
      const trusted = await trustedClick(target);
      return Boolean(trusted?.ok && await waitUntil(changed, 320));
    }
    const currentPhoenixDatePanel = () => {
      const roots = discoverInteractionRoots(session);
      const root = roots.find((candidate) => candidate.matches?.('.phoenix-calendar-date-panel,.phoenix-calendar,.phoenix-date-picker__wrap,.phoenix-date-picker')
        && candidate.querySelector('.phoenix-calendar-table'))
        || roots.find((candidate) => candidate.querySelector('.phoenix-calendar-date-panel .phoenix-calendar-table'))
        || [...document.querySelectorAll('.phoenix-date-picker,.phoenix-date-picker__wrap,.phoenix-calendar,.phoenix-calendar-date-panel')]
          .find((candidate) => visible(candidate) && candidate.querySelector('.phoenix-calendar-table'));
      if (!root) return null;
      const calendar = root.matches?.('.phoenix-calendar')
        ? root
        : root.closest?.('.phoenix-calendar') || root.querySelector?.('.phoenix-calendar');
      return calendar && visible(calendar) ? calendar : root;
    };
    const phoenixDatePanel = await waitUntil(currentPhoenixDatePanel, 500);
    if (phoenixDatePanel) {
      rememberInteractionRoot(session, phoenixDatePanel);
      const targetYear = Number(match[1]);
      const targetMonth = Number(match[2]);
      const targetDay = match[3] ? Number(match[3]) : null;
      const yearNumber = () => Number(cleanText(currentPhoenixDatePanel()?.querySelector('.phoenix-calendar-year-select')?.textContent)
        .match(/(?:19|20)\d{2}/)?.[0]);
      const monthNumber = () => Number(cleanText(currentPhoenixDatePanel()?.querySelector('.phoenix-calendar-month-select')?.textContent)
        .match(/\d{1,2}/)?.[0]);
      if (!yearNumber() || !monthNumber()) {
        fillFailureReasons.set(element, '已打开完整日期面板，但无法读取当前年份或月份标题');
        return false;
      }
      async function clickLivePhoenix(selector, changed) {
        let target = currentPhoenixDatePanel()?.querySelector(selector);
        if (!target) return false;
        activateOption(target);
        if (await waitUntil(changed, 90)) return true;
        // 普通事件之后组件可能替换箭头节点，浏览器级点击前必须重新定位当前节点。
        target = currentPhoenixDatePanel()?.querySelector(selector);
        if (!target) return Boolean(await waitUntil(changed, 60));
        const trusted = await trustedClick(target);
        return Boolean(trusted?.ok && await waitUntil(changed, 320));
      }

      // 先只移动年份，避免用月份箭头跨年后又重新推导当前层级。
      for (let step = 0; step < 160 && yearNumber() && yearNumber() !== targetYear; step += 1) {
        const beforeYear = yearNumber();
        const selector = targetYear < beforeYear
          ? '.phoenix-calendar-prev-year-btn'
          : '.phoenix-calendar-next-year-btn';
        if (!await clickLivePhoenix(selector, () => yearNumber() && yearNumber() !== beforeYear)) {
          fillFailureReasons.set(element, `日期面板无法从 ${beforeYear} 年移动到 ${targetYear} 年`);
          return false;
        }
      }
      if (yearNumber() !== targetYear) {
        fillFailureReasons.set(element, `日期面板年份没有到达 ${targetYear} 年`);
        return false;
      }

      // 年份正确后再在该年内移动月份，最多十一格，不会跨出目标年份。
      for (let step = 0; step < 12 && monthNumber() && monthNumber() !== targetMonth; step += 1) {
        const beforeMonth = monthNumber();
        const selector = targetMonth < beforeMonth
          ? '.phoenix-calendar-prev-month-btn'
          : '.phoenix-calendar-next-month-btn';
        if (!await clickLivePhoenix(selector, () => monthNumber() && monthNumber() !== beforeMonth)) {
          fillFailureReasons.set(element, `日期面板无法从 ${beforeMonth} 月移动到 ${targetMonth} 月`);
          return false;
        }
      }
      if (yearNumber() !== targetYear || monthNumber() !== targetMonth) {
        fillFailureReasons.set(element, `日期面板没有到达 ${targetYear}-${String(targetMonth).padStart(2, '0')}`);
        return false;
      }

      if (!targetDay) {
        const confirmed = selectionSatisfied(trigger, element, value);
        if (confirmed) await commitControl(element, trigger);
        return confirmed;
      }
      const currentDayCell = () => {
        const livePanel = currentPhoenixDatePanel();
        const dayCells = [...(livePanel?.querySelectorAll('.phoenix-calendar-cell') || [])]
          .filter(visible)
          .filter((cell) => !/last-month|next-month|outside|disabled/i.test(String(cell.className || '')))
          .filter((cell) => cell.getAttribute('aria-disabled') !== 'true');
        return dayCells.find((cell) => {
          const date = cell.querySelector('.phoenix-calendar-date,[aria-selected]');
          return date && date.getAttribute('aria-disabled') !== 'true' && Number(cleanText(date.textContent)) === targetDay;
        }) || null;
      };
      const dayCell = currentDayCell();
      if (!dayCell) {
        fillFailureReasons.set(element, `已经到达目标年月，但当月没有找到 ${targetDay} 日`);
        return false;
      }
      const targetDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
      const normalizeFullDate = (raw) => {
        const parsed = String(raw || '').match(/((?:19|20)\d{2})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?/);
        if (!parsed || !parsed[3]) return '';
        return `${parsed[1]}-${String(Number(parsed[2])).padStart(2, '0')}-${String(Number(parsed[3])).padStart(2, '0')}`;
      };
      const dateAccepted = () => {
        const dateInput = currentPhoenixDatePanel()?.querySelector('.phoenix-calendar-input');
        const display = trigger.querySelector?.('[class*="display-value"],[class*="selected-value"],[class*="date-value"]');
        const readings = [
          element.value,
          display?.textContent,
          dateInput?.value
        ].map(normalizeFullDate).filter(Boolean);
        return readings.includes(targetDate);
      };
      let clicked = false;
      for (const kind of ['text', 'cell']) {
        let liveCell = currentDayCell();
        let target = kind === 'text' ? liveCell?.querySelector('.phoenix-calendar-date,[aria-selected]') : liveCell;
        if (!target) continue;
        activateOption(target);
        clicked = Boolean(await waitUntil(() => dateAccepted() || !currentPhoenixDatePanel(), 500));
        if (!clicked) {
          liveCell = currentDayCell();
          target = kind === 'text' ? liveCell?.querySelector('.phoenix-calendar-date,[aria-selected]') : liveCell;
          const trusted = target ? await trustedClick(target) : null;
          clicked = Boolean(trusted?.ok && await waitUntil(() => dateAccepted() || !currentPhoenixDatePanel(), 900));
        }
        if (clicked && dateAccepted()) break;
      }
      if (!clicked || !dateAccepted()) {
        fillFailureReasons.set(element, `已点击 ${targetDate}，但日期控件没有接受该值`);
        return false;
      }
      await commitControl(element, trigger);
      return true;
    }
    const phoenixPanel = await waitUntil(() => {
      const roots = discoverInteractionRoots(session);
      return roots.find((root) => root.querySelector('.phoenix-calendar-month-panel-year-select-content'))
        || [...document.querySelectorAll('.common-unmodeled-layer .phoenix-date-picker')]
          .find((root) => visible(root) && !session.beforeVisible.has(root)
            && root.querySelector('.phoenix-calendar-month-panel-year-select-content'));
    }, 500);
    if (phoenixPanel) {
      rememberInteractionRoot(session, phoenixPanel);
      const yearNumber = () => Number(cleanText(phoenixPanel.querySelector('.phoenix-calendar-month-panel-year-select-content')?.textContent)
        .match(/(?:19|20)\d{2}/)?.[0]);
      const previousYear = () => phoenixPanel.querySelector('.phoenix-calendar-month-panel-prev-year-btn');
      const nextYear = () => phoenixPanel.querySelector('.phoenix-calendar-month-panel-next-year-btn');
      for (let step = 0; step < 160 && yearNumber() && yearNumber() !== Number(match[1]); step += 1) {
        const beforeYear = yearNumber();
        const arrow = Number(match[1]) < beforeYear ? previousYear() : nextYear();
        if (!await fastComponentClick(arrow, () => yearNumber() && yearNumber() !== beforeYear)) return false;
      }
      if (yearNumber() !== Number(match[1])) return false;
      const monthText = `${Number(match[2])}月`;
      const month = [...phoenixPanel.querySelectorAll('.phoenix-calendar-month-panel-month')]
        .find((node) => cleanText(node.textContent) === monthText);
      const monthCell = month?.closest('[role="gridcell"]') || month;
      if (!monthCell) return false;
      const ok = await fastComponentClick(monthCell, () => {
        const shown = cleanText(`${element.value || ''} ${trigger.textContent || ''}`).replace(/[年月日号/.]/g, '-').replace(/\s+/g, '');
        return shown.includes(match[1]) && new RegExp(`(?:^|-)0?${Number(match[2])}(?:-|$)`).test(shown);
      });
      if (ok) await commitControl(element, trigger);
      return ok;
    }
    const sdPanel = await waitUntil(() => {
      const roots = discoverInteractionRoots(session);
      return roots.find((root) => root.querySelector('[class*="basic-selector-year"],[class*="basic-year-container"]'))
        || [...trigger.querySelectorAll('[class*="Dropdown-dropdown"],[class*="dropdown-dropdown"]')]
          .find((root) => visible(root) && root.querySelector('[class*="basic-selector-year"],[class*="basic-year-container"]'));
    }, 700);
    if (sdPanel) {
      rememberInteractionRoot(session, sdPanel);
      const yearText = () => cleanText(sdPanel.querySelector('[class*="basic-selector-year"]')?.textContent);
      const yearNumber = () => Number(yearText().match(/(?:19|20)\d{2}/)?.[0]);
      const left = () => sdPanel.querySelector('[class*="icondoubleLeft"]');
      const right = () => sdPanel.querySelector('[class*="icondoubleRight"]');
      for (let step = 0; step < 160 && yearNumber() && yearNumber() !== Number(match[1]); step += 1) {
        const beforeYear = yearNumber();
        const arrow = Number(match[1]) < beforeYear ? left() : right();
        if (!await fastComponentClick(arrow, () => yearNumber() && yearNumber() !== beforeYear)) return false;
      }
      if (yearNumber() !== Number(match[1])) return false;
      const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
      const currentMonthNumber = () => {
        const text = cleanText(sdPanel.querySelector('[class*="basic-selector-month"]')?.textContent);
        const numeric = text.match(/\d{1,2}/)?.[0];
        return numeric ? Number(numeric) : monthNames.indexOf(text) + 1;
      };
      // SD 的完整日期面板把年份和月份放在两个相邻标题中，下面直接显示日网格。
      // 这种结构不能走“点击十二个月列表”的分支，需要用单箭头移动月份后点击当月日期。
      if (match[3] && currentMonthNumber()) {
        for (let step = 0; step < 24 && (yearNumber() !== Number(match[1]) || currentMonthNumber() !== Number(match[2])); step += 1) {
          const before = `${yearNumber()}-${currentMonthNumber()}`;
          const currentIndex = yearNumber() * 12 + currentMonthNumber();
          const targetIndex = Number(match[1]) * 12 + Number(match[2]);
          const arrow = targetIndex < currentIndex
            ? sdPanel.querySelector('[class*="iconleft-"]')
            : sdPanel.querySelector('[class*="iconright-"]');
          if (!await fastComponentClick(arrow, () => `${yearNumber()}-${currentMonthNumber()}` !== before)) return false;
        }
        if (yearNumber() !== Number(match[1]) || currentMonthNumber() !== Number(match[2])) return false;
        const targetDay = Number(match[3]);
        const dayCell = [...sdPanel.querySelectorAll('[class*="basic-item-wrapper"]')]
          .filter(visible)
          .filter((cell) => !/fade|disabled|outside/i.test(String(cell.className || '')))
          .find((cell) => Number(cleanText(cell.querySelector('[class*="basic-date-item"]')?.textContent)) === targetDay);
        if (!dayCell) return false;
        const ok = await fastComponentClick(dayCell, () => !visible(sdPanel) || selectionSatisfied(trigger, element, value));
        if (ok) await commitControl(element, trigger);
        return ok && (selectionSatisfied(trigger, element, value) || !visible(sdPanel));
      }
      const monthName = monthNames[Number(match[2]) - 1];
      const monthText = [...sdPanel.querySelectorAll('[class*="basic-year-item"]')]
        .find((node) => cleanText(node.textContent) === monthName);
      const monthCell = monthText?.closest('[class*="basic-year-wrapper"]') || monthText;
      if (!monthCell) return false;
      if (!match[3]) {
        const ok = await fastComponentClick(monthCell, () => selectionSatisfied(trigger, element, value) || !visible(sdPanel));
        if (ok) await commitControl(element, trigger);
        return ok;
      }
      const previousMonthCell = monthCell;
      if (!await fastComponentClick(monthCell, () => !previousMonthCell.isConnected
        || !visible(previousMonthCell)
        || !sdPanel.querySelector('[class*="basic-year-container"]'))) return false;
      const dayValue = String(Number(match[3]));
      const dayText = await waitUntil(() => [...sdPanel.querySelectorAll('[class*="day"],[class*="date"],[class*="basic-item"],[class*="panal"] *')]
        .filter((node) => visible(node) && cleanText(node.textContent) === dayValue)
        .find((node) => ![...node.children].some((child) => visible(child) && cleanText(child.textContent) === dayValue)), 700);
      if (!dayText) return false;
      const dayCell = dayText.closest('[class*="wrapper"],[class*="item"],[role="gridcell"],button') || dayText;
      const ok = await fastComponentClick(dayCell, () => {
        const shown = cleanText(`${element.value || ''} ${trigger.textContent || ''}`).replace(/[年月日号/.]/g, '-').replace(/\s+/g, '');
        return shown.includes(match[1])
          && new RegExp(`(?:^|-)0?${Number(match[2])}(?:-|$)`).test(shown)
          && new RegExp(`(?:^|-)0?${dayValue}(?:-|$)`).test(shown);
      });
      if (ok) await commitControl(element, trigger);
      return ok;
    }
    const shortClickable = () => {
      const dateRoots = [...new Set([openedPanel, ...discoverInteractionRoots(session)].filter((root) => root instanceof Element && visible(root)))];
      const genericPanelNodes = dateRoots.flatMap((root) => [...root.querySelectorAll('*')])
        .filter((node) => {
          const text = cleanText(`${node.getAttribute('aria-label') || ''} ${node.textContent}`);
          if (!text || text.length > 16) return false;
          return interactionHint(node) || interactionHint(node.parentElement) || node.children.length === 0;
        });
      const candidates = [...new Set([
        ...document.querySelectorAll('[role="option"], [role="gridcell"], button, li, [tabindex], [class*="date"], [class*="Date"], [class*="calendar"], [class*="Calendar"], [class*="year"], [class*="Year"], [class*="month"], [class*="Month"], [class*="day"], [class*="Day"]'),
        ...genericPanelNodes
      ])]
        .filter((node) => interactionRelated(session, node) && cleanText(node.textContent).length <= 16)
        .filter((node) => !node.disabled && node.getAttribute('aria-disabled') !== 'true' && !/disabled|outside|other.?month/i.test(String(node.className || '')));
      const leaves = candidates.filter((candidate) => !candidates.some((other) => other !== candidate && candidate.contains(other) && cleanText(candidate.textContent) === cleanText(other.textContent)));
      leaves.forEach((candidate) => rememberInteractionRoot(session, candidate));
      return leaves;
    };
    const panelStarted = Date.now();
    while (Date.now() - panelStarted < INTERACTION_TIMEOUT && !shortClickable().length) await wait(60);
    async function clickDateToken(pattern) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const candidate = shortClickable().find((node) => pattern.test(cleanText(node.textContent)));
        if (!candidate) return false;
        activateOption(candidate);
        await wait(100);
        const next = shortClickable().find((node) => pattern.test(cleanText(node.textContent)));
        if (!next || next !== candidate) return true;
      }
      return true;
    }
    function yearHeader() {
      return shortClickable().find((node) => /^(?:19|20)\d{2}(?:年)?$/.test(cleanText(node.textContent)));
    }
    function yearNavigation(header, direction) {
      if (!header) return null;
      const roots = [header.parentElement, header.parentElement?.parentElement].filter(Boolean);
      for (const root of roots) {
        const candidates = [...root.querySelectorAll('button,[role="button"],[tabindex],[aria-label],[title],[class*="prev"],[class*="Prev"],[class*="next"],[class*="Next"],[class*="left"],[class*="Left"],[class*="right"],[class*="Right"]')]
          .filter((node) => node !== header && visible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true');
        const semantic = candidates.find((node) => {
          const description = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${node.className || ''} ${cleanText(node.textContent)}`;
          return direction < 0 ? /prev|previous|上一|向前|左/i.test(description) : /next|下一|向后|右/i.test(description);
        });
        if (semantic) return semantic;
        const headerCenter = header.getBoundingClientRect().left + header.getBoundingClientRect().width / 2;
        const sided = candidates.filter((node) => {
          const center = node.getBoundingClientRect().left + node.getBoundingClientRect().width / 2;
          return direction < 0 ? center < headerCenter : center > headerCenter;
        }).sort((left, right) => {
          const leftDistance = Math.abs((left.getBoundingClientRect().left + left.getBoundingClientRect().width / 2) - headerCenter);
          const rightDistance = Math.abs((right.getBoundingClientRect().left + right.getBoundingClientRect().width / 2) - headerCenter);
          return leftDistance - rightDistance;
        });
        if (sided[0]) return sided[0];
      }
      return null;
    }
    async function navigateToYear(targetYear) {
      for (let step = 0; step < 160; step += 1) {
        const header = yearHeader();
        const current = Number(cleanText(header?.textContent).match(/(?:19|20)\d{2}/)?.[0]);
        if (!current) return false;
        if (current === Number(targetYear)) return true;
        const direction = Number(targetYear) < current ? -1 : 1;
        const navigation = yearNavigation(header, direction);
        if (!navigation) return false;
        activateOption(navigation);
        await wait(55);
      }
      return false;
    }
    const currentMonthHeader = shortClickable().find((node) => /^(?:19|20)\d{2}\s*年?\s*(?:0?[1-9]|1[0-2])\s*月$/.test(cleanText(node.textContent)));
    const currentMonthMatch = cleanText(currentMonthHeader?.textContent).match(/^((?:19|20)\d{2})\s*年?\s*(\d{1,2})\s*月$/);
    if (match[3] && currentMonthMatch && currentMonthMatch[1] === match[1] && Number(currentMonthMatch[2]) === Number(match[2])) {
      const dayNumber = String(Number(match[3]));
      if (!await clickDateToken(new RegExp(`^(?:${dayNumber}|${match[3]})(?:日|号)?$`))) return false;
      await wait(80);
      const shown = cleanText(`${element.value || ''} ${trigger.textContent || ''}`).replace(/[年月日号/.]/g, '-').replace(/\s+/g, '');
      const confirmed = Boolean(element.value) && shown.includes(match[1])
        && new RegExp(`(?:^|-)0?${Number(match[2])}(?:-|$)`).test(shown)
        && new RegExp(`(?:^|-)0?${dayNumber}(?:-|$)`).test(shown);
      if (confirmed) await commitControl(element, trigger);
      return confirmed;
    }
    // 另一类日期面板固定显示“1990年”并通过左右箭头逐年翻页，下面直接列出十二个月。
    // 这种面板没有可点击的年份列表，先导航到目标年，再进入月份/日期。
    if (yearHeader() && shortClickable().some((node) => /^(?:一|二|三|四|五|六|七|八|九|十|十一|十二)月$/.test(cleanText(node.textContent)))) {
      if (!await navigateToYear(match[1])) return false;
      const monthName = ['一','二','三','四','五','六','七','八','九','十','十一','十二'][Number(match[2]) - 1];
      if (!await clickDateToken(new RegExp(`^(?:${Number(match[2])}|${match[2]}|${monthName})(?:月)?$`))) return false;
      if (match[3]) {
        const dayNumber = String(Number(match[3]));
        if (!await clickDateToken(new RegExp(`^(?:${dayNumber}|${match[3]})(?:日|号)?$`))) return false;
      }
      await commitControl(element, trigger);
      const shown = cleanText(`${element.value || ''} ${trigger.textContent || ''}`).replace(/[年月日号/.]/g, '-').replace(/\s+/g, '');
      return shown.includes(match[1])
        && new RegExp(`(?:^|-)0?${Number(match[2])}(?:-|$)`).test(shown)
        && (!match[3] || new RegExp(`(?:^|-)0?${Number(match[3])}(?:-|$)`).test(shown));
    }
    for (let attempt = 0; attempt < 3 && !shortClickable().some((node) => new RegExp(`^${match[1]}(?:年)?$`).test(cleanText(node.textContent))); attempt += 1) {
      const calendarHeader = shortClickable().find((node) => /^(?:19|20)\d{2}\s*年?\s*(?:0?[1-9]|1[0-2])\s*月$/.test(cleanText(node.textContent)))
        || shortClickable().find((node) => /^(?:19|20)\d{2}(?:年)?$/.test(cleanText(node.textContent)));
      if (!calendarHeader) break;
      activateOption(calendarHeader);
      await wait(120);
    }
    if (!await clickDateToken(new RegExp(`^${match[1]}(?:年)?$`))) return false;
    const monthNumber = String(Number(match[2]));
    if (!await clickDateToken(new RegExp(`^(?:${monthNumber}|${match[2]}|${['一','二','三','四','五','六','七','八','九','十','十一','十二'][Number(match[2]) - 1]})(?:月)?$`))) return false;
    if (match[3]) {
      const dayNumber = String(Number(match[3]));
      if (!await clickDateToken(new RegExp(`^(?:${dayNumber}|${match[3]})(?:日|号)?$`))) return false;
    }
    await wait(80);
    const shown = cleanText(`${element.value || ''} ${trigger.textContent || ''}`);
    const targetYear = match[1];
    const targetMonth = String(Number(match[2]));
    const targetDay = match[3] ? String(Number(match[3])) : '';
    const normalizedShown = shown.replace(/[年月日号/.]/g, '-').replace(/\s+/g, '');
    const dateConfirmed = Boolean(element.value) && normalizedShown.includes(targetYear)
      && new RegExp(`(?:^|-)0?${targetMonth}(?:-|$)`).test(normalizedShown)
      && (!targetDay || new RegExp(`(?:^|-)0?${targetDay}(?:-|$)`).test(normalizedShown));
    if (dateConfirmed) await commitControl(element, trigger);
    return dateConfirmed;
    } finally {
      const closed = await settleDynamicInteraction(session, element, '日期弹层');
      if (!closed) {
        fillFailureReasons.set(element, interactionBlocked);
        return false;
      }
    }
  }

  function customChoiceGroups() {
    const candidates = [...document.querySelectorAll([
      '[role="radiogroup"]',
      '.phoenix-radio-group',
      '[class*="radio-group"]',
      '[class*="radioGroup"]',
      '[class*="RadioGroup"]'
    ].join(','))];
    const roots = candidates
      .filter((group) => {
        const optionCount = group.querySelectorAll('[role="radio"],input[type="radio"],[class*="radioItem"],[class*="radio-item"]').length;
        return optionCount >= 2 && visible(group);
      })
      .filter((group) => !candidates.some((other) => other !== group && other.contains(group)
        && other.querySelectorAll('[role="radio"],input[type="radio"],[class*="radioItem"],[class*="radio-item"]').length >= 2));
    return roots.map((group) => {
      const container = semanticContainer(group);
      // Walk until the option group and a title-like sibling share one root.
      // This avoids stopping at wrappers such as `form-item__control`.
      let fieldRoot = null;
      for (let ancestor = group.parentElement, depth = 0; ancestor && depth < 10; ancestor = ancestor.parentElement, depth += 1) {
        const outsideTitle = [...ancestor.querySelectorAll('label,legend,[class*="title"],[class*="Title"],[class*="field-label"],[class*="form-item__text"]')]
          .some((node) => !group.contains(node) && !node.contains(group) && Boolean(cleanText(node.textContent)));
        if (outsideTitle) {
          fieldRoot = ancestor;
          break;
        }
      }
      fieldRoot ||= container || group.parentElement;
      const titleCandidates = fieldRoot ? [...fieldRoot.querySelectorAll([
        ':scope > [class*="title"]',
        ':scope > [class*="Title"]',
        ':scope > label',
        '[class*="form-item__text"]',
        '[class*="field-title"]',
        '[class*="field-label"]'
      ].join(','))] : [];
      const explicitTitle = titleCandidates.find((node) => {
        const label = cleanText(node.textContent);
        return !group.contains(node) && !node.contains(group) && Boolean(label) && label.length <= 80;
      });
      const text = cleanText(explicitTitle?.textContent) || directSemanticLabels(container || group, group)[0] || '';
      const rawOptions = [...group.querySelectorAll('[role="radio"],input[type="radio"],label,button,[class*="radioItem"],[class*="radio-item"],[class*="radio-text"],[class*="RadioItem"]')]
        .filter((node) => node !== group && cleanText(node.textContent || node.value));
      const options = [...new Set(rawOptions.map((node) => {
        return node.closest('[role="radio"],label,button,[class*="radioItem"],[class*="radio-item"]')
          || node.closest('[class~="phoenix-radio"]')
          || node;
      }))].filter((node) => group.contains(node) && cleanText(node.textContent || node.value));
      return { group, container: fieldRoot || container, text, options };
    }).filter(({ options }) => options.length >= 2);
  }

  function customChoiceChecked(option) {
    if (!(option instanceof Element)) return false;
    if (option.matches('input[type="radio"]:checked,[aria-checked="true"]')) return true;
    if (/(?:^|\s|--)checked(?:\s|$)|(?:^|\s)selected(?:\s|$)/i.test(String(option.className || ''))) return true;
    return Boolean(option.querySelector('input[type="radio"]:checked,[aria-checked="true"],[class*="--checked"],[class~="checked"],[class~="selected"]'));
  }

  function customChoiceIsDeclaredDefault(option) {
    if (!(option instanceof Element)) return false;
    const input = option.matches('input[type="radio"]') ? option : option.querySelector('input[type="radio"]');
    if (input?.defaultChecked) return true;
    return option.matches('[data-default="true"],[data-is-default="true"]')
      || Boolean(option.querySelector('[data-default="true"],[data-is-default="true"]'));
  }

  function liveCustomChoice(group, value, fallback = null) {
    const candidates = [...group.querySelectorAll('[role="radio"],input[type="radio"],label,button,[class*="radioItem"],[class*="radio-item"],[class*="radio-text"],[class*="RadioItem"]')]
      .filter((node) => choiceMatches(node.textContent || node.value, value));
    const exactTargets = normalizedChoices(value).map(normalizedExactText);
    const normalized = [...new Set(candidates.map((node) => {
      return node.closest('[role="radio"],label,button,[class*="radioItem"],[class*="radio-item"]')
        || node.closest('[class~="phoenix-radio"]')
        || node;
    }))].filter((node) => group.contains(node));
    return normalized.find((node) => exactTargets.includes(normalizedExactText(node.textContent || node.value)))
      || normalized[0]
      || (fallback?.isConnected && group.contains(fallback) ? fallback : null);
  }

  async function waitForCustomChoiceChecked(group, value, fallback, timeout = 140) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const option = liveCustomChoice(group, value, fallback);
      if (customChoiceChecked(option)) return option;
      await wait(35);
    }
    const option = liveCustomChoice(group, value, fallback);
    return customChoiceChecked(option) ? option : null;
  }

  async function activateCustomChoice(group, option, value) {
    const targets = () => {
      const live = liveCustomChoice(group, value, option);
      if (!live) return [];
      const radio = live.matches('[class~="phoenix-radio"],[role="radio"],input[type="radio"]')
        ? live
        : live.querySelector('[class~="phoenix-radio"],[role="radio"],input[type="radio"]');
      const wrapper = live.querySelector('[class*="radio__wrapper"],[class*="radio-wrapper"]');
      const circle = live.querySelector('[class*="circle-wrapper"],[class*="radio__circle"]');
      const label = live.querySelector('[class*="radio-text"],[class*="label"]');
      return [...new Set([wrapper || live, radio || circle, label].filter(Boolean))].slice(0, 3);
    };
    for (const target of targets()) {
      activateOption(target);
      const checked = await waitForCustomChoiceChecked(group, value, option);
      if (checked) return checked;
    }
    for (const target of targets()) {
      const trusted = await trustedClick(target);
      if (trusted?.ok) {
        const checked = await waitForCustomChoiceChecked(group, value, option, 400);
        if (checked) return checked;
      }
    }
    return null;
  }

  function customChoiceDescription(text, options) {
    const title = cleanText(text) || '未命名单选组';
    const labels = options.map((node) => cleanText(node.textContent || node.value)).filter(Boolean).slice(0, 8);
    return `${title} [${labels.join(' / ')}]`;
  }

  async function fillCustomChoices(profile, stats, overwrite, processedGroups, finalPass = false) {
    const choiceOccurrences = new Map();
    for (const { group, container, text, options } of customChoiceGroups()) {
      const description = customChoiceDescription(text, options);
      const context = sectionContext(container);
      const key = matchKey(text.toLowerCase(), context);
      if (!key) {
        if (processedGroups?.has(group)) continue;
        // The group can be mounted before its title. Give the framework one more
        // render cycle before treating it as an unknown field.
        if (!finalPass) continue;
        processedGroups?.add(group);
        markFillResult(group, UNMATCHED_CLASS);
        stats.unmatched += 1;
        if (stats.details.unmatched.length < 8) stats.details.unmatched.push(`${description}（发现了需要勾选的按钮组，但未识别字段标题）`);
        recordDiagnostic(stats, 'unmatched', {
          field: description, stage: '单选/按钮组语义映射',
          reason: '已识别为可交互选项组，但区块标题未命中本地资料字段；为避免乱选，没有点击'
        });
        continue;
      }
      const occurrenceKey = `${context || 'global'}:${key}`;
      const fallbackOccurrence = choiceOccurrences.get(occurrenceKey) || 0;
      const educationResolution = educationMappedKey(key)
        ? educationEntryResolution(profile, text, fallbackOccurrence)
        : { explicit: false, index: fallbackOccurrence, label: '' };
      const occurrence = educationResolution.explicit ? educationResolution.index : fallbackOccurrence;
      if (!educationResolution.explicit) choiceOccurrences.set(occurrenceKey, fallbackOccurrence + 1);
      // The final framework-render pass must still count groups completed in the
      // first pass, otherwise later education rows shift back to occurrence 0.
      if (processedGroups?.has(group)) continue;
      const value = occurrence >= 0 ? profileValue(profile, key, occurrence, context) : '';
      if (!value) {
        processedGroups?.add(group);
        markFillResult(container || group, MISSING_CLASS);
        stats.missingData += 1;
        if (stats.details.missingData.length < 8) stats.details.missingData.push(`${description} → ${key}`);
        recordDiagnostic(stats, 'missingData', {
          field: description, key, stage: '本地资料取值',
          reason: educationResolution.explicit && occurrence < 0
            ? `页面选项组明确指定${educationResolution.label}，但本地资料中没有对应教育经历；未点击任何选项`
            : `选项组已映射为 ${key}，但本地资料第 ${occurrence + 1} 个对应值为空；未点击任何选项`
        });
        continue;
      }
      const option = options
        .map((node) => ({ node, score: choiceMatchScore(node.textContent, value) }))
        .filter(({ score }) => score >= 60)
        .sort((left, right) => right.score - left.score)[0]?.node;
      if (!option) {
        if (!finalPass) continue;
        processedGroups?.add(group);
        markFillResult(group, FAILED_CLASS);
        stats.unsupported += 1;
        if (stats.details.unsupported.length < 8) stats.details.unsupported.push(`${description} → ${key}（没有与“${value}”匹配的选项）`);
        recordDiagnostic(stats, 'unsupported', {
          field: description, key, target: value,
          observed: options.map((node) => cleanText(node.textContent || node.value)).filter(Boolean).slice(0, 10).join(' / '),
          stage: '候选匹配', reason: '已读取页面选项，但没有任何选项达到安全匹配阈值'
        });
        continue;
      }
      const selected = options.find(customChoiceChecked);
      processedGroups?.add(group);
      const selectedIsDefault = customChoiceIsDeclaredDefault(selected);
      if (selected && selected !== option && !overwrite && !selectedIsDefault) {
        markFillResult(container || group, EXISTING_CLASS);
        stats.existing += 1;
        const observed = cleanText(selected.textContent || selected.value);
        stats.details.existing.push(`${cleanText(text) || '单选组'}（页面已有：${observed}）`);
        recordDiagnostic(stats, 'existing', {
          field: description, key, target: value, observed, stage: '填写前检查',
          reason: '页面已选中非默认选项，且未开启覆盖'
        });
        continue;
      }
      if (selected === option && !selectedIsDefault) {
        markFillResult(container || group, EXISTING_CLASS);
        stats.existing += 1;
        const observed = cleanText(selected.textContent || selected.value);
        stats.details.existing.push(`${cleanText(text) || '单选组'}（页面已符合：${observed}）`);
        recordDiagnostic(stats, 'existing', {
          field: description, key, target: value, observed, stage: '填写前检查',
          reason: '页面已选中与目标一致的非默认选项，无需再点击'
        });
        continue;
      }
      const checked = await activateCustomChoice(group, option, value);
      if (checked) {
        checked.classList.add(FILLED_CLASS);
        container?.classList.add(FILLED_CLASS);
        stats.filled += 1;
      } else {
        markFillResult(container || group, FAILED_CLASS);
        stats.unsupported += 1;
        if (stats.details.unsupported.length < 8) {
          stats.details.unsupported.push(`${cleanText(text)} → ${key}（找到了“${value}”选项，但点击后没有出现 checked 状态）`);
        }
        recordDiagnostic(stats, 'unsupported', {
          field: description, key, target: value,
          observed: options.filter(customChoiceChecked).map((node) => cleanText(node.textContent || node.value)).join(' / '),
          stage: '点击后选中状态验证',
          reason: '找到了安全匹配选项并已尝试 DOM/浏览器级点击，但回读不到 checked/aria-checked/选中类名'
        });
      }
    }
  }

  function datePart(element, fallbackIndex = -1) {
    const placeholder = (element.placeholder || '').trim();
    if (placeholder === '年') return 'year';
    if (placeholder === '月') return 'month';
    if (placeholder === '日') return 'day';
    if (fallbackIndex >= 0) return ['year', 'month', 'day'][fallbackIndex % 3] || '';
    return '';
  }

  function datePartValue(value, part) {
    const match = String(value || '').match(/((?:19|20)\d{2})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?/);
    if (!match) return value;
    return part === 'year' ? match[1] : part === 'month' ? String(Number(match[2])) : part === 'day' && match[3] ? String(Number(match[3])) : value;
  }

  function auxiliaryControl(element, text) {
    const container = semanticContainer(element);
    if (!container) return false;
    const controls = controlNodes(container).filter((node) => node.type !== 'hidden');
    if (controls.length < 2) return false;
    const trigger = customSelectTrigger(element);
    if (!trigger) return false;
    const shown = cleanText(trigger.textContent);
    if (/手机|电话|phone|mobile/i.test(text) && /^[+＋]\d{1,4}$/.test(shown)) return true;
    return false;
  }

  function structuralDateRange(element) {
    const candidates = [];
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 10; depth += 1, ancestor = ancestor.parentElement) {
      const controls = [...ancestor.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')];
      if (!controls.includes(element) || controls.length < 4 || controls.length > 6 || controls.length % 2) continue;
      const dateLike = controls.every((node) => {
        const hint = `${node.placeholder || ''} ${node.className || ''}`;
        return node.type === 'date' || Boolean(customSelectTrigger(node)) || /年|月|日|日期|时间|date|year|month|day/i.test(hint);
      });
      if (!dateLike) continue;
      const text = cleanText(ancestor.textContent);
      const hasRangeSignal = /至今|当前|present|currently/i.test(text)
        || [...ancestor.children].some((child) => /^\s*[-—–~至]\s*$/.test(cleanText(child.textContent)))
        || /range|期间|起止/i.test(String(ancestor.className || ''));
      if (hasRangeSignal) candidates.push({ root: ancestor, controls });
    }
    return candidates[0] || null;
  }

  function structuralDatePart(controls, index) {
    const half = controls.length / 2;
    const position = index % half;
    const corresponding = [controls[position], controls[position + half]].filter(Boolean);
    const explicit = corresponding.map((node) => datePart(node)).find(Boolean);
    if (explicit) return explicit;
    if (half === 1) return '';
    return ['year', 'month', 'day'][position] || '';
  }

  const DATE_RANGE_KINDS = {
    educationDateRange: ['educationStartDate', 'graduationDate'],
    workDateRange: ['workStartDate', 'workEndDate'],
    projectDateRange: ['projectStartDate', 'projectEndDate']
  };

  function liveStructuralDateRange(host, fallbackRoot = null) {
    if (fallbackRoot?.isConnected) {
      const first = fallbackRoot.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
      const range = first && structuralDateRange(first);
      if (range?.root === fallbackRoot || range?.root?.isConnected) return range;
    }
    if (!(host instanceof Element) || !host.isConnected) return null;
    for (const input of host.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')) {
      const range = structuralDateRange(input);
      if (range && host.contains(range.root)) return range;
    }
    return null;
  }

  function allStructuralDateRanges() {
    const ranges = [];
    const seen = new Set();
    for (const input of document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')) {
      if (!input.isConnected || !visible(input)) continue;
      const range = structuralDateRange(input);
      if (range && !seen.has(range.root)) {
        seen.add(range.root);
        ranges.push(range);
      }
    }
    return ranges;
  }

  function rangeDescriptor(range) {
    const ranges = allStructuralDateRanges().filter((candidate) => candidate.controls.length === range.controls.length);
    const context = sectionContext(range.controls[0]);
    const sameContext = context
      ? ranges.filter((candidate) => sectionContext(candidate.controls[0]) === context)
      : ranges;
    const index = Math.max(0, sameContext.findIndex((candidate) => candidate.root === range.root));
    return { controls: range.controls.length, context, index };
  }

  function locateStructuralDateRange(descriptor, host = null, fallbackRoot = null) {
    const direct = liveStructuralDateRange(host, fallbackRoot);
    if (direct && direct.controls.length === descriptor.controls) return direct;
    const ranges = allStructuralDateRanges().filter((candidate) => candidate.controls.length === descriptor.controls);
    const sameContext = descriptor.context
      ? ranges.filter((candidate) => sectionContext(candidate.controls[0]) === descriptor.context)
      : ranges;
    return sameContext[descriptor.index] || ranges[descriptor.index] || null;
  }

  function rangeControlHasValue(element) {
    if (!(element instanceof Element)) return false;
    if (String(element.value || '').trim() && !placeholderLike(element.value)) return true;
    const trigger = customSelectTrigger(element);
    if (!trigger) return false;
    const shown = String(trigger.textContent || '').trim();
    return Boolean(shown && !placeholderLike(shown));
  }

  function structuralRangeComplete(range) {
    return Boolean(range?.controls?.length >= 4 && range.controls.every(rangeControlHasValue));
  }

  function rangeControlShownValue(element) {
    if (!(element instanceof Element)) return '';
    const trigger = customSelectTrigger(element);
    const displayed = trigger?.querySelector('[class*="display-value"]')?.textContent
      || trigger?.textContent
      || element.value
      || '';
    return cleanText(displayed);
  }

  function structuralRangeReading(range, side = 0) {
    if (!range?.controls?.length || range.controls.length % 2) return '';
    const half = range.controls.length / 2;
    return range.controls.slice(side ? half : 0, side ? range.controls.length : half)
      .map(rangeControlShownValue)
      .filter((value) => value && !placeholderLike(value))
      .join('-');
  }

  function rangeControlMatches(element, expected) {
    const shown = rangeControlShownValue(element);
    if (!shown) return false;
    const expectedText = String(expected);
    if (/^\d+$/.test(expectedText)) {
      const number = shown.match(/(?:^|\D)0*(\d+)(?:\D|$)/)?.[1];
      return number !== undefined && Number(number) === Number(expectedText);
    }
    return normalizedExactText(shown) === normalizedExactText(expectedText);
  }

  function structuralRangeMatches(range, startValue, endValue) {
    if (!range || ![4, 6].includes(range.controls.length)) return false;
    const half = range.controls.length / 2;
    const parts = half === 2 ? ['year', 'month'] : ['year', 'month', 'day'];
    return range.controls.every((control, index) => {
      const source = index < half ? startValue : endValue;
      return rangeControlMatches(control, datePartValue(source, parts[index % half]));
    });
  }

  async function fillStructuralDateRangeGroup(host, initialRange, startValue, endValue, keys, overwrite) {
    const descriptor = rangeDescriptor(initialRange);
    let range = locateStructuralDateRange(descriptor, host, initialRange.root);
    if (!range || ![4, 6].includes(range.controls.length)) {
      return { ok: false, reason: '日期范围不是四格年月或六格年月日结构' };
    }
    const half = range.controls.length / 2;
    const expectedParts = half === 2 ? ['year', 'month'] : ['year', 'month', 'day'];
    const sideValues = [startValue, endValue];
    const originalStates = range.controls.map((control) => captureFillState(control, customSelectTrigger(control) || control));

    if (!startValue) return { ok: false, missingKey: keys[0], reason: '开始日期资料为空' };
    if (!endValue) return { ok: false, missingKey: keys[1], reason: '结束日期资料为空' };

    // 选择年份后，部分组件会自动把月份设成 1；任意一次交互还可能触发整组重渲染。
    // 因此按“多轮校正”处理：单格失败不终止，继续尝试后面的格子；下一轮只补不匹配项。
    const failures = [];
    for (let pass = 0; pass < 3; pass += 1) {
      let attempted = false;
      for (let side = 0; side < 2; side += 1) {
        const sourceValue = sideValues[side];
        for (let position = 0; position < half; position += 1) {
          range = locateStructuralDateRange(descriptor, host, range?.root || initialRange.root);
          if (!range || range.controls.length !== half * 2) {
            failures.push('填写过程中日期范围 DOM 已替换且无法重新定位');
            continue;
          }
          const control = range.controls[side * half + position];
          const part = expectedParts[position];
          const expected = datePartValue(sourceValue, part);
          if (rangeControlMatches(control, expected)) continue;
          attempted = true;
          const filled = await fillElement(control, sourceValue, keys[side], part);
          range = locateStructuralDateRange(descriptor, host, range?.root || initialRange.root);
          const liveControl = range?.controls?.[side * half + position];
          if (!filled || !liveControl || !rangeControlMatches(liveControl, expected)) {
            failures.push(`${side ? '结束' : '开始'}${part === 'year' ? '年份' : part === 'month' ? '月份' : '日期'}未达到 ${expected}`);
          }
        }
      }
      range = locateStructuralDateRange(descriptor, host, range?.root || initialRange.root);
      if (structuralRangeMatches(range, startValue, endValue)) break;
      if (!attempted) break;
      await wait(80);
    }

    range = locateStructuralDateRange(descriptor, host, range.root);
    if (!structuralRangeMatches(range, startValue, endValue)) {
      const missing = range?.controls?.map((control, index) => rangeControlHasValue(control) ? '' : `${index < half ? '开始' : '结束'}${expectedParts[index % half]}`)
        .filter(Boolean).join('、');
      const actual = range?.controls?.map(rangeControlShownValue).join(' / ') || '无法回读';
      const details = [...new Set(failures)].slice(-4).join('、');
      for (let index = 0; index < (range?.controls?.length || 0); index += 1) {
        const control = range.controls[index];
        await rollbackFailedControl(control, customSelectTrigger(control) || control, originalStates[index]);
      }
      return { ok: false, reason: `日期范围没有达到目标值（当前：${actual}${missing ? `；空格：${missing}` : ''}${details ? `；尝试：${details}` : ''}）` };
    }
    range.controls.forEach((control) => control.classList.add(FILLED_CLASS));
    return { ok: true, range };
  }

  function atsxPeriodMonthWidgets() {
    return [...document.querySelectorAll('.atsx-date-picker-period-month,[class*="atsx-date-picker-period-month"]')]
      .filter((widget) => visible(widget))
      .filter((widget, index, list) => list.indexOf(widget) === index)
      .filter((widget) => widget.querySelectorAll('[class*="period-month-label"]').length >= 2);
  }

  function atsxPeriodMonthLabels(widget) {
    const labels = [...widget.querySelectorAll('[class*="period-month-label"]')].filter(visible);
    const begin = widget.querySelector('[data-cy$="periodInputBegin"]') || labels[0] || null;
    const end = widget.querySelector('[data-cy$="periodInputEnd"]') || labels[1] || null;
    return [begin, end];
  }

  function atsxPeriodMonthReading(widget, side) {
    const label = atsxPeriodMonthLabels(widget)[side];
    if (!label) return '';
    const year = cleanText(label.querySelector('[data-cy="year"],[class*="label-year"]')?.textContent);
    const month = cleanText(label.querySelector('[data-cy="month"],[class*="label-month"]')?.textContent);
    if (!/(?:19|20)\d{2}/.test(year) || !/\d{1,2}/.test(month)) return '';
    return `${year.match(/(?:19|20)\d{2}/)[0]}-${String(Number(month.match(/\d{1,2}/)[0])).padStart(2, '0')}`;
  }

  function atsxPeriodMonthExpected(value) {
    const match = String(value || '').match(/((?:19|20)\d{2})[-/.年](\d{1,2})/);
    return match ? `${match[1]}-${String(Number(match[2])).padStart(2, '0')}` : '';
  }

  function atsxPeriodContextAndKey(widget) {
    const cue = `${widget.getAttribute('data-cy') || ''} ${labelText(widget)}`;
    let context = sectionContext(widget);
    if (!context && /internship|employment|work/i.test(cue)) context = 'work';
    if (!context && /education|school/i.test(cue)) context = 'education';
    if (!context && /project/i.test(cue)) context = 'project';
    const key = matchKey(labelText(widget), context) || contextualKey('起止时间', context);
    return { context, key };
  }

  function atsxVisiblePeriodPanel() {
    const roots = [...document.querySelectorAll('[class*="atsx-date-picker-period-month-panel"],[class*="date-picker-period-month-panel"]')]
      .filter((node) => visible(node));
    return roots.find((root) => root.querySelector('[class*="panel-list-item"]')) || roots[0] || null;
  }

  function atsxPeriodTokenMatches(node, part, expected) {
    const text = cleanText(node.textContent);
    const data = cleanText(node.getAttribute('data-cy'));
    if (part === 'year') return [text, data].some((value) => Number(value.match(/(?:19|20)\d{2}/)?.[0]) === Number(expected));
    const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    return [text, data].some((value) => {
      const number = value.match(/\d{1,2}/)?.[0];
      return number ? Number(number) === Number(expected) : monthNames[Number(expected) - 1] === value;
    });
  }

  async function fillAtsxPeriodMonthSide(widget, side, value) {
    const expected = atsxPeriodMonthExpected(value);
    const match = expected.match(/^((?:19|20)\d{2})-(\d{2})$/);
    if (!match) return { ok: false, reason: `资料日期无法解析为年月` };
    const label = atsxPeriodMonthLabels(widget)[side];
    if (!label) return { ok: false, reason: `没有找到${side ? '结束' : '开始'}时间入口` };
    if (atsxPeriodMonthReading(widget, side) === expected) return { ok: true };
    const session = beginDynamicInteraction(widget);
    const waitUntil = async (test, timeout = 800) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const result = test();
        if (result) return result;
        await wait(35);
      }
      return test() || null;
    };
    const clickWithFallback = async (resolveTarget, accepted = null) => {
      let target = resolveTarget();
      if (!target) return false;
      const revision = session.revision;
      activateOption(target);
      if (await waitUntil(() => accepted?.() || session.revision !== revision || !target.isConnected, 180)) return true;
      target = resolveTarget();
      if (!target) return Boolean(accepted?.());
      const trusted = await trustedClick(target);
      return Boolean(trusted?.ok && await waitUntil(() => accepted?.() || !target.isConnected || session.revision !== revision, 650));
    };
    activateOption(label);
    let panel = await waitUntil(atsxVisiblePeriodPanel, 500);
    if (!panel) {
      const trusted = await trustedClick(label);
      if (trusted?.ok) panel = await waitUntil(atsxVisiblePeriodPanel, 900);
    }
    if (!panel) {
      session.stop();
      return { ok: false, reason: `点击${side ? '结束' : '开始'}时间后没有出现年月面板` };
    }
    rememberInteractionRoot(session, panel);
    const token = (part, target) => {
      const livePanel = atsxVisiblePeriodPanel();
      if (!livePanel) return null;
      const candidates = [...livePanel.querySelectorAll('[class*="panel-list-item"],[role="option"],[data-cy]')]
        .filter((node) => atsxPeriodTokenMatches(node, part, target));
      return candidates.find((node) => !candidates.some((other) => other !== node && node.contains(other))) || null;
    };
    const openTokenList = async (part) => {
      if (token(part, part === 'year' ? match[1] : Number(match[2]))) return true;
      let livePanel = atsxVisiblePeriodPanel();
      if (!livePanel) {
        activateOption(label);
        livePanel = await waitUntil(atsxVisiblePeriodPanel, 500);
        if (!livePanel) {
          const trusted = await trustedClick(label);
          if (trusted?.ok) livePanel = await waitUntil(atsxVisiblePeriodPanel, 700);
        }
      }
      const opener = livePanel?.querySelector(`[data-cy="${part}"],[class*="${part}"]`);
      if (!opener) return false;
      return clickWithFallback(() => opener, () => Boolean(token(part, part === 'year' ? match[1] : Number(match[2]))));
    };
    if (!await openTokenList('year')
      || !await clickWithFallback(() => token('year', match[1]))) {
      session.stop();
      return { ok: false, reason: `年份列表中无法选择 ${match[1]}` };
    }
    await wait(80);
    if (!await openTokenList('month')
      || !await clickWithFallback(() => token('month', Number(match[2])), () => atsxPeriodMonthReading(widget, side) === expected)) {
      session.stop();
      return { ok: false, reason: `月份列表中无法选择 ${Number(match[2])} 月` };
    }
    const ok = Boolean(await waitUntil(() => atsxPeriodMonthReading(widget, side) === expected, 900));
    session.stop();
    if (!ok) return { ok: false, reason: `${side ? '结束' : '开始'}时间没有回读到 ${expected}` };
    clickOutsideControl(widget);
    return { ok: true };
  }

  async function rollbackAtsxPeriodMonth(widget, originalReadings) {
    const clear = widget.querySelector('[class*="clear" i],[aria-label*="清除"],[aria-label*="clear" i]');
    if (!originalReadings[0] && !originalReadings[1] && clear && visible(clear)) {
      activateOption(clear);
      await wait(100);
      if (atsxPeriodMonthReading(widget, 0) || atsxPeriodMonthReading(widget, 1)) await trustedClick(clear);
    }
    for (let side = 0; side < 2; side += 1) {
      const original = originalReadings[side];
      if (original && atsxPeriodMonthReading(widget, side) !== original) {
        await fillAtsxPeriodMonthSide(widget, side, original);
      }
    }
    const hidden = widget.querySelector('input[class*="hidden-input"],input[type="hidden"]');
    if (!originalReadings[0] && !originalReadings[1] && hidden instanceof HTMLInputElement) {
      setNativeValue(hidden, '');
    }
    return originalReadings.every((value, side) => atsxPeriodMonthReading(widget, side) === value);
  }

  async function fillAtsxPeriodMonthRanges(profile, stats, overwrite) {
    const occurrences = new Map();
    for (const widget of atsxPeriodMonthWidgets()) {
      const { context, key } = atsxPeriodContextAndKey(widget);
      if (!key || !DATE_RANGE_KINDS[key]) {
        markFillResult(widget, UNMATCHED_CLASS);
        stats.unmatched += 1;
        if (stats.details.unmatched.length < 24) stats.details.unmatched.push(`${labelText(widget) || '年月起止控件'}（已识别交互结构，未确定资料字段）`);
        recordDiagnostic(stats, 'unmatched', {
          field: labelText(widget) || '年月起止控件', stage: 'ATSX 日期范围映射',
          reason: '已识别为开始/结束年月组件，但附近区块和字段标题无法确定应对应教育、工作还是项目日期'
        });
        continue;
      }
      const occurrenceKey = `${context || 'global'}:${key}`;
      const occurrence = occurrences.get(occurrenceKey) || 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      const [startKey, endKey] = DATE_RANGE_KINDS[key];
      const startValue = profileValue(profile, startKey, occurrence, context);
      const endValue = profileValue(profile, endKey, occurrence, context);
      if (!startValue || !endValue) {
        markFillResult(widget, MISSING_CLASS);
        stats.missingData += 1;
        if (stats.details.missingData.length < 8) stats.details.missingData.push(`${labelText(widget) || '起止时间'} → ${!startValue ? startKey : endKey}`);
        recordDiagnostic(stats, 'missingData', {
          field: labelText(widget) || '起止时间', key: `${startKey}/${endKey}`,
          target: `${startValue || '缺失'} → ${endValue || '缺失'}`, stage: '本地资料取值',
          reason: `日期组件已映射，但第 ${occurrence + 1} 段资料缺少 ${!startValue ? startKey : endKey}；未点击日历`
        });
        continue;
      }
      const startExpected = atsxPeriodMonthExpected(startValue);
      const endExpected = atsxPeriodMonthExpected(endValue);
      const originalReadings = [atsxPeriodMonthReading(widget, 0), atsxPeriodMonthReading(widget, 1)];
      if (!overwrite && atsxPeriodMonthReading(widget, 0) === startExpected && atsxPeriodMonthReading(widget, 1) === endExpected) {
        markFillResult(widget, EXISTING_CLASS);
        stats.existing += 1;
        stats.details.existing.push(`${labelText(widget) || '起止时间'}（页面已符合 ${startExpected} → ${endExpected}）`);
        recordDiagnostic(stats, 'existing', {
          field: labelText(widget) || '起止时间', key: `${startKey}/${endKey}`,
          target: `${startExpected} → ${endExpected}`, observed: `${atsxPeriodMonthReading(widget, 0)} → ${atsxPeriodMonthReading(widget, 1)}`,
          stage: '填写前检查', reason: '页面开始/结束年月都已与目标资料匹配，不是 YYYY/MM 占位值'
        });
        continue;
      }
      const startResult = await fillAtsxPeriodMonthSide(widget, 0, startValue);
      const endResult = startResult.ok ? await fillAtsxPeriodMonthSide(widget, 1, endValue) : { ok: false, reason: '开始时间失败，未继续结束时间' };
      if (startResult.ok && endResult.ok) {
        markFillResult(widget, FILLED_CLASS);
        stats.filled += 1;
      } else {
        const failedReadings = [atsxPeriodMonthReading(widget, 0), atsxPeriodMonthReading(widget, 1)];
        const rolledBack = await rollbackAtsxPeriodMonth(widget, originalReadings);
        markFillResult(widget, FAILED_CLASS);
        const failureReason = startResult.ok ? endResult.reason : startResult.reason;
        fillFailureReasons.set(widget, `${failureReason}${rolledBack ? '' : '；组件没有清除入口，未能完全恢复原状态'}`);
        stats.unsupported += 1;
        if (stats.details.unsupported.length < 8) stats.details.unsupported.push(`${labelText(widget) || '起止时间'} → ${startKey}/${endKey}（${fillFailureReasons.get(widget)}）`);
        recordDiagnostic(stats, 'unsupported', {
          field: labelText(widget) || '起止时间', key: `${startKey}/${endKey}`,
          target: `${startExpected} → ${endExpected}`,
          observed: `${failedReadings[0] || '操作后仍为空'} → ${failedReadings[1] || '操作后仍为空'}`,
          stage: 'ATSX 年/月选择后回读', reason: fillFailureReasons.get(widget)
        });
      }
    }
  }

  function dateBinding(element, key, groupOccurrences) {
    const rangeKinds = DATE_RANGE_KINDS;
    const structuralRange = structuralDateRange(element);
    if (structuralRange && rangeKinds[key]) {
      const { root: rangeRoot, controls: rangeControls } = structuralRange;
      const index = rangeControls.indexOf(element);
      if (index >= 0) {
        const occurrenceKey = `structural-range:${key}`;
        if (!groupOccurrences.has(occurrenceKey)) groupOccurrences.set(occurrenceKey, { next: 0, containers: new WeakMap() });
        const state = groupOccurrences.get(occurrenceKey);
        if (!state.containers.has(rangeRoot)) state.containers.set(rangeRoot, state.next++);
        const occurrence = state.containers.get(rangeRoot);
        const half = rangeControls.length / 2;
        return {
          key: rangeKinds[key][index < half ? 0 : 1],
          occurrence,
          part: structuralDatePart(rangeControls, index)
        };
      }
    }
    const container = semanticContainer(element);
    if (!container) return null;
    const isDateControl = (node) => datePart(node)
      || node.type === 'date'
      || Boolean(customSelectTrigger(node) && (node.readOnly || /日期|时间|年月|date|year|month/i.test(`${node.placeholder || ''} ${node.className || ''}`)));
    const controls = controlNodes(container).filter((node) => isDateControl(node));
    const index = controls.indexOf(element);
    if (index < 0) return null;
    const occurrenceKey = rangeKinds[key] ? key : `compound:${key}`;
    if (!groupOccurrences.has(occurrenceKey)) groupOccurrences.set(occurrenceKey, { next: 0, containers: new WeakMap() });
    const state = groupOccurrences.get(occurrenceKey);
    if (!state.containers.has(container)) state.containers.set(container, state.next++);
    const occurrence = state.containers.get(container);
    if (rangeKinds[key]) {
      const half = Math.max(1, Math.ceil(controls.length / 2));
      const sideIndex = index < half ? 0 : 1;
      const sideStart = sideIndex ? half : 0;
      const sideControls = controls.slice(sideStart, sideIndex ? controls.length : half);
      const explicitPart = datePart(element);
      const part = explicitPart || (sideControls.length > 1 ? datePart(element, sideControls.indexOf(element)) : '');
      return { key: rangeKinds[key][sideIndex], occurrence, part };
    }
    if (/Date$|Date\b/.test(key) && controls.length > 1) return { key, occurrence, part: datePart(element) };
    return null;
  }

  async function fillElement(element, value, key, part = '') {
    if (value === undefined || value === null || String(value).trim() === '') return false;
    const locationLeaf = CASCADE_LOCATION_KEYS.has(key) ? (locationChoicePath(value).at(-1) || String(value)) : String(value);
    if (element instanceof HTMLSelectElement) return fillSelect(element, locationLeaf)
      || (locationLeaf !== String(value) && fillSelect(element, value));
    if (element.type === 'radio' || element.type === 'checkbox') return fillChoice(element, value);
    if (part && customSelectTrigger(element)) return fillCustomSelect(element, datePartValue(value, part), key);
    if (/Date$|Date\b/.test(key) && customSelectTrigger(element)) return fillCustomDate(element, value);
    if (/Date$|Date\b/.test(key)) {
      const wasReadOnly = element.readOnly;
      if (wasReadOnly) element.removeAttribute('readonly');
      setNativeValue(element, String(value));
      if (wasReadOnly) element.setAttribute('readonly', '');
      await commitControl(element, element);
      return element.value === String(value);
    }
    if (customSelectTrigger(element)) return fillCustomSelect(element, value, key);
    if (element.isContentEditable) {
      element.focus();
      element.textContent = locationLeaf;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: locationLeaf }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }
    if (AUTOCOMPLETE_KEYS.has(key) && element instanceof HTMLInputElement && !element.readOnly) {
      const autocompleteResult = await fillAutocompleteText(element, value, key);
      if (autocompleteResult !== null) return autocompleteResult;
    }
    setNativeValue(element, locationLeaf);
    return normalizedExactText(element.value) === normalizedExactText(locationLeaf);
  }

  function fastFillOrdinaryControls(profile, stats, overwrite, processedControls) {
    const controls = [...document.querySelectorAll('input:not([type="hidden"]),textarea,select,[contenteditable="true"]')];
    for (const element of controls) {
      if (!element.isConnected || !visible(element) || element.disabled || processedControls.has(element)) continue;
      const type = (element.type || '').toLowerCase();
      if (['file', 'radio', 'checkbox', 'password', 'submit', 'button', 'reset', 'image', 'date', 'month'].includes(type)) continue;
      const text = labelText(element);
      const context = sectionContext(element);
      const key = matchKey(text, context);
      if (!key || repeatedFieldMap[key] || /Date$|Date\b/.test(key) || AUTOCOMPLETE_KEYS.has(key) || customSelectTrigger(element)) continue;
      const value = profileValue(profile, key, 0, context);
      if (!value) continue;
      const fastValue = CASCADE_LOCATION_KEYS.has(key) ? (locationChoicePath(value).at(-1) || String(value)) : value;
      if (!overwrite && hasValue(element)) {
        markFillResult(element, EXISTING_CLASS);
        stats.existing += 1;
        const field = readableField(text, element);
        const observed = controlReadback(element, customSelectTrigger(element));
        stats.details.existing.push(`${field}（页面已有：${diagnosticValue(observed)}）`);
        recordDiagnostic(stats, 'existing', {
          field, key, target: fastValue, observed, stage: '快速字段填写前检查',
          reason: '检测到非空、非占位、非声明默认的页面值，且未开启覆盖'
        });
        processedControls.add(element);
        continue;
      }
      let filled = false;
      if (element instanceof HTMLSelectElement) filled = fillSelect(element, fastValue)
        || (String(fastValue) !== String(value) && fillSelect(element, value));
      else if (element.isContentEditable) {
        element.focus();
        element.textContent = fastValue;
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(fastValue) }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        filled = true;
      } else {
        setNativeValue(element, String(fastValue));
        filled = true;
      }
      if (!filled) continue;
      element.classList.add(FILLED_CLASS);
      processedControls.add(element);
      stats.filled += 1;
    }
  }

  const repeatedFieldMap = {
    school: ['educationEntries', 'school'], college: ['educationEntries', 'college'], major: ['educationEntries', 'major'],
    degree: ['educationEntries', 'degree'], academicDegree: ['educationEntries', 'academicDegree'], studyMode: ['educationEntries', 'studyMode'], isHighestEducation: ['educationEntries', 'isHighest'],
    educationStartDate: ['educationEntries', 'startDate'], graduationDate: ['educationEntries', 'endDate'], gpa: ['educationEntries', 'gpa'], ranking: ['educationEntries', 'ranking'], rankingPercent: ['educationEntries', 'rankingPercent'],
    company: ['workEntries', 'company'], currentTitle: ['workEntries', 'title'], department: ['workEntries', 'department'], workType: ['workEntries', 'type'],
    workStartDate: ['workEntries', 'startDate'], workEndDate: ['workEntries', 'endDate'], workDescription: ['workEntries', 'description'],
    familyName: ['familyEntries', 'name'], familyRelationship: ['familyEntries', 'relationship'], familyPhone: ['familyEntries', 'phone'],
    familyWorkplace: ['familyEntries', 'workplace'], familyOccupation: ['familyEntries', 'occupation'],
    projectName: ['projectEntries', 'name'], projectRole: ['projectEntries', 'role'], projectStartDate: ['projectEntries', 'startDate'],
    projectEndDate: ['projectEntries', 'endDate'], projectDescription: ['projectEntries', 'description'],
    certificateName: ['certificateEntries', 'name'], certificateDate: ['certificateEntries', 'date'], certificateNumber: ['certificateEntries', 'number'],
    certificateIssuer: ['certificateEntries', 'issuer'], certificateLevel: ['certificateEntries', 'level'],
    certificateDescription: ['certificateEntries', 'description'], languageName: ['languageEntries', 'name'],
    languageProficiency: ['languageEntries', 'proficiency'], languageCertificate: ['languageEntries', 'certificate'], languageScore: ['languageEntries', 'score'],
    languageListeningSpeaking: ['languageEntries', 'listeningSpeaking'], languageReadingWriting: ['languageEntries', 'readingWriting']
  };

  function educationEntryResolution(profile, fieldText, fallbackOccurrence = 0) {
    const text = cleanText(fieldText);
    const hints = [
      { label: '博士', pattern: /博士|ph\.?d|doctoral/i, entry: /博士|ph\.?d|doctoral/i },
      { label: '硕士', pattern: /硕士|研究生|master|mba/i, entry: /硕士|研究生|master|mba/i },
      { label: '本科/学士', pattern: /本科|学士|bachelor/i, entry: /本科|学士|bachelor/i },
      { label: '大专/专科', pattern: /大专|专科|associate/i, entry: /大专|专科|associate/i },
      { label: '高中', pattern: /高中|high\s*school/i, entry: /高中|high\s*school/i }
    ];
    const hint = hints.find((item) => item.pattern.test(text));
    if (!hint) return { explicit: false, index: fallbackOccurrence, label: '' };
    const entries = profile.educationEntries || [];
    const index = entries.findIndex((entry) => hint.entry.test(`${entry.degree || ''} ${entry.academicDegree || ''}`));
    return { explicit: true, index, label: hint.label };
  }

  function educationMappedKey(key) {
    return repeatedFieldMap[key]?.[0] === 'educationEntries';
  }

  function profileValue(profile, key, occurrence, context = '') {
    const explicitDefaults = {
      relativesEmployed: '否',
      healthStatus: '健康',
      mentalIllness: '无',
      acceptsAdjustment: '是',
      acceptsRotation: '是'
    };
    if (key === 'highestDegree') return profile.degree || '';
    if (key === 'highestGraduationDate') return profile.graduationDate || '';
    if (['nativePlaceProvince', 'nativePlaceCity', 'nativePlaceDistrict', 'nativePlace'].includes(key)) {
      const explicitParts = [profile.nativePlaceProvince, profile.nativePlaceCity, profile.nativePlaceDistrict]
        .map((value) => cleanText(value));
      const hasExplicitLevels = explicitParts.some(Boolean);
      let parts = hasExplicitLevels ? explicitParts : locationChoicePath(profile.nativePlace || '');
      const directAdministration = /^(?:北京市|上海市|天津市|重庆市|香港特别行政区|澳门特别行政区)$/.test(parts[0] || '');
      const legacyDirectDistrict = directAdministration && !hasExplicitLevels && parts.length === 2 ? parts[1] : '';
      if (key === 'nativePlaceProvince') return hasExplicitLevels ? explicitParts[0] : (parts[0] || '');
      if (key === 'nativePlaceCity') return hasExplicitLevels
        ? (explicitParts[1] || (directAdministration ? explicitParts[0] : ''))
        : ((directAdministration ? parts[0] : parts[1]) || parts[0] || '');
      if (key === 'nativePlaceDistrict') return hasExplicitLevels ? explicitParts[2] : (legacyDirectDistrict || parts[2] || parts.at(-1) || '');
      // 组合字段保留完整路径；直辖市在资料中可同时占省/市两级，
      // 但级联选择时不需要连续点击两次同一个值。
      return parts.filter(Boolean).filter((value, index, values) => index === 0 || value !== values[index - 1]).join('/') || profile.nativePlace || '';
    }
    if (key === 'englishName') return profile.englishName || [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    if (key === 'englishLevel') return profile.englishLevel || profile.languageEntries?.find((entry) => /^(?:英语|英文|english)$/i.test(entry.name || ''))?.certificate || profile.languageEntries?.find((entry) => /^(?:英语|英文|english)$/i.test(entry.name || ''))?.proficiency || '';
    if (key === 'englishListeningSpeaking') return profile.englishListeningSpeaking || profile.languageEntries?.find((entry) => /^(?:英语|英文|english)$/i.test(entry.name || ''))?.listeningSpeaking || '';
    if (key === 'englishReadingWriting') return profile.englishReadingWriting || profile.languageEntries?.find((entry) => /^(?:英语|英文|english)$/i.test(entry.name || ''))?.readingWriting || '';
    if (context === 'basic' && (key === 'degree' || key === 'graduationDate')) return profile[key] || '';
    const repeated = repeatedFieldMap[key];
    if (repeated) {
      const [collection, property] = repeated;
      const value = profile[collection]?.[occurrence]?.[property];
      if (value !== undefined && value !== null && String(value).trim()) return value;
      if (occurrence > 0) return '';
    }
    if (key === 'currentResidence') return profile.currentResidence || profile.city || '';
    return profile[key] || explicitDefaults[key] || '';
  }

  function readableField(text, element) {
    return (text || element.name || element.id || element.type || '未知字段').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function diagnosticValue(value, fallback = '—') {
    const text = cleanText(value);
    return text ? text.slice(0, 160) : fallback;
  }

  function recordDiagnostic(stats, category, item) {
    if (!stats?.diagnostics?.[category]) return;
    const normalized = {
      field: diagnosticValue(item.field, '未命名字段'),
      key: diagnosticValue(item.key),
      target: diagnosticValue(item.target),
      observed: diagnosticValue(item.observed),
      reason: diagnosticValue(item.reason, '未提供判定原因'),
      stage: diagnosticValue(item.stage)
    };
    const signature = JSON.stringify(normalized);
    if (stats.diagnosticSignatures?.has(signature)) return;
    stats.diagnosticSignatures?.add(signature);
    if (stats.diagnostics[category].length < 160) stats.diagnostics[category].push(normalized);
  }

  function controlValueSatisfied(element, trigger, value, key = '', part = '') {
    const observed = controlReadback(element, trigger);
    if (!observed || placeholderLike(observed)) return false;
    if (element instanceof HTMLSelectElement) {
      const expected = part ? datePartValue(value, part) : value;
      return choiceMatches(observed, expected);
    }
    if (trigger) {
      const expected = part ? datePartValue(value, part) : value;
      // 可编辑下拉框里“搜索文字恰好等于目标值”不是选中成功。
      // 只信任明确 selected/checked 节点，或组件已显示非占位选中值的情况。
      const selected = trigger.querySelector('[aria-selected="true"],[aria-checked="true"],[class*="selected-value"],[class*="SelectedValue"],[class*="singleValue"],[class*="SingleValue"],[class*="display-value"],[class*="DisplayValue"],[class*="calcEle"],[class*="selected-item"],[class*="selection-item"]');
      const selectedShown = cleanText(selected?.textContent || '');
      if (selectedShown && choiceMatches(selectedShown, expected)) return true;
      if (!customTriggerHasSelection(trigger)) return false;
      const triggerShown = cleanText(trigger.textContent || '');
      return Boolean(triggerShown && choiceMatches(triggerShown, expected));
    }
    if (/Date$|Date\b/.test(key) || part) {
      const expected = normalizedExactText(part ? datePartValue(value, part) : value).replace(/[^0-9]/g, '');
      const actual = normalizedExactText(observed).replace(/[^0-9]/g, '');
      return Boolean(expected && actual && (actual === expected || actual.endsWith(expected) || expected.endsWith(actual)));
    }
    return normalizedExactText(observed) === normalizedExactText(value);
  }

  function showToast(message) {
    document.querySelector('.resume-autofill-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'resume-autofill-toast';
    toast.textContent = message;
    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  function showCompletionPanel(stats) {
    document.querySelector('.resume-autofill-completion')?.remove();
    const panel = document.createElement('section');
    panel.className = 'resume-autofill-completion';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');

    const header = document.createElement('div');
    header.className = 'resume-autofill-completion__header';
    const title = document.createElement('strong');
    title.textContent = '自动填写完成';
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭完成提示');
    close.textContent = '×';
    close.addEventListener('click', () => panel.remove());
    header.append(title, close);

    const summary = document.createElement('p');
    summary.textContent = `已填写 ${stats.filled} 项，新增经历 ${stats.sectionsAdded} 段，跳过已有内容 ${stats.existing} 项。`;
    const issues = document.createElement('p');
    issues.textContent = `资料字段未映射 ${stats.unmatched} 项，资料缺失 ${stats.missingData} 项，实际处理失败 ${stats.unsupported} 项，有意忽略 ${stats.ignored || 0} 项。`;
    const legend = document.createElement('div');
    legend.className = 'resume-autofill-completion__legend';
    legend.innerHTML = '<span class="is-filled">绿色：填写成功</span><span class="is-missing">黄色：本地资料缺失</span><span class="is-failed">红色：实际处理失败</span><span class="is-existing">蓝色：页面已有值，未覆盖</span><span class="is-unmapped">紫色：未映射资料字段</span><span class="is-ignored">灰色：有意忽略</span>';
    const timing = document.createElement('p');
    timing.textContent = `耗时 ${(stats.timings.totalMs / 1000).toFixed(1)} 秒。请检查日期、选择项和资格问题后手动提交。`;

    const explanation = document.createElement('p');
    explanation.className = 'resume-autofill-completion__hint';
    explanation.textContent = '下方诊断表会列出每一项的目标值、页面回读值、判定阶段和原因。黄色=字段已映射但本地资料为空（未操作页面）；紫色=页面字段标签没有命中映射规则；红色=已尝试后回读验证未通过；蓝色=填写前已有明确的非占位、非默认值。';

    const appendDetails = (label, items) => {
      if (!items?.length) return;
      const details = document.createElement('details');
      const detailsSummary = document.createElement('summary');
      detailsSummary.textContent = `${label}（显示 ${Math.min(items.length, 8)} 项）`;
      const list = document.createElement('ol');
      for (const item of items.slice(0, 8)) {
        const row = document.createElement('li');
        row.textContent = item;
        list.appendChild(row);
      }
      details.append(detailsSummary, list);
      panel.appendChild(details);
    };

    const appendDiagnosticTable = (label, items, category, open = false) => {
      if (!items?.length) return false;
      const details = document.createElement('details');
      details.className = `resume-autofill-completion__diagnostics resume-autofill-completion__diagnostics--${category}`;
      details.open = open;
      const detailsSummary = document.createElement('summary');
      detailsSummary.textContent = `${label}（${items.length} 项）`;
      const wrap = document.createElement('div');
      wrap.className = 'resume-autofill-completion__table-wrap';
      const table = document.createElement('table');
      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (const heading of ['字段', '映射 / 目标', '页面回读', '判定阶段', '原因']) {
        const cell = document.createElement('th');
        cell.textContent = heading;
        headRow.appendChild(cell);
      }
      head.appendChild(headRow);
      const body = document.createElement('tbody');
      for (const item of items) {
        const row = document.createElement('tr');
        const values = [
          item.field,
          `${item.key !== '—' ? `${item.key}\n` : ''}${item.target}`,
          item.observed,
          item.stage,
          item.reason
        ];
        for (const value of values) {
          const cell = document.createElement('td');
          cell.textContent = value || '—';
          row.appendChild(cell);
        }
        body.appendChild(row);
      }
      table.append(head, body);
      wrap.appendChild(table);
      details.append(detailsSummary, wrap);
      panel.appendChild(details);
      return true;
    };

    const slowItems = (stats.slowFields || []).map((item) =>
      `${item.field} → ${item.key}：${(item.ms / 1000).toFixed(2)} 秒${item.ok ? '' : '（失败）'}`
    );
    const actions = document.createElement('div');
    actions.className = 'resume-autofill-completion__actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'resume-autofill-completion__action';
    copy.textContent = '复制本次诊断';
    copy.addEventListener('click', async () => {
      const report = {
        page: location.href,
        summary: {
          filled: stats.filled,
          sectionsAdded: stats.sectionsAdded,
          existing: stats.existing,
          unmatched: stats.unmatched,
          missingData: stats.missingData,
          unsupported: stats.unsupported,
          ignored: stats.ignored || 0,
          totalSeconds: Number((stats.timings.totalMs / 1000).toFixed(1))
        },
        details: stats.details,
        diagnostics: stats.diagnostics,
        slowFields: stats.slowFields,
        timings: stats.timings,
        sectionPlan: stats.sectionPlan,
        interactionWarnings: stats.interactionWarnings
      };
      try {
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        copy.textContent = '已复制';
      } catch {
        copy.textContent = '复制失败';
      }
    });
    actions.appendChild(copy);

    panel.append(header, summary, issues, legend, timing, explanation);
    if (!appendDiagnosticTable('红色：处理失败', stats.diagnostics.unsupported, 'unsupported', true)) appendDetails('实际处理失败', stats.details.unsupported);
    if (!appendDiagnosticTable('黄色：本地资料缺失', stats.diagnostics.missingData, 'missing')) appendDetails('本地资料缺失', stats.details.missingData);
    if (!appendDiagnosticTable('紫色：页面字段未映射', stats.diagnostics.unmatched, 'unmatched')) appendDetails('资料字段未映射', stats.details.unmatched);
    if (!appendDiagnosticTable('蓝色：页面已有明确值', stats.diagnostics.existing, 'existing')) appendDetails('页面已有明确值', stats.details.existing);
    appendDetails('有意忽略', stats.details.ignored);
    appendDetails('最慢字段', slowItems);
    panel.appendChild(actions);
    document.documentElement.appendChild(panel);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function isResumeUpload(element) {
    if (element.type !== 'file') return false;
    const nearby = cleanText(element.parentElement?.textContent);
    const text = `${labelText(element)} ${nearby}`.slice(0, 500);
    if (/头像|照片|证件|身份证|作品|portfolio|cover\s*letter|求职信|attachment|其他附件/i.test(text)) return false;
    return /简历|个人履历|resume|curriculum\s*vitae|\bcv\b/i.test(text);
  }

  function describeResumeUpload(element) {
    const root = resumeUploadRoot(element);
    const text = cleanText(`${labelText(element)} ${root?.textContent || ''}`).slice(0, 600);
    const parsesResume = /快速解析|帮你.*解析|智能解析|解析简历|简历解析|parse/i.test(text);
    const attachmentOnly = /简历附件|附件上传|上传文件/i.test(text) && !parsesResume;
    return {
      element,
      root,
      text,
      kind: parsesResume ? 'parse' : attachmentOnly ? 'attachment' : 'resume',
      score: parsesResume ? 100 : attachmentOnly ? 20 : 50
    };
  }

  async function findResumeUploadTargets(timeout = 1800) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const targets = [...document.querySelectorAll('input[type="file"]')].filter(isResumeUpload).map(describeResumeUpload);
      if (targets.length) return targets.sort((left, right) => right.score - left.score);
      await wait(120);
    }
    return [...document.querySelectorAll('input[type="file"]')].filter(isResumeUpload).map(describeResumeUpload).sort((left, right) => right.score - left.score);
  }

  function resumeUploadRoot(element) {
    let best = element.parentElement || element;
    for (let ancestor = element.parentElement, depth = 0; ancestor && depth < 5; ancestor = ancestor.parentElement, depth += 1) {
      const text = cleanText(ancestor.textContent).slice(0, 800);
      const fileInputs = ancestor.querySelectorAll('input[type="file"]').length;
      if (fileInputs === 1 && /上传简历|简历上传|拖拽.*简历|resume\s*upload|upload\s*(?:resume|cv)/i.test(text)) best = ancestor;
      if (text.length > 700 || fileInputs > 2) break;
    }
    return best;
  }

  function uploadResume(element, storedFile, overwrite) {
    if (!storedFile?.base64 || (!overwrite && element.files?.length)) return null;
    try {
      const file = new File([base64ToBytes(storedFile.base64)], storedFile.name, {
        type: storedFile.type || 'application/octet-stream',
        lastModified: storedFile.lastModified || Date.now()
      });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
      setter ? setter.call(element, transfer.files) : (element.files = transfer.files);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return element.files?.length === 1 ? { file, transfer } : null;
    } catch {
      return null;
    }
  }

  function dispatchResumeDrop(root, transfer) {
    if (!(root instanceof Element) || !transfer) return false;
    try {
      for (const type of ['dragenter', 'dragover', 'drop']) {
        let event;
        try {
          event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer });
        } catch {
          event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'dataTransfer', { configurable: true, value: transfer });
        }
        root.dispatchEvent(event);
      }
      return true;
    } catch {
      return false;
    }
  }

  function resumeUploadSuccessText(storedFile) {
    const fileStem = cleanText(storedFile?.name).replace(/\.[^.]+$/, '').slice(0, 40);
    const successPattern = /(?:简历|文件).{0,20}(?:上传成功|解析成功|解析完成|已上传|已解析)|(?:上传成功|解析成功|解析完成).{0,20}(?:简历|文件)|重新上传|删除简历/i;
    return [...document.querySelectorAll('body *')].some((node) => {
      if (!(node instanceof HTMLElement) || !visible(node) || node.children.length > 4) return false;
      const text = cleanText(node.textContent).slice(0, 160);
      return Boolean(text && (successPattern.test(text) || (fileStem.length >= 3 && text.includes(fileStem))));
    });
  }

  function resumeParsingBusy() {
    const pattern = /(?:简历|文件).{0,12}(?:上传中|解析中|识别中|处理中)|(?:uploading|parsing|processing).{0,12}(?:resume|cv)?/i;
    return [...document.querySelectorAll('body *')].some((node) => {
      if (!(node instanceof HTMLElement) || !visible(node) || node.children.length > 3) return false;
      const text = cleanText(node.textContent).slice(0, 100);
      return Boolean(text && pattern.test(text));
    });
  }

  async function waitForResumeParsing(storedFile, activity, timeout = 30000) {
    const started = Date.now();
    let lastStructuralChange = Date.now();
    let structuralChanges = 0;
    let busyObserved = false;
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'childList' || mutation.type === 'characterData')) {
        lastStructuralChange = Date.now();
        structuralChanges += 1;
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    try {
      await wait(600);
      while (Date.now() - started < timeout) {
        const busy = resumeParsingBusy();
        busyObserved ||= busy;
        const quietFor = Date.now() - lastStructuralChange;
        const formControlsIncreased = document.querySelectorAll('input,textarea,select,[contenteditable="true"],[role="combobox"]').length > activity.beforeControlCount;
        const sawParserActivity = structuralChanges > 0 || activity.relevantCount > 0 || formControlsIncreased;
        const accepted = resumeUploadSuccessText(storedFile) || busyObserved || activity.relevantCount > 0 || formControlsIncreased;
        const conservativeFallbackElapsed = Date.now() - started >= 5000;
        if (!busy && quietFor >= 900 && accepted && (sawParserActivity || conservativeFallbackElapsed)) {
          return { completed: true, accepted: true, waitedMs: Date.now() - started, structuralChanges, busyObserved };
        }
        await wait(180);
      }
      const formControlsIncreased = document.querySelectorAll('input,textarea,select,[contenteditable="true"],[role="combobox"]').length > activity.beforeControlCount;
      return { completed: false, accepted: resumeUploadSuccessText(storedFile) || busyObserved || activity.relevantCount > 0 || formControlsIncreased, waitedMs: Date.now() - started, structuralChanges, busyObserved };
    } finally {
      observer.disconnect();
    }
  }

  async function uploadResumeAndWait(element, storedFile, overwrite) {
    const uploadRoot = resumeUploadRoot(element);
    const activity = {
      count: 0,
      relevantCount: 0,
      beforeControlCount: document.querySelectorAll('input,textarea,select,[contenteditable="true"],[role="combobox"]').length
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (!['childList', 'characterData', 'attributes'].includes(mutation.type)) continue;
        activity.count += 1;
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (target && uploadRoot && (uploadRoot.contains(target) || target.contains(uploadRoot))) activity.relevantCount += 1;
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'aria-busy', 'disabled'] });
    try {
      const injected = uploadResume(element, storedFile, overwrite);
      if (!injected) return { injected: false, accepted: false, completed: false, waitedMs: 0, dropFallback: false };
      await wait(1200);
      const earlyAccepted = resumeUploadSuccessText(storedFile) || resumeParsingBusy()
        || activity.relevantCount > 0
        || document.querySelectorAll('input,textarea,select,[contenteditable="true"],[role="combobox"]').length > activity.beforeControlCount;
      const dropFallback = !earlyAccepted && dispatchResumeDrop(uploadRoot, injected.transfer);
      const result = await waitForResumeParsing(storedFile, activity);
      if (result.accepted) element.classList.add(FILLED_CLASS);
      else element.classList.add(FAILED_CLASS);
      return { injected: true, dropFallback, ...result };
    } finally {
      observer.disconnect();
    }
  }

  const REPEATED_SECTION_CONFIG = {
    education: {
      label: '教育经历',
      profileKey: 'educationEntries',
      anchorKey: 'school',
      // 真实网站往往只写“学校”或“院校”，不一定带“名称”。
      anchor: /学校(?:名称)?|院校(?:名称)?|毕业(?:学校|院校)|就读(?:学校|院校)|university(?:\s*name)?|school\s*name/i,
      // 不使用过宽的单词“学习”，避免和基本信息中的学习形式串台。
      kind: /教育(?:经历|背景|信息)?|学历(?:经历|背景|信息)?|学习经历|院校经历|education|academic(?:\s*background)?/i,
      addPattern: /(?:添加|新增|继续添加|增加|新建|再添).{0,16}(?:教育|学历|学习经历|院校经历)|(?:教育|学历|学习经历|院校经历).{0,16}(?:添加|新增|继续添加|增加|新建|再添)|add.{0,24}(?:education|academic)/i,
      // React/Vue 表单常用 education[0].school、education.1.school 等路径。
      // 按索引计数可避免把“最高学历/毕业院校”这类基本信息误算成教育段。
      indexPattern: /(?:^|[^a-z])(?:educations?|education(?:entries|experiences?|backgrounds?|histories?)?|educational(?:backgrounds?|experiences?)|academic(?:backgrounds?|experiences?|histories?)|school(?:experiences?|histories?))\s*(?:\[|\(|\.|_|-)?\s*(\d+)(?:\]|\)|\.|_|-|$)/i
    },
    work: {
      label: '工作/实习经历',
      profileKey: 'workEntries',
      anchorKey: 'company',
      anchor: /公司名称|单位名称|雇主|employer|company\s*name/i,
      kind: /实习|工作|任职|职业|社会实践|实践经历|employment|intern(?:ship)?|work\s*experience/i
    },
    project: {
      label: '项目经历',
      profileKey: 'projectEntries',
      anchorKey: 'projectName',
      anchor: /项目名称|课题名称|project\s*name/i,
      kind: /项目|科研|课题|project|research/i
    },
    certificate: {
      label: '证书/奖项',
      profileKey: 'certificateEntries',
      anchorKey: 'certificateName',
      anchor: /证书名称|技能证书|资格证书|奖项名称|荣誉名称|资质名称|certificate\s*(?:name|title)|award\s*(?:name|title)|honou?r\s*(?:name|title)/i,
      kind: /证书|技能证书|资格|奖项|奖励|荣誉|资质|certificate|qualification|award|honou?r/i
    },
    language: {
      label: '语言经历',
      profileKey: 'languageEntries',
      anchorKey: 'languageName',
      anchor: /语言名称|语言类型|外语语种|语种|language\s*(?:name|type)?/i,
      kind: /语言|外语|语种|language/i
    },
    family: {
      label: '家庭成员/联系人',
      profileKey: 'familyEntries',
      anchorKey: 'familyName',
      anchor: /家庭成员.*姓名|亲属.*姓名|紧急联系人.*姓名|联系人姓名|成员姓名|family.*name|contact.*name/i,
      kind: /家庭|亲属|父母|紧急联系人|联系人|family|relative|emergency\s*contact/i
    }
  };

  const ADD_ACTION_PATTERN = /添加|新增|继续添加|增加|新建|再添|add|create|new|\+/i;
  const ADD_NEGATIVE_PATTERN = /删除|移除|编辑|保存|取消|提交|上传|delete|remove|edit|save|submit|upload/i;

  function nearbyKindTexts(button) {
    const pieces = [];
    const add = (value) => {
      const text = cleanText(value);
      if (text && text.length <= 120 && !pieces.includes(text)) pieces.push(text);
    };
    add(button.getAttribute('aria-label'));
    add(button.getAttribute('title'));
    add(button.textContent);

    let branch = button;
    for (let depth = 0; branch?.parentElement && depth < 10; depth += 1) {
      const ancestor = branch.parentElement;
      const children = [...ancestor.children];
      const branchIndex = children.indexOf(branch);

      // 同行标题、按钮前面的区块标题和包裹层中的标题语义。
      children.forEach((child, index) => {
        if (child === branch || child.contains(button)) return;
        if (child.matches('button,a,[role="button"]') || child.querySelector('input,textarea,select,[contenteditable="true"]')) return;
        const text = cleanText(child.textContent);
        if (text.length <= 80 && (index <= branchIndex || children.length <= 4)) add(text);
      });
      [...ancestor.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,[role="heading"],[class*="title"],[class*="Title"],[class*="heading"]')]
        .filter((node) => !node.contains(button) && !button.contains(node))
        .slice(0, 10)
        .forEach((node) => add(node.textContent));

      // 小型结构区可以安全使用整体文字；大型表单不能，否则会把多个“添加”串台。
      const controls = controlNodes(ancestor).length;
      const actions = ancestor.querySelectorAll('button,a,[role="button"]').length;
      const whole = cleanText(ancestor.textContent);
      if (whole.length <= 180 && controls <= 8 && actions <= 4) add(whole);
      branch = ancestor;
    }

    // 最后按空间关系寻找按钮上方或同行的短标题，解决标题和按钮被不同包装层隔开的页面。
    const rect = button.getBoundingClientRect();
    [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,label,strong,span,p,[role="heading"]')]
      .filter((node) => node !== button && visible(node) && !node.contains(button) && !button.contains(node))
      .filter((node) => {
        const text = cleanText(node.textContent);
        if (!text || text.length > 60 || ADD_ACTION_PATTERN.test(text)) return false;
        if (!Object.values(REPEATED_SECTION_CONFIG).some((config) => config.kind.test(text))) return false;
        const candidate = node.getBoundingClientRect();
        const vertical = rect.top - candidate.bottom;
        const sameRow = Math.abs((candidate.top + candidate.bottom) / 2 - (rect.top + rect.bottom) / 2) <= 50;
        const overlaps = candidate.right >= rect.left - 500 && candidate.left <= rect.right + 160;
        return overlaps && (sameRow || (vertical >= -20 && vertical <= 220));
      })
      .sort((left, right) => Math.abs(rect.top - left.getBoundingClientRect().bottom) - Math.abs(rect.top - right.getBoundingClientRect().bottom))
      .slice(0, 5)
      .forEach((node) => add(node.textContent));
    return pieces;
  }

  function repeatedButtonKindScore(button, kind) {
    const config = REPEATED_SECTION_CONFIG[kind];
    if (!config) return 0;
    const own = interactiveDescription(button);
    if (!ADD_ACTION_PATTERN.test(own) || ADD_NEGATIVE_PATTERN.test(own)) return 0;
    const evidence = nearbyKindTexts(button);
    // “添加教育经历”这类明确自述文本必须压过附近其他区块的模糊文字。
    let score = config.addPattern?.test(own) ? 30 : (config.kind.test(own) ? 12 : 0);
    evidence.forEach((text, index) => {
      if (config.addPattern?.test(text)) score = Math.max(score, 24 - Math.min(index, 4));
      if (config.kind.test(text)) score = Math.max(score, 10 - Math.min(index, 6));
      if (config.anchor.test(text)) score = Math.max(score, 8 - Math.min(index, 4));
    });
    // 标题缺失时，用按钮与该类经历强字段的空间邻近关系补充证据。
    // 例如按钮只有一个“+”图标，但它紧邻“公司名称”输入框，仍可判定为工作经历入口。
    const buttonRect = button.getBoundingClientRect();
    for (const control of controlNodes(document)) {
      if (!visible(control)) continue;
      const text = labelText(control);
      const context = sectionContext(control);
      if (matchKey(text, context) !== config.anchorKey && !config.anchor.test(text)) continue;
      const rect = control.getBoundingClientRect();
      const vertical = Math.min(Math.abs(buttonRect.top - rect.bottom), Math.abs(rect.top - buttonRect.bottom));
      const horizontal = Math.max(0, Math.max(rect.left - buttonRect.right, buttonRect.left - rect.right));
      if (vertical <= 420 && horizontal <= 700) {
        score = Math.max(score, context === kind ? 9 : 7);
        break;
      }
    }
    if (button.matches('button,a,[role="button"]')) score += 2;
    else if (interactionHint(button)) score += 1;
    return score;
  }

  function resolvedRepeatedButtonKind(button) {
    const ranked = Object.keys(REPEATED_SECTION_CONFIG)
      .map((kind) => ({ kind, score: repeatedButtonKindScore(button, kind) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);
    if (!ranked.length) return '';
    if (ranked[1]?.score === ranked[0].score) {
      const own = cleanText(`${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.textContent}`);
      const explicit = ranked.filter(({ kind }) => REPEATED_SECTION_CONFIG[kind].kind.test(own));
      return explicit.length === 1 ? explicit[0].kind : '';
    }
    return ranked[0].kind;
  }

  function indexedRepeatedSectionSignatures(kind) {
    const config = REPEATED_SECTION_CONFIG[kind];
    if (!config?.indexPattern) return new Set();
    const signatures = new Set();
    const attributes = ['data-cy', 'data-testid', 'data-field', 'data-name', 'name', 'id'];
    const nodes = document.querySelectorAll('[data-cy],[data-testid],[data-field],[data-name],[name],[id]');
    for (const node of nodes) {
      if (!(node instanceof Element) || !node.isConnected || !visible(node)) continue;
      for (const attribute of attributes) {
        const value = node.getAttribute(attribute);
        if (!value) continue;
        const match = value.match(config.indexPattern);
        if (match) {
          signatures.add(`${kind}:${Number(match[1])}`);
          break;
        }
      }
    }
    return signatures;
  }

  function repeatedAnchorControls(kind) {
    const config = REPEATED_SECTION_CONFIG[kind];
    if (!config) return [];
    const controls = [...document.querySelectorAll('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[role="combobox"]')];
    return controls.filter((control) => {
      if (!control.isConnected || !visible(control)) return false;
      const label = labelText(control);
      const context = sectionContext(control);
      if (matchKey(label, context) !== config.anchorKey) return false;
      // 区块语义是最稳定的证据；标题缺失时才退回到强字段锚点。
      // 教育的退回路径排除“最高学历毕业院校”等顶层概要字段。
      if (context === kind) return true;
      if (context && context !== kind) return false;
      if (!config.anchor.test(label)) return false;
      if (kind === 'education' && /最高学历|最高学位|基本信息|个人信息/i.test(label)) return false;
      return true;
    });
  }

  function repeatedSectionCount(kind) {
    if (!REPEATED_SECTION_CONFIG[kind]) return 0;
    // 教育经历优先按数组路径中的唯一索引计数。一段内有学校、学历、日期多个字段，
    // 但 education[1] 只计一次；也能在新段尚未填写时立即观察到 DOM 增长。
    const indexed = indexedRepeatedSectionSignatures(kind);
    if (indexed.size) return indexed.size;
    return repeatedAnchorControls(kind).length;
  }

  function nearbySectionText(button) {
    let ancestor = button.parentElement;
    const buttonText = cleanText(button.textContent);
    for (let depth = 0; ancestor && depth < 7; ancestor = ancestor.parentElement, depth += 1) {
      const heading = ancestor.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > [role="heading"],:scope > [class*="title"],:scope > [class*="Title"],:scope > [class*="heading"]');
      const text = cleanText(heading?.textContent);
      if (text && text.length <= 80) return text;

      // 一些组件把区块名放在按钮同一行的普通 span/div 中，例如“技能证书 [添加]”。
      // 读取最近结构行内不包含按钮、控件和其他操作按钮的兄弟文字，不依赖随机 class。
      const siblingText = [...ancestor.children]
        .filter((child) => !child.contains(button) && !button.contains(child) && visible(child))
        .filter((child) => !child.matches('button,a,[role="button"]') && !child.querySelector('button,a,[role="button"],input,textarea,select,[contenteditable="true"]'))
        .map((child) => cleanText(child.textContent))
        .filter((value) => value && value !== buttonText && value.length <= 80)
        .join(' ')
        .slice(0, 160);
      if (siblingText) return siblingText;
    }
    return '';
  }

  function findRepeatedSectionAddButton(kind) {
    const nativeCandidates = [...document.querySelectorAll('button,[role="button"],[role="menuitem"],a,[tabindex],[onclick],[aria-label],[title],[data-action],[data-testid]')]
      .filter((node) => {
        const text = interactiveDescription(node);
        return visible(node) && ADD_ACTION_PATTERN.test(text) && !ADD_NEGATIVE_PATTERN.test(text);
      });
    // 许多 React 页面把“添加经历”实现为普通 div/span 并在祖先上注册事件。
    // 按短文本语义寻找，而不是依赖会随构建变化的 class 名。
    const semanticCandidates = [...document.querySelectorAll('div,span,p,strong,li,i,svg')]
      .filter((node) => {
        if (!(node instanceof Element) || !visible(node)) return false;
        // 原生交互元素及其文字子节点已由 nativeCandidates 处理；结构行只用于提供上下文，
        // 不能反过来抢占真正的按钮成为坐标点击目标。
        if (node.closest('button,a,[role="button"],[role="menuitem"]') || node.querySelector('button,a,[role="button"],[role="menuitem"]')) return false;
        const text = interactiveDescription(node).slice(0, 100);
        if (!text || text.length > 60 || !ADD_ACTION_PATTERN.test(text)) return false;
        if (!resolvedRepeatedButtonKind(node)) return false;
        return !node.querySelector('input,textarea,select,[contenteditable="true"]');
      });
    const candidates = [...new Set([...nativeCandidates, ...semanticCandidates])];

    function clickableTarget(candidate) {
      let node = candidate;
      for (let depth = 0; node instanceof Element && depth < 6; depth += 1, node = node.parentElement) {
        const text = cleanText(node.textContent);
        const native = node.matches('button,a,[role="button"],[role="menuitem"]');
        const eventHint = typeof node.onclick === 'function' || node.hasAttribute('tabindex');
        const pointer = getComputedStyle(node).cursor === 'pointer';
        if (native || eventHint || pointer) return node;
        if (text.length > 160) break;
      }
      // React 委托事件会从文字节点冒泡到真正的 div 处理器，子元素本身也可作为坐标目标。
      return candidate;
    }

    return candidates
      .filter((candidate) => candidate instanceof Element && visible(candidate) && !candidate.disabled && candidate.getAttribute('aria-disabled') !== 'true')
      .map((candidate) => {
        const button = clickableTarget(candidate);
        return { button, score: resolvedRepeatedButtonKind(button) === kind ? repeatedButtonKindScore(button, kind) : 0 };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.button || null;
  }

  async function waitForRepeatedSectionCount(kind, before, timeout = 600) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const count = repeatedSectionCount(kind);
      if (count > before) return count;
      await wait(40);
    }
    return repeatedSectionCount(kind);
  }

  async function ensureRepeatedSections(profile, stats) {
    for (const [kind, config] of Object.entries(REPEATED_SECTION_CONFIG)) {
      const entries = (profile[config.profileKey] || []).filter((entry) => entry && Object.values(entry).some((value) => String(value || '').trim()));
      // 资料中有几段，就以几段为目标；不使用固定段数或固定上限。
      // 每次点击仍必须观察到强字段锚点增加，否则立即停止，避免错误按钮导致循环点击。
      const desired = entries.length;
      let current = repeatedSectionCount(kind);
      if (!desired) continue;
      const plan = {
        kind,
        label: config.label,
        desired,
        existing: current,
        needed: Math.max(0, desired - current),
        added: 0,
        final: current
      };
      stats.sectionPlan.push(plan);
      while (current < desired) {
        const button = findRepeatedSectionAddButton(kind);
        if (!button) {
          plan.skipped = desired - current;
          stats.ignored += 1;
          if (stats.details.ignored.length < 8) {
            stats.details.ignored.push(`${config.label}：页面未提供或未识别到可安全归类的新增入口；跳过新增 ${desired - current} 段`);
          }
          break;
        }
        activateOption(button);
        let next = await waitForRepeatedSectionCount(kind, current);
        if (next <= current && button.isConnected) {
          const trusted = await trustedClick(button);
          if (trusted?.ok) next = await waitForRepeatedSectionCount(kind, current, 1400);
        }
        if (next <= current) {
          stats.sectionAddFailed += desired - current;
          stats.unsupported += 1;
          button.classList.add(FAILED_CLASS);
          if (stats.details.unsupported.length < 8) stats.details.unsupported.push(`${kind} 的“添加经历”按钮已点击，但没有观察到新的经历表单`);
          recordDiagnostic(stats, 'unsupported', {
            field: config.label, key: config.profileKey, target: `${desired} 段`, observed: `${current} 段`,
            stage: '添加按钮点击后 DOM 增长验证',
            reason: '已尝试 DOM 点击和浏览器级点击，但没有观察到新的数组索引或强字段锚点'
          });
          break;
        }
        stats.sectionsAdded += next - current;
        plan.added += next - current;
        current = next;
        plan.final = current;
        await wait(40);
      }
      plan.final = current;
    }
  }

  function clearMarks() {
    document.querySelectorAll(`.${FILLED_CLASS}, .${UNMATCHED_CLASS}, .${MISSING_CLASS}, .${FAILED_CLASS}, .${EXISTING_CLASS}, .${IGNORED_CLASS}`).forEach((element) => {
      element.classList.remove(FILLED_CLASS, UNMATCHED_CLASS, MISSING_CLASS, FAILED_CLASS, EXISTING_CLASS, IGNORED_CLASS);
    });
    document.querySelector('.resume-autofill-toast')?.remove();
    document.querySelector('.resume-autofill-completion')?.remove();
    document.querySelector('.resume-autofill-audit')?.remove();
    document.querySelectorAll('.resume-autofill-audit-target').forEach((element) => element.classList.remove('resume-autofill-audit-target'));
    clearAuditAnnotations();
  }

  function clearAuditAnnotations() {
    const classes = [
      'resume-autofill-audit-mark--free-entry', 'resume-autofill-audit-mark--type-then-select',
      'resume-autofill-audit-mark--select-only', 'resume-autofill-audit-mark--date', 'resume-autofill-audit-mark--file-upload',
      'resume-autofill-audit-mark--add-action', 'resume-autofill-audit-mark--understood-unsupported',
      'resume-autofill-audit-mark--not-understood', 'resume-autofill-audit-mark--safe-ignored',
      'resume-autofill-audit-status--understood-unsupported', 'resume-autofill-audit-status--not-understood',
      'resume-autofill-audit-status--safe-ignored'
    ];
    document.querySelectorAll('[data-resume-autofill-audit-ref]').forEach((element) => {
      element.classList.remove(...classes);
      delete element.dataset.resumeAutofillAuditRef;
    });
  }

  function classSummary(element) {
    return String(element?.className || '').split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
  }

  function auditOwnText(element) {
    const labelledBy = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent || '').join(' ');
    const labels = element.labels ? [...element.labels].map((label) => label.textContent || '').join(' ') : '';
    return cleanText([
      labels, labelledBy, element.getAttribute('aria-label'), element.getAttribute('title'),
      element.getAttribute('placeholder'), element.getAttribute('name'), element.id
    ].filter(Boolean).join(' '));
  }

  function auditWidgetSemantics(element) {
    const root = element.closest('.phoenix-select,[class*="date-picker"],[class*="DatePicker"],[class*="calendar"],[class*="Calendar"]')
      || customSelectTrigger(element) || element;
    const evidence = [String(root.className || ''), root.id || ''];
    for (const node of root.querySelectorAll('svg [id], svg use, svg title, [data-icon], [class*="date"], [class*="Date"], [class*="calendar"], [class*="Calendar"]')) {
      evidence.push(
        node.id || '', String(node.className?.baseVal || node.className || ''), node.textContent || '',
        node.getAttribute('href') || '', node.getAttribute('xlink:href') || '', node.getAttribute('data-icon') || ''
      );
      if (evidence.length >= 50) break;
    }
    return cleanText(evidence.filter(Boolean).join(' '));
  }

  function auditControlKind(element, inferredText = '', matchedKey = '') {
    const type = String(element.type || '').toLowerCase();
    const role = element.getAttribute('role') || '';
    const ownText = auditOwnText(element);
    const widgetSemantics = auditWidgetSemantics(element);
    const logicalDateWidget = element.matches('.atsx-date-picker-period-month,[class*="date-picker-period"]');
    const fieldMatchedAsDate = Boolean(matchedKey && (/Date$|Date\b/.test(matchedKey) || DATE_RANGE_KINDS[matchedKey]));
    if (type === 'file') return 'file-upload';
    if (type === 'radio' || role === 'radio') return 'radio';
    if (type === 'checkbox' || role === 'checkbox' || role === 'switch') return role === 'switch' ? 'switch' : 'checkbox';
    if (element instanceof HTMLSelectElement) return 'native-select';
    if (type === 'date' || type === 'month') return 'native-date';
    if ((fieldMatchedAsDate || /日期|时间|年月|年\s*\/\s*月|date|calendar|yyyy|mm|dd|time[_-]?picker/i.test(`${ownText} ${widgetSemantics}`))
      && (element.matches('input,[role="combobox"]') || element.readOnly || logicalDateWidget)) return 'date-trigger';
    if (element.matches('[role="combobox"]') || element.getAttribute('aria-haspopup') === 'listbox'
      || (element.matches('input,textarea') && customSelectTrigger(element))) {
      return element.getAttribute('aria-autocomplete') || (!element.readOnly && AUTOCOMPLETE_KEYS.has(matchKey(inferredText, sectionContext(element))))
        ? 'autocomplete' : 'custom-select';
    }
    if (element.matches('textarea,[contenteditable="true"],[role="textbox"]')) return 'free-text';
    if (element instanceof HTMLInputElement) return 'free-text';
    if (ADD_ACTION_PATTERN.test(interactiveDescription(element)) && !ADD_NEGATIVE_PATTERN.test(interactiveDescription(element))) return 'add-action';
    if (element.matches('button,[role="button"],[role="menuitem"],summary')) return 'button';
    if (element.matches('a,[role="link"]')) return 'link';
    return 'custom-interactive';
  }

  function auditDateShape(element, matchedKey, controlKind) {
    if (!['native-date', 'date-trigger'].includes(controlKind)) return { precision: '', mechanism: '' };
    const type = String(element.type || '').toLowerCase();
    const ownText = `${auditOwnText(element)} ${auditWidgetSemantics(element)}`;
    const atsxPeriodMonth = element.matches('.atsx-date-picker-period-month,[class*="date-picker-period-month"]');
    const range = element.matches('input') ? structuralDateRange(element) : null;
    const container = semanticContainer(element);
    const nearbyDateControls = container
      ? controlNodes(container).filter((node) => datePart(node) || ['date', 'month'].includes(String(node.type || '').toLowerCase())
        || /年|月|日|year|month|day/i.test(auditOwnText(node)))
      : [];
    const parts = range?.controls?.length ? range.controls.length / 2 : nearbyDateControls.length;
    const explicitDay = type === 'date' || parts === 3 || /日|day|dd|yyyy\W*mm\W*dd/i.test(ownText);
    const explicitMonth = type === 'month' || parts === 2 || /月|month|mm|yyyy\W*mm/i.test(ownText);
    const precision = atsxPeriodMonth ? 'year-month' : explicitDay ? 'year-month-day' : explicitMonth ? 'year-month' : 'unknown-date';
    let mechanism = 'custom-calendar-or-list';
    if (atsxPeriodMonth) mechanism = 'period-month-two-end-lists';
    else if (type === 'date' || type === 'month') mechanism = 'browser-native-picker';
    else if (parts >= 2) mechanism = parts >= 3 ? 'separate-year-month-day-lists' : 'separate-year-month-lists';
    else if (customSelectTrigger(element)) mechanism = 'dropdown-or-calendar-panel';
    else if (!element.readOnly) mechanism = 'free-date-text';
    return { precision, mechanism };
  }

  function auditFieldCapability(element, matchedKey, controlKind, repeatedKind) {
    const hadFillFailure = Boolean(fillFailureReasons.get(element));
    const supportedKinds = new Set([
      'free-text', 'autocomplete', 'native-select', 'custom-select', 'native-date', 'date-trigger',
      'radio', 'checkbox', 'switch', 'file-upload'
    ]);
    if (repeatedKind) return { capability: 'understood-supported', reason: '' };
    if (hadFillFailure) return { capability: 'understood-unsupported', reason: '此前填写尝试失败；具体资料值和失败原文不写入审计报告' };
    if (supportedKinds.has(controlKind)) return { capability: 'understood-supported', reason: '' };
    if (controlKind === 'add-action') {
      return { capability: 'understood-unsupported', reason: '已识别为添加按钮，但没有确定它要新增哪一类区块，暂不自动点击' };
    }
    return { capability: 'not-understood', reason: `发现了可交互元素，但暂时没有 ${controlKind} 的安全操作规则` };
  }

  function auditInputMode(controlKind) {
    if (controlKind === 'free-text') return 'free-entry';
    if (controlKind === 'autocomplete') return 'type-then-select';
    if (['native-select', 'custom-select', 'radio', 'checkbox', 'switch'].includes(controlKind)) return 'select-only';
    if (['native-date', 'date-trigger'].includes(controlKind)) return 'date';
    if (controlKind === 'file-upload') return 'file-upload';
    if (controlKind === 'add-action') return 'add-action';
    return 'other-action';
  }

  function auditVisualTarget(element) {
    const phoenixSelect = element.closest('.phoenix-select');
    if (phoenixSelect instanceof Element && phoenixSelect.isConnected) return phoenixSelect;
    const trigger = customSelectTrigger(element);
    if (trigger instanceof Element && trigger.isConnected) return trigger;
    return element;
  }

  function auditMarkKind(item) {
    if (item.inputMode && item.inputMode !== 'other-action') return item.inputMode;
    if (['understood-unsupported', 'not-understood', 'safe-ignored'].includes(item.capability)) return item.capability;
    return item.inputMode || 'other-action';
  }

  function auditRequirement(element) {
    if (element.required || element.getAttribute('aria-required') === 'true') return 'required';
    const ownText = auditOwnText(element);
    const nearbyLabel = element.closest('label')?.textContent || element.parentElement?.querySelector(':scope > label')?.textContent || '';
    if (/(?:^|\s)[*＊]|必填|required/i.test(`${ownText} ${nearbyLabel}`)) return 'required';
    return 'not-marked-required';
  }

  function auditDomPath(element) {
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

  function auditElementRecord(element, index) {
    const visualTarget = auditVisualTarget(element);
    const semanticField = element.matches('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"],[role="radio"],[role="checkbox"],[role="switch"]');
    const logicalDateWidget = element.matches('.atsx-date-picker-period-month,[class*="date-picker-period"]');
    const selectTrigger = customSelectTrigger(element);
    const fieldLike = semanticField || logicalDateWidget || Boolean(selectTrigger && (selectTrigger === element || element.contains(selectTrigger)));
    const inferredText = fieldLike ? labelText(element) : interactiveDescription(element);
    const context = fieldLike ? sectionContext(element) : '';
    const matchedKey = fieldLike ? matchKey(inferredText, context) : '';
    const controlKind = auditControlKind(element, inferredText, matchedKey);
    const description = interactiveDescription(element);
    const repeatedKind = controlKind === 'add-action' ? resolvedRepeatedButtonKind(element) : '';
    const dangerous = /提交|投递|删除|移除|保存|登录|授权|同意|下一步|submit|apply|delete|remove|save|login|authori[sz]e|next/i.test(description);
    const ignored = Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'
      || (fieldLike && inferredText && ignoredText.test(inferredText)));
    const capabilityResult = ignored || dangerous
      ? { capability: 'safe-ignored', reason: dangerous ? '提交、保存、删除等危险操作不会自动执行' : '控件已禁用或属于安全忽略项' }
      : auditFieldCapability(element, matchedKey, controlKind, repeatedKind);
    const inputMode = auditInputMode(controlKind);
    const dateShape = auditDateShape(element, matchedKey, controlKind);
    const requirement = fieldLike ? auditRequirement(element) : '';
    const rect = visualTarget.getBoundingClientRect();
    const ref = `i${index + 1}`;
    auditElementMap.set(ref, visualTarget);
    return {
      ref,
      status: capabilityResult.capability,
      capability: capabilityResult.capability,
      reason: capabilityResult.reason,
      controlKind,
      inputMode,
      datePrecision: dateShape.precision,
      dateMechanism: dateShape.mechanism,
      requirement,
      text: inferredText || description || '(无可读文字)',
      visibleText: cleanText(element.innerText || element.textContent).slice(0, 180),
      matchedKey,
      mappingStatus: matchedKey ? 'mapped' : 'unmapped',
      repeatedKind,
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
      readonly: Boolean(element.readOnly),
      disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
      class: classSummary(visualTarget),
      domPath: auditDomPath(visualTarget),
      sourceDomPath: visualTarget === element ? '' : auditDomPath(element),
      bounds: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  }

  function diagnosePage() {
    document.querySelector('.resume-autofill-audit')?.remove();
    document.querySelectorAll('.resume-autofill-audit-target').forEach((element) => element.classList.remove('resume-autofill-audit-target'));
    clearAuditAnnotations();
    auditElementMap = new Map();
    const allControls = [...document.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="textbox"]')]
      .filter((element, index, list) => list.indexOf(element) === index);
    const controls = allControls
      .slice(0, 600)
      .map((element, index) => {
        const ancestors = [];
        let node = element.parentElement;
        for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
          const explicit = node.querySelector(':scope > label, :scope > legend, :scope > dt, :scope > th, :scope > [class*="label"], :scope > [class*="Label"], :scope > [class*="title"], :scope > [class*="Title"]');
          ancestors.push({
            tag: node.tagName.toLowerCase(),
            class: classSummary(node),
            role: node.getAttribute('role') || '',
            label: explicit?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) || '',
            directText: [...node.childNodes]
              .filter((child) => child.nodeType === Node.TEXT_NODE)
              .map((child) => child.textContent.trim()).filter(Boolean).join(' ').slice(0, 120)
          });
        }
        const text = labelText(element);
        const context = sectionContext(element);
        const matchedKey = matchKey(text, context);
        return {
          index,
          tag: element.tagName.toLowerCase(),
          type: element.type || '',
          name: element.name || '',
          id: element.id || '',
          placeholder: element.placeholder || '',
          role: element.getAttribute('role') || '',
          ariaLabel: element.getAttribute('aria-label') || '',
          ariaLabelledby: element.getAttribute('aria-labelledby') || '',
          readonly: Boolean(element.readOnly),
          disabled: Boolean(element.disabled),
          class: classSummary(element),
          inferredText: text,
          context,
          matchedKey,
          controlKind: auditControlKind(element, text, matchedKey),
          visible: visible(element),
          ancestors
        };
      });
    const choiceGroups = customChoiceGroups().map(({ group, container, text, options }, index) => {
      const context = sectionContext(container);
      return {
        index,
        title: cleanText(text),
        context,
        matchedKey: matchKey(cleanText(text).toLowerCase(), context),
        class: classSummary(group),
        options: options.map((option) => ({
          text: cleanText(option.textContent || option.value),
          checked: customChoiceChecked(option),
          class: classSummary(option)
        }))
      };
    });

    const semanticSelector = [
      'input', 'textarea', 'select', '[contenteditable="true"]', 'button', 'a', 'summary',
      '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="combobox"]',
      '[role="radio"]', '[role="checkbox"]', '[role="switch"]', '[role="menuitem"]',
      '[role="option"]', '[role="gridcell"]', '[role="treeitem"]', '[tabindex]', '[onclick]',
      '[aria-haspopup]', '[data-action]', '[data-testid]', '.atsx-date-picker-period-month', '[class*="date-picker-period"]'
    ].join(',');
    const semanticCandidates = [...document.querySelectorAll(semanticSelector)];
    const pointerCandidates = [...document.querySelectorAll('body *')].filter((element) => {
      if (!visible(element) || element.closest('.resume-autofill-completion,.resume-autofill-audit')) return false;
      const text = interactiveDescription(element);
      return text && text.length <= 180 && getComputedStyle(element).cursor === 'pointer';
    });
    const rawInteractive = [...new Set([...semanticCandidates, ...pointerCandidates])]
      .filter((element) => visible(element) && !element.closest('.resume-autofill-completion,.resume-autofill-audit'));
    const seenVisualTargets = new Set();
    const allInteractive = rawInteractive.filter((element) => {
      const visualTarget = auditVisualTarget(element);
      if (seenVisualTargets.has(visualTarget)) return false;
      seenVisualTargets.add(visualTarget);
      return true;
    });
    const auditLimit = 1200;
    const interactiveElements = allInteractive.slice(0, auditLimit).map(auditElementRecord);

    const textCandidates = [...document.querySelectorAll('label,legend,h1,h2,h3,h4,h5,h6,dt,th,[role="heading"],[aria-label]')]
      .filter((element) => visible(element) && !element.closest('.resume-autofill-completion,.resume-autofill-audit'));
    const semanticTexts = textCandidates.slice(0, 600).map((element, index) => {
      const text = cleanText(`${element.getAttribute('aria-label') || ''} ${element.textContent}`).slice(0, 180);
      const ref = `t${index + 1}`;
      auditElementMap.set(ref, element);
      return { ref, text: text || '(无可读文字)', tag: element.tagName.toLowerCase(), role: element.getAttribute('role') || '', class: classSummary(element), domPath: auditDomPath(element) };
    }).filter((item) => item.text !== '(无可读文字)');

    const auditCounts = interactiveElements.reduce((counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      return counts;
    }, {});
    return {
      version: CONTENT_SCRIPT_VERSION,
      page: { host: location.host, pathname: location.pathname, title: document.title },
      counts: {
        controls: allControls.length,
        inputs: document.querySelectorAll('input').length,
        selects: document.querySelectorAll('select').length,
        comboboxes: document.querySelectorAll('[role="combobox"]').length,
        choiceGroups: choiceGroups.length,
        shadowHosts: [...document.querySelectorAll('*')].filter((element) => element.shadowRoot).length,
        interactive: allInteractive.length,
        semanticTexts: textCandidates.length,
        audit: auditCounts
      },
      truncated: { controls: allControls.length > controls.length, interactive: allInteractive.length > auditLimit, semanticTexts: textCandidates.length > semanticTexts.length },
      iframes: [...document.querySelectorAll('iframe')].map((frame) => ({
        title: frame.title || '', name: frame.name || '', srcHost: (() => { try { return new URL(frame.src).host; } catch { return ''; } })()
      })),
      controls,
      choiceGroups,
      interactiveElements,
      semanticTexts
    };
  }

  function showAuditPanel(report) {
    document.querySelector('.resume-autofill-audit')?.remove();
    const panel = document.createElement('aside');
    panel.className = 'resume-autofill-audit';
    const statusLabels = {
      'understood-supported': '已有交互处理器',
      'understood-unsupported': '已识别但当前处理不了',
      'not-understood': '交互方式未适配',
      'safe-ignored': '安全忽略'
    };
    const modeLabels = {
      'free-entry': '自由填写',
      'type-then-select': '可输入，再从列表确认',
      'select-only': '只能从列表选择',
      date: '日期',
      'file-upload': '文件上传',
      'add-action': '添加按钮/添加类别',
      'other-action': '其他按钮或交互'
    };
    const datePrecisionLabels = {
      'year-month': '年月',
      'year-month-day': '年月日',
      'unknown-date': '日期精度待确认'
    };
    const dateMechanismLabels = {
      'browser-native-picker': '浏览器原生日期选择器',
      'separate-year-month-lists': '年/月分列下拉列表',
      'separate-year-month-day-lists': '年/月/日分列下拉列表',
      'period-month-two-end-lists': '起止时间：开始/结束分别选择年月',
      'dropdown-or-calendar-panel': '下拉列表或日历面板',
      'free-date-text': '可直接写入日期文字',
      'custom-calendar-or-list': '自定义日期控件（需打开后确认）'
    };
    const header = document.createElement('div');
    header.className = 'resume-autofill-audit__header';
    const title = document.createElement('div');
    title.innerHTML = `<strong>页面识别审计</strong><small>版本 ${report.version} · 不包含输入值或本地资料</small>`;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', '关闭识别审计');
    close.addEventListener('click', () => {
      panel.remove();
      clearAuditAnnotations();
    });
    header.append(title, close);

    const summary = document.createElement('div');
    summary.className = 'resume-autofill-audit__summary';
    summary.textContent = `发现 ${report.counts.interactive} 个可见交互元素：已有交互处理器 ${report.counts.audit['understood-supported'] || 0}，已识别但当前处理不了 ${report.counts.audit['understood-unsupported'] || 0}，交互方式未适配 ${report.counts.audit['not-understood'] || 0}，安全忽略 ${report.counts.audit['safe-ignored'] || 0}。字段是否映射到本地资料只作为附加信息，不影响控件交互类型判断。`;

    const legend = document.createElement('div');
    legend.className = 'resume-autofill-audit__legend';
    const filterOptions = [
      ['all', '全部'], ['mode:free-entry', '自由填写'], ['mode:type-then-select', '输入后选列表'],
      ['mode:select-only', '只能选择'], ['mode:date', '日期'], ['mode:file-upload', '文件上传'],
      ['mode:add-action', '添加按钮'], ['cap:understood-unsupported', '当前处理不了'],
      ['cap:not-understood', '交互未适配'], ['cap:safe-ignored', '安全忽略']
    ];
    legend.innerHTML = filterOptions.map(([filter, label]) => {
      const [axis, value] = filter.split(':');
      const count = filter === 'all' ? report.interactiveElements.length
        : report.interactiveElements.filter((item) => axis === 'mode' ? item.inputMode === value : item.capability === value).length;
      const cssKind = filter.replace(':', '-');
      return `<button type="button" data-audit-filter="${filter}" class="resume-autofill-audit__legend--${cssKind}${filter === 'all' ? ' is-active' : ''}">${label} ${count}</button>`;
    }).join('');

    const toolbar = document.createElement('div');
    toolbar.className = 'resume-autofill-audit__toolbar';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = '筛选文字、字段、类型、ref…';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = '复制完整诊断';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        copy.textContent = '已复制';
      } catch {
        copy.textContent = '复制失败';
      }
    });
    toolbar.append(search, copy);

    const list = document.createElement('div');
    list.className = 'resume-autofill-audit__list';
    for (const item of report.interactiveElements) {
      const target = auditElementMap.get(item.ref);
      const markKind = auditMarkKind(item);
      if (target instanceof Element && target.isConnected) {
        const supportedMarkKinds = new Set(['free-entry', 'type-then-select', 'select-only', 'date', 'file-upload', 'add-action', 'understood-unsupported', 'not-understood', 'safe-ignored']);
        if (supportedMarkKinds.has(markKind)) target.classList.add(`resume-autofill-audit-mark--${markKind}`);
        if (['understood-unsupported', 'not-understood', 'safe-ignored'].includes(item.capability)) {
          target.classList.add(`resume-autofill-audit-status--${item.capability}`);
        }
        target.dataset.resumeAutofillAuditRef = item.ref;
      }
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `resume-autofill-audit__row resume-autofill-audit__row--${item.status} resume-autofill-audit__row--kind-${markKind}`;
      row.dataset.auditKind = markKind;
      row.dataset.auditMode = item.inputMode;
      row.dataset.auditCapability = item.capability;
      row.dataset.search = `${item.ref} ${item.text} ${item.visibleText} ${item.matchedKey} ${item.mappingStatus} ${item.controlKind} ${item.inputMode} ${item.datePrecision} ${item.dateMechanism} ${item.requirement} ${item.reason} ${item.context} ${statusLabels[item.status]} ${modeLabels[item.inputMode]}`.toLowerCase();
      const mapping = item.matchedKey ? ` → ${item.matchedKey}` : item.repeatedKind ? ` → 添加 ${item.repeatedKind}` : '';
      const requirement = item.requirement === 'required' ? '<i>必填</i>' : item.requirement ? '<i>页面未标必填</i>' : '';
      const dateDescription = item.datePrecision
        ? ` · ${datePrecisionLabels[item.datePrecision] || item.datePrecision} · ${dateMechanismLabels[item.dateMechanism] || item.dateMechanism}`
        : '';
      row.innerHTML = `<span class="resume-autofill-audit__row-head"><b>${item.ref}</b><em>${statusLabels[item.status]}</em>${requirement}<code>${modeLabels[item.inputMode] || item.controlKind}${mapping}</code></span><span class="resume-autofill-audit__row-text"></span><span class="resume-autofill-audit__row-meta"></span><small></small>`;
      row.querySelector('.resume-autofill-audit__row-text').textContent = item.text;
      row.querySelector('.resume-autofill-audit__row-meta').textContent = `控件：${item.controlKind}${dateDescription} · 资料字段：${item.matchedKey || '未映射（不影响交互识别）'}${item.reason ? ` · 原因：${item.reason}` : ''}`;
      row.querySelector('small').textContent = `${item.domPath}${item.sourceDomPath ? ` · 内部字段 ${item.sourceDomPath}` : ''}${item.context ? ` · 区块 ${item.context}` : ''}`;
      row.addEventListener('click', () => {
        const target = auditElementMap.get(item.ref);
        if (!(target instanceof Element) || !target.isConnected) return;
        document.querySelectorAll('.resume-autofill-audit-target').forEach((element) => element.classList.remove('resume-autofill-audit-target'));
        target.classList.add('resume-autofill-audit-target');
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
        setTimeout(() => target.classList.remove('resume-autofill-audit-target'), 3500);
      });
      list.appendChild(row);
    }

    const textDetails = document.createElement('details');
    textDetails.className = 'resume-autofill-audit__texts';
    const textSummary = document.createElement('summary');
    textSummary.textContent = `页面语义文字 (${report.semanticTexts.length})`;
    const textList = document.createElement('div');
    for (const item of report.semanticTexts) {
      const row = document.createElement('button');
      row.type = 'button';
      row.dataset.search = `${item.ref} ${item.text} ${item.tag} ${item.role}`.toLowerCase();
      row.textContent = `${item.ref} · ${item.text}`;
      row.addEventListener('click', () => {
        const target = auditElementMap.get(item.ref);
        if (target instanceof Element) target.scrollIntoView({ block: 'center' });
      });
      textList.appendChild(row);
    }
    textDetails.append(textSummary, textList);
    let activeFilter = 'all';
    const applyAuditFilters = () => {
      const query = search.value.trim().toLowerCase();
      list.querySelectorAll('[data-search]').forEach((row) => {
        const [axis, value] = activeFilter.split(':');
        const categoryMatches = activeFilter === 'all'
          || (axis === 'mode' ? row.dataset.auditMode === value : row.dataset.auditCapability === value);
        const textMatches = !query || row.dataset.search.includes(query);
        row.hidden = !(categoryMatches && textMatches);
      });
      textDetails.hidden = activeFilter !== 'all';
    };
    search.addEventListener('input', applyAuditFilters);
    legend.addEventListener('click', (event) => {
      const button = event.target.closest('[data-audit-filter]');
      if (!button) return;
      activeFilter = button.dataset.auditFilter;
      legend.querySelectorAll('[data-audit-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
      applyAuditFilters();
    });
    panel.append(header, summary, legend, toolbar, list, textDetails);
    document.documentElement.appendChild(panel);
    search.focus();
    return report.counts;
  }

  async function runResumeUploadOnly(resumeFile, overwrite) {
    const result = {
      resumeStored: Boolean(resumeFile?.base64),
      fileName: resumeFile?.name || '',
      totalFileInputs: document.querySelectorAll('input[type="file"]').length,
      targetFound: false,
      injected: false,
      dropFallback: false,
      accepted: false,
      completed: false,
      waitedMs: 0,
      reason: ''
    };
    if (!resumeFile?.base64) {
      result.reason = '扩展中没有保存简历附件，请先在“编辑我的资料”页面导入并保存 PDF。';
      return result;
    }
    const targets = await findResumeUploadTargets(2500);
    result.candidates = targets.map((descriptor, index) => ({
      index,
      kind: descriptor.kind,
      text: descriptor.text.slice(0, 180),
      accept: descriptor.element.getAttribute('accept') || '',
      disabled: Boolean(descriptor.element.disabled)
    }));
    result.totalFileInputs = document.querySelectorAll('input[type="file"]').length;
    result.targetFound = targets.length > 0;
    if (!targets.length) {
      const fileInputs = [...document.querySelectorAll('input[type="file"]')];
      result.reason = fileInputs.length
        ? '页面存在文件框，但其附近没有“上传简历/快速解析/Resume”等语义，为避免误传到头像或证件附件，脚本没有写入。'
        : '当前页面没有发现 input[type=file]；上传组件可能在跨域 iframe、尚未展开或使用了封闭 Shadow DOM。';
      return result;
    }
    for (const descriptor of targets) {
      const target = descriptor.element;
      result.targetKind = descriptor.kind;
      result.targetText = descriptor.text.slice(0, 160);
      if (!overwrite && target.files?.length) {
        result.injected = true;
        result.accepted = resumeUploadSuccessText(resumeFile);
        result.completed = result.accepted;
        result.reason = result.accepted ? '' : '文件框中已有文件，但没有观察到网站解析状态；如需重新上传，请勾选“覆盖页面中已有内容”。';
        return result;
      }
      const state = await uploadResumeAndWait(target, resumeFile, overwrite);
      result.injected ||= Boolean(state.injected);
      result.dropFallback ||= Boolean(state.dropFallback);
      result.waitedMs = Math.max(result.waitedMs, state.waitedMs || 0);
      if (state.accepted) {
        result.accepted = true;
        result.completed = Boolean(state.completed);
        result.reason = state.completed ? '' : '网站已响应文件，但 30 秒内没有稳定完成解析。';
        return result;
      }
    }
    result.reason = result.injected
      ? 'PDF 已写入隐藏文件框并触发 input/change/drop，但网站没有产生可观察的上传或解析响应。该网站可能要求浏览器原生文件选择。'
      : '找到了简历文件框，但无法把保存的 PDF 写入该控件。';
    return result;
  }

  async function runAutofill(profile, overwrite) {
    const runStarted = performance.now();
    clearMarks();
    semanticContainerCache = new WeakMap();
    labelTextCache = new WeakMap();
    sectionContextCache = new WeakMap();
    interactionBlocked = '';
    interactionWarnings = [];
    const stats = {
      filled: 0, existing: 0, unmatched: 0, missingData: 0, unsupported: 0, ignored: 0,
      sectionsAdded: 0, sectionAddFailed: 0,
      sectionPlan: [],
      timings: {},
      slowFields: [],
      details: { unmatched: [], missingData: [], unsupported: [], existing: [], ignored: [] },
      diagnostics: { unmatched: [], missingData: [], unsupported: [], existing: [] },
      diagnosticSignatures: new Set()
    };

    await ensureRepeatedSections(profile, stats);
    stats.timings.sectionSetupMs = Math.round(performance.now() - runStarted);
    // 新增经历会改变标题、字段与容器之间的结构关系。新增前计算过的语义容器和
    // sectionContext 已经过期，必须在正式字段映射前重建，否则首段和新增段可能
    // 落入不同 occurrence 计数器并重复使用第一条资料。
    semanticContainerCache = new WeakMap();
    labelTextCache = new WeakMap();
    sectionContextCache = new WeakMap();

    const logicalDateRangesStarted = performance.now();
    await fillAtsxPeriodMonthRanges(profile, stats, overwrite);
    stats.timings.logicalDateRangesMs = Math.round(performance.now() - logicalDateRangesStarted);

    const elements = [];
    const queuedElements = new WeakSet();
    const enqueueControls = (root) => {
      const candidates = [];
      if (root instanceof Element && root.matches('input, textarea, select, [contenteditable="true"]')) candidates.push(root);
      if (root?.querySelectorAll) candidates.push(...root.querySelectorAll('input, textarea, select, [contenteditable="true"]'));
      for (const candidate of candidates) {
        if (!queuedElements.has(candidate)) {
          queuedElements.add(candidate);
          elements.push(candidate);
        }
      }
    };
    enqueueControls(document);
    const formObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) mutation.addedNodes.forEach((node) => enqueueControls(node));
    });
    formObserver.observe(document.documentElement, { childList: true, subtree: true });
    const handledRadioNames = new Set();
    const handledDateRangeHosts = new WeakSet();
    const handledCustomSelectTriggers = new WeakSet();
    const countedUnmatchedTriggers = new WeakSet();
    const processedCustomChoiceGroups = new WeakSet();
    const fastProcessedControls = new WeakSet();
    const occurrences = new Map();
    const groupOccurrences = new Map();

    await wait(30);
    const choicesStarted = performance.now();
    await fillCustomChoices(profile, stats, overwrite, processedCustomChoiceGroups, false);
    stats.timings.initialChoicesMs = Math.round(performance.now() - choicesStarted);

    const fastStarted = performance.now();
    fastFillOrdinaryControls(profile, stats, overwrite, fastProcessedControls);
    stats.timings.fastFieldsMs = Math.round(performance.now() - fastStarted);

    const controlsStarted = performance.now();

    for (let elementIndex = 0, idleRounds = 0; idleRounds < 2;) {
      if (elementIndex >= elements.length) {
        idleRounds += 1;
        await wait(35);
        continue;
      }
      idleRounds = 0;
      const element = elements[elementIndex++];
      const fieldStarted = performance.now();
      if (fastProcessedControls.has(element)) continue;
      if (!element.isConnected) continue;
      const type = (element.type || '').toLowerCase();
      if (type === 'file') {
        continue;
      }
      if (element.disabled || ['hidden', 'password', 'submit', 'button', 'reset', 'image'].includes(type)) {
        if (visible(element) && element.disabled && !['submit', 'button', 'reset', 'image'].includes(type)) {
          markFillResult(element, IGNORED_CLASS);
          stats.ignored += 1;
          if (stats.details.ignored.length < 8) stats.details.ignored.push(`${readableField(labelText(element), element)}（控件已禁用）`);
        }
        continue;
      }
      if (!visible(element)) continue;
      if (type === 'radio' && handledRadioNames.has(element.name)) continue;
      const text = labelText(element);
      const context = sectionContext(element);
      const matchedKey = matchKey(text, context);
      if (!matchedKey) {
        if (text && !ignoredText.test(text)) {
          const unmatchedTrigger = customSelectTrigger(element);
          if (unmatchedTrigger && customTriggerHasSelection(unmatchedTrigger)) {
            markFillResult(unmatchedTrigger, EXISTING_CLASS);
            stats.existing += 1;
            const field = readableField(text, element);
            const observed = controlReadback(element, unmatchedTrigger);
            stats.details.existing.push(`${field}（页面已有非占位值，但字段未映射）`);
            recordDiagnostic(stats, 'existing', {
              field, observed, stage: '映射前检查',
              reason: '自定义选择器显示了明确选中值（已排除“请选择”等占位文字），未开启覆盖'
            });
            continue;
          }
          if (unmatchedTrigger && countedUnmatchedTriggers.has(unmatchedTrigger)) continue;
          if (unmatchedTrigger) countedUnmatchedTriggers.add(unmatchedTrigger);
          markFillResult(element, UNMATCHED_CLASS);
          stats.unmatched += 1;
          if (stats.details.unmatched.length < 24) stats.details.unmatched.push(readableField(text, element));
          recordDiagnostic(stats, 'unmatched', {
            field: readableField(text, element), observed: controlReadback(element, unmatchedTrigger), stage: '字段语义映射',
            reason: '页面控件可见且有标签，但标签没有命中任何本地资料字段规则；脚本因此不猜测填写'
          });
        } else if (text) {
          markFillResult(element, IGNORED_CLASS);
          stats.ignored += 1;
          if (stats.details.ignored.length < 8) stats.details.ignored.push(`${readableField(text, element)}（安全忽略规则）`);
        }
        continue;
      }
      if (auxiliaryControl(element, text)) {
        markFillResult(element, IGNORED_CLASS);
        stats.ignored += 1;
        if (stats.details.ignored.length < 8) stats.details.ignored.push(`${readableField(text, element)}（辅助控件）`);
        continue;
      }
      const structuralRange = structuralDateRange(element);
      if (structuralRange && DATE_RANGE_KINDS[matchedKey]) {
        const rangeHost = semanticContainer(element) || structuralRange.root.parentElement || structuralRange.root;
        if (handledDateRangeHosts.has(rangeHost)) continue;
        handledDateRangeHosts.add(rangeHost);
        const binding = dateBinding(element, matchedKey, groupOccurrences);
        const fallbackOccurrence = binding?.occurrence || 0;
        const [startKey, endKey] = DATE_RANGE_KINDS[matchedKey];
        const educationResolution = educationMappedKey(startKey)
          ? educationEntryResolution(profile, text, fallbackOccurrence)
          : { explicit: false, index: fallbackOccurrence, label: '' };
        const occurrence = educationResolution.explicit ? educationResolution.index : fallbackOccurrence;
        const startValue = occurrence >= 0 ? profileValue(profile, startKey, occurrence) : '';
        const endValue = occurrence >= 0 ? profileValue(profile, endKey, occurrence) : '';
        if (!startValue || !endValue) {
          markFillResult(structuralRange.root, MISSING_CLASS);
          stats.missingData += 1;
          const missingKey = !startValue ? startKey : endKey;
          if (stats.details.missingData.length < 8) stats.details.missingData.push(`${readableField(text, element)} → ${missingKey}`);
          recordDiagnostic(stats, 'missingData', {
            field: readableField(text, element), key: `${startKey}/${endKey}`,
            target: `${startValue || '缺失'} → ${endValue || '缺失'}`, stage: '本地资料取值',
            reason: educationResolution.explicit && occurrence < 0
              ? `已识别为${educationResolution.label}日期，但本地资料中没有对应学历层级；未尝试操作页面`
              : `已映射为日期范围，但第 ${occurrence + 1} 段资料的 ${missingKey} 为空；未尝试操作页面`
          });
          continue;
        }
        if (!overwrite && structuralRangeMatches(structuralRange, startValue, endValue)) {
          markFillResult(structuralRange.root, EXISTING_CLASS);
          stats.existing += 1;
          const field = readableField(text, element);
          stats.details.existing.push(`${field}（页面日期范围已匹配资料）`);
          recordDiagnostic(stats, 'existing', {
            field, key: `${startKey}/${endKey}`, target: `${startValue} → ${endValue}`,
            observed: `${structuralRangeReading(structuralRange, 0) || '—'} → ${structuralRangeReading(structuralRange, 1) || '—'}`,
            stage: '填写前检查', reason: '页面回读的起止日期已与目标资料匹配，且未开启覆盖'
          });
          continue;
        }
        const rangeResult = await fillStructuralDateRangeGroup(
          rangeHost, structuralRange, startValue, endValue, [startKey, endKey], overwrite
        );
        const rangeElapsed = Math.round(performance.now() - fieldStarted);
        if (rangeElapsed >= 100) {
          stats.slowFields.push({
            field: readableField(text, element),
            key: `${startKey}/${endKey}`,
            ms: rangeElapsed,
            ok: Boolean(rangeResult.ok)
          });
          stats.slowFields.sort((left, right) => right.ms - left.ms);
          stats.slowFields.length = Math.min(stats.slowFields.length, 8);
        }
        if (rangeResult.ok) {
          markFillResult(structuralRange.root, FILLED_CLASS);
          stats.filled += 1;
        } else {
          const failedElement = rangeResult.element || structuralRange.root || element;
          markFillResult(failedElement, FAILED_CLASS);
          stats.unsupported += 1;
          if (stats.details.unsupported.length < 8) {
            stats.details.unsupported.push(`${readableField(text, element)} → ${startKey}/${endKey}（${rangeResult.reason}）`);
          }
          recordDiagnostic(stats, 'unsupported', {
            field: readableField(text, element), key: `${startKey}/${endKey}`, target: `${startValue} → ${endValue}`,
            observed: `${structuralRangeReading(structuralRange, 0) || '—'} → ${structuralRangeReading(structuralRange, 1) || '—'}`,
            stage: '日期范围回读验证', reason: rangeResult.reason || '网页未接受目标日期范围'
          });
        }
        continue;
      }
      const logicalTrigger = customSelectTrigger(element);
      if (logicalTrigger && handledCustomSelectTriggers.has(logicalTrigger)) continue;
      if (logicalTrigger) handledCustomSelectTriggers.add(logicalTrigger);
      const binding = dateBinding(element, matchedKey, groupOccurrences);
      const key = binding?.key || matchedKey;
      if (type === 'checkbox' && /Date$|Date\b/.test(key)) {
        markFillResult(element, IGNORED_CLASS);
        stats.ignored += 1;
        if (stats.details.ignored.length < 8) stats.details.ignored.push(`${readableField(text, element)}（日期附属复选框）`);
        continue;
      }
      const occurrenceKey = `${context || 'global'}:${key}`;
      const fallbackOccurrence = binding?.occurrence ?? (occurrences.get(occurrenceKey) || 0);
      const educationResolution = educationMappedKey(key)
        ? educationEntryResolution(profile, text, fallbackOccurrence)
        : { explicit: false, index: fallbackOccurrence, label: '' };
      const occurrence = educationResolution.explicit ? educationResolution.index : fallbackOccurrence;
      const value = occurrence >= 0 ? profileValue(profile, key, occurrence, context) : '';
      if (!value) {
        markFillResult(logicalTrigger || element, MISSING_CLASS);
        stats.missingData += 1;
        if (stats.details.missingData.length < 8) stats.details.missingData.push(`${readableField(text, element)} → ${key}`);
        recordDiagnostic(stats, 'missingData', {
          field: readableField(text, element), key, stage: '本地资料取值',
          reason: educationResolution.explicit && occurrence < 0
            ? `页面字段明确指定${educationResolution.label}，但本地资料中没有对应教育经历；未尝试操作页面`
            : `页面字段已映射为 ${key}，但本地资料第 ${occurrence + 1} 个对应值为空；未尝试操作页面`
        });
        continue;
      }
      if (!binding && !educationResolution.explicit && type !== 'radio' && type !== 'checkbox') {
        occurrences.set(occurrenceKey, fallbackOccurrence + 1);
      }
      if (!overwrite && hasValue(element) && type !== 'radio' && type !== 'checkbox') {
        markFillResult(logicalTrigger || element, EXISTING_CLASS);
        stats.existing += 1;
        const field = readableField(text, element);
        const observed = controlReadback(element, logicalTrigger);
        stats.details.existing.push(`${field}（页面已有：${diagnosticValue(observed)}）`);
        recordDiagnostic(stats, 'existing', {
          field, key, target: value, observed, stage: '填写前检查',
          reason: '检测到非空、非占位、非浏览器默认首项的页面值，且未开启覆盖'
        });
        continue;
      }
      let filled = false;
      let fillSnapshot = null;
      if (type === 'radio') {
        const group = element.name ? [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(element.name)}"]`)] : [element];
        filled = group.some((radio) => fillChoice(radio, value));
        if (element.name) handledRadioNames.add(element.name);
        if (filled) group.find((radio) => radio.checked)?.classList.add(FILLED_CLASS);
      } else {
        fillSnapshot = captureFillState(element, logicalTrigger || element);
        filled = await fillElement(element, value, key, binding?.part || '');
        // 部分 React/Vue 组件已经成功更新可见值，却不会更新原始 input.value。
        // 在判红前再做一次独立回读，只要可见选中值与目标匹配就按成功处理。
        if (!filled && controlValueSatisfied(element, logicalTrigger, value, key, binding?.part || '')) {
          filled = true;
          fillFailureReasons.delete(element);
        }
        if (filled) markFillResult(element, FILLED_CLASS);
      }
      if (filled) stats.filled += 1;
      else {
        if (fillSnapshot) {
          const rolledBack = await rollbackFailedControl(element, logicalTrigger || element, fillSnapshot);
          if (!rolledBack) {
            const prior = fillFailureReasons.get(element) || '控件没有接受目标值';
            fillFailureReasons.set(element, `${prior}；失败后未能通过通用清除按钮完全恢复原状态`);
          }
        }
        markFillResult(logicalTrigger || element, FAILED_CLASS);
        stats.unsupported += 1;
        const reason = fillFailureReasons.get(element);
        if (stats.details.unsupported.length < 8) stats.details.unsupported.push(`${readableField(text, element)} → ${key}${reason ? `（${reason}）` : ''}`);
        recordDiagnostic(stats, 'unsupported', {
          field: readableField(text, element), key, target: value,
          observed: fillFailureObserved.get(element) || controlReadback(element, logicalTrigger) || (fillSnapshot?.hadValue ? fillSnapshot.value : '回滚后为空'),
          stage: '操作后回读验证',
          reason: reason || '已尝试填写/点击，但控件可见值、选中状态或关闭状态没有达到成功条件'
        });
      }
      const fieldElapsed = Math.round(performance.now() - fieldStarted);
      if (fieldElapsed >= 100) {
        stats.slowFields.push({ field: readableField(text, element), key, ms: fieldElapsed, ok: Boolean(filled) });
        stats.slowFields.sort((left, right) => right.ms - left.ms);
        stats.slowFields.length = Math.min(stats.slowFields.length, 8);
      }
    }
    // Framework-rendered radio groups may appear after the ordinary input queue has
    // already been scanned. Run the same structural pass again before disconnecting.
    stats.timings.controlsMs = Math.round(performance.now() - controlsStarted);
    const finalChoicesStarted = performance.now();
    await wait(30);
    await fillCustomChoices(profile, stats, overwrite, processedCustomChoiceGroups, true);
    stats.timings.finalChoicesMs = Math.round(performance.now() - finalChoicesStarted);
    formObserver.disconnect();

    stats.blocked = '';
    stats.interactionWarnings = [...interactionWarnings];
    stats.timings.totalMs = Math.round(performance.now() - runStarted);
    delete stats.diagnosticSignatures;
    showCompletionPanel(stats);
    return stats;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'RESUME_AUTOFILL_UPLOAD_ONLY_V2') {
      Promise.resolve(runResumeUploadOnly(message.resumeFile || null, Boolean(message.overwrite)))
        .then(sendResponse)
        .catch((error) => sendResponse({ resumeStored: false, targetFound: false, injected: false, accepted: false, completed: false, reason: error?.message || String(error) }));
      return true;
    }
    if (message.type === 'RESUME_AUTOFILL_FILL') {
      runAutofill(message.profile || {}, Boolean(message.overwrite)).then(sendResponse);
      return true;
    }
    if (message.type === 'RESUME_AUTOFILL_CLEAR') {
      clearMarks();
      sendResponse({ ok: true });
    }
    if (message.type === 'RESUME_AUTOFILL_DIAGNOSE') sendResponse(diagnosePage());
    if (message.type === 'RESUME_AUTOFILL_AUDIT_SHOW') {
      const report = diagnosePage();
      showAuditPanel(report);
      sendResponse({ ok: true, counts: report.counts, truncated: report.truncated });
    }
  });
})();
