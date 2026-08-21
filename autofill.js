(() => {
  const VERSION = '0.9.66';
  if (globalThis.__resumeProfileAutofillVersion === VERSION) return;
  globalThis.__resumeProfileAutofillVersion = VERSION;

  const ADD_TEXT = /添加|新增|继续添加|add\s+(?:another|new)?|create\s+new|^\s*[+＋]\s*$/i;
  const SAVE_TEXT = /保存|确定|完成|确认|提交本条|save|ok|confirm|done/i;
  const PLACEHOLDER_VALUE = /^(?:请选择|请输入|选择|搜索|select|choose|yyyy|mm|dd|—|-)?$/i;
  const DATE_KINDS = new Set(['native-date', 'date-trigger', 'date-picker', 'month-trigger', 'month-picker']);
  const FILL_OPERATION_GROUPS = new Set(['direct-write', 'input-select', 'closed-select']);
  const REPEAT_CONFIGS = [
    { section: 'educationExperiences', anchor: 'educationExperiences[].schoolName', pattern: /教育|学历|学校|院校|education|academic/i, label: '教育经历' },
    { section: 'workExperiences', anchor: 'workExperiences[].companyName', pattern: /工作|实习|任职|就业|work|intern|employment|experience/i, label: '工作/实习经历' },
    { section: 'projectExperiences', anchor: 'projectExperiences[].name', pattern: /项目|project/i, label: '项目经历' },
    { section: 'campusExperiences', anchor: 'campusExperiences[].jobTitle', pattern: /校园|校内|社团|学生会|campus/i, label: '校园经历' },
    { section: 'practiceExperiences', anchor: 'practiceExperiences[].name', pattern: /社会实践|实践经历|practice/i, label: '社会实践' },
    { section: 'familyMembers', anchor: 'familyMembers[].name', pattern: /家庭|亲属|紧急联系人|证明人|family|relative|emergency/i, label: '家庭/联系人' },
    { section: 'languageSkills', anchor: 'languageSkills[].language', pattern: /语言|外语|英语|language|english/i, label: '语言能力' },
    { section: 'skills', anchor: 'skills[].name', pattern: /技能|特长|skill/i, label: '技能' },
    { section: 'publications', anchor: 'publications[].title', pattern: /论文|期刊|发表|publication|paper|journal/i, label: '论文' },
    { section: 'patents', anchor: 'patents[].name', pattern: /专利|patent/i, label: '专利' },
    { section: 'certificates', anchor: 'certificates[].name', pattern: /能力证书|资格证书|职业资格|证书|certificate|qualification/i, negative: /获奖|奖励|荣誉|award|honou?r/i, label: '能力/资格证书' },
    { section: 'awards', anchor: 'awards[].name', pattern: /获奖|奖项|奖励|荣誉|award|honou?r/i, label: '奖项/获奖证书' }
  ];

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const auditApi = () => globalThis.ResumePageAuditApi;
  const PROGRESS_ROOT_ID = 'resume-autofill-progress-root';
  const PROGRESS_STYLE_ID = 'resume-autofill-progress-style';
  const FIELD_TIMEOUT_MS = 10000;
  const MODULE_TIMEOUT_MS = 10000;
  const CANCEL_POLL_MS = 120;
  const WAITING_LINES = [
    '我在加速整理这一页。',
    '下拉框打开了，我会选完再走。',
    '日期控件有点绕，我慢慢来。',
    '页面正在反应，等它半拍。',
    '我在绕开不需要填的地方。',
    '快到最后几步了。',
    '这一步要等弹层反应一下。',
    '马上汇总结果。',
    '我先看看哪里能下手。',
    '这一页信息有点密，我在排队处理。',
    '我在等页面把选项吐出来。',
    '先稳住，别让下拉框跑偏。',
    '我在找真正该点的那个按钮。',
    '这一步需要一点耐心。',
    '我在给字段和资料对暗号。',
    '我在确认这个选项是不是正主。',
    '先把能确定的内容处理掉。',
    '我在避开看起来很像的干扰项。',
    '这页控件不少，我逐个确认。',
    '我在等列表加载完整。',
    '我在把日期拆成正确的年月日。',
    '我在确认弹层有没有关好。',
    '先不乱跳，按顺序来。',
    '我在检查页面现在的状态。',
    '我在找最匹配的候选项。',
    '我在让页面先反应完。',
    '不要急，我在认真收尾。',
    '我在处理那些不太标准的控件。',
    '我在看这个输入框是不是已经填过。',
    '页面正在变化，我先等它稳定。',
    '我在确认选择结果有没有写回去。',
    '我在把重复经历排好顺序。',
    '这一项要点开再判断。',
    '我在过滤不该操作的按钮。',
    '我在观察新出现的弹层。',
    '我在把候选项排个优先级。',
    '我在处理一个有点倔的下拉框。',
    '我在等搜索结果刷新。',
    '这一步先慢一点更稳。',
    '我在确认当前字段属于哪段经历。',
    '我在看页面有没有自动改值。',
    '我在处理需要确认的选择。',
    '我在避开提交和跳转动作。',
    '我在让控件自己完成更新。',
    '这页的结构我已经记住了。',
    '我在找最近的字段关系。',
    '我在处理年月这种小细节。',
    '我在检查有没有同名字段。',
    '我在把页面上的线索串起来。',
    '我在等它别再闪了。',
    '我在确认是不是可编辑状态。',
    '我在挑最像资料值的选项。',
    '我在处理地区选择的层级。',
    '我在确认城市有没有选中。',
    '我在补上还空着的位置。',
    '我在把当前页整理成可操作清单。',
    '我在确认这个按钮是不是添加按钮。',
    '我在处理页面里的隐藏弹层。',
    '我在等动画结束。',
    '这一项需要先打开再选择。',
    '我在确认输入后有没有出现列表。',
    '我在处理格式不一样的值。',
    '我在看页面是不是已经有答案。',
    '我在把年份和月份分开处理。',
    '我在对比候选项的文字。',
    '我在避开太模糊的匹配。',
    '我在给不确定项留审核空间。',
    '我在处理只读但能点击的控件。',
    '我在确认弹层属于当前字段。',
    '我在看按钮旁边的上下文。',
    '我在让页面少受一点打扰。',
    '我在处理那些挂到 body 下的菜单。',
    '我在等候选区域出现。',
    '我在把控件类型先分清楚。',
    '我在确认这个选择是否需要确定按钮。',
    '我在处理可能已经填好的字段。',
    '我在检查回读结果。',
    '我在把简单项先清掉。',
    '我在处理需要点击的字段。',
    '我在确认是不是多段经历。',
    '我在等页面保存当前小状态。',
    '我在检查列表有没有正确高亮。',
    '我在确认资料值有没有可用内容。',
    '我在找当前弹层里的候选。',
    '我在把页面噪声降下来。',
    '我在检查是不是需要先输入再选择。',
    '我在等输入法事件走完。',
    '我在确认这次点击有没有生效。',
    '我在处理选项文字的不同说法。',
    '我在按当前页面的节奏来。',
    '我在把可填字段按位置排序。',
    '我在检查是不是同一组控件。',
    '我在确认没有选到旁边的导航。',
    '我在看这个弹层是不是旧的。',
    '我在把已经完成的部分放一边。',
    '我在等最后一个控件回应。',
    '马上把结果整理出来。',
    '我在确认没有漏掉明显字段。',
    '我在给这页做最后一次核对。',
    '这一步快结束了。'
  ];
  let progressHideTimer = 0;
  let progressLineIndex = 0;
  let progressLineBag = [];
  let cancelAutofillRequested = false;
  let autofillAbortVersion = 0;
  let debugTraceEnabled = false;
  let debugTraceEntries = [];
  let debugRunId = '';
  globalThis.__resumeAutofillCancelRequested = () => Boolean(cancelAutofillRequested);
  globalThis.__resumeAutofillAbortVersion = () => autofillAbortVersion;

  function clean(value) {
    return String(value || '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  }

  function compactDebugValue(value, limit = 120) {
    const text = clean(value);
    return text.length <= limit ? text : `${text.slice(0, limit)}...`;
  }

  function debugTrace(event, payload = {}) {
    if (!debugTraceEnabled) return;
    const entry = {
      at: new Date().toISOString(),
      ms: Math.round(performance.now()),
      runId: debugRunId,
      event,
      ...payload
    };
    debugTraceEntries.push(entry);
    if (debugTraceEntries.length > 1200) debugTraceEntries.splice(0, debugTraceEntries.length - 1200);
    try {
      console.debug('[resume-autofill]', event, entry);
    } catch (_) {}
  }

  function debugFieldDetail(stage, detail = {}) {
    debugTrace('field-result', {
      stage,
      ref: detail.ref || '',
      field: detail.field || '',
      profilePath: detail.profilePath || '',
      operation: detail.operation || detail.legacyType || '',
      status: detail.status || '',
      reason: detail.reason || '',
      before: compactDebugValue(detail.before),
      desired: compactDebugValue(detail.desired),
      after: compactDebugValue(detail.after || detail.afterAttempt || detail.selected),
      ms: detail.ms || 0,
      timing: Array.isArray(detail.timing) ? detail.timing.slice(0, 20) : []
    });
  }

  function debugSnapshot() {
    return {
      enabled: debugTraceEnabled,
      runId: debugRunId,
      entries: debugTraceEntries.slice()
    };
  }

  function normalized(value) {
    return clean(value).toLowerCase().replace(/[\s:：,，。.、;；()（）\[\]【】/_-]+/g, '');
  }

  function moduleSection(text) {
    return globalThis.ResumeProfileSchema?.moduleSectionForTitle?.(text) || '';
  }

  function parseDatePieces(value) {
    const text = clean(value);
    const match = text.match(/((?:19|20)\d{2})\D{0,4}(\d{1,2})?\D{0,4}(\d{1,2})?/);
    if (!match) return null;
    const year = match[1];
    const month = match[2] ? String(Number(match[2])) : '';
    const day = match[3] ? String(Number(match[3])) : '';
    return {
      year,
      month,
      day,
      monthIso: month ? `${year}-${month.padStart(2, '0')}` : year,
      iso: month ? `${year}-${month.padStart(2, '0')}${day ? `-${day.padStart(2, '0')}` : ''}` : year
    };
  }

  function isLocationItem(item = {}, key = '') {
    const text = `${item.matchedKey || ''} ${item.profilePath || ''} ${key || ''}`;
    return /(?:^|\.|\[\]\.)(?:nativePlace|studentOrigin|householdRegistration|currentResidence|city|cities|desiredCity|desiredCities|location|province|district|county)(?:$|\.|\s)/i.test(text);
  }

  function dateLikeItem(item = {}, key = '') {
    if (isLocationItem(item, key)) return false;
    return DATE_KINDS.has(item.controlKind)
      || /date|time|year|month|day/i.test(`${item.controlKind || ''} ${item.matchedKey || ''} ${item.profilePath || ''} ${key || ''}`)
      || Boolean(item.datePart || item.datePrecision || item.rangeRole);
  }

  function datePartExpected(value, part) {
    const date = parseDatePieces(value);
    if (!date) return '';
    if (part === 'year') return date.year;
    if (part === 'month') return date.month;
    if (part === 'day') return date.day;
    return '';
  }

  function equivalentValue(actual, desired, item = {}, key = '') {
    const actualText = clean(actual);
    const desiredText = clean(desired);
    if (!actualText || !desiredText || PLACEHOLDER_VALUE.test(actualText)) return false;
    if (normalized(actualText) === normalized(desiredText)) return true;

    if (item.datePart) {
      const expectedPart = datePartExpected(desiredText, item.datePart);
      return Boolean(expectedPart) && normalized(actualText) === normalized(expectedPart);
    }

    if (dateLikeItem(item, key)) {
      const actualDate = parseDatePieces(actualText);
      const desiredDate = parseDatePieces(desiredText);
      if (actualDate && desiredDate) {
        return desiredDate.day
          ? actualDate.iso === desiredDate.iso
          : actualDate.monthIso === desiredDate.monthIso;
      }
    }

    const actualNormalized = normalized(actualText);
    const desiredNormalized = normalized(desiredText);
    const shorter = Math.min([...actualNormalized].length, [...desiredNormalized].length);
    return shorter >= 2 && (actualNormalized.includes(desiredNormalized) || desiredNormalized.includes(actualNormalized));
  }

  function existingFilledValue(source, target) {
    return existingControlValue(source) || existingControlValue(target);
  }

  function profileData(profile) {
    return profile?.data && typeof profile.data === 'object' ? profile.data : profile;
  }

  function moduleMatchesConfig(module, config) {
    const title = clean(module?.module || module?.moduleTitle || '');
    if (!title) return false;
    const section = moduleSection(title);
    if (section && section === config.section) return true;
    return config.pattern.test(title) && !config.negative?.test(title);
  }

  function moduleControlDetails(report, module, config) {
    const moduleBlock = module?.ref ? auditApi().getTarget(module.ref) : null;
    const fields = controlsForSection(report, config).filter((item) => {
      if (item.blockRef && module.ref && item.blockRef === module.ref) return true;
      const sameTitle = clean(item.moduleTitle || item.blockTitle || '') === clean(module.module || module.moduleTitle || '');
      const target = auditApi().getTarget(item.ref);
      return sameTitle || (target instanceof Element && moduleBlock instanceof Element && moduleBlock.contains(target));
    });
    const anchors = fields.filter((item) => item.profilePath === config.anchor);
    return { fields, anchors };
  }

  function reportModuleScore(report, module, config) {
    if (!moduleMatchesConfig(module, config)) return -1;
    const title = clean(module?.module || module?.moduleTitle || '');
    const section = moduleSection(title);
    const { fields, anchors } = moduleControlDetails(report, module, config);
    return (section === config.section ? 80 : 0)
      + anchors.length * 48
      + fields.length * 12
      + moduleRecordCount(module) * 3
      + (config.pattern.test(title) ? 4 : 0);
  }

  function findReportModule(report, config) {
    return (report.moduleSummary || [])
      .filter((module) => moduleMatchesConfig(module, config))
      .sort((left, right) => reportModuleScore(report, right, config) - reportModuleScore(report, left, config))[0] || null;
  }

  function pageHasRepeatSection(report, config) {
    return Boolean(findReportModule(report, config) || controlsForSection(report, config).length);
  }

  function moduleRecordCount(module) {
    return Math.max(0, Number(module?.record_count || 0));
  }

  function phoneCountryRegionValue(profile, item) {
    const explicit = clean(profile?.basic?.phoneCountryRegion);
    if (explicit) return explicit;
    const region = clean(profile?.basic?.countryRegion);
    if (/^(?:中国|中华人民共和国|中国内地|大陆|内地)$/.test(region)) return '中国大陆';
    if (/(?:中国大陆|中国内地|大陆|内地)/.test(region)) return '中国大陆';
    if (/(?:中国港澳台|港澳台|香港|澳门|台湾)/.test(region)) return '中国港澳台';
    if (/(?:国外|海外|境外|外国|外籍)/.test(region)) return '国外';
    return clean(region || item.currentValue || '中国大陆');
  }

  function highestEducationIndex(entries) {
    if (!entries.length) return -1;
    const explicit = entries.findIndex((entry) => /^(?:是|yes|true|1)$/i.test(clean(entry?.isHighest)));
    return explicit >= 0 ? explicit : entries.length - 1;
  }

  function ordinalIndexFromItem(item = {}) {
    const text = clean(item.displayName || item.label || item.fieldLabel || item.text || '');
    const match = text.match(/(?:^|[^\d])(\d{1,2})$/);
    const index = match ? Number(match[1]) - 1 : -1;
    return index >= 0 ? index : -1;
  }

  function profileRecordValue(profile, path, item, occurrenceByPath) {
    if (!path) return '';
    if (item?.compoundRole === 'phone-country-region') {
      return phoneCountryRegionValue(profile, item);
    }
    if (item?.compoundRole === 'identity-document-type') {
      return clean(profile?.basic?.identityDocumentType || item.currentValue || '身份证');
    }
    const indexedArrayMatch = path.match(/^([^[]+)\[([^\]]+)\]\.([^.]*)$/);
    if (indexedArrayMatch) {
      const [, section, indexToken, field] = indexedArrayMatch;
      const entries = Array.isArray(profile[section]) ? profile[section] : [];
      const index = indexToken === 'highest' ? highestEducationIndex(entries) : Number(indexToken);
      return clean(entries[index]?.[field]);
    }
    const arrayMatch = path.match(/^([^[]+)\[\]\.([^.]*)$/);
    if (arrayMatch) {
      const [, section, field] = arrayMatch;
      const entries = Array.isArray(profile[section]) ? profile[section] : [];
      let index = Number(item.repeatIndex || item.recordIndex || 0) - 1;
      if (index < 0) index = ordinalIndexFromItem(item);
      if (index < 0 && /最高/.test(item.fieldLabel || '')) {
        index = entries.findIndex((entry) => /^(?:是|yes|true)$/i.test(entry.isHighest || ''));
        if (index < 0) index = Math.max(0, entries.length - 1);
      }
      if (index < 0) {
        index = occurrenceByPath.get(path) || 0;
        occurrenceByPath.set(path, index + 1);
      }
      return clean(entries[index]?.[field]);
    }
    let value = profile;
    for (const part of path.split('.')) value = value?.[part];
    return clean(value);
  }

  function phoenixRadioSelectedText(element) {
    if (!(element instanceof Element)) return '';
    const group = element.matches?.('.phoenix-radio-group')
      ? element
      : element.closest?.('.phoenix-radio-group') || element.querySelector?.('.phoenix-radio-group');
    if (!(group instanceof Element)) return '';
    const options = [...group.querySelectorAll('.phoenix-radio-group__radioItem,.phoenix-radio')];
    const selected = options.find((option) => {
      const className = String(option.className?.baseVal || option.className || '');
      return /phoenix-radio--checked|phoenix-radio__circle-wrapper--checked|phoenix-radio__dot--checked/.test(className)
        || option.getAttribute?.('aria-checked') === 'true'
        || Boolean(option.querySelector?.('.phoenix-radio--checked,.phoenix-radio__circle-wrapper--checked,.phoenix-radio__dot--checked,[aria-checked="true"]'));
    });
    return clean(selected?.querySelector?.('.phoenix-radio__radio-text')?.textContent
      || selected?.getAttribute?.('aria-label')
      || selected?.textContent
      || '');
  }

  function existingControlValue(element) {
    if (!(element instanceof Element)) return '';
    if (element.matches('select')) {
      const selectedOptions = [...element.selectedOptions || []].map((option) => clean(option.textContent || option.value)).filter(Boolean);
      return clean(selectedOptions.join(' / ') || element.value);
    }
    if (element.matches('input[type="checkbox"],input[type="radio"]')) {
      return element.checked ? clean(element.labels?.[0]?.textContent || element.value || 'checked') : '';
    }
    if (element.matches('input,textarea')) return clean(element.value);
    if (element.matches('[contenteditable]:not([contenteditable="false"])')) return clean(element.textContent);
    const phoenixRadioText = phoenixRadioSelectedText(element);
    if (phoenixRadioText && !PLACEHOLDER_VALUE.test(phoenixRadioText)) return phoenixRadioText;
    const descendantValue = [...element.querySelectorAll('input,textarea,select')]
      .map((control) => existingControlValue(control))
      .find(Boolean) || '';
    if (descendantValue && !PLACEHOLDER_VALUE.test(descendantValue)) return descendantValue;
    const selected = element.querySelector('[aria-checked="true"],[aria-selected="true"],input:checked,option:checked,[class*="selected"],[class*="Selected"],[class*="checked"],[class*="Checked"]');
    const selectedValue = clean(selected?.textContent || selected?.value || selected?.getAttribute?.('aria-label') || '');
    if (selectedValue && !PLACEHOLDER_VALUE.test(selectedValue)) return selectedValue;
    const displayed = element.querySelector([
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
      '[class*="display-value"]',
      '[class*="DisplayValue"]',
      '[class*="selected-value"]',
      '[class*="SelectedValue"]',
      '[class*="selectedValue"]',
      '[class*="singleValue"]',
      '[class*="SingleValue"]',
      '[class*="selection-item"]',
      '[class*="SelectionItem"]'
    ].join(','));
    const value = clean(displayed?.textContent || displayed?.getAttribute?.('title') || displayed?.getAttribute?.('aria-label') || '');
    return PLACEHOLDER_VALUE.test(value) ? '' : value;
  }

  function writableElement(source, target) {
    if (source?.matches?.('input:not([type="hidden"]),textarea,[contenteditable]:not([contenteditable="false"])')) return source;
    if (target?.matches?.('input:not([type="hidden"]),textarea,[contenteditable]:not([contenteditable="false"])')) return target;
    return source?.querySelector?.('input:not([type="hidden"]),textarea,[contenteditable]:not([contenteditable="false"])')
      || target?.querySelector?.('input:not([type="hidden"]),textarea,[contenteditable]:not([contenteditable="false"])') || null;
  }

  function dispatchAutofillMouseActivation(element, options = {}) {
    if (!(element instanceof Element)) return;
    const common = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 };
    if (typeof PointerEvent === 'function') {
      element.dispatchEvent(new PointerEvent('pointerdown', { ...common, pointerType: 'mouse', buttons: 1 }));
      element.dispatchEvent(new PointerEvent('pointerup', { ...common, pointerType: 'mouse', buttons: 0 }));
    }
    element.dispatchEvent(new MouseEvent('mousedown', { ...common, buttons: 1 }));
    element.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 }));
    if (options.click !== false) element.dispatchEvent(new MouseEvent('click', common));
  }

  function dispatchAutofillFocusEvent(element, type) {
    if (!(element instanceof Element)) return;
    try {
      element.dispatchEvent(new FocusEvent(type, { bubbles: true, composed: true, relatedTarget: null }));
    } catch (_) {
      element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    }
  }

  function dispatchAutofillTextCommit(element, value) {
    if (!(element instanceof Element)) return;
    try {
      element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertReplacementText',
        data: String(value ?? '')
      }));
    } catch (_) {
      element.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true, composed: true }));
    }
    try {
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertReplacementText',
        data: String(value ?? '')
      }));
    } catch (_) {
      element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    for (const type of ['keydown', 'keyup']) {
      element.dispatchEvent(new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        key: 'Unidentified',
        code: 'Unidentified'
      }));
    }
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  function setNativeValue(element, value) {
    if (!(element instanceof Element)) return false;
    dispatchAutofillMouseActivation(element, { click: true });
    try {
      element.focus?.({ preventScroll: true });
    } catch (_) {
      element.focus?.();
    }
    dispatchAutofillFocusEvent(element, 'focusin');
    if (element.matches('[contenteditable]:not([contenteditable="false"])')) {
      element.textContent = value;
      dispatchAutofillTextCommit(element, value);
      element.dispatchEvent(new Event('blur', { bubbles: false, composed: true }));
      dispatchAutofillFocusEvent(element, 'focusout');
      return true;
    }
    if (!element.matches('input,textarea')) return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter ? setter.call(element, value) : (element.value = value);
    dispatchAutofillTextCommit(element, value);
    element.dispatchEvent(new Event('blur', { bubbles: false, composed: true }));
    dispatchAutofillFocusEvent(element, 'focusout');
    return true;
  }

  function safeClick(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    if (typeof element.click === 'function') {
      element.click();
    } else {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: window }));
    }
    return true;
  }

  function ensureProgressStyle() {
    if (document.getElementById(PROGRESS_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = PROGRESS_STYLE_ID;
    style.textContent = `
      #${PROGRESS_ROOT_ID} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        display: grid !important;
        place-items: center !important;
        background: rgba(15, 23, 42, .34) !important;
        pointer-events: all !important;
        font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-card {
        width: min(420px, calc(100vw - 40px)) !important;
        border-radius: 10px !important;
        background: #ffffff !important;
        color: #17202a !important;
        box-shadow: 0 18px 48px rgba(15, 23, 42, .22) !important;
        padding: 18px 18px 16px !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-head {
        display: grid !important;
        grid-template-columns: 34px 1fr !important;
        gap: 12px !important;
        align-items: center !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-spinner {
        width: 30px !important;
        height: 30px !important;
        border: 3px solid #dcfce7 !important;
        border-top-color: #16a34a !important;
        border-radius: 999px !important;
        animation: resume-autofill-spin .8s linear infinite !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-title {
        font-size: 16px !important;
        font-weight: 800 !important;
        line-height: 1.35 !important;
        margin: 0 0 4px !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-line {
        color: #667085 !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-detail {
        min-height: 20px !important;
        color: #475467 !important;
        font-size: 13px !important;
        line-height: 1.45 !important;
        margin: 14px 0 13px !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-track {
        height: 10px !important;
        border-radius: 999px !important;
        overflow: hidden !important;
        background: #e5e7eb !important;
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, .08) !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-bar {
        height: 100% !important;
        width: 0;
        border-radius: inherit !important;
        background: linear-gradient(90deg, #22c55e, #16a34a) !important;
        box-shadow: 0 0 0 1px rgba(22, 163, 74, .08), 0 0 14px rgba(34, 197, 94, .24) !important;
        transition: width .22s ease !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-meta {
        margin-top: 8px !important;
        color: #667085 !important;
        font-size: 12px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: 12px !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-progress-percent {
        color: #16a34a !important;
        font-weight: 800 !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-cancel {
        appearance: none !important;
        border: 1px solid #d0d5dd !important;
        border-radius: 999px !important;
        background: #ffffff !important;
        cursor: pointer !important;
        display: inline-grid !important;
        place-items: center !important;
        width: 30px !important;
        height: 30px !important;
        padding: 0 !important;
        font-size: 0 !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-cancel:hover {
        background: #f9fafb !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-cancel::before {
        content: "" !important;
        display: block !important;
        width: 10px !important;
        height: 10px !important;
        border-radius: 2px !important;
        background: #344054 !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-cancel:disabled {
        opacity: .6 !important;
        cursor: default !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-close {
        appearance: none !important;
        border: 0 !important;
        border-radius: 8px !important;
        background: #16a34a !important;
        color: #ffffff !important;
        cursor: pointer !important;
        display: none !important;
        font: inherit !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        padding: 7px 12px !important;
      }
      #${PROGRESS_ROOT_ID} .resume-autofill-close:hover {
        background: #15803d !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="error"] .resume-autofill-close {
        background: #dc2626 !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="cancelled"] .resume-autofill-close {
        background: #f97316 !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="done"] .resume-autofill-close,
      #${PROGRESS_ROOT_ID}[data-state="error"] .resume-autofill-close,
      #${PROGRESS_ROOT_ID}[data-state="cancelled"] .resume-autofill-close {
        display: inline-block !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="done"] .resume-autofill-progress-bar {
        background: #16a34a !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="done"] .resume-autofill-spinner {
        animation: none !important;
        border-color: #16a34a !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="error"] .resume-autofill-progress-bar {
        background: #dc2626 !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="cancelling"] .resume-autofill-progress-bar,
      #${PROGRESS_ROOT_ID}[data-state="cancelled"] .resume-autofill-progress-bar {
        background: #f97316 !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="error"] .resume-autofill-spinner {
        animation: none !important;
        border-color: #dc2626 !important;
      }
      #${PROGRESS_ROOT_ID}[data-state="cancelling"] .resume-autofill-spinner,
      #${PROGRESS_ROOT_ID}[data-state="cancelled"] .resume-autofill-spinner {
        animation: none !important;
        border-color: #f97316 !important;
      }
      @keyframes resume-autofill-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureProgressRoot() {
    ensureProgressStyle();
    let root = document.getElementById(PROGRESS_ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = PROGRESS_ROOT_ID;
    root.className = 'resume-autofill-progress-overlay';
    root.dataset.resumePageAuditUi = 'autofill-progress';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML = `
      <div class="resume-autofill-progress-card">
        <div class="resume-autofill-progress-head">
          <div class="resume-autofill-spinner"></div>
          <div>
            <div class="resume-autofill-progress-title"></div>
            <div class="resume-autofill-progress-line"></div>
          </div>
        </div>
        <div class="resume-autofill-progress-detail"></div>
        <div class="resume-autofill-progress-track"><div class="resume-autofill-progress-bar"></div></div>
        <div class="resume-autofill-progress-meta">
          <span class="resume-autofill-progress-percent"></span>
          <button class="resume-autofill-cancel" type="button" aria-label="暂停/取消本次填写" title="暂停/取消本次填写"></button>
          <button class="resume-autofill-close" type="button">关闭</button>
        </div>
      </div>
    `;
    root.querySelector('.resume-autofill-cancel')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      requestAutofillCancel();
    });
    root.querySelector('.resume-autofill-close')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      root.remove();
    });
    document.documentElement.appendChild(root);
    return root;
  }

  function progressLine() {
    if (!progressLineBag.length) {
      progressLineBag = WAITING_LINES.map((_, index) => index);
      for (let index = progressLineBag.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [progressLineBag[index], progressLineBag[swap]] = [progressLineBag[swap], progressLineBag[index]];
      }
    }
    const line = WAITING_LINES[progressLineBag.pop() ?? (progressLineIndex % WAITING_LINES.length)];
    progressLineIndex += 1;
    return line;
  }

  function requestAutofillCancel() {
    if (cancelAutofillRequested) return;
    cancelAutofillRequested = true;
    autofillAbortVersion += 1;
    const root = document.getElementById(PROGRESS_ROOT_ID);
    const button = root?.querySelector('.resume-autofill-cancel');
    if (button) {
      button.disabled = true;
      button.dataset.state = 'cancelling';
      button.setAttribute('aria-label', '正在停止填写');
      button.setAttribute('title', '正在停止填写');
    }
    updateProgress({
      percent: Number(root?.querySelector('.resume-autofill-progress-percent')?.dataset.percent || 0),
      title: '收到，正在停下来',
      detail: '当前这一步结束后就会停止。',
      state: 'cancelling',
      line: '我先把正在进行的动作收尾。'
    });
  }

  function throwIfCancelled(stage = '') {
    if (!cancelAutofillRequested) return;
    const error = new Error(stage ? `用户已取消填写：${stage}` : '用户已取消填写');
    error.name = 'ResumeAutofillCancelled';
    throw error;
  }

  function cancellationError(stage = '') {
    const error = new Error(stage ? `Autofill cancelled: ${stage}` : 'Autofill cancelled');
    error.name = 'ResumeAutofillCancelled';
    return error;
  }

  function timeoutError(label, timeoutMs) {
    const error = new Error(`${label || 'operation'} timed out after ${timeoutMs}ms`);
    error.name = 'ResumeAutofillTimeout';
    error.timeoutMs = timeoutMs;
    return error;
  }

  function isCancellationError(error) {
    return error?.name === 'ResumeAutofillCancelled';
  }

  function isTimeoutError(error) {
    return error?.name === 'ResumeAutofillTimeout';
  }

  async function withAutofillTimeout(task, timeoutMs, label = 'operation') {
    if (cancelAutofillRequested) throw cancellationError(label);
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutTimer = 0;
      let pollTimer = 0;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        clearTimeout(pollTimer);
        fn(value);
      };
      const pollCancel = () => {
        if (settled) return;
        if (cancelAutofillRequested) {
          finish(reject, cancellationError(label));
          return;
        }
        pollTimer = setTimeout(pollCancel, CANCEL_POLL_MS);
      };
      timeoutTimer = setTimeout(() => {
        finish(reject, timeoutError(label, timeoutMs));
      }, timeoutMs);
      pollTimer = setTimeout(pollCancel, CANCEL_POLL_MS);
      Promise.resolve()
        .then(task)
        .then((value) => finish(resolve, value), (error) => finish(reject, error));
    });
  }

  function setImportantDisplay(element, value) {
    if (!(element instanceof HTMLElement)) return;
    element.style.setProperty('display', value, 'important');
  }

  function updateProgress({ percent = 0, title = '我在处理', detail = '', state = 'running', line = '' } = {}) {
    clearTimeout(progressHideTimer);
    const root = ensureProgressRoot();
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    const progressText = line || progressLine();
    root.dataset.state = state;
    root.querySelector('.resume-autofill-progress-title').textContent = title;
    root.querySelector('.resume-autofill-progress-line').textContent = state === 'running' ? '' : progressText;
    root.querySelector('.resume-autofill-progress-detail').textContent = state === 'running' ? (detail || progressText) : detail;
    root.querySelector('.resume-autofill-progress-bar').style.setProperty('width', `${safePercent}%`, 'important');
    const percentNode = root.querySelector('.resume-autofill-progress-percent');
    percentNode.textContent = `${safePercent}%`;
    percentNode.dataset.percent = String(safePercent);
    const cancelButton = root.querySelector('.resume-autofill-cancel');
    const closeButton = root.querySelector('.resume-autofill-close');
    if (cancelButton) {
      if (state === 'running') {
        setImportantDisplay(cancelButton, 'inline-grid');
        cancelButton.disabled = false;
        delete cancelButton.dataset.state;
        cancelButton.setAttribute('aria-label', '暂停/取消本次填写');
        cancelButton.setAttribute('title', '暂停/取消本次填写');
      } else if (state === 'cancelling' || state === 'cancelled') {
        setImportantDisplay(cancelButton, state === 'cancelling' ? 'inline-grid' : 'none');
        cancelButton.disabled = true;
        cancelButton.dataset.state = state;
        cancelButton.setAttribute('aria-label', '正在停止填写');
        cancelButton.setAttribute('title', '正在停止填写');
      } else {
        setImportantDisplay(cancelButton, 'none');
        cancelButton.disabled = true;
      }
    }
    if (closeButton) setImportantDisplay(closeButton, ['done', 'error', 'cancelling', 'cancelled'].includes(state) ? 'inline-block' : 'none');
  }

  function finishProgress({ title = '处理完成', detail = '当前页面填写流程已结束。', state = 'done' } = {}) {
    updateProgress({ percent: state === 'error' ? 100 : 100, title, detail, state, line: state === 'done' ? '收工，剩下的看结果。' : '这次先到这里。' });
  }

  function desiredRepeatCount(profile, config) {
    return profileRepeatStats(profile, config).effective;
  }

  function profileRepeatStats(profile, config) {
    const records = Array.isArray(profile?.[config.section]) ? profile[config.section] : [];
    const entries = records.filter((item) => Object.values(item || {}).some((value) => clean(value)));
    const anchorKey = clean(config.anchor.split('[].')[1] || '');
    const anchorValues = anchorKey
      ? entries.map((item) => clean(item?.[anchorKey])).filter(Boolean).slice(0, 6)
      : [];
    const sampleFields = entries.slice(0, 2).map((item) => Object.entries(item || {})
      .filter(([, value]) => clean(value))
      .map(([key]) => key)
      .slice(0, 6)
      .join(', ')
    ).filter(Boolean);
    return {
      total: records.length,
      effective: entries.length,
      entries,
      anchorValues,
      sampleFields
    };
  }

  function repeatActionSummary(action) {
    return action
      ? { addActionFound: true, addActionRef: action.ref || '', addActionText: clean(action.text || '') }
      : { addActionFound: false, addActionRef: '', addActionText: '' };
  }

  function emptyProfileRepeatReason(stats, action) {
    if (stats.total <= 0) return action ? '个人资料中没有该模块记录；页面添加按钮已匹配，未执行添加' : '个人资料中没有该模块记录';
    return action ? '个人资料中该模块记录都是空的；页面添加按钮已匹配，未执行添加' : '个人资料中该模块记录都是空的';
  }

  function pageAddActionDiag(report, config) {
    return repeatActionSummary(findAddAction(report, config));
  }

  function repeatResultBase(profile, report, config, desired, actual) {
    const action = findAddAction(report, config);
    const stats = profileRepeatStats(profile, config);
    const result = {
      section: config.section,
      label: config.label,
      desired,
      before: actual,
      after: actual,
      added: 0,
      status: 'matched',
      reason: '',
      profileTotal: stats.total,
      profileEffective: stats.effective,
      profileAnchorValues: stats.anchorValues,
      profileSampleFields: stats.sampleFields,
      ...repeatActionSummary(action)
    };
    if (!desired) result.reason = emptyProfileRepeatReason(stats, action);
    return result;
  }

  function refreshAddActionDiag(result, report, config) {
    Object.assign(result, pageAddActionDiag(report, config));
  }

  function controlsForSection(report, config) {
    return (report.controls || []).filter((item) => item.profilePath?.startsWith(`${config.section}[]`));
  }

  function pageRepeatCount(report, config) {
    const module = findReportModule(report, config);
    if (!module) return 0;
    const { fields, anchors } = moduleControlDetails(report, module, config);
    if (anchors.length) {
      const anchorIndexes = new Set(anchors.map((item) => Number(item.repeatIndex || item.recordIndex || 0)).filter(Boolean));
      if (anchorIndexes.size) return anchorIndexes.size;
      const anchorGroups = new Set(anchors.map((item) => item.repeatGroup).filter(Boolean));
      if (anchorGroups.size) return anchorGroups.size;
      return anchors.length;
    }
    const structuralTotal = Math.max(0, ...fields.map((item) => Number(item.recordTotal || 0)));
    if (structuralTotal) return structuralTotal;
    const groups = new Set(fields.map((item) => item.repeatGroup).filter(Boolean));
    if (groups.size) return groups.size;
    const indexes = new Set(fields.map((item) => Number(item.repeatIndex || item.recordIndex || 0)).filter(Boolean));
    if (indexes.size) return indexes.size;
    return moduleRecordCount(module);
  }

  function sectionSignature(report, config) {
    return controlsForSection(report, config)
      .map((item) => `${item.ref}:${item.profilePath}:${item.repeatIndex || 0}:${item.text || ''}:${item.fieldLabel || ''}`)
      .join('|');
  }

  function actionNearbyText(element) {
    let node = element;
    const evidence = [];
    for (let depth = 0; node instanceof Element && depth < 6; depth += 1, node = node.parentElement) {
      const heading = node.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > legend,:scope > [class*="title"],:scope > [class*="Title"]');
      if (heading) evidence.push(heading.textContent || '');
      if (clean(node.textContent).length < 240) evidence.push(node.textContent || '');
    }
    return clean(evidence.join(' ')).slice(0, 600);
  }

  function findAddAction(report, config) {
    return findRepeatAction(report, config, ADD_TEXT, ['structure-add', 'click']);
  }

  function findSaveAction(report, config) {
    return findRepeatAction(report, config, SAVE_TEXT, ['submit', 'click']);
  }

  function findRepeatAction(report, config, textPattern, allowedTypes) {
    const module = findReportModule(report, config);
    if (!module) return null;
    const moduleBlock = module?.ref ? auditApi().getTarget(module.ref) : null;
    const score = (item, target) => {
      const inMatchedBlock = item.blockRef && module.ref && item.blockRef === module.ref;
      const inMatchedDom = target instanceof Element && moduleBlock instanceof Element && moduleBlock.contains(target);
      const sameSemanticModule = moduleSection(item.moduleTitle || item.blockTitle || '') === config.section;
      if (!inMatchedBlock && !inMatchedDom && !sameSemanticModule) return 0;
      const evidence = `${item.text || ''} ${item.context || ''} ${item.moduleTitle || ''} ${item.blockTitle || ''} ${actionNearbyText(target)}`;
      return (inMatchedBlock ? 32 : 0)
        + (inMatchedDom ? 24 : 0)
        + (sameSemanticModule ? 16 : 0)
        + (config.pattern.test(evidence) && !config.negative?.test(evidence) ? 8 : 0)
        + (textPattern.test(clean(item.text || '')) ? 4 : 0)
        + (item.actionType === 'structure-add' ? 2 : 0);
    };
    return (report.interactiveElements || []).filter((item) => {
      if (item.elementKind !== 'action' || !allowedTypes.includes(item.actionType)) return false;
      if (!textPattern.test(clean(item.text || '')) && item.actionType !== 'structure-add') return false;
      if (item.actionType === 'submit' && /(?:投递|申请|提交简历|提交申请|下一步|上一步|预览|submit\s+application|apply|next|previous)/i.test(item.text || '')) return false;
      const target = auditApi().getTarget(item.ref);
      return score(item, target) > 0;
    }).sort((left, right) => score(right, auditApi().getTarget(right.ref)) - score(left, auditApi().getTarget(left.ref)))[0] || null;
  }

  async function waitForSectionGrowth(config, beforeCount, beforeSignature = '', timeout = 2200) {
    const started = performance.now();
    let changed = false;
    while (performance.now() - started < timeout) {
      throwIfCancelled('等待重复经历变化');
      await wait(100);
      throwIfCancelled('等待重复经历变化');
      const report = auditApi().diagnosePage();
      const count = pageRepeatCount(report, config);
      if (count > beforeCount) return { report, count };
      if (beforeSignature && sectionSignature(report, config) !== beforeSignature) changed = true;
    }
    const report = auditApi().diagnosePage();
    return { report, count: pageRepeatCount(report, config), changed };
  }

  async function ensureRepeatSections(profile, initialReport) {
    let report = initialReport;
    const details = [];
    for (const config of REPEAT_CONFIGS) {
      throwIfCancelled(`处理${config.label}`);
      const desired = desiredRepeatCount(profile, config);
      let actual = pageRepeatCount(report, config);
      const result = repeatResultBase(profile, report, config, desired, actual);
      if (desired && !pageHasRepeatSection(report, config)) {
        result.status = 'section-not-present';
        result.reason = `当前页面没有“${config.label}”模块，不执行跨模块添加`;
        result.after = actual;
        details.push(result);
        continue;
      }
      for (let attempt = 0; desired && actual < desired && attempt < 20; attempt += 1) {
        throwIfCancelled(`添加${config.label}`);
        const action = findAddAction(report, config);
        Object.assign(result, repeatActionSummary(action));
        if (!action) { result.status = 'missing-add-action'; result.reason = `没有找到“${config.label}”添加按钮`; break; }
        if (!safeClick(auditApi().getTarget(action.ref))) { result.status = 'add-click-failed'; result.reason = '添加按钮不可点击'; break; }
        const growth = await waitForSectionGrowth(config, actual);
        throwIfCancelled(`添加${config.label}`);
        report = growth.report;
        refreshAddActionDiag(result, report, config);
        if (growth.count <= actual) { result.status = 'add-not-verified'; result.reason = '点击后对应编号没有增加'; break; }
        result.added += growth.count - actual;
        actual = growth.count;
      }
      result.after = actual;
      if (actual >= desired) {
        result.status = result.added ? 'matched-after-add' : actual > desired && desired ? 'page-has-extra' : 'matched';
        if (desired) result.reason = '';
      }
      details.push(result);
    }
    return { report, details };
  }

  function repeatSectionFilter(report, config, recordIndex, allowSingleEditor = false) {
    const sectionPrefix = `${config.section}[]`;
    const visibleCount = pageRepeatCount(report, config);
    return (item) => {
      if (!item.profilePath?.startsWith(sectionPrefix)) return false;
      const itemIndex = Number(item.repeatIndex || item.recordIndex || 0);
      if (!itemIndex) return true;
      if (itemIndex === recordIndex) return true;
      return Boolean(allowSingleEditor && visibleCount <= 1);
    };
  }

  async function fillRepeatRecord(profile, initialReport, config, recordIndex, overwrite, options = {}) {
    throwIfCancelled(`填写${config.label}${recordIndex}`);
    let report = initialReport;
    const started = performance.now();
    const phaseOptions = {
      filter: repeatSectionFilter(report, config, recordIndex, Boolean(options.allowSingleEditor)),
      repeatSection: config.section,
      repeatIndex: recordIndex,
      onProgress: options.onProgress
    };
    const fill = await sequentialFillControls(profile, report, overwrite, phaseOptions);
    report = fill.report;
    const phases = fill.phases;
    const details = [phases.directWrite, phases.inputSelect, phases.closedSelect].flatMap((phase) => phase.details);
    const completed = details.filter((item) => ['filled', 'kept-existing'].includes(item.status)).length;
    return {
      section: config.section,
      label: config.label,
      recordIndex,
      mode: options.allowSingleEditor ? 'single-editor' : 'visible-record',
      status: details.length ? 'filled' : 'no-visible-fields',
      attempted: details.length,
      completed,
      omitted: details.length - completed,
      filled: details.filter((item) => item.status === 'filled').length,
      ms: Math.round(performance.now() - started),
      phases,
      report
    };
  }

  function timeoutRepeatRecord(config, recordIndex, started, options = {}) {
    const detail = {
      ref: '',
      field: `${config.label}${recordIndex}`,
      profilePath: `${config.section}[]`,
      repeatSection: config.section,
      repeatIndex: recordIndex,
      desired: '',
      status: 'timeout-skipped',
      reason: `Repeat record timed out after ${MODULE_TIMEOUT_MS}ms`,
      operation: 'repeat-section',
      ms: Math.round(performance.now() - started)
    };
    const phases = emptyFillPhases(started);
    phases.directWrite = phaseFromDetails('direct-write', [detail], started);
    return {
      section: config.section,
      label: config.label,
      recordIndex,
      mode: options.allowSingleEditor ? 'single-editor' : 'visible-record',
      status: 'timeout-skipped',
      reason: `Repeat record timed out after ${MODULE_TIMEOUT_MS}ms`,
      attempted: 1,
      completed: 0,
      omitted: 1,
      filled: 0,
      ms: Math.round(performance.now() - started),
      phases,
      report: auditApi().diagnosePage()
    };
  }

  async function fillRepeatRecordWithTimeout(profile, initialReport, config, recordIndex, overwrite, options = {}) {
    const started = performance.now();
    try {
      return await withAutofillTimeout(
        () => fillRepeatRecord(profile, initialReport, config, recordIndex, overwrite, options),
        MODULE_TIMEOUT_MS,
        `${config.label}${recordIndex}`
      );
    } catch (error) {
      if (isCancellationError(error)) throw error;
      if (isTimeoutError(error)) return timeoutRepeatRecord(config, recordIndex, started, options);
      throw error;
    }
  }

  async function clickRepeatAction(report, config, finder, missingStatus, failedStatus) {
    throwIfCancelled(`点击${config.label}操作`);
    const action = finder(report, config);
    if (!action) return { status: missingStatus, action: '', report };
    const clicked = safeClick(auditApi().getTarget(action.ref));
    if (!clicked) return { status: failedStatus, action: action.ref, text: action.text || '', report };
    await wait(650);
    throwIfCancelled(`点击${config.label}操作`);
    return { status: 'clicked', action: action.ref, text: action.text || '', report: auditApi().diagnosePage() };
  }

  async function continueSequentialRepeatSections(profile, initialReport, structures, overwrite, options = {}) {
    let report = initialReport;
    const details = [];
    const recordRuns = [];
    const sequentialSections = structures
      .filter((item) => item.status === 'add-not-verified' && item.desired > item.after)
      .map((item) => REPEAT_CONFIGS.find((config) => config.section === item.section))
      .filter(Boolean);

    for (const config of sequentialSections) {
      throwIfCancelled(`顺序处理${config.label}`);
      const desired = desiredRepeatCount(profile, config);
      options.onProgress?.({ section: config.section, field: `${config.label} 顺序补填`, operationGroup: 'repeat-section', index: 0, total: desired || 1 });
      let knownCount = Math.max(0, pageRepeatCount(report, config));
      const result = {
        section: config.section,
        label: config.label,
        desired,
        before: knownCount,
        after: knownCount,
        plannedAfter: knownCount,
        mode: 'fill-save-add',
        actions: [],
        records: [],
        status: desired > knownCount ? 'running' : 'matched',
        reason: ''
      };
      let plannedCount = Math.max(knownCount, knownCount ? knownCount : 0);

      for (let recordIndex = Math.max(knownCount, 0) + 1; desired && recordIndex <= desired && result.status === 'running'; recordIndex += 1) {
        throwIfCancelled(`顺序处理${config.label}${recordIndex}`);
        const beforeSave = await clickRepeatAction(report, config, findSaveAction, 'save-not-found', 'save-click-failed');
        result.actions.push({ stage: 'save-before-add', ...beforeSave, report: undefined });
        report = beforeSave.report;

        const beforeCount = pageRepeatCount(report, config);
        const beforeSignature = sectionSignature(report, config);
        const add = findAddAction(report, config);
        if (!add) {
          result.status = 'missing-add-action';
          result.reason = `没有找到“${config.label}”添加按钮`;
          break;
        }
        if (!safeClick(auditApi().getTarget(add.ref))) {
          result.status = 'add-click-failed';
          result.reason = '添加按钮不可点击';
          break;
        }
        const growth = await waitForSectionGrowth(config, beforeCount, beforeSignature);
        throwIfCancelled(`顺序处理${config.label}${recordIndex}`);
        report = growth.report;
        const grew = growth.count > beforeCount;
        const changed = grew || growth.changed || sectionSignature(report, config) !== beforeSignature;
        result.actions.push({ stage: 'add-next', status: grew ? 'count-grown' : changed ? 'editor-opened' : 'no-change', action: add.ref, text: add.text || '', before: beforeCount, after: growth.count });
        if (!changed) {
          result.status = 'add-not-opened';
          result.reason = '填写后再次点击添加，页面仍没有出现新记录或新编辑态';
          break;
        }

        const targetRecordIndex = grew ? growth.count : recordIndex;
        const run = await fillRepeatRecordWithTimeout(profile, report, config, targetRecordIndex, overwrite, {
          allowSingleEditor: !grew,
          onProgress: (info) => options.onProgress?.({
            ...info,
            section: config.section,
            field: `${config.label}${targetRecordIndex} ${info.field || ''}`.trim()
          })
        });
        recordRuns.push(run);
        result.records.push({ recordIndex: targetRecordIndex, status: run.status, attempted: run.attempted, completed: run.completed, omitted: run.omitted });
        report = run.report;
        if (run.status === 'timeout-skipped') {
          result.status = 'record-timeout-skipped';
          result.reason = `${config.label}${targetRecordIndex} timed out after ${MODULE_TIMEOUT_MS}ms`;
          break;
        }

        const afterSave = await clickRepeatAction(report, config, findSaveAction, 'save-not-found', 'save-click-failed');
        result.actions.push({ stage: 'save-after-fill', ...afterSave, report: undefined });
        report = afterSave.report;
        knownCount = Math.max(pageRepeatCount(report, config), grew ? growth.count : beforeCount);
        plannedCount = Math.max(plannedCount, targetRecordIndex);
        result.after = knownCount;
        result.plannedAfter = plannedCount;
      }

      if (result.status === 'running') {
        result.status = plannedCount >= desired ? 'matched-after-sequential-fill' : 'partial';
        if (result.status === 'matched-after-sequential-fill' && result.after < result.plannedAfter) {
          result.reason = `页面只检测到 ${result.after} 条可见记录；已按单编辑器顺序处理到第 ${result.plannedAfter} 条`;
        }
      }
      if (result.status === 'matched' && desired > knownCount) result.status = 'partial';
      details.push(result);
    }

    return { report, details, recordRuns };
  }

  function phaseOmissions(phases) {
    return Object.values(phases).flatMap((phase) => phase.details || [])
      .filter((item) => !['filled', 'kept-existing'].includes(item.status));
  }

  function sumPhases(phases) {
    return Object.values(phases).reduce((totals, phase) => {
      totals.filled += phase.filled || 0;
      totals.completed += phase.completed || 0;
      totals.required += phase.required || 0;
      totals.omitted += phase.omitted || 0;
      totals.attempted += phase.attempted || 0;
      totals.manualReview += phase.manualReview || 0;
      return totals;
    }, { filled: 0, completed: 0, required: 0, omitted: 0, attempted: 0, manualReview: 0 });
  }

  function sumSequentialRuns(runs) {
    return runs.reduce((totals, run) => {
      const phaseTotals = sumPhases(run.phases || {});
      totals.filled += phaseTotals.filled;
      totals.completed += phaseTotals.completed;
      totals.required += phaseTotals.required;
      totals.omitted += phaseTotals.omitted;
      totals.attempted += phaseTotals.attempted;
      totals.manualReview += phaseTotals.manualReview || 0;
      return totals;
    }, { filled: 0, completed: 0, required: 0, omitted: 0, attempted: 0, manualReview: 0 });
  }

  function isMappedFillTarget(item = {}) {
    if (!item.profilePath || !FILL_OPERATION_GROUPS.has(item.operationGroup)) return false;
    if (item.elementKind && item.elementKind !== 'field') return false;
    if (Object.prototype.hasOwnProperty.call(item, 'mappingStatus') && item.mappingStatus !== 'mapped') return false;
    return true;
  }

  function isExecutableFillTarget(item = {}, options = {}) {
    const filter = typeof options.filter === 'function' ? options.filter : () => true;
    if (!isMappedFillTarget(item) || !filter(item)) return false;
    if (!options.includeFilledCurrentValues && !isCurrentEmptyControl(item)) return false;
    return true;
  }

  function phaseFields(report, operationGroup, options = {}) {
    return (report.controls || [])
      .filter((field) => field.operationGroup === operationGroup && isExecutableFillTarget(field, options));
  }

  function fieldOrder(item = {}) {
    const refIndex = Number(String(item.ref || '').match(/\d+/)?.[0] || 0);
    return refIndex || Number.MAX_SAFE_INTEGER;
  }

  function orderedFillFields(report, options = {}) {
    return (report.controls || [])
      .filter((field) => isExecutableFillTarget(field, options))
      .sort((left, right) => fieldOrder(left) - fieldOrder(right));
  }

  function valueItemForPhase(item, options = {}) {
    if (!options.repeatSection || !options.repeatIndex) return item;
    if (!item.profilePath?.startsWith(`${options.repeatSection}[]`)) return item;
    return { ...item, repeatIndex: options.repeatIndex, repeatSection: options.repeatSection };
  }

  function phaseRequiredCount(details) {
    return details.length;
  }

  function skippedPhase(group, reason = '') {
    return {
      group,
      attempted: 0,
      required: 0,
      completed: 0,
      omitted: 0,
      filled: 0,
      ms: 0,
      details: [],
      skipped: true,
      reason
    };
  }

  function phaseFromDetails(group, details, started) {
    const completed = details.filter((item) => ['filled', 'kept-existing'].includes(item.status)).length;
    const manualReview = details.filter((item) => ['manual-review', 'filled-needs-review'].includes(item.status)).length;
    return {
      group,
      attempted: details.length,
      required: phaseRequiredCount(details),
      completed,
      omitted: details.length - completed,
      filled: details.filter((item) => item.status === 'filled').length,
      manualReview,
      ms: Math.round(performance.now() - started),
      details
    };
  }

  function emptyFillPhases(started) {
    return {
      directWrite: phaseFromDetails('direct-write', [], started),
      inputSelect: phaseFromDetails('input-select', [], started),
      closedSelect: phaseFromDetails('closed-select', [], started)
    };
  }

  function fillDirectWriteField(profile, item, valueItem, occurrenceByPath, overwrite) {
    throwIfCancelled(`填写${item.displayName || item.ref || ''}`);
    const fieldStarted = performance.now();
    const source = auditApi().getSource(item.ref);
    const target = auditApi().getTarget(item.ref);
    const input = writableElement(source, target);
    const value = profileRecordValue(profile, item.profilePath, valueItem, occurrenceByPath);
    let status = 'filled';
    let reason = '';
    if (!value) { status = 'missing-profile-value'; reason = '个人资料对应值为空'; }
    else if (!input || input.readOnly || input.disabled) { status = 'not-writable'; reason = '没有可写输入节点'; }
    else if (!overwrite && existingControlValue(input) && !PLACEHOLDER_VALUE.test(existingControlValue(input))) { status = 'kept-existing'; reason = '页面已有内容'; }
    else if (!setNativeValue(input, value)) { status = 'write-failed'; reason = '原生写入失败'; }
    const after = input ? existingControlValue(input) : '';
    let restored = false;
    if (status === 'kept-existing' && !equivalentValue(after, value, item, item.matchedKey || '')) {
      status = 'existing-different';
      reason = `existing value differs from profile: "${after}"`;
    }
    if (status === 'filled' && !equivalentValue(after, value, item, item.matchedKey || '')) {
      status = 'write-verify-failed';
      reason = `readback mismatch after write: "${after}"`;
      markManualReview(input, source, target, reason);
    }
    return {
      ref: item.ref,
      field: item.displayName,
      profilePath: item.profilePath,
      repeatIndex: valueItem.repeatIndex,
      desired: value,
      status,
      reason,
      after,
      restored,
      operation: 'direct-write',
      controlKind: item.controlKind || '',
      ms: Math.round(performance.now() - fieldStarted)
    };
  }

  function timeoutDirectWriteDetail(profile, item, valueItem, occurrenceByPath, started) {
    const value = profileRecordValue(profile, item.profilePath, valueItem, occurrenceByPath);
    return {
      ref: item.ref,
      field: item.displayName,
      profilePath: item.profilePath,
      repeatIndex: valueItem.repeatIndex,
      desired: value,
      status: 'timeout-skipped',
      reason: `Field timed out after ${FIELD_TIMEOUT_MS}ms`,
      after: '',
      restored: false,
      operation: 'direct-write',
      controlKind: item.controlKind || '',
      ms: Math.round(performance.now() - started)
    };
  }

  async function fillDirectWriteFieldWithTimeout(profile, item, valueItem, occurrenceByPath, overwrite) {
    const started = performance.now();
    try {
      return await withAutofillTimeout(
        () => fillDirectWriteField(profile, item, valueItem, occurrenceByPath, overwrite),
        FIELD_TIMEOUT_MS,
        item.displayName || item.ref || 'direct-write'
      );
    } catch (error) {
      if (isCancellationError(error)) throw error;
      if (isTimeoutError(error)) return timeoutDirectWriteDetail(profile, item, valueItem, occurrenceByPath, started);
      throw error;
    }
  }

  async function directWritePhase(profile, report, overwrite, options = {}) {
    const started = performance.now();
    const occurrenceByPath = new Map();
    const details = [];
    for (const item of phaseFields(report, 'direct-write', options)) {
      const valueItem = valueItemForPhase(item, options);
      const detail = await fillDirectWriteFieldWithTimeout(profile, item, valueItem, occurrenceByPath, overwrite);
      debugFieldDetail('direct-write', detail);
      details.push(detail);
    }
    return phaseFromDetails('direct-write', details, started);
  }

  function reacquireControl(original, operationGroup, options = {}) {
    const report = auditApi().diagnosePage();
    const fields = (report.controls || []).filter((item) => {
      if (item.operationGroup !== operationGroup || item.profilePath !== original.profilePath) return false;
      return isExecutableFillTarget(item, options);
    });
    return fields.sort((left, right) => {
      const score = (item) => (original.ref && item.ref === original.ref ? 32 : 0)
        + (original.repeatIndex && item.repeatIndex === original.repeatIndex ? 16 : 0)
        + (original.repeatGroup && item.repeatGroup === original.repeatGroup ? 12 : 0)
        + (original.bindingKey && item.bindingKey === original.bindingKey ? 8 : 0)
        + (original.rangeRole && item.rangeRole === original.rangeRole ? 4 : 0)
        + (original.displayName && item.displayName === original.displayName ? 2 : 0);
      return score(right) - score(left);
    })[0] || null;
  }

  function legacyChoiceAliases(value) {
    if (/^(?:是|yes|true)$/i.test(value)) return ['是', 'yes', 'true'];
    if (/^(?:否|no|false)$/i.test(value)) return ['否', 'no', 'false'];
    if (/^(?:男|male)$/i.test(value)) return ['男', 'male'];
    if (/^(?:女|female)$/i.test(value)) return ['女', 'female'];
    return [value];
  }

  async function fillLegacyChoice(source, target, value) {
    const root = source?.closest?.('.phoenix-radio-group,[role="radiogroup"],fieldset,[class*="radio-group"],[class*="radioGroup"]')
      || target?.closest?.('.phoenix-radio-group,[role="radiogroup"],fieldset,[class*="radio-group"],[class*="radioGroup"]') || target || source;
    const nodes = [...root.querySelectorAll('.phoenix-radio-group__radioItem,[role="radio"],input[type="radio"],label,button')];
    const aliases = legacyChoiceAliases(value).map(normalized);
    const option = nodes.find((node) => aliases.includes(normalized(node.querySelector?.('.phoenix-radio__radio-text')?.textContent || node.labels?.[0]?.textContent || node.getAttribute?.('aria-label') || node.textContent || node.value)));
    if (!option) return { ok: false, type: 'choice-group', reason: '旧版单选逻辑没有找到完全匹配项', candidates: nodes.map((node) => clean(node.textContent || node.value)).filter(Boolean).slice(0, 20) };
    const clickTarget = option.querySelector?.('.phoenix-radio,.phoenix-radio__wrapper')
      || option.closest('label,.phoenix-radio-group__radioItem,[role="radio"]')
      || option.labels?.[0]
      || option;
    safeClick(clickTarget);
    await wait(300);
    const checked = clickTarget.matches('[aria-checked="true"],[class*="checked"],[class*="selected"]')
      || clickTarget.querySelector('input:checked,[aria-checked="true"],[class*="checked"],[class*="selected"]')
      || option.matches?.('[aria-checked="true"],[class*="checked"],[class*="selected"]')
      || option.querySelector?.('input:checked,[aria-checked="true"],[class*="checked"],[class*="selected"]');
    return { ok: Boolean(checked) || !clickTarget.isConnected, type: 'choice-group', selected: clean(clickTarget.textContent), reason: checked || !clickTarget.isConnected ? '' : '已点击但没有检测到选中状态' };
  }

  function legacyElement(source, target) {
    return writableElement(source, target) || source || target;
  }

  function restoreSearchValue(element, value) {
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) return false;
    setNativeValue(element, value);
    element.blur();
    return true;
  }

  function ensureReviewStyle() {
    if (document.getElementById('resume-autofill-review-style')) return;
    const style = document.createElement('style');
    style.id = 'resume-autofill-review-style';
    style.textContent = `
      .resume-autofill-review {
        outline: 3px solid #f59e0b !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(245, 158, 11, .18) !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function reviewMarkTarget(control, source, target) {
    const candidates = [target, source, control].filter((node) => node instanceof Element);
    for (const node of candidates) {
      const block = node.closest?.('.apply-field,.form-item,.form-item--phoenix,[class*="field"],[class*="Field"],[class*="form-item"],[class*="FormItem"]');
      if (block instanceof Element) return block;
    }
    return candidates[0] || null;
  }

  function markManualReview(control, source, target, reason = '') {
    const node = reviewMarkTarget(control, source, target);
    if (!(node instanceof Element)) return false;
    ensureReviewStyle();
    node.classList.add('resume-autofill-review');
    node.dataset.resumeAutofillReview = reason || 'manual-required';
    return true;
  }

  function controlReadback(control, source, target) {
    if (control && 'value' in control) return clean(control.value);
    return existingControlValue(source) || existingControlValue(target);
  }

  function isDateItem(item) {
    if (isLocationItem(item)) return false;
    return DATE_KINDS.has(item.controlKind)
      || /(?:^|\.)(?:birthDate|availableDate|identityDocumentExpiry|startDate|endDate|date)$/i.test(item.profilePath || '')
      || /(?:Date|Start|End|Graduation)$/i.test(item.matchedKey || '');
  }

  function isEducationRankingSelection(item) {
    return item?.matchedKey === 'ranking' && item?.profilePath === 'educationExperiences[].ranking';
  }

  function rankingValueLooksPercent(value) {
    const text = clean(value);
    if (!text) return false;
    if (/[%\uff05]/.test(text)) return true;
    return /^0?\.\d+$/.test(text) || /^1(?:\.0+)?$/.test(text);
  }

  function rankingPercentSelectionValue(profile, item, valueItem, occurrenceByPath) {
    if (!isEducationRankingSelection(item)) return null;
    const value = profileRecordValue(profile, 'educationExperiences[].rankingPercent', valueItem, occurrenceByPath);
    return value ? {
      value,
      key: 'rankingPercent',
      profilePath: 'educationExperiences[].rankingPercent',
      reason: '选择控件优先使用排名百分比'
    } : null;
  }

  async function fillElement({ engine, operationGroup, item, source, target, control, value, key }) {
    if (['radio-group', 'radio', 'checkbox', 'switch'].includes(item.controlKind)) {
      return fillLegacyChoice(source, target, value);
    }
    if (!engine) return { ok: false, type: 'legacy-engine-missing', reason: '备用选择引擎没有加载' };
    if (isDateItem(item)) return engine.fillDate(control, value, key || '');
    if (operationGroup === 'input-select' && typeof engine.fillInputSelect === 'function') {
      return engine.fillInputSelect(control, value, key || '');
    }
    if (operationGroup === 'input-select') return { ok: false, type: 'input-select', reason: 'input-select engine is not loaded' };
    return engine.fillSelect(control, value, key || '');
  }

  async function fillSelectionField(profile, original, valueOriginal, occurrenceByPath, operationGroup, overwrite, options = {}) {
    throwIfCancelled(`填写${original.displayName || original.ref || ''}`);
    const fieldStarted = performance.now();
    const item = reacquireControl(valueOriginal, operationGroup, {
      ...options,
      includeFilledCurrentValues: Boolean(overwrite)
    }) || original;
    const source = auditApi().getSource(item.ref);
    const target = auditApi().getTarget(item.ref);
    const originalValue = profileRecordValue(profile, original.profilePath, valueOriginal, occurrenceByPath);
    const percentPlan = rankingPercentSelectionValue(profile, original, valueOriginal, occurrenceByPath);
    const originalRankingPercentLike = !percentPlan && isEducationRankingSelection(original) && rankingValueLooksPercent(originalValue);
    let value = percentPlan?.value || originalValue;
    let fillKey = percentPlan?.key || (originalRankingPercentLike ? 'rankingPercent' : original.matchedKey || '');
    let fillProfilePath = percentPlan?.profilePath || original.profilePath;
    let valueReason = percentPlan?.reason || (originalRankingPercentLike ? 'ranking value looks like percent; use rankingPercent matcher' : '');
    const control = legacyElement(source, target);
    const before = controlReadback(control, source, target);
    let status = 'filled';
    let reason = '';
    let result = {};
    let afterAttempt = '';
    let after = '';
    let restored = false;
    if (!value) { status = 'missing-profile-value'; reason = '个人资料对应值为空'; }
    else if (!(control instanceof Element) || !control.isConnected) { status = 'stale-control'; reason = '编号对应控件已失效'; }
    else if (!overwrite && (existingControlValue(source) || existingControlValue(target)) && !PLACEHOLDER_VALUE.test(existingControlValue(source) || existingControlValue(target))) {
      status = 'kept-existing'; reason = '页面已有内容';
    } else {
      const engine = globalThis.ResumeComplexControls;
      result = await fillElement({ engine, operationGroup, item, source, target, control, value, key: fillKey });
      throwIfCancelled(`填写${original.displayName || original.ref || ''}`);
      if (!result.ok && percentPlan && originalValue) {
        const percentReason = result.reason || 'rankingPercent selection failed';
        restoreSearchValue(control, before);
        value = originalValue;
        fillKey = original.matchedKey || '';
        fillProfilePath = original.profilePath;
        valueReason = `rankingPercent fallback failed first: ${percentReason}; retried ranking`;
        result = await fillElement({ engine, operationGroup, item, source, target, control, value, key: fillKey });
        throwIfCancelled(`填写${original.displayName || original.ref || ''}`);
        if (!result.ok) result.reason = `${valueReason}; ${result.reason || 'ranking retry did not match'}`;
      }
    }
    if (status === 'filled' && result.status === 'already_satisfied') {
      status = 'kept-existing';
      reason = '页面已有目标值';
    }
    if (status === 'filled' && !result.ok && result.keepAttempt) {
      status = result.status === 'manual_required' ? 'manual-review' : 'filled-needs-review';
      reason = result.reason || '已操作但需要人工审核';
      afterAttempt = controlReadback(control, source, target) || clean((result.selected || []).join?.(' / ') || result.selected || result.actual || '');
      after = afterAttempt;
      markManualReview(control, source, target, reason);
    } else if (status === 'filled' && !result.ok) {
      status = 'selection-failed';
      reason = result.reason || '旧版选择引擎未完成';
      afterAttempt = controlReadback(control, source, target) || clean((result.selected || []).join?.(' / ') || result.selected || result.actual || '');
      after = afterAttempt;
    } else {
      after = controlReadback(control, source, target) || clean((result.selected || []).join?.(' / ') || result.selected || result.actual || '');
    }
    return {
      ref: item.ref,
      field: original.displayName,
      profilePath: fillProfilePath,
      matchedKey: fillKey,
      compoundRole: original.compoundRole || '',
      repeatSection: original.repeatSection,
      repeatIndex: valueOriginal.repeatIndex,
      desired: value,
      status,
      reason: reason || valueReason,
      executed: status !== 'missing-profile-value' && status !== 'stale-control' && status !== 'kept-existing',
      legacyType: result.type || '',
      stage: result.stage || '',
      before,
      afterAttempt,
      after,
      restored,
      selected: clean((result.selected || []).join?.(' / ') || result.selected || result.actual || ''),
      candidateSample: result.candidates || [],
      dynamicDom: result.dynamicDom || null,
      timingComponent: result.timingComponent || '',
      timingTotalMs: result.timingTotalMs || 0,
      timing: Array.isArray(result.timing) ? result.timing : [],
      operation: operationGroup,
      controlKind: item.controlKind || original.controlKind || '',
      ms: Math.round(performance.now() - fieldStarted)
    };
  }

  function timeoutSelectionDetail(profile, original, valueOriginal, occurrenceByPath, operationGroup, started) {
    const value = profileRecordValue(profile, original.profilePath, valueOriginal, occurrenceByPath);
    return {
      ref: original.ref,
      field: original.displayName,
      profilePath: original.profilePath,
      matchedKey: original.matchedKey || '',
      compoundRole: original.compoundRole || '',
      repeatSection: original.repeatSection,
      repeatIndex: valueOriginal.repeatIndex,
      desired: value,
      status: 'timeout-skipped',
      reason: `Field timed out after ${FIELD_TIMEOUT_MS}ms`,
      executed: false,
      legacyType: '',
      stage: 'timeout',
      before: '',
      afterAttempt: '',
      after: '',
      restored: false,
      selected: '',
      candidateSample: [],
      dynamicDom: null,
      timingComponent: '',
      timingTotalMs: 0,
      timing: [],
      operation: operationGroup,
      controlKind: original.controlKind || '',
      ms: Math.round(performance.now() - started)
    };
  }

  async function fillSelectionFieldWithTimeout(profile, original, valueOriginal, occurrenceByPath, operationGroup, overwrite, options = {}) {
    const started = performance.now();
    try {
      return await withAutofillTimeout(
        () => fillSelectionField(profile, original, valueOriginal, occurrenceByPath, operationGroup, overwrite, options),
        FIELD_TIMEOUT_MS,
        original.displayName || original.ref || operationGroup
      );
    } catch (error) {
      if (isCancellationError(error)) throw error;
      if (isTimeoutError(error)) return timeoutSelectionDetail(profile, original, valueOriginal, occurrenceByPath, operationGroup, started);
      throw error;
    }
  }

  async function legacySelectionPhase(profile, report, operationGroup, overwrite, options = {}) {
    const started = performance.now();
    const occurrenceByPath = new Map();
    const details = [];
    const originals = phaseFields(report, operationGroup, options);
    for (const original of originals) {
      throwIfCancelled(`填写${original.displayName || original.ref || ''}`);
      const valueOriginal = valueItemForPhase(original, options);
      const detail = await fillSelectionFieldWithTimeout(profile, original, valueOriginal, occurrenceByPath, operationGroup, overwrite, options);
      debugFieldDetail(operationGroup, detail);
      details.push(detail);
      await wait(180);
      throwIfCancelled(`填写${original.displayName || original.ref || ''}`);
    }
    return phaseFromDetails(operationGroup, details, started);
  }

  async function sequentialFillControls(profile, initialReport, overwrite, options = {}) {
    const started = performance.now();
    const occurrenceByPath = new Map();
    const detailsByGroup = {
      'direct-write': [],
      'input-select': [],
      'closed-select': []
    };
    const originals = orderedFillFields(initialReport, { ...options, includeFilledCurrentValues: Boolean(overwrite) });
    const total = originals.length;
    debugTrace('fill-queue-ready', {
      overwrite: Boolean(overwrite),
      total,
      emptyOnly: !overwrite,
      skippedFilledByCurrentValue: overwrite ? 0 : (initialReport.controls || [])
        .filter((field) => isMappedFillTarget(field))
        .filter((field) => typeof options.filter === 'function' ? options.filter(field) : true)
        .filter((field) => hasCurrentValueInfo(field) && !isCurrentEmptyControl(field))
        .length
    });
    for (const [index, original] of originals.entries()) {
      throwIfCancelled(`填写${original.displayName || original.ref || ''}`);
      const operationGroup = original.operationGroup;
      const valueOriginal = valueItemForPhase(original, options);
      const progressInfo = {
        index: index + 1,
        total,
        operationGroup,
        field: original.displayName || original.fieldLabel || original.ref || '',
        profilePath: original.profilePath || '',
        ref: original.ref || '',
        progressKey: fieldProgressKey(original, options),
        emptyProgressTarget: isCurrentEmptyFillTarget(original)
      };
      options.onProgress?.({
        ...progressInfo,
        stage: 'start'
      });
      if (operationGroup === 'direct-write') {
        const item = reacquireControl(valueOriginal, operationGroup, {
          ...options,
          includeFilledCurrentValues: Boolean(overwrite)
        }) || original;
        const detail = await fillDirectWriteFieldWithTimeout(profile, item, valueOriginal, occurrenceByPath, overwrite);
        attachProgressInfo(detail, progressInfo);
        debugFieldDetail('direct-write', detail);
        detailsByGroup[operationGroup].push(detail);
        options.onProgress?.({
          ...progressInfo,
          stage: 'done',
          status: detail.status || ''
        });
        continue;
      }
      const detail = await fillSelectionFieldWithTimeout(profile, original, valueOriginal, occurrenceByPath, operationGroup, overwrite, options);
      attachProgressInfo(detail, progressInfo);
      debugFieldDetail(operationGroup, detail);
      detailsByGroup[operationGroup].push(detail);
      options.onProgress?.({
        ...progressInfo,
        stage: 'done',
        status: detail.status || ''
      });
      await wait(180);
      throwIfCancelled(`填写${original.displayName || original.ref || ''}`);
    }
    const phases = emptyFillPhases(started);
    phases.directWrite = phaseFromDetails('direct-write', detailsByGroup['direct-write'], started);
    phases.inputSelect = phaseFromDetails('input-select', detailsByGroup['input-select'], started);
    phases.closedSelect = phaseFromDetails('closed-select', detailsByGroup['closed-select'], started);
    return { phases, report: auditApi().diagnosePage() };
  }

  function reportFieldStats(report) {
    const controls = report?.controls || [];
    const fillable = controls.filter((item) => FILL_OPERATION_GROUPS.has(item.operationGroup));
    const mappedFillable = fillable.filter(isMappedFillTarget);
    const currentEmptyMapped = mappedFillable.filter(isCurrentEmptyFillTarget);
    const currentFilledMapped = mappedFillable.filter((item) => hasCurrentValueInfo(item) && !isCurrentEmptyControl(item));
    const ambiguousSkipped = fillable.filter((item) => item.mappingStatus === 'ambiguous').length;
    const unmappedSkipped = fillable.filter((item) => item.mappingStatus === 'unmapped' || (!item.profilePath && item.mappingStatus !== 'ambiguous')).length;
    return {
      totalControls: controls.length,
      fillableControls: fillable.length,
      mappedFillable: mappedFillable.length,
      currentEmptyMapped: currentEmptyMapped.length,
      currentFilledMapped: currentFilledMapped.length,
      ambiguousSkipped,
      unmappedSkipped
    };
  }

  function phaseDetails(phases = {}) {
    return Object.values(phases).flatMap((phase) => phase.details || []);
  }

  function allFillDetails(initialPhases, recordRuns = []) {
    return [
      ...phaseDetails(initialPhases),
      ...recordRuns.flatMap((run) => phaseDetails(run.phases || {}))
    ];
  }

  function fieldProgressKey(item = {}, options = {}) {
    return [
      item.ref || '',
      item.profilePath || '',
      options.repeatSection || item.repeatSection || '',
      options.repeatIndex || item.repeatIndex || '',
      item.operationGroup || '',
      item.compoundRole || '',
      item.matchedKey || '',
      item.field || item.displayName || ''
    ].join('|');
  }

  function hasCurrentValueInfo(item = {}) {
    return Object.prototype.hasOwnProperty.call(item, 'hasCurrentValue')
      || Object.prototype.hasOwnProperty.call(item, 'currentValueState')
      || Object.prototype.hasOwnProperty.call(item, 'currentValue');
  }

  function isCurrentEmptyFillTarget(item = {}) {
    if (!isMappedFillTarget(item)) return false;
    return isCurrentEmptyControl(item);
  }

  function isCurrentEmptyControl(item = {}) {
    if (!FILL_OPERATION_GROUPS.has(item.operationGroup)) return false;
    if (item.currentValueState === 'empty') return true;
    if (item.currentValueState === 'filled') return false;
    if (Object.prototype.hasOwnProperty.call(item, 'hasCurrentValue')) return !item.hasCurrentValue;
    if (hasCurrentValueInfo(item)) return !clean(item.currentValue);
    return true;
  }

  function currentEmptyFillTargets(report, options = {}) {
    return (report?.controls || [])
      .filter((field) => isExecutableFillTarget(field, options))
      .sort((left, right) => fieldOrder(left) - fieldOrder(right));
  }

  function skippedEmptyReviewTargets(report, options = {}) {
    const filter = typeof options.filter === 'function' ? options.filter : () => true;
    return (report?.controls || [])
      .filter((field) => FILL_OPERATION_GROUPS.has(field.operationGroup) && !isMappedFillTarget(field) && isCurrentEmptyControl(field) && filter(field))
      .sort((left, right) => fieldOrder(left) - fieldOrder(right));
  }

  function attachProgressInfo(detail, progressInfo = {}) {
    if (detail && typeof detail === 'object') {
      detail.progressKey = progressInfo.progressKey || '';
      detail.emptyProgressTarget = Boolean(progressInfo.emptyProgressTarget);
    }
    return detail;
  }

  function currentEmptyProgressStats(report, details = [], options = {}) {
    const targets = currentEmptyFillTargets(report, options);
    const total = targets.length;
    const targetKeys = new Set(targets.map((item) => fieldProgressKey(item, options)));
    const skippedTargets = skippedEmptyReviewTargets(report, options);
    const processedKeys = new Set();
    for (const detail of details) {
      const key = detail?.progressKey || fieldProgressKey(detail || {}, options);
      if (!key) continue;
      if (targetKeys.has(key)) processedKeys.add(key);
    }
    const processed = Math.min(total, processedKeys.size);
    return {
      total,
      processed,
      skipped: skippedTargets.length,
      remaining: Math.max(0, total - processed)
    };
  }

  function currentEmptyProgressDetailText(stats = {}, totals = {}) {
    const total = Number(stats.total || 0);
    const processed = Number(stats.processed || 0);
    const skipped = Number(stats.skipped || 0);
    const skippedText = skipped ? `，未映射已跳过 ${skipped}` : '';
    if (!total) return `当前页没有识别到需要补写的空值字段。实际写入 ${totals.filled || 0}，待审核 ${totals.manualReview || 0}，遗漏 ${totals.omitted || 0}。`;
    return `空值字段已处理或跳过 ${processed}/${total}${skippedText}，实际写入 ${totals.filled || 0}，待审核 ${totals.manualReview || 0}，遗漏 ${totals.omitted || 0}。`;
  }

  function operationPerformance(details = []) {
    const groups = new Map();
    for (const item of details) {
      const operation = item.operation || item.legacyType || 'unknown';
      const entry = groups.get(operation) || { operation, count: 0, ms: 0 };
      entry.count += 1;
      entry.ms += Number(item.ms || 0);
      groups.set(operation, entry);
    }
    return [...groups.values()].sort((left, right) => right.ms - left.ms);
  }

  function componentPerformance(details = []) {
    const groups = new Map();
    for (const item of details) {
      const component = item.controlKind || item.legacyType || item.operation || 'unknown';
      const entry = groups.get(component) || {
        component,
        operation: item.operation || '',
        count: 0,
        ms: 0,
        maxMs: 0,
        slowestField: '',
        slowestRef: ''
      };
      const ms = Number(item.ms || 0);
      entry.count += 1;
      entry.ms += ms;
      if (ms >= entry.maxMs) {
        entry.maxMs = ms;
        entry.slowestField = item.field || '';
        entry.slowestRef = item.ref || '';
      }
      groups.set(component, entry);
    }
    return [...groups.values()]
      .map((item) => ({
        ...item,
        avgMs: item.count ? Math.round(item.ms / item.count) : 0
      }))
      .sort((left, right) => right.ms - left.ms);
  }

  function slowFieldPerformance(details = []) {
    return details
      .filter((item) => Number(item.ms || 0) > 0)
      .sort((left, right) => Number(right.ms || 0) - Number(left.ms || 0))
      .slice(0, 8)
      .map((item) => ({
        ref: item.ref,
        field: item.field,
        profilePath: item.profilePath,
        status: item.status,
        reason: item.reason || '',
        operation: item.operation || '',
        controlKind: item.controlKind || '',
        legacyType: item.legacyType || '',
        stage: item.stage || '',
        ms: item.ms,
        timingComponent: item.timingComponent || '',
        timingTotalMs: item.timingTotalMs || 0,
        timing: Array.isArray(item.timing) ? item.timing.slice(0, 20) : []
      }));
  }

  function slowStepPerformance(details = []) {
    const steps = [];
    for (const item of details) {
      const timing = Array.isArray(item.timing) ? item.timing : [];
      for (const step of timing) {
        const ms = Number(step?.ms || 0);
        if (!ms) continue;
        steps.push({
          ref: item.ref,
          field: item.field,
          profilePath: item.profilePath,
          operation: item.operation || '',
          controlKind: item.controlKind || '',
          legacyType: item.legacyType || '',
          status: item.status || '',
          component: item.timingComponent || item.controlKind || item.legacyType || '',
          step: step.name || '',
          ms,
          ok: step.ok,
          phase: step.phase || '',
          timeout: step.timeout || 0,
          trustedTimeout: step.trustedTimeout || 0,
          error: step.error || ''
        });
      }
    }
    return steps
      .sort((left, right) => Number(right.ms || 0) - Number(left.ms || 0))
      .slice(0, 20);
  }

  function updateAutofillDebugOverlay(report, details = []) {
    const api = auditApi();
    if (!debugTraceEnabled) {
      api?.clearAutofillDebugOverlay?.();
      return null;
    }
    return api?.showAutofillDebugOverlay?.({ report, details, runId: debugRunId }) || null;
  }

  function progressRange(start, end, title) {
    return (info = {}) => {
      const total = Math.max(1, Number(info.total || 1));
      const index = Math.max(0, Number(info.index || 0));
      const ratio = Math.min(1, index / total);
      const eased = end <= 90
        ? 1 - Math.pow(1 - ratio, 2.35)
        : Math.pow(ratio, 2.15);
      const percent = start + (end - start) * eased;
      updateProgress({ percent, title });
    };
  }

  function currentEmptyProgress(report, options = {}, { start = 30, end = 90, title = '填写页面' } = {}) {
    const targets = currentEmptyFillTargets(report, options);
    const total = targets.length;
    const targetKeys = new Set(targets.map((item) => fieldProgressKey(item, options)));
    const completedKeys = new Set();
    const labelFor = (info = {}) => clean(info.field || info.profilePath || info.ref || '');
    return (info = {}) => {
      const key = info.progressKey || '';
      const isTarget = info.emptyProgressTarget === true || (key && targetKeys.has(key));
      if (info.stage === 'done' && isTarget && key) completedKeys.add(key);
      const done = Math.min(total, completedKeys.size);
      const ratio = total ? done / total : 1;
      const percent = start + (end - start) * ratio;
      const current = labelFor(info);
      const statusText = info.stage === 'done'
        ? `已处理或跳过空值字段 ${done}/${total}`
        : `空值字段 ${done}/${total}`;
      const currentText = current ? `，当前：${current}` : '';
      updateProgress({
        percent,
        title,
        detail: total ? `${statusText}${currentText}` : '当前页没有识别到需要补写的空值字段。'
      });
    };
  }

  async function runAutofill(profile, overwrite = false, options = {}) {
    cancelAutofillRequested = false;
    debugTraceEnabled = Boolean(options.debug);
    debugTraceEntries = [];
    debugRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    progressLineIndex = 0;
    progressLineBag = [];
    const started = performance.now();
    let stageStarted = started;
    const stages = [];
    const markStage = (name) => {
      const now = performance.now();
      stages.push({ name, ms: Math.round(now - stageStarted) });
      stageStarted = now;
    };

    try {
      debugTrace('run-start', { version: VERSION, overwrite });
      updateProgress({ percent: 3, title: '准备开始', detail: '先看看当前页面能处理多少内容。' });
      const api = auditApi();
      if (!api?.diagnosePage || !api?.getSource) throw new Error('页面解析 API 尚未加载，请刷新页面后重试');
      if (!debugTraceEnabled) api?.clearAutofillDebugOverlay?.();
      profile = profileData(profile);
      if (!profile || typeof profile !== 'object') throw new Error('没有收到个人资料');
      debugTrace('profile-ready', { sections: Object.keys(profile).filter((key) => profile?.[key]).slice(0, 40) });
      throwIfCancelled('准备填写');

      updateProgress({ percent: 10, title: '解析页面', detail: '正在统计可处理的页面元素。' });
      let report = api.diagnosePage();
      const initialFieldStats = reportFieldStats(report);
      debugTrace('page-diagnosed', {
        controls: initialFieldStats.totalControls,
        mappedFillable: initialFieldStats.mappedFillable,
        currentEmptyMapped: initialFieldStats.currentEmptyMapped,
        currentFilledMapped: initialFieldStats.currentFilledMapped,
        ambiguousSkipped: initialFieldStats.ambiguousSkipped,
        unmappedSkipped: initialFieldStats.unmappedSkipped,
        currentValueStats: report.currentValueStats || null
      });
      markStage('解析页面');
      throwIfCancelled('解析页面');

      updateProgress({ percent: 20, title: '准备经历段落' });
      const structures = await ensureRepeatSections(profile, report);
      report = structures.report;
      debugTrace('repeat-sections-ready', {
        sections: structures.details.map((item) => `${item.section}:${item.status}:${item.after || 0}/${item.desired || 0}`).join(', ')
      });
      markStage('处理重复经历');
      throwIfCancelled('处理重复经历');

      const fillTargetReport = report;
      const emptyProgressStart = currentEmptyProgressStats(fillTargetReport);
      const fillProgress = currentEmptyProgress(fillTargetReport, {}, { start: 30, end: 90, title: '填写页面' });
      updateProgress({
        percent: 30,
        title: '填写页面',
        detail: emptyProgressStart.total ? `空值字段 0/${emptyProgressStart.total}` : '当前页没有识别到需要补写的空值字段。'
      });
      const orderedFill = await sequentialFillControls(profile, report, overwrite, {
        onProgress: fillProgress
      });
      report = orderedFill.report;
      markStage('填写可见字段');
      throwIfCancelled('填写可见字段');

      updateProgress({ percent: 90, title: '收尾处理', detail: '正在做最后几步确认。' });
      const sequential = await continueSequentialRepeatSections(profile, report, structures.details, overwrite, {
        onProgress: progressRange(90, 96, '收尾处理')
      });
      report = sequential.report;
      markStage('顺序追加经历');
      throwIfCancelled('顺序追加经历');

      updateProgress({ percent: 98, title: '整理结果', detail: '正在生成本次填写结果。' });
      const initialPhases = orderedFill.phases;
      const initialTotals = sumPhases(initialPhases);
      const sequentialTotals = sumSequentialRuns(sequential.recordRuns);
      const omissions = [
        ...phaseOmissions(initialPhases),
        ...sequential.recordRuns.flatMap((run) => phaseOmissions(run.phases || {}))
      ];
      const details = allFillDetails(initialPhases, sequential.recordRuns);
      const emptyProgress = currentEmptyProgressStats(fillTargetReport, details);
      markStage('汇总结果');
      const totalMs = Math.round(performance.now() - started);
      const response = {
        ok: true,
        complete: omissions.length === 0,
        version: VERSION,
        legacyInteractionVersion: globalThis.ResumeComplexControls?.version || '',
        safety: { submitted: false, navigated: false, deleted: false, reset: false },
        overwrite,
        structures: structures.details,
        sequential: sequential.details,
        phases: initialPhases,
        sequentialPhases: sequential.recordRuns.map((run) => ({
          section: run.section,
          label: run.label,
          recordIndex: run.recordIndex,
          mode: run.mode,
          status: run.status,
          phases: run.phases
        })),
        omissions,
        totals: {
          filled: initialTotals.filled + sequentialTotals.filled,
          completed: initialTotals.completed + sequentialTotals.completed,
          required: initialTotals.required + sequentialTotals.required,
          omitted: omissions.length,
          manualReview: initialTotals.manualReview + sequentialTotals.manualReview,
          attempted: initialTotals.attempted + sequentialTotals.attempted,
          ms: totalMs
        },
        performance: {
          totalMs,
          stages,
          fieldStats: initialFieldStats,
          byOperation: operationPerformance(details),
          byComponent: componentPerformance(details),
          slowFields: slowFieldPerformance(details),
          slowSteps: slowStepPerformance(details)
        },
        progress: {
          currentEmpty: emptyProgress
        },
        debug: debugSnapshot()
      };
      debugTrace('run-finish', {
        complete: response.complete,
        completed: response.totals.completed,
        required: response.totals.required,
        omitted: response.totals.omitted,
        totalMs
      });
      response.debug = debugSnapshot();
      response.debugOverlay = updateAutofillDebugOverlay(report, details);
      finishProgress({
        title: response.complete ? '处理完成' : '处理完成，仍有字段需要检查',
        detail: currentEmptyProgressDetailText(emptyProgress, response.totals)
      });
      return response;
    } catch (error) {
      if (error?.name === 'ResumeAutofillCancelled') {
        const totalMs = Math.round(performance.now() - started);
        debugTrace('run-cancelled', { message: error.message || '', totalMs });
        finishProgress({
          title: '已取消本次填写',
          detail: '已经停止，后面的内容不会继续操作。',
          state: 'cancelled',
          delay: 2200
        });
        return {
          ok: true,
          canceled: true,
          complete: false,
          version: VERSION,
          overwrite,
          message: error.message || '用户已取消填写',
          totals: { filled: 0, completed: 0, required: 0, omitted: 0, manualReview: 0, attempted: 0, ms: totalMs },
          performance: { totalMs, stages },
          debug: debugSnapshot()
        };
      }
      debugTrace('run-error', { message: error?.message || String(error), stack: error?.stack || '' });
      finishProgress({
        title: '填写失败',
        detail: '填写时遇到问题，详情可以在扩展窗口下载日志查看。',
        state: 'error',
        delay: 3200
      });
      throw error;
    }
  }

  function normalizedMessageType(message) {
    return String(message?.type || '').replace(/_V2$/, '');
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = normalizedMessageType(message);
    if (type === 'RESUME_PROFILE_FILL_CURRENT_PAGE') {
      runAutofill(message.profile, Boolean(message.overwrite), { debug: Boolean(message.debug) }).then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error?.message || String(error), debug: debugSnapshot() }));
      return true;
    }
  });
})();
