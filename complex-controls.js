(() => {
  const VERSION = '0.5.27';
  if (globalThis.ResumeComplexControls?.version === VERSION) return;

  const results = new WeakMap();
  const OPTION_SELECTOR = [
    '[role="option"]', '[role="treeitem"]', '[role="gridcell"]', '[aria-selected]',
    '[role="listbox"] li', '[role="menu"] li', '[data-value]', '[data-key]',
    '[class*="option"]', '[class*="Option"]', '[class*="menu"] li', '[class*="Menu"] li',
    '[class*="item"]', '[class*="Item"]', 'li', 'button'
  ].join(',');
  const OVERLAY_SELECTOR = [
    '[role="listbox"]', '[role="dialog"]', '[role="menu"]', '[role="tree"]', '[role="grid"]', '[aria-modal="true"]',
    '[class*="dropdown"]', '[class*="Dropdown"]', '[class*="popup"]', '[class*="Popup"]',
    '[class*="popover"]', '[class*="Popover"]', '[class*="calendar"]', '[class*="Calendar"]',
    '[class*="picker"]', '[class*="Picker"]', '[class*="cascader"]', '[class*="Cascader"]'
  ].join(',');

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function clean(value) {
    return String(value || '').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeOpenText(value) {
    return clean(value).toLowerCase().replace(/\s+/g, '');
  }

  function isOpenTextFallbackKey(key = '') {
    return /^(?:company|companyName|projectName|projectRole|currentTitle|department|campusPosition|awardName|certificateName|certificateNumber|awardingOrganization|github|linkedin|portfolio|summary)$/i.test(String(key || ''));
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  }

  function controls(root) {
    return [...root.querySelectorAll('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[role="combobox"]')]
      .filter((node, index, list) => list.indexOf(node) === index);
  }

  function findTrigger(element) {
    if (element instanceof HTMLSelectElement) return element;
    const candidates = [];
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 7; depth += 1, ancestor = ancestor.parentElement) {
      const roleSemantics = `${ancestor.getAttribute('role') || ''} ${ancestor.getAttribute('aria-haspopup') || ''}`;
      const className = String(ancestor.className || '');
      const classSemantics = /select|dropdown|picker|calendar|cascad/i.test(className) && !/field|form.?item|question|section|block/i.test(className);
      if ((/combobox|listbox|dialog|grid/i.test(roleSemantics) || classSemantics) && controls(ancestor).length <= 3) candidates.push(ancestor);
    }
    if (candidates.length) return candidates.at(-1);
    if (element.getAttribute('role') === 'combobox' || element.getAttribute('aria-haspopup')) return element;
    if (element.readOnly && /日期|年月日|请选择|select|年|月|日/i.test(element.placeholder || '')) return element;
    return null;
  }

  function findTrigger(element) {
    if (element instanceof HTMLSelectElement) return element;
    if (!(element instanceof Element)) return null;
    if (element.matches('.atsx-date-picker-period-month-label')) return element;
    if (element.getAttribute('role') === 'combobox' || element.getAttribute('aria-haspopup')) return element;
    const placeholder = clean(element.getAttribute('placeholder') || '');
    if (element instanceof HTMLInputElement && (element.readOnly || element.getAttribute('aria-readonly') === 'true')
      && /日期|时间|年|月|日|请选择|请输入|选择|籍贯|户籍|城市|地区|省份|select|date|month|yyyy|mm|dd/i.test(placeholder)) return element;
    const siblingButton = element.parentElement?.querySelector?.('button,[role="button"],[aria-haspopup],[class*="select"],[class*="picker"],[class*="calendar"],[class*="Select"],[class*="Picker"],[class*="Calendar"]');
    if (siblingButton && siblingButton !== element && controls(siblingButton).length <= 1) return siblingButton;
    const candidates = [];
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 8; depth += 1, ancestor = ancestor.parentElement) {
      const roleSemantics = `${ancestor.getAttribute('role') || ''} ${ancestor.getAttribute('aria-haspopup') || ''}`;
      const className = String(ancestor.className || '');
      const semantic = /combobox|listbox|dialog|grid|menu/i.test(roleSemantics)
        || /select|dropdown|picker|calendar|cascad|autocomplete/i.test(className);
      const tooBroad = /field|form.?item|question|section|block|module|content|container/i.test(className) && controls(ancestor).length > 3;
      if (semantic && !tooBroad && controls(ancestor).length <= 4) candidates.push(ancestor);
    }
    return candidates.length ? candidates.at(-1) : null;
  }

  function nativeSet(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter ? setter.call(element, value) : (element.value = value);
    for (const type of ['input', 'change']) element.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function click(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element?.getBoundingClientRect?.();
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth)) {
      element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
    if (typeof PointerEvent === 'function') {
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    }
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    if (typeof element.click === 'function') {
      element.click();
    } else {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: window }));
    }
    return true;
  }

  async function trustedClick(element) {
    if (!(element instanceof Element) || !element.isConnected || !visible(element)) return { ok: false, error: 'target-not-visible' };
    const rectBefore = element.getBoundingClientRect();
    if (rectBefore.top < 0 || rectBefore.bottom > window.innerHeight || rectBefore.left < 0 || rectBefore.right > window.innerWidth) {
      try { element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); } catch { element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
      await wait(25);
    }
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return { ok: false, error: 'target-out-of-viewport' };
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(element === hit || element.contains(hit) || hit.contains(element))) return { ok: false, error: 'target-covered' };
    try {
      if (!globalThis.chrome?.runtime?.sendMessage) return { ok: false, error: 'runtime-unavailable' };
      return await chrome.runtime.sendMessage({ type: 'RESUME_AUTOFILL_TRUSTED_CLICK', point: { x, y } });
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  }

  function dismissTransientPopup(element) {
    const target = element instanceof Element ? element : document.activeElement;
    for (const eventType of ['keydown', 'keyup']) {
      target?.dispatchEvent?.(new KeyboardEvent(eventType, {
        bubbles: true,
        cancelable: true,
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27
      }));
      document.dispatchEvent(new KeyboardEvent(eventType, {
        bubbles: true,
        cancelable: true,
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27
      }));
    }
    target?.blur?.();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function optionLeafNodes(nodes) {
    return nodes.filter((candidate) => {
      const text = clean(candidate.innerText || candidate.textContent);
      const children = nodes.filter((other) => other !== candidate && candidate.contains(other) && clean(other.innerText || other.textContent));
      if (children.length >= 2) return false;
      return !children.some((other) => text === clean(other.innerText || other.textContent));
    });
  }

  function optionSearchRoots(trigger, roots = []) {
    const explicit = roots.filter((root) => root instanceof Element && root.isConnected && visible(root) && !root.contains(trigger));
    return explicit.length ? explicit : [document];
  }

  function collectOptions(trigger, beforeVisible = new Set(), roots = []) {
    const candidates = optionSearchRoots(trigger, roots).flatMap((root) => [
      ...(root.matches?.(OPTION_SELECTOR) ? [root] : []),
      ...root.querySelectorAll(OPTION_SELECTOR)
    ])
      .filter((node) => !beforeVisible.has(node) && visible(node) && node !== trigger && !node.contains(trigger))
      .filter((node) => !node.closest?.('.resume-page-audit-overlay,.resume-page-audit-panel,[data-resume-page-audit-ui]'))
      .filter((node) => !node.disabled && node.getAttribute('aria-disabled') !== 'true')
      .filter((node) => clean(node.innerText || node.textContent) && clean(node.innerText || node.textContent).length <= 100);
    return optionLeafNodes([...new Set(candidates)]);
  }

  function overlayRoots(trigger, changedNodes) {
    const roots = [...document.querySelectorAll(OVERLAY_SELECTOR)]
      .filter((node) => visible(node) && !trigger.contains(node) && !node.closest?.('.resume-page-audit-overlay,.resume-page-audit-panel,[data-resume-page-audit-ui]'));
    for (const node of changedNodes) {
      if (!(node instanceof Element) || !node.isConnected || !visible(node) || trigger.contains(node)) continue;
      const root = node.closest(OVERLAY_SELECTOR) || node;
      if (root.closest?.('.resume-page-audit-overlay,.resume-page-audit-panel,[data-resume-page-audit-ui]')) continue;
      roots.push(root);
    }
    return [...new Set(roots)];
  }

  async function probe(element, timeout = 500) {
    const trigger = findTrigger(element);
    if (!trigger) return { ok: false, reason: '未找到可点击的控件触发器' };
    const beforeVisible = new Set([...document.querySelectorAll(OPTION_SELECTOR)].filter(visible));
    const changedNodes = new Set();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => changedNodes.add(node));
        if (mutation.target instanceof Element) changedNodes.add(mutation.target);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-expanded', 'aria-hidden'] });
    click(trigger);
    const started = Date.now();
    let options = [];
    while (Date.now() - started < timeout) {
      await wait(50);
      options = collectOptions(trigger, beforeVisible, overlayRoots(trigger, changedNodes));
      if (options.length) break;
    }
    const roots = overlayRoots(trigger, changedNodes);
    const text = clean(roots.map((root) => root.textContent).join(' '));
    const dateEvidence = /(?:19|20)\d{2}\s*年|\d{1,2}\s*月|calendar|date|日期/i.test(`${text} ${roots.map((root) => root.className).join(' ')}`);
    const columnCount = roots.reduce((max, root) => Math.max(max, [...root.children].filter((child) => visible(child)).length), 0);
    const searchable = !element.readOnly && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement);
    const type = dateEvidence ? 'calendar' : columnCount >= 2 && options.length >= 4 ? 'cascader' : searchable ? 'searchable-select' : 'custom-select';
    return {
      ok: Boolean(options.length || roots.length),
      trigger,
      beforeVisible,
      changedNodes,
      observer,
      close: () => observer.disconnect(),
      options,
      roots,
      type,
      reason: options.length || roots.length ? '' : '点击后未检测到候选项或弹层'
    };
  }

  function aliases(value) {
    const string = String(value || '');
    if (/中国大陆|大陆|中国内地|内地/.test(string)) return ['中国大陆', '大陆', '中国内地', '内地', '+86', '86'];
    if (/中国港澳台|港澳台|香港|澳门|台湾/.test(string)) return ['中国港澳台', '港澳台', '香港', '澳门', '台湾'];
    if (/国外|海外|境外/.test(string)) return ['国外', '海外', '境外'];
    if (/身份证|居民身份证|id\s*card/i.test(string)) return ['身份证', '居民身份证', '中国居民身份证', '中华人民共和国居民身份证', 'id card'];
    if (/护照|passport/i.test(string)) return ['护照', '中国护照', '外国护照', 'passport'];
    if (string === 'yes') return ['是', 'yes', 'true'];
    if (string === 'no') return ['否', 'no', 'false'];
    if (string === '男') return ['男', 'male'];
    if (string === '女') return ['女', 'female'];
    if (string === '本科') return ['本科', '大学本科', 'bachelor'];
    if (string === '硕士') return ['硕士', '研究生', 'master'];
    if (string === '博士') return ['博士', 'phd', 'doctorate'];
    if (string === '学士') return ['学士', '学士学位', 'bachelor'];
    if (string === '双学士') return ['双学士', '双学位'];
    if (string === 'MBA') return ['MBA', '工商管理硕士'];
    if (/cet\s*[-－]?\s*6|大学英语六级|英语六级/i.test(string)) return ['CET-6', 'CET6', '大学英语六级', '英语六级', '六级'];
    if (/cet\s*[-－]?\s*4|大学英语四级|英语四级/i.test(string)) return ['CET-4', 'CET4', '大学英语四级', '英语四级', '四级'];
    return [string];
  }

  function normalizeChoice(value) {
    const normalized = clean(value).toLowerCase().replace(/[·•\s_－-]/g, '');
    const numeric = normalized.match(/^0*(\d+)(?:年|月|日|号)?$/);
    if (numeric) return String(Number(numeric[1]));
    return normalized
      .replace(/^(?:中华人民共和国|中国)/, '')
      .replace(/(?:特别行政区|自治区|自治州|地区|省|市|区|县|旗)$/i, '');
  }

  function optionText(option) {
    return clean(option.innerText || option.textContent || option.getAttribute?.('title') || option.getAttribute?.('aria-label') || option.getAttribute?.('data-value') || '');
  }

  function uniqueMatch(matches, reason) {
    const unique = [...new Set(matches)];
    if (unique.length === 1) return { option: unique[0] };
    if (unique.length > 1) return { reason: `出现 ${unique.length} 个${reason}候选项，无法唯一确定` };
    return null;
  }

  function exactOption(options, value) {
    const targets = aliases(value).map(normalizeChoice).filter(Boolean);
    const decorated = options.map((option) => ({ option, text: normalizeChoice(optionText(option)) })).filter((item) => item.text);
    const exact = uniqueMatch(decorated.filter((item) => targets.includes(item.text)).map((item) => item.option), '同名');
    if (exact) return exact;
    const contained = uniqueMatch(decorated
      .filter((item) => targets.some((target) => item.text.includes(target) || target.includes(item.text)))
      .map((item) => item.option), '近似');
    if (contained) return contained;
    return { reason: '没有找到与资料值完全一致的候选项' };
  }

  function locationPath(value) {
    const raw = clean(value);
    const explicit = raw.split(/\s*(?:\/|>|｜|\||,|，)\s*/).filter(Boolean);
    if (explicit.length > 1) return explicit;
    const parts = raw.match(/.+?(?:特别行政区|自治区|省|市|自治州|地区|盟|区|县|旗)(?=.+|$)/g) || [];
    const remainder = parts.reduce((text, part) => text.replace(part, ''), raw).trim();
    if (remainder) parts.push(remainder);
    return parts.length ? parts : [raw];
  }

  const STRICT_CHOICE_KEYS = new Set(['degree', 'highestDegree', 'academicDegree', 'highestAcademicDegree']);
  const LOCATION_KEYS = new Set([
    'nativePlace', 'nativePlaceProvince', 'nativePlaceCity', 'nativePlaceDistrict',
    'studentOrigin', 'householdRegistration', 'currentResidence', 'city',
    'desiredCity', 'desiredCities', 'location'
  ]);

  function isLocationKey(key = '') {
    const text = String(key || '');
    return LOCATION_KEYS.has(text)
      || /(?:^|\.)(?:nativePlace|studentOrigin|householdRegistration|currentResidence|city|cities|desiredCity|desiredCities|location|province|district|county)(?:$|\.)/i.test(text);
  }

  function isRankingPercentKey(key = '') {
    return /rankingPercent|rankingPercentage|rankingRatio|rankPercent|rankPercentage/i.test(String(key || ''));
  }

  function isStudyModeKey(key = '') {
    return /studyMode|learningForm|learningMode|educationForm|educationMode|培养方式|学习形式|就读形式/i.test(String(key || ''));
  }

  function isEthnicityKey(key = '') {
    const text = String(key || '');
    return /(?:^|\.)(?:ethnicity|ethnicGroup|ethnic|nation)(?:$|\.)|民族|族别/i.test(text);
  }

  function parsePercentValue(value) {
    const text = clean(value);
    if (!text) return null;
    const rankTotal = text.match(/(?:\u7b2c\s*)?(\d+(?:\.\d+)?)\s*(?:\u540d|\/)\s*(?:\/|\u5171)?\s*(\d+(?:\.\d+)?)\s*(?:\u4eba|\u540d)?/i);
    if (rankTotal) {
      const rank = Number(rankTotal[1]);
      const total = Number(rankTotal[2]);
      if (Number.isFinite(rank) && Number.isFinite(total) && total > 0) return (rank / total) * 100;
    }
    const percentNumber = text.match(/(\d+(?:\.\d+)?)\s*[%\uff05]/);
    if (percentNumber) {
      const number = Number(percentNumber[1]);
      return Number.isFinite(number) ? number : null;
    }
    const numberOnly = text.match(/^-?\d+(?:\.\d+)?$/);
    if (!numberOnly) return null;
    const number = Number(text);
    if (!Number.isFinite(number) || number < 0) return null;
    return number > 0 && number <= 1 ? number * 100 : number;
  }

  function parsePercentOption(text) {
    const label = clean(text).replace(/\uff05/g, '%');
    if (!label) return null;
    const range = label.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:-|~|\uff5e|\uff0d|\u2014|\u81f3|\u5230)\s*(\d+(?:\.\d+)?)\s*%?/);
    if (range) {
      const first = Number(range[1]);
      const second = Number(range[2]);
      if (Number.isFinite(first) && Number.isFinite(second)) {
        return { type: 'range', min: Math.min(first, second), max: Math.max(first, second) };
      }
    }
    const upper = label.match(/^(?:top|\u524d)?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:\u4ee5\u5185|\u4ee5\u4e0b)?$/i);
    if (upper) {
      const max = Number(upper[1]);
      if (Number.isFinite(max)) return { type: 'upper', min: 0, max };
    }
    const lower = label.match(/(\d+(?:\.\d+)?)\s*%?\s*\u4ee5\u4e0a/);
    if (lower) {
      const min = Number(lower[1]);
      if (Number.isFinite(min)) return { type: 'lower', min, max: 100 };
    }
    return null;
  }

  function rankingPercentMatchScore(text, value) {
    const target = parsePercentValue(value);
    if (target === null) return 0;
    const optionTextValue = clean(text).replace(/\uff05/g, '%');
    if (/^(?:\u5176\u4ed6|\u5176\u5b83|other)$/i.test(optionTextValue)) return target > 20 ? 80 : 0;
    const exact = optionTextValue.match(/^\s*(?:top|\u524d)?\s*(\d+(?:\.\d+)?)\s*%?\s*$/i);
    if (exact && Math.abs(Number(exact[1]) - target) < 0.01) return 100;
    const bucket = parsePercentOption(optionTextValue);
    if (!bucket) return 0;
    if (bucket.type === 'range') {
      if (target < bucket.min || target > bucket.max) return 0;
      const width = Math.max(0.1, bucket.max - bucket.min);
      return Math.max(88, Math.round(99 - Math.min(width * 0.15, 8)));
    }
    if (bucket.type === 'upper') {
      if (target > bucket.max) return 0;
      const distance = bucket.max - target;
      const distanceWeight = target <= 10 ? 2.0 : target <= 20 ? 1.2 : 0.7;
      return Math.max(62, Math.round(99 - distance * distanceWeight - Math.min(bucket.max * 0.08, 8)));
    }
    if (bucket.type === 'lower') {
      if (target < bucket.min) return 0;
      const distance = target - bucket.min;
      return Math.max(62, Math.round(84 - distance * 0.7));
    }
    return 0;
  }

  function rankingPercentAliases(value) {
    const percent = parsePercentValue(value);
    if (percent === null) return [];
    const list = [];
    const push = (...items) => items.forEach((item) => {
      if (item && !list.includes(item)) list.push(item);
    });
    const fixed = Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2))).replace(/\.0+$/, '');
    const floor = Math.max(0, Math.floor(percent));
    const ceil = Math.ceil(percent);
    const commonBounds = [1, 5, 10, 20, 30, 50, 100];
    const upper = commonBounds.find((bound) => percent <= bound) || ceil;
    const previous = commonBounds.reduce((best, bound) => (bound < upper && bound >= best ? bound : best), 0);
    push(`${fixed}%`, `${floor}%`, `${ceil}%`, `${upper}%`, `\u524d${upper}%`);
    if (previous > 0) push(`${previous}%-${upper}%`, `${previous}% - ${upper}%`);
    if (upper <= 10) push(`${upper}%\u4ee5\u5185`);
    if (percent > 20) push('\u5176\u4ed6', '\u5176\u5b83', 'other');
    return list;
  }

  function aliases(value, key = '') {
    const string = clean(value);
    const lower = string.toLowerCase();
    if (!string) return [];
    const list = [string];
    const push = (...items) => items.forEach((item) => { if (item && !list.includes(item)) list.push(item); });
    if (/中国大陆|大陆|中国内地|内地|\+?86/.test(string)) push('中国大陆', '大陆', '中国内地', '内地', '+86', '86');
    if (/港澳台|香港|澳门|澳門|台湾|臺灣/.test(string)) push('中国港澳台', '港澳台', '香港', '澳门', '台湾');
    if (/国外|海外|境外|外籍/.test(string)) push('国外', '海外', '境外');
    if (/身份证|居民身份证|id\s*card/i.test(string)) push('身份证', '居民身份证', '中国居民身份证', '中华人民共和国居民身份证', 'id card');
    if (/护照|passport/i.test(string)) push('护照', '中国护照', '外国护照', 'passport');
    if (/^(?:yes|true|1|是)$/i.test(string)) push('是', 'yes', 'true');
    if (/^(?:no|false|0|否)$/i.test(string)) push('否', 'no', 'false');
    if (/^(?:男|male)$/i.test(string)) push('男', 'male');
    if (/^(?:女|female)$/i.test(string)) push('女', 'female');
    if (canonicalEducationLevel(string) === 'bachelor') push('本科', '大学本科', 'bachelor');
    if (canonicalEducationLevel(string) === 'master') push('硕士', '硕士研究生', '研究生', 'master');
    if (canonicalEducationLevel(string) === 'doctor') push('博士', '博士研究生', 'phd', 'doctorate');
    if (canonicalEducationLevel(string) === 'associate') push('大专', '专科', 'associate');
    if (canonicalAcademicDegree(string) === 'bachelor') push('学士', '学士学位', 'bachelor');
    if (canonicalAcademicDegree(string) === 'master') push('硕士', '硕士学位', 'master');
    if (canonicalAcademicDegree(string) === 'doctor') push('博士', '博士学位', 'doctor');
    if (/mba|工商管理硕士/i.test(string)) push('MBA', '工商管理硕士');
    if (/cet\s*[-－]?\s*6|大学英语六级|英语六级/i.test(string)) push('CET-6', 'CET6', '大学英语六级', '英语六级', '六级');
    if (/cet\s*[-－]?\s*4|大学英语四级|英语四级/i.test(string)) push('CET-4', 'CET4', '大学英语四级', '英语四级', '四级');
    if (isEthnicityKey(key)) {
      const shortEthnicity = string.replace(/族$/, '');
      if (shortEthnicity && shortEthnicity.length <= 6) push(shortEthnicity, `${shortEthnicity}族`);
    }
    if (/全日制|统招|full.?time/i.test(string) && !/非全日制|part.?time|在职/.test(string)) push('全日制', '普通全日制', '统招', '全日制统招', 'full-time', 'full time');
    if (/非全日制|part.?time|在职/i.test(string)) push('非全日制', '非全日制研究生', '在职', '在职研究生', 'part-time', 'part time');
    if (isRankingPercentKey(key)) push(...rankingPercentAliases(string));
    const dateAlias = string.match(/^((?:19|20)\d{2})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/);
    if (dateAlias) {
      const year = dateAlias[1];
      const month = String(Number(dateAlias[2]));
      const month2 = month.padStart(2, '0');
      const day = dateAlias[3] ? String(Number(dateAlias[3])) : '';
      const day2 = day ? day.padStart(2, '0') : '';
      push(`${year}-${month2}`, `${year}/${month2}`, `${year}.${month2}`, `${year}${month2}`);
      push(`${year}\u5e74${month}\u6708`, `${year}\u5e74${month2}\u6708`);
      if (day) {
        push(`${year}-${month2}-${day2}`, `${year}/${month2}/${day2}`, `${year}.${month2}.${day2}`, `${year}${month2}${day2}`);
        push(`${year}\u5e74${month}\u6708${day}\u65e5`, `${year}\u5e74${month2}\u6708${day2}\u65e5`);
      }
    }
    if (isLocationKey(key)) locationPath(string).forEach((part) => push(part));
    if (lower !== string) push(lower);
    return list;
  }

  function normalizeChoice(value) {
    const normalized = clean(value).toLowerCase()
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/[·•\s_，,、。:：;；()（）\[\]【】<>《》\/\\\-－_]+/g, '');
    const numeric = normalized.match(/^0*(\d+)(?:年|月|日|号)?$/);
    if (numeric) return String(Number(numeric[1]));
    return normalized
      .replace(/^(?:中华人民共和国|中国)/, '')
      .replace(/(?:特别行政区|自治区|自治州|地区|省|市|区|县|旗)$/i, '');
  }

  function normalizedExactText(value) {
    return clean(value).toLowerCase()
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/\s+/g, '')
      .replace(/[，,、。:：;；()（）\[\]【】<>《》]/g, '');
  }

  function canonicalEducationLevel(value) {
    const text = clean(value).toLowerCase();
    if (!text) return '';
    if (/emba/.test(text)) return 'emba';
    if (/mpa/.test(text)) return 'mpa';
    if (/mba|工商管理硕士/.test(text)) return 'mba';
    if (/博士研究生|博士|doctor|ph\.?d|doctoral/.test(text)) return 'doctor';
    if (/硕士研究生|硕士|研究生|master/.test(text)) return 'master';
    if (/本科|大学本科|bachelor|学士/.test(text)) return 'bachelor';
    if (/大专|专科|associate/.test(text)) return 'associate';
    if (/中专/.test(text)) return 'technical_secondary';
    if (/高中/.test(text)) return 'high_school';
    if (/初中/.test(text)) return 'middle_school';
    return '';
  }

  function canonicalAcademicDegree(value) {
    const text = clean(value).toLowerCase();
    if (!text) return '';
    if (/双学士|双学位|double\s*bachelor/.test(text)) return 'double_bachelor';
    if (/emba/.test(text)) return 'emba';
    if (/mpa/.test(text)) return 'mpa';
    if (/mba|工商管理硕士/.test(text)) return 'mba';
    if (/博士|doctor|ph\.?d|doctoral/.test(text)) return 'doctor';
    if (/硕士|学硕|专硕|master/.test(text)) return 'master';
    if (/学士|bachelor/.test(text)) return 'bachelor';
    return '';
  }

  function strictChoiceCanonical(key, value) {
    if (!STRICT_CHOICE_KEYS.has(key)) return '';
    return /academicDegree/i.test(key) ? canonicalAcademicDegree(value) : canonicalEducationLevel(value);
  }

  function strictChoiceMatchScore(text, value, key = '') {
    const targetCanonical = strictChoiceCanonical(key, value);
    if (!targetCanonical) return null;
    const optionCanonical = strictChoiceCanonical(key, text);
    if (!optionCanonical || optionCanonical !== targetCanonical) return 0;
    return normalizedExactText(text) === normalizedExactText(value) ? 100 : 92;
  }

  function textRelationAllowed(key, left, right) {
    if (STRICT_CHOICE_KEYS.has(key)) return false;
    const minLength = Math.min([...left].length, [...right].length);
    return minLength >= 2;
  }

  function normalizeLocationPiece(value) {
    return normalizeChoice(value)
      .replace(/(?:特别行政区|自治区|自治州|地区|省|市|区|县|旗)$/i, '');
  }

  function locationPath(value) {
    const raw = clean(value);
    if (!raw) return [];
    const separated = raw.split(/[\s,，、/／>|]+/).map((part) => clean(part)).filter(Boolean);
    if (separated.length > 1) return separated;
    const matches = raw.match(/.+?(?:特别行政区|自治区|自治州|省|市|地区|盟|区|县|旗)(?=.+|$)/g) || [];
    const remainder = matches.reduce((text, part) => text.replace(part, ''), raw).trim();
    if (remainder) matches.push(remainder);
    return matches.length ? matches : [raw];
  }

  function locationMatchScore(text, value) {
    const option = normalizeLocationPiece(text);
    const parts = locationPath(value).map(normalizeLocationPiece).filter(Boolean);
    if (!option || !parts.length) return 0;
    const leaf = parts.at(-1);
    if (option === leaf) return 100;
    if (option.includes(leaf) || leaf.includes(option)) return Math.min(option.length, leaf.length) >= 2 ? 92 : 0;
    for (const part of parts.slice(0, -1)) {
      if (option === part) return 80;
      if (option.includes(part) || part.includes(option)) return 70;
    }
    return 0;
  }

  function studyModeMatchScore(text, value) {
    const option = clean(text).toLowerCase().replace(/\s+/g, '');
    const target = clean(value).toLowerCase().replace(/\s+/g, '');
    if (!option || !target) return null;
    if (normalizedExactText(option) === normalizedExactText(target)) return 100;

    const targetNonFullTime = /非全日制|part.?time|在职/.test(target);
    const optionNonFullTime = /非全日制|part.?time|在职/.test(option);
    const targetFullTime = /全日制|full.?time/.test(target) && !targetNonFullTime;
    const optionFullTime = /全日制|full.?time/.test(option) && !optionNonFullTime;
    if ((targetFullTime && optionNonFullTime) || (targetNonFullTime && optionFullTime)) return 0;

    const pairedPatterns = [
      [/海外|留学|overseas|abroad/, /海外|留学|overseas|abroad/],
      [/成人高等教育|成人教育/, /成人高等教育|成人教育/],
      [/网络教育|远程教育/, /网络教育|远程教育/],
      [/自学考试|自考/, /自学考试|自考/],
      [/开放教育/, /开放教育/],
      [/义务教育/, /义务教育/]
    ];
    for (const [targetPattern, optionPattern] of pairedPatterns) {
      if (targetPattern.test(target)) return optionPattern.test(option) ? 98 : 0;
    }

    if (/专升本/.test(target)) {
      if (targetNonFullTime || /非统招/.test(target)) return /非统招专升本|非全日制.*专升本/.test(option) ? 98 : 0;
      if (/统招/.test(target)) return /统招专升本/.test(option) && !/非统招/.test(option) ? 98 : 0;
      return /专升本/.test(option) ? 94 : 0;
    }

    if (targetNonFullTime) return optionNonFullTime ? 98 : 0;
    if (targetFullTime) {
      if (optionFullTime && /普通|高等院校|高校|全日制/.test(option)) return 98;
      if (/统招/.test(option) && !/非统招|非全日制/.test(option)) return 86;
      return 0;
    }

    if (/统招/.test(target) && !/非统招/.test(target)) {
      if (/统招/.test(option) && !/非统招/.test(option)) return /专升本/.test(option) ? 96 : 90;
      if (optionFullTime) return 88;
      return 0;
    }
    if (/非统招/.test(target)) return /非统招/.test(option) ? 98 : 0;
    return null;
  }

  function choiceConflict(text, value, key = '') {
    const strictScore = strictChoiceMatchScore(text, value, key);
    if (strictScore !== null) return strictScore <= 0;
    const option = clean(text).toLowerCase();
    const target = clean(value).toLowerCase();
    if (/硕士|master/.test(target) && /博士|doctor|ph\.?d|本科|bachelor|专科|大专|associate/.test(option)) return true;
    if (/博士|doctor|ph\.?d/.test(target) && /硕士|master|本科|bachelor|专科|大专|associate/.test(option)) return true;
    if (/本科|bachelor/.test(target) && /博士|doctor|ph\.?d|硕士|master|专科|大专|associate/.test(option)) return true;
    if (/专科|大专|associate/.test(target) && /博士|doctor|ph\.?d|硕士|master|本科|bachelor/.test(option)) return true;
    const targetNonFullTime = /非全日制|part.?time|在职/.test(target);
    const optionNonFullTime = /非全日制|part.?time|在职/.test(option);
    const targetFullTime = /全日制|full.?time/.test(target) && !targetNonFullTime;
    const optionFullTime = /全日制|full.?time/.test(option) && !optionNonFullTime;
    return (targetFullTime && optionNonFullTime) || (targetNonFullTime && optionFullTime);
  }

  function choiceMatchScore(text, value, key = '') {
    const optionTextValue = text instanceof Element ? optionText(text) : clean(text);
    const strictScore = strictChoiceMatchScore(optionTextValue, value, key);
    if (strictScore !== null) return strictScore;
    if (isRankingPercentKey(key)) {
      const score = rankingPercentMatchScore(optionTextValue, value);
      if (score) return score;
    }
    if (isLocationKey(key)) {
      const score = locationMatchScore(optionTextValue, value);
      if (score) return score;
    }
    if (isStudyModeKey(key)) {
      const score = studyModeMatchScore(optionTextValue, value);
      if (score !== null) return score;
    }
    if (choiceConflict(optionTextValue, value, key)) return 0;
    let best = 0;
    for (const target of aliases(value, key)) {
      const left = normalizedExactText(optionTextValue);
      const right = normalizedExactText(target);
      if (!left || !right) continue;
      if (left === right) best = Math.max(best, 100);
      else if (textRelationAllowed(key, left, right) && (left.includes(right) || right.includes(left))) best = Math.max(best, 88);
      else if (normalizeChoice(optionTextValue) === normalizeChoice(target)) best = Math.max(best, 96);
    }
    return best;
  }

  function choiceMatches(text, value, key = '') {
    return choiceMatchScore(text, value, key) >= (isRankingPercentKey(key) ? 80 : 60);
  }

  function exactOption(options, value, key = '') {
    const ranked = options.map((option) => ({
      option,
      text: optionText(option),
      score: choiceMatchScore(option, value, key)
    })).filter((item) => item.text && item.score >= 60)
      .sort((left, right) => right.score - left.score);
    if (!ranked.length) return { reason: '没有找到与资料值匹配的候选项', candidates: options.slice(0, 20).map((node) => optionText(node)) };
    const top = ranked[0];
    const sameTop = ranked.filter((item) => item.score === top.score);
    if (top.score >= 96 && sameTop.length === 1) return { option: top.option, score: top.score };
    if (top.score >= 80 && (!ranked[1] || top.score - ranked[1].score >= 12)) return { option: top.option, score: top.score };
    return { reason: `候选项不唯一：${ranked.slice(0, 5).map((item) => `${item.text}(${item.score})`).join('、')}`, candidates: ranked.slice(0, 10).map((item) => item.text) };
  }

  function triggerDisplayText(trigger) {
    if (!(trigger instanceof Element)) return '';
    const selected = trigger.querySelector('.phoenix-button__content,.phoenix-select__singleValue,[class*="singleValue"],[class*="selectedValue"],[class*="selected-value"],[class*="display-value"],[class*="DisplayValue"]');
    if (selected) return clean(selected.textContent);
    const clone = trigger.cloneNode(true);
    clone.querySelectorAll?.(`${OPTION_SELECTOR},[role="listbox"],[role="menu"],[class*="selectList"],[class*="SelectList"],[class*="dropdown"],[class*="Dropdown"],[class*="popup"],[class*="Popup"]`)
      .forEach((node) => node.remove());
    return clean(clone.textContent || trigger.getAttribute('aria-label') || trigger.getAttribute('title') || '');
  }

  function displayedValue(element, trigger) {
    return clean(`${element.value || ''} ${element.getAttribute?.('data-value') || ''} ${element.getAttribute?.('title') || ''} ${triggerDisplayText(trigger)}`);
  }

  function choiceVerified(element, trigger, value, key = '') {
    const actual = normalizeChoice(displayedValue(element, trigger));
    return aliases(value, key).some((candidate) => actual.includes(normalizeChoice(candidate)))
      || choiceMatches(displayedValue(element, trigger), value, key);
  }

  function inputAlreadySatisfied(element, value, key = '') {
    const actual = clean(element?.value || element?.textContent || '');
    if (!actual || !clean(value)) return false;
    if (choiceMatches(actual, value, key)) return true;
    if (isLocationKey(key)) {
      const leaf = locationPath(value).at(-1);
      return Boolean(leaf && choiceMatches(actual, leaf, key));
    }
    return aliases(value, key).some((candidate) => normalizeChoice(actual) === normalizeChoice(candidate));
  }

  function controlAlreadySatisfied(element, value, key = '') {
    if (!(element instanceof Element) || !clean(value)) return null;
    if (element instanceof HTMLSelectElement) {
      const selected = element.selectedOptions?.[0];
      const selectedText = clean(selected?.textContent || '');
      if (selectedText && choiceMatches(selectedText, value, key)) {
        return { ok: true, type: 'native-select', status: 'already_satisfied', actual: selectedText, reason: '' };
      }
      return null;
    }
    const trigger = findTrigger(element) || element;
    if (choiceVerified(element, trigger, value, key)) {
      return { ok: true, type: 'custom-select', status: 'already_satisfied', actual: displayedValue(element, trigger), reason: '' };
    }
    if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && inputAlreadySatisfied(element, value, key)) {
      return { ok: true, type: 'input-select', status: 'already_satisfied', actual: element.value, reason: '' };
    }
    return null;
  }

  function optionSelected(option) {
    return Boolean(option?.matches?.('[aria-selected="true"],[aria-checked="true"],[class*="selected"],[class*="Selected"],[class*="checked"],[class*="Checked"],[class*="isSelected"]')
      || option?.querySelector?.('[aria-selected="true"],[aria-checked="true"],[class*="selected"],[class*="Selected"],[class*="checked"],[class*="Checked"],[class*="isSelected"]'));
  }

  async function refreshedOptions(session, timeout = 450) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const roots = overlayRoots(session.trigger, session.changedNodes || new Set());
      const options = collectOptions(session.trigger, session.beforeVisible, roots);
      if (options.length) return options;
      await wait(50);
    }
    return [];
  }

  function panelAction(panel, pattern) {
    if (!(panel instanceof Element)) return null;
    const candidates = [...panel.querySelectorAll('button,[role="button"],a,[tabindex],[class*="button__content"],[class*="button-content"]')]
      .filter(visible)
      .filter((node) => pattern.test(clean(node.textContent)));
    const leaf = candidates.find((node) => ![...node.children].some((child) => pattern.test(clean(child.textContent)))) || candidates[0];
    if (!leaf) return null;
    const clickable = leaf.closest('button,[role="button"],a,[tabindex],[class*="button__wraper"],[class*="button-wrapper"],[class~="phoenix-button"]');
    return clickable && panel.contains(clickable) ? clickable : leaf;
  }

  function confirmationButton(session) {
    const roots = overlayRoots(session.trigger, session.changedNodes || new Set());
    for (const root of roots) {
      const button = panelAction(root, /^(?:确定|确认|完成|应用|选择|保存|ok|confirm|done|apply)$/i);
      if (button) return button;
    }
    return null;
  }

  function sessionPanelRoots(session) {
    const roots = [];
    const changed = session.changedNodes || session.changed || new Set();
    const explicitRoots = session.roots instanceof Set ? [...session.roots] : (Array.isArray(session.roots) ? session.roots : []);
    roots.push(...explicitRoots, ...overlayRoots(session.trigger, changed));
    return [...new Set(roots)]
      .filter((root) => root instanceof Element && root.isConnected && visible(root) && !root.contains(session.trigger))
      .filter((root) => !auditUiNode(root));
  }

  function expandedPanels(session, selector = '') {
    const panels = [];
    for (const root of sessionPanelRoots(session)) {
      panels.push(root);
      const parent = selector ? root.closest(selector) : null;
      if (parent) panels.push(parent);
    }
    return [...new Set(panels)]
      .filter((panel) => panel instanceof Element && panel.isConnected && visible(panel) && !panel.contains(session.trigger));
  }

  function searchConfirmInput(panel) {
    return panel.querySelector([
      'input[type="search"]',
      'input[placeholder*="搜索" i]',
      'input[placeholder*="search" i]',
      'input[aria-label*="搜索" i]',
      'input[aria-label*="search" i]',
      '[class*="search"] input',
      '[class*="Search"] input'
    ].join(','));
  }

  function searchConfirmRowNodes(panel, value, key = '') {
    const selector = [
      '[role="option"]',
      '[role="radio"]',
      '[role="checkbox"]',
      'label',
      'li',
      '[data-value]',
      '[data-key]',
      '[class*="list-item"]',
      '[class*="ListItem"]',
      '[class*="area-item"]',
      '[class*="AreaItem"]',
      '[class*="item-text"]',
      '[class*="ItemText"]',
      '[class*="option"]',
      '[class*="Option"]'
    ].join(',');
    const rows = [...panel.querySelectorAll(selector)]
      .filter((node) => node instanceof Element && node.isConnected && visible(node))
      .filter((node) => !node.querySelector?.('input[type="search"],textarea,select'))
      .filter((node) => !/button.?content|confirm|cancel|footer|header/i.test(String(node.className || '')))
      .map((node) => node.closest('[role="option"],[role="radio"],[role="checkbox"],label,li,[data-value],[data-key],[class*="list-item"],[class*="ListItem"],[class*="area-item"],[class*="AreaItem"]') || node)
      .filter((node) => panel.contains(node));
    return [...new Set(rows)]
      .map((node) => ({ node, text: optionText(node), score: choiceMatchScore(optionText(node), value, key) }))
      .filter((item) => item.text && item.text.length <= 180 && item.score >= 60)
      .sort((left, right) => right.score - left.score || left.text.length - right.text.length)
      .map((item) => item.node);
  }

  function searchConfirmPanel(session) {
    const panels = expandedPanels(session, [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[class*="selector"]',
      '[class*="Selector"]',
      '[class*="layer"]',
      '[class*="Layer"]',
      '[class*="modal"]',
      '[class*="Modal"]',
      '[class*="popup"]',
      '[class*="Popup"]'
    ].join(','));
    return panels.find((panel) => {
      const search = searchConfirmInput(panel);
      const confirm = panelAction(panel, /^(?:确定|确认|完成|应用|选择|保存|ok|confirm|done|apply)$/i);
      return Boolean(search && confirm);
    }) || null;
  }

  async function waitForSearchConfirmPanel(session, timeout = 520) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const panel = searchConfirmPanel(session);
      if (panel) return panel;
      await wait(40);
    }
    return searchConfirmPanel(session);
  }

  function classIndicatesSelected(node) {
    const text = String(node?.className?.baseVal || node?.className || '');
    if (/unchecked|unselected|disabled/i.test(text)) return false;
    return /(?:^|[-_\s])(?:checked|selected|active)(?:$|[-_\s])|RadioChecked|CheckboxChecked|isSelected|is-checked|is-selected/i.test(text);
  }

  function explicitRowMark(row) {
    return row?.querySelector?.([
      'input[type="radio"]',
      'input[type="checkbox"]',
      '[role="radio"]',
      '[role="checkbox"]',
      'svg[class*="RadioChecked"]',
      'svg[class*="RadioUnchecked"]',
      'svg[class*="CheckboxChecked"]',
      'svg[class*="CheckboxUnchecked"]',
      '[class*="radio-checked"]',
      '[class*="radio-unchecked"]',
      '[class*="checkbox-checked"]',
      '[class*="checkbox-unchecked"]'
    ].join(','));
  }

  function checkedInRow(row) {
    if (!(row instanceof Element)) return false;
    const mark = explicitRowMark(row);
    if (mark) {
      if (mark instanceof HTMLInputElement) return Boolean(mark.checked);
      if (mark.getAttribute?.('aria-checked') === 'true') return true;
      if (classIndicatesSelected(mark)) return true;
      const markClass = String(mark.className?.baseVal || mark.className || '');
      if (/unchecked|unselected|RadioUnchecked|CheckboxUnchecked|radio-unchecked|checkbox-unchecked/i.test(markClass)) return false;
      return false;
    }
    if (row.getAttribute('aria-checked') === 'true' || row.getAttribute('aria-selected') === 'true') return true;
    return [row, ...row.querySelectorAll('[aria-checked="true"],[aria-selected="true"],[class]')]
      .some((node) => node !== mark && classIndicatesSelected(node));
  }

  async function waitForRowChecked(row, timeout = 520) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (!row?.isConnected) return false;
      if (checkedInRow(row)) return true;
      await wait(35);
    }
    return checkedInRow(row);
  }

  async function waitForSearchConfirmRowChecked(panel, row, value, key = '', timeout = 620) {
    const started = Date.now();
    let current = row;
    while (Date.now() - started < timeout) {
      if (!current?.isConnected) current = searchConfirmRowNodes(panel, value, key)[0] || current;
      if (current?.isConnected && checkedInRow(current)) return true;
      await wait(35);
    }
    if (!current?.isConnected) current = searchConfirmRowNodes(panel, value, key)[0] || current;
    return Boolean(current?.isConnected && checkedInRow(current));
  }

  function rowClickTargets(row) {
    if (!(row instanceof Element)) return [];
    const mark = explicitRowMark(row);
    const markContainer = mark?.closest?.('label,[role="radio"],[role="checkbox"],[class*="icon-container"],[class*="radio"],[class*="checkbox"],[class*="Radio"],[class*="Checkbox"]');
    const text = [...row.querySelectorAll('[class*="item-text-label"],[class*="area-text-label"],label,span,div')]
      .find((node) => visible(node) && clean(node.textContent) && clean(node.textContent).length <= 80);
    return [...new Set([mark, markContainer, row, text].filter((node) => node instanceof Element && visible(node)))];
  }

  async function waitForPanelClosed(panel, timeout = 700) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (!panel?.isConnected || !visible(panel)) return true;
      await wait(45);
    }
    return !panel?.isConnected || !visible(panel);
  }

  async function fillSearchConfirmSelect(session, element, value, key = '') {
    const panel = await waitForSearchConfirmPanel(session, isLocationKey(key) ? 720 : 520);
    if (!panel) return null;
    const search = searchConfirmInput(panel);
    const path = isLocationKey(key) ? locationPath(value) : [];
    const terms = [...new Set([path.at(-1), String(value), ...aliases(value, key)].map((item) => clean(item)).filter(Boolean))];
    let row = null;
    let candidates = [];
    for (const term of terms.length ? terms : [String(value)]) {
      if (search instanceof HTMLInputElement || search instanceof HTMLTextAreaElement) {
        nativeSet(search, term);
        search.focus?.();
        await wait(220);
      }
      const started = Date.now();
      while (!row && Date.now() - started < 1300) {
        const rows = searchConfirmRowNodes(panel, value, key);
        candidates = rows.slice(0, 12).map((node) => optionText(node));
        row = rows[0] || null;
        if (!row && term !== String(value)) {
          const termRows = searchConfirmRowNodes(panel, term, key);
          candidates = candidates.length ? candidates : termRows.slice(0, 12).map((node) => optionText(node));
          row = termRows[0] || null;
        }
        if (!row) await wait(55);
      }
      if (row) break;
    }
    if (!row) {
      return withDynamicDom(session, { ok: false, type: 'custom-select', status: 'failed', strategy: 'search-confirm', stage: 'candidate-match', reason: 'NO_CANDIDATE_ABOVE_THRESHOLD', target: clean(value), candidates }, value, key);
    }

    const selectedText = optionText(row);
    let selected = checkedInRow(row);
    if (!selected) {
      for (const target of rowClickTargets(row)) {
        click(target);
        selected = await waitForSearchConfirmRowChecked(panel, row, selectedText || value, key, 700);
        if (selected) break;
      }
    }
    if (!selected) {
      for (const target of rowClickTargets(row)) {
        const trusted = await trustedClick(target);
        selected = Boolean(trusted?.ok) && await waitForSearchConfirmRowChecked(panel, row, selectedText || value, key, 900);
        if (selected) break;
      }
    }
    if (!selected) {
      return withDynamicDom(session, { ok: false, type: 'custom-select', status: 'failed', strategy: 'search-confirm', stage: 'select', reason: 'ROW_FOUND_BUT_NOT_CHECKED', target: clean(value), selected: selectedText, candidates }, value, key);
    }

    const confirm = panelAction(panel, /^(?:确定|确认|完成|应用|选择|保存|ok|confirm|done|apply)$/i);
    if (!confirm) {
      return withDynamicDom(session, { ok: false, type: 'custom-select', status: 'failed', strategy: 'search-confirm', stage: 'confirm', reason: 'CONFIRM_BUTTON_NOT_FOUND', target: clean(value), selected: selectedText, candidates }, value, key);
    }
    click(confirm);
    let closed = await waitForPanelClosed(panel, 900);
    if (!closed && confirm.isConnected && visible(confirm)) {
      const trusted = await trustedClick(confirm);
      if (trusted?.ok) closed = await waitForPanelClosed(panel, 900);
    }
    const leaf = isLocationKey(key) ? path.at(-1) || value : value;
    const ok = choiceVerified(element, session.trigger, value, key) || choiceVerified(element, session.trigger, leaf, key) || closed;
    return withDynamicDom(session, {
      ok,
      type: 'custom-select',
      status: ok ? 'success' : 'failed',
      strategy: 'search-confirm',
      stage: 'verify',
      target: clean(value),
      actual: displayedValue(element, session.trigger),
      selected: selectedText,
      candidates,
      reason: ok ? '' : 'VERIFY_FAILED_AFTER_CONFIRM'
    }, value, key);
  }

  function tabRole(text) {
    const label = clean(text).replace(/\s+/g, '').toLowerCase();
    if (/^(?:省份|省)+$/.test(label) || /^(?:province)+$/.test(label)) return 'province';
    if (/^(?:城市|市)+$/.test(label) || /^(?:city)+$/.test(label)) return 'city';
    if (/^(?:县区|区县|区|县)+$/.test(label) || /^(?:district|county)+$/.test(label)) return 'district';
    if (/^(?:省份){2,}$/.test(label) || /^(?:province){2,}$/.test(label)) return 'province';
    if (/^(?:城市){2,}$/.test(label) || /^(?:city){2,}$/.test(label)) return 'city';
    if (/^(?:县区|区县){2,}$/.test(label) || /^(?:district|county){2,}$/.test(label)) return 'district';
    return '';
  }

  function tabbedLocationTabItems(panel) {
    return [...panel.querySelectorAll('[role="tab"],button,li,[tabindex],[class*="Tabs-item"],[class*="tabs-item"],[class*="tab"]')]
      .filter((node) => node instanceof Element && visible(node))
      .map((node) => ({ node, role: tabRole(node.textContent) }))
      .filter((item) => item.role);
  }

  function tabbedLocationTabs(panel) {
    const nodes = tabbedLocationTabItems(panel);
    const map = new Map();
    for (const item of nodes) if (!map.has(item.role)) map.set(item.role, item.node);
    return map;
  }

  function activeTabRole(panel) {
    const active = tabbedLocationTabItems(panel).find(({ node }) => (
      node.matches('[aria-selected="true"],[class*="active"],[class*="Active"],[class*="selected"],[class*="Selected"]')
      || node.getAttribute('aria-selected') === 'true'
    ));
    return active?.role || '';
  }

  function tabbedLocationTagOptions(panel) {
    return [...panel.querySelectorAll('[class*="Tag-container"],[class*="Tag-text"]')]
      .filter((node) => node instanceof Element && node.isConnected && visible(node))
      .map((node) => node.closest('[class*="Tag-container"]') || node)
      .filter((node) => panel.contains(node))
      .filter((node, index, list) => list.indexOf(node) === index)
      .filter((node) => {
        const text = optionText(node);
        return text && text.length <= 30 && !tabRole(text) && !/^(?:热门地区|省份|城市|县区|区县|搜索结果)$/i.test(text);
      });
  }

  function tabbedLocationOptions(panel) {
    const tagNodes = tabbedLocationTagOptions(panel);
    const nodes = [...panel.querySelectorAll('[class*="Tag-container"],[class*="Tag-text"],[role="option"],button,li,[tabindex],[data-value],[data-key]')]
      .filter((node) => node instanceof Element && node.isConnected && visible(node))
      .filter((node) => !node.querySelector?.('input,textarea,select'))
      .filter((node) => !tabRole(node.textContent))
      .filter((node) => !/confirm|cancel|button.?content|footer|header/i.test(String(node.className || '')))
      .map((node) => node.closest('[class*="Tag-container"],[role="option"],button,li,[tabindex],[data-value],[data-key]') || node)
      .filter((node) => panel.contains(node));
    return [...new Set([...tagNodes, ...nodes])].filter((node) => {
      const text = optionText(node);
      return text && text.length <= 80 && !/^(?:确定|确认|取消|完成|应用|选择|ok|cancel|confirm)$/i.test(text);
    });
  }

  function tabbedLocationPanel(session) {
    const selector = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[class*="dropdown"]',
      '[class*="Dropdown"]',
      '[class*="menu-wrapper"]',
      '[class*="MenuWrapper"]',
      '[class*="menuWrapper"]',
      '[class*="container-"]',
      '[class*="page-container"]',
      '[class*="area"]',
      '[class*="Area"]',
      '[class*="cascad"]',
      '[class*="Cascad"]',
      '[class*="picker"]',
      '[class*="Picker"]',
      '[class*="Tabs"]',
      '[class*="tabs"]'
    ].join(',');
    const panels = expandedPanels(session, selector);
    const candidates = new Set();
    for (const panel of panels) {
      candidates.add(panel);
      const closest = panel.closest?.(selector);
      if (closest) candidates.add(closest);
      let ancestor = panel.parentElement;
      for (let depth = 0; ancestor instanceof Element && depth < 4; depth += 1, ancestor = ancestor.parentElement) {
        if (ancestor.matches?.(selector)) candidates.add(ancestor);
      }
      panel.querySelectorAll?.(selector).forEach((node) => candidates.add(node));
    }
    const scored = [...candidates]
      .filter((panel) => panel instanceof Element && panel.isConnected && visible(panel) && !panel.contains(session.trigger) && !auditUiNode(panel))
      .map((panel) => ({
        panel,
        tabs: tabbedLocationTabs(panel).size,
        options: tabbedLocationOptions(panel).length,
        hasConfirm: Boolean(panelAction(panel, /^(?:确定|确认|完成|应用|选择|保存|ok|confirm|done|apply)$/i)),
        area: (() => {
          const rect = panel.getBoundingClientRect();
          return Math.max(1, rect.width * rect.height);
        })()
      }))
      .filter((item) => item.tabs >= 2 && item.options >= 3)
      .sort((left, right) => Number(right.hasConfirm) - Number(left.hasConfirm)
        || right.tabs - left.tabs
        || right.options - left.options
        || left.area - right.area);
    return scored[0]?.panel || null;
  }

  async function waitForTabbedLocationPanel(session, timeout = 620) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const panel = tabbedLocationPanel(session);
      if (panel) return panel;
      await wait(40);
    }
    return tabbedLocationPanel(session);
  }

  function tabbedLocationSignature(panel) {
    const active = activeTabRole(panel);
    const options = tabbedLocationOptions(panel).slice(0, 18).map((node) => optionText(node)).join('|');
    return `${active}:${options}`;
  }

  function tabbedLocationTargets(value) {
    const parts = locationPath(value).filter(Boolean);
    if (!parts.length) return [];
    const direct = /^(?:北京|上海|天津|重庆|香港|澳门)/.test(parts[0]);
    if (parts.length === 1) return [{ role: '', value: parts[0] }];
    if (direct && parts.length === 2) return [
      { role: 'province', value: parts[0] },
      { role: 'city', value: parts[0] },
      { role: 'district', value: parts[1] }
    ];
    const roles = ['province', 'city', 'district'];
    return parts.map((part, index) => ({ role: roles[index] || '', value: part }));
  }

  function tabbedLocationCandidateSample(panel) {
    return tabbedLocationOptions(panel).slice(0, 12).map((node) => optionText(node));
  }

  async function activateTabbedLocationTab(panel, role, value = '', key = '') {
    if (!role) return true;
    const tab = tabbedLocationTabs(panel).get(role);
    if (!tab && activeTabRole(panel) !== role) return true;
    if (tab && activeTabRole(panel) !== role) click(tab);
    const started = Date.now();
    let trustedTried = false;
    while (Date.now() - started < 900) {
      if (!panel.isConnected || !visible(panel)) return true;
      const active = activeTabRole(panel);
      const match = value ? tabbedLocationMatch(panel, value, key).option : null;
      if (active === role && (!value || match || Date.now() - started > 360)) return true;
      if (!active && match) return true;
      if (tab && !trustedTried && Date.now() - started > 360 && active !== role && tab.isConnected && visible(tab)) {
        trustedTried = true;
        const trusted = await trustedClick(tab);
        if (!trusted?.ok) click(tab);
      }
      await wait(45);
    }
    const active = activeTabRole(panel);
    return active === role || (!active && Boolean(value && tabbedLocationMatch(panel, value, key).option));
  }

  function tabbedLocationMatch(panel, value, key = '') {
    const options = tabbedLocationOptions(panel);
    const match = exactOption(options, value, key);
    if (match.option) return { ...match, candidates: options.slice(0, 12).map((node) => optionText(node)) };
    const locationMatch = exactOption(options, value, 'location');
    return { ...locationMatch, candidates: locationMatch.candidates || options.slice(0, 12).map((node) => optionText(node)) };
  }

  async function waitForTabbedLocationMatch(panel, value, key = '', timeout = 900) {
    const started = Date.now();
    let match = tabbedLocationMatch(panel, value, key);
    while (!match.option && Date.now() - started < timeout) {
      if (!panel.isConnected || !visible(panel)) break;
      await wait(45);
      match = tabbedLocationMatch(panel, value, key);
    }
    return match;
  }

  async function waitForTabbedAdvance(panel, before, element, trigger, value, key = '', timeout = 760, nextRole = '') {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (!panel.isConnected || !visible(panel)) return true;
      if (choiceVerified(element, trigger, value, key)) return true;
      if (nextRole && activeTabRole(panel) === nextRole) return true;
      if (tabbedLocationSignature(panel) !== before) return true;
      await wait(45);
    }
    return !panel.isConnected || !visible(panel) || choiceVerified(element, trigger, value, key)
      || Boolean(nextRole && activeTabRole(panel) === nextRole) || tabbedLocationSignature(panel) !== before;
  }

  async function fillTabbedLocationSelect(session, element, value, key = '') {
    let panel = await waitForTabbedLocationPanel(session, 720);
    if (!panel) return null;
    const targets = tabbedLocationTargets(value);
    if (!targets.length) return { ok: false, type: 'custom-select', status: 'failed', strategy: 'tabbed-location', stage: 'normalize', reason: 'EMPTY_LOCATION_PATH', target: clean(value) };
    const selected = [];
    let candidates = [];
    for (let index = 0; index < targets.length; index += 1) {
      panel = tabbedLocationPanel(session) || (panel.isConnected ? panel : null);
      if (!panel || !visible(panel)) break;
      const target = targets[index];
      const tabReady = await activateTabbedLocationTab(panel, target.role, target.value, key);
      if (!tabReady) {
        return withDynamicDom(session, { ok: false, type: 'custom-select', status: 'failed', strategy: 'tabbed-location', stage: 'activate-tab', reason: `TAB_NOT_READY:${target.role}; active=${activeTabRole(panel) || 'unknown'}`, target: clean(value), selected, candidates: tabbedLocationCandidateSample(panel) }, value, key);
      }
      panel = tabbedLocationPanel(session) || panel;
      const match = await waitForTabbedLocationMatch(panel, target.value, key, 900);
      candidates = match.candidates || candidates;
      if (!match.option) {
        return withDynamicDom(session, { ok: false, type: 'custom-select', status: 'failed', strategy: 'tabbed-location', stage: 'candidate-match', reason: `${target.value}: ${match.reason || 'NO_CANDIDATE_ABOVE_THRESHOLD'}; active=${activeTabRole(panel) || 'unknown'}`, target: clean(value), selected, candidates }, value, key);
      }
      const text = optionText(match.option);
      const before = tabbedLocationSignature(panel);
      click(match.option);
      selected.push(text);
      const nextRole = targets[index + 1]?.role || '';
      const advanced = await waitForTabbedAdvance(panel, before, element, session.trigger, target.value, key, 800, nextRole);
      if (!advanced && match.option.isConnected && visible(match.option)) {
        const trusted = await trustedClick(match.option);
        if (trusted?.ok) await waitForTabbedAdvance(panel, before, element, session.trigger, target.value, key, 700, nextRole);
      }
      await wait(120);
    }
    panel = tabbedLocationPanel(session) || (panel?.isConnected ? panel : null);
    if (panel && visible(panel)) {
      const confirm = panelAction(panel, /^(?:确定|确认|完成|应用|选择|保存|ok|confirm|done|apply)$/i);
      if (confirm) {
        click(confirm);
        await waitForPanelClosed(panel, 800);
      }
    }
    const leaf = targets.at(-1)?.value || value;
    const ok = choiceVerified(element, session.trigger, value, key) || choiceVerified(element, session.trigger, leaf, key) || selected.length >= targets.length;
    return withDynamicDom(session, { ok, type: 'custom-select', status: ok ? 'success' : 'failed', strategy: 'tabbed-location', stage: 'verify', target: clean(value), actual: displayedValue(element, session.trigger), selected, candidates, reason: ok ? '' : 'VERIFY_FAILED_AFTER_TABBED_LOCATION' }, value, key);
  }

  async function fillSelect(element, value, key = '') {
    if (element instanceof HTMLSelectElement) {
      const match = exactOption([...element.options], value);
      if (!match.option) return remember(element, { ok: false, type: 'native-select', reason: match.reason });
      element.value = match.option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return remember(element, { ok: element.value === match.option.value, type: 'native-select', actual: match.option.textContent });
    }
    const session = await probe(element);
    if (!session.ok) {
      session.close?.();
      return remember(element, { ok: false, type: 'unknown-select', reason: session.reason });
    }
    const isLocation = ['nativePlace', 'studentOrigin', 'householdRegistration', 'currentResidence', 'city', 'desiredCity'].includes(key);
    const path = isLocation ? locationPath(value) : [String(value)];
    const selected = [];
    const clickedOptions = [];
    for (let level = 0; level < path.length; level += 1) {
      let options = level === 0 ? session.options : await refreshedOptions(session);
      let match = exactOption(options, path[level]);
      if (!match.option && session.type === 'searchable-select' && !element.readOnly) {
        nativeSet(element, path[level]);
        await wait(250);
        options = await refreshedOptions(session);
        match = exactOption(options, path[level]);
      }
      if (!match.option) return remember(element, { ok: false, type: session.type, stage: '候选匹配', reason: `${path[level]}：${match.reason}`, candidates: options.slice(0, 20).map((node) => optionText(node)) });
      click(match.option);
      clickedOptions.push(match.option);
      selected.push(optionText(match.option));
      await wait(260);
      if (level < path.length - 1 && !(await refreshedOptions(session)).length) {
        click(session.trigger);
        await wait(120);
      }
    }
    const readbackOk = choiceVerified(element, session.trigger, path.at(-1));
    const selectedStateOk = clickedOptions.some(optionSelected);
    const ok = readbackOk || selectedStateOk || selected.length === path.length && (session.type === 'cascader' || !element.isConnected);
    return remember(element, { ok, type: session.type, actual: displayedValue(element, session.trigger), selected, stage: '点击后回读', reason: ok ? '' : '候选项已点击，但页面没有显示目标值' });
  }

  async function fillSelect(element, value, key = '') {
    if (element instanceof HTMLSelectElement) {
      const already = controlAlreadySatisfied(element, value, key);
      if (already) return remember(element, already);
      const match = exactOption([...element.options], value, key);
      if (!match.option) return remember(element, { ok: false, type: 'native-select', reason: match.reason, candidates: match.candidates || [] });
      element.value = match.option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return remember(element, { ok: element.value === match.option.value, type: 'native-select', actual: match.option.textContent });
    }
    const already = controlAlreadySatisfied(element, value, key);
    if (already) return remember(element, already);
    const session = await probe(element);
    if (!session.ok) return remember(element, { ok: false, type: 'unknown-select', reason: session.reason });
    try {
      if (isRankingPercentKey(key)) {
        let options = session.options || [];
        if (!options.length) options = await refreshedOptions(session, 900);
        const match = exactOption(options, value, 'rankingPercent');
        if (!match.option) {
          return remember(element, withDynamicDom(session, {
            ok: false,
            type: session.type,
            status: 'failed',
            strategy: 'ranking-visible-options',
            stage: 'candidate-match',
            reason: match.reason || 'NO_CANDIDATE_ABOVE_THRESHOLD',
            target: clean(value),
            normalizedTarget: parsePercentValue(value) === null ? '' : `${Number(parsePercentValue(value).toFixed(4))}%`,
            candidates: match.candidates || options.slice(0, 20).map((node) => optionText(node))
          }, value, 'rankingPercent'));
        }
        const selectedText = optionText(match.option);
        click(match.option);
        await wait(260);
        const confirm = confirmationButton(session);
        if (confirm) {
          click(confirm);
          await wait(180);
        }
        const readbackOk = choiceVerified(element, session.trigger, value, 'rankingPercent');
        const selectedStateOk = optionSelected(match.option);
        const ok = readbackOk || selectedStateOk || !match.option.isConnected || !visible(match.option);
        return remember(element, withDynamicDom(session, {
          ok,
          type: session.type,
          status: ok ? 'success' : 'failed',
          strategy: 'ranking-visible-options',
          stage: 'verify',
          target: clean(value),
          normalizedTarget: parsePercentValue(value) === null ? '' : `${Number(parsePercentValue(value).toFixed(4))}%`,
          actual: displayedValue(element, session.trigger),
          selected: selectedText,
          confidence: (match.score || 100) / 100,
          candidates: match.candidates || options.slice(0, 20).map((node) => optionText(node)),
          reason: ok ? '' : 'VERIFY_FAILED_AFTER_CANDIDATE_CLICK'
        }, value, 'rankingPercent'));
      }
      const isLocation = isLocationKey(key);
      if (isLocation) {
        const tabbed = await fillTabbedLocationSelect(session, element, value, key);
        if (tabbed) return remember(element, tabbed);
        const searchConfirm = await fillSearchConfirmSelect(session, element, value, key);
        if (searchConfirm) return remember(element, searchConfirm);
      } else {
        const searchConfirm = await fillSearchConfirmSelect(session, element, value, key);
        if (searchConfirm) return remember(element, searchConfirm);
      }
      const path = isLocation ? locationPath(value) : [String(value)];
      const searchable = session.type === 'searchable-select' && !element.readOnly && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement);
      const selected = [];
      const clickedOptions = [];

      if (searchable) {
        const terms = [...new Set([
          isLocation ? path.at(-1) : String(value),
          String(value),
          ...aliases(value, key)
        ].filter(Boolean))];
        let lastOptions = session.options || [];
        let lastMatch = null;
        for (const term of terms) {
          nativeSet(element, term);
          await wait(180);
          const options = await refreshedOptions(session, 1000);
          lastOptions = options.length ? options : lastOptions;
          lastMatch = exactOption(lastOptions, value, key);
          if (!lastMatch.option && term !== String(value)) lastMatch = exactOption(lastOptions, term, key);
          if (lastMatch.option) break;
        }
        if (!lastMatch?.option) {
          return remember(element, withDynamicDom(session, {
            ok: false,
            type: session.type,
            stage: '候选匹配',
            reason: lastMatch?.reason || '输入后没有出现匹配候选',
            candidates: lastOptions.slice(0, 20).map((node) => optionText(node))
          }, value, key));
        }
        click(lastMatch.option);
        clickedOptions.push(lastMatch.option);
        selected.push(optionText(lastMatch.option));
        await wait(260);
      } else {
        for (let level = 0; level < path.length; level += 1) {
          const targetValue = path[level];
          let options = level === 0 ? session.options : await refreshedOptions(session, 900);
          let match = exactOption(options, targetValue, key);
          if (!match.option && isLocation) match = exactOption(options, value, key);
          if (!match.option) {
            return remember(element, withDynamicDom(session, {
              ok: false,
              type: session.type,
              stage: '候选匹配',
              reason: `${targetValue}: ${match.reason}`,
              candidates: options.slice(0, 20).map((node) => optionText(node))
            }, value, key));
          }
          click(match.option);
          clickedOptions.push(match.option);
          selected.push(optionText(match.option));
          await wait(260);
          if (level < path.length - 1 && !(await refreshedOptions(session, 450)).length) {
            click(session.trigger);
            await wait(120);
          }
        }
      }

      const confirm = confirmationButton(session);
      if (confirm) {
        click(confirm);
        await wait(180);
      }
      const verifyValue = isLocation ? path.at(-1) || value : value;
      const readbackOk = choiceVerified(element, session.trigger, verifyValue, key) || choiceVerified(element, session.trigger, value, key);
      const selectedStateOk = clickedOptions.some(optionSelected);
      const ok = readbackOk || selectedStateOk || (selected.length >= 1 && (session.type === 'cascader' || !element.isConnected));
      return remember(element, withDynamicDom(session, {
        ok,
        type: session.type,
        actual: displayedValue(element, session.trigger),
        selected,
        stage: '点击后回读',
        reason: ok ? '' : '候选项已点击，但页面没有显示目标值'
      }, value, key));
    } finally {
      session.close?.();
    }
  }

  function auditUiNode(node) {
    return node instanceof Element && Boolean(node.closest('.resume-page-audit-overlay,.resume-page-audit-panel,[data-resume-page-audit-ui]'));
  }

  function beginDynamicInteraction(trigger) {
    const snapshotSelector = `${OVERLAY_SELECTOR},${OPTION_SELECTOR},button,li,[tabindex],[data-value],[data-key]`;
    const beforeVisible = new WeakSet([...document.querySelectorAll(snapshotSelector)].filter(visible));
    const changed = new Set();
    const added = new Set();
    const roots = new Set();
    let revision = 0;
    const remember = (node) => {
      if (!(node instanceof Element) || node === trigger || auditUiNode(node)) return;
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
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'aria-expanded', 'aria-selected', 'aria-checked']
    });
    click(trigger);
    trigger.focus?.();
    return {
      trigger,
      displayTrigger: findTrigger(trigger) || trigger,
      beforeVisible,
      changed,
      added,
      roots,
      observer,
      get revision() { return revision; },
      close: () => observer.disconnect()
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
      && (!session.trigger?.contains(root) || dynamicInsideTrigger) && !auditUiNode(root)) session.roots.add(root);
    return root;
  }

  function discoverInteractionRoots(session) {
    for (const node of session.added) {
      if (!(node instanceof Element) || auditUiNode(node) || !node.isConnected || !visible(node) || node.contains(session.trigger)) continue;
      if (node.matches(OVERLAY_SELECTOR)) session.roots.add(node);
      for (const semantic of node.querySelectorAll(OVERLAY_SELECTOR)) {
        if (visible(semantic) && !semantic.contains(session.trigger) && !auditUiNode(semantic)) session.roots.add(semantic);
      }
    }
    for (const node of session.changed) {
      if (!(node instanceof Element) || auditUiNode(node) || !node.isConnected || !visible(node)
        || node.contains(session.trigger)) continue;
      if (node.matches(OVERLAY_SELECTOR) && !session.trigger.contains(node)) session.roots.add(node);
      else if (node !== document.body && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if ((style.position === 'fixed' || style.position === 'absolute') && !node.contains(session.trigger)) session.roots.add(node);
      }
    }
    return [...session.roots].filter((root) => root.isConnected && visible(root) && !auditUiNode(root));
  }

  function interactionOptionCandidates(session, value, key = '') {
    const roots = discoverInteractionRoots(session);
    const selector = `${OPTION_SELECTOR},button,li,[tabindex],[data-value],[data-key]`;
    const rootNodes = roots.flatMap((root) => [
      ...(root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector)
    ]);
    const fallbackRoots = roots.length ? [] : [...session.added, ...session.changed]
      .filter((node) => node instanceof Element && node !== session.trigger && node.isConnected && visible(node))
      .slice(-12);
    const semantic = fallbackRoots.flatMap((root) => [
      ...(root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector)
    ]);
    const textRoots = roots.length ? roots : fallbackRoots;
    const exactText = textRoots.flatMap((root) => [root, ...root.querySelectorAll('*')]).filter((node) => {
      const text = optionText(node);
      return text && text.length <= 100 && choiceMatchScore(text, value, key) >= 60;
    });
    const candidates = [...new Set([...rootNodes, ...semantic, ...exactText])]
      .filter((node) => node instanceof Element && node.isConnected && visible(node) && !auditUiNode(node))
      .filter((node) => interactionRelated(session, node))
      .filter((node) => !node.disabled && node.getAttribute('aria-disabled') !== 'true')
      .filter((node) => !/menu.?header|group.?keyword|group.?title|placeholder/i.test(String(node.className || '')))
      .filter((node) => optionText(node).length <= 100 && choiceMatchScore(node, value, key) >= 60);
    const leaves = optionLeafNodes(candidates);
    const clickable = leaves.map((node) => node.closest('[role="option"],[role="treeitem"],li,button,[data-value],[data-key],[tabindex]') || node);
    const unique = [...new Set(clickable)].filter((node) => node instanceof Element && visible(node));
    for (const option of unique) rememberInteractionRoot(session, option);
    return unique;
  }

  function matchInteractionCandidate(session, value, key = '', minScore = 92, minGap = 12) {
    const ranked = interactionOptionCandidates(session, value, key).map((option) => ({
      option,
      text: optionText(option),
      score: choiceMatchScore(option, value, key)
    })).filter((item) => item.text && item.score > 0)
      .sort((left, right) => right.score - left.score);
    const candidates = ranked.slice(0, 10).map((item) => [item.text, item.score]);
    if (!ranked.length || ranked[0].score < minScore) {
      return { status: 'no_match', reason: 'NO_CANDIDATE_ABOVE_THRESHOLD', candidates };
    }
    const best = ranked[0];
    const secondScore = ranked[1]?.score || 0;
    const sameScoreCount = ranked.filter((item) => item.score === best.score).length;
    if (best.score < 96 && (sameScoreCount > 1 || best.score - secondScore < minGap)) {
      return { status: 'ambiguous', reason: 'AMBIGUOUS_CANDIDATE', candidates };
    }
    if (best.score >= 96 || best.score - secondScore >= minGap || ranked.length === 1) {
      return { status: 'matched', option: best.option, text: best.text, score: best.score, secondScore, candidates };
    }
    return { status: 'ambiguous', reason: 'AMBIGUOUS_CANDIDATE', candidates };
  }

  async function waitForInputSelectMatch(session, value, key = '', timeout = 1400, minScore = 92, minGap = 12) {
    const started = Date.now();
    let last = { status: 'no_match', candidates: [] };
    while (Date.now() - started < timeout) {
      last = matchInteractionCandidate(session, value, key, minScore, minGap);
      if (last.status === 'matched' || last.status === 'ambiguous') return last;
      await wait(40);
    }
    return last;
  }

  async function waitForRankingPercentInteractionMatch(session, value, timeout = 1600) {
    const started = Date.now();
    let last = { status: 'no_match', reason: 'NO_CANDIDATE_ABOVE_THRESHOLD', candidates: [] };
    while (Date.now() - started < timeout) {
      last = matchInteractionCandidate(session, value, 'rankingPercent', 78, 8);
      if (last.status === 'matched' || last.status === 'ambiguous') return last;
      await wait(40);
    }
    return last;
  }

  function interactionVisibleOptionTexts(session, limit = 30) {
    const roots = discoverInteractionRoots(session);
    const fallbackRoots = roots.length ? [] : [...session.added, ...session.changed]
      .filter((node) => node instanceof Element && node.isConnected && visible(node))
      .slice(-12);
    const nodes = (roots.length ? roots : fallbackRoots).flatMap((root) => [
      ...(root.matches?.(OPTION_SELECTOR) ? [root] : []),
      ...root.querySelectorAll(OPTION_SELECTOR)
    ]);
    return optionLeafNodes([...new Set(nodes)])
      .map((node) => optionText(node))
      .filter(Boolean)
      .slice(0, limit);
  }

  function compactText(value, limit = 100) {
    const text = clean(value);
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  }

  function rectBrief(node) {
    if (!(node instanceof Element)) return null;
    const rect = node.getBoundingClientRect();
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height)
    };
  }

  function classHint(node) {
    const classes = String(node?.getAttribute?.('class') || '').split(/\s+/).filter(Boolean);
    const semantic = classes.filter((name) => /select|dropdown|menu|list|option|item|tag|radio|checkbox|search|date|calendar|picker|tab|panel|confirm|button|input/i.test(name));
    return (semantic.length ? semantic : classes).slice(0, 4).join(' ');
  }

  function dynamicNodeKind(node) {
    if (!(node instanceof Element)) return 'element';
    const tag = node.tagName.toLowerCase();
    const role = node.getAttribute('role') || '';
    const cls = String(node.getAttribute('class') || '');
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || role === 'combobox' || node.isContentEditable) return 'input';
    if (tag === 'button' || role === 'button' || /button|confirm|cancel/i.test(cls)) return 'button';
    if (/radio/i.test(role) || /radio/i.test(cls) || node.getAttribute('type') === 'radio') return 'radio';
    if (/checkbox/i.test(role) || /checkbox/i.test(cls) || node.getAttribute('type') === 'checkbox') return 'checkbox';
    if (/tab/i.test(role) || /tabs?-?item/i.test(cls)) return 'tab';
    if (node.matches?.(OPTION_SELECTOR) || /option|item|tag|cell/i.test(role) || /option|item|tag|cell/i.test(cls)) return 'option';
    return 'element';
  }

  function briefNode(node, index, value = '', key = '') {
    if (!(node instanceof Element)) return null;
    const text = compactText(optionText(node) || node.textContent || '', 100);
    const brief = {
      index,
      kind: dynamicNodeKind(node),
      tag: node.tagName.toLowerCase()
    };
    const role = node.getAttribute('role');
    if (role) brief.role = role;
    if (text) brief.text = text;
    if ('value' in node && clean(node.value)) brief.value = compactText(node.value, 80);
    const placeholder = node.getAttribute('placeholder');
    if (placeholder) brief.placeholder = compactText(placeholder, 80);
    const aria = {
      expanded: node.getAttribute('aria-expanded'),
      selected: node.getAttribute('aria-selected'),
      checked: node.getAttribute('aria-checked'),
      disabled: node.getAttribute('aria-disabled')
    };
    for (const [name, attrValue] of Object.entries(aria)) if (attrValue !== null) brief[`aria-${name}`] = attrValue;
    const dataValue = node.getAttribute('data-value') || node.getAttribute('data-key') || node.getAttribute('data-cy');
    if (dataValue) brief.data = compactText(dataValue, 60);
    const hint = classHint(node);
    if (hint) brief.classHint = hint;
    if (text && value) brief.score = choiceMatchScore(text, value, key);
    brief.rect = rectBrief(node);
    return brief;
  }

  function dynamicDomNodes(root, limit = 45) {
    if (!(root instanceof Element)) return [];
    const selector = [
      'input:not([type="hidden"])', 'textarea', 'select', 'button', 'li',
      '[role]', '[tabindex]', '[data-value]', '[data-key]', '[data-cy]',
      '[aria-selected]', '[aria-checked]',
      '[class*="Tag"]', '[class*="tag"]', '[class*="item"]', '[class*="Item"]',
      '[class*="option"]', '[class*="Option"]'
    ].join(',');
    const nodes = [
      ...(root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector)
    ].filter((node) => node instanceof Element && node.isConnected && visible(node) && !auditUiNode(node));
    return [...new Set(nodes)].slice(0, limit);
  }

  function dynamicDomSummary(session, value = '', key = '', options = {}) {
    if (!session) return null;
    const maxRoots = options.maxRoots || 3;
    const maxNodesPerRoot = options.maxNodesPerRoot || 35;
    const canDiscover = session.added instanceof Set && session.changed instanceof Set;
    const discovered = canDiscover
      ? discoverInteractionRoots(session)
      : [...new Set([...(session.roots || []), ...(session.changedNodes || [])])]
        .filter((node) => node instanceof Element && node.isConnected && visible(node) && !auditUiNode(node));
    const fallbackRoots = discovered.length ? [] : [
      ...(session.added || []),
      ...(session.changed || []),
      ...(session.changedNodes || [])
    ]
      .filter((node) => node instanceof Element && node.isConnected && visible(node) && !auditUiNode(node))
      .filter((node) => node !== document.body && node !== document.documentElement && !node.contains(session.trigger))
      .slice(-8);
    const roots = [...new Set([...(discovered.length ? discovered : fallbackRoots)])]
      .filter((root) => root instanceof Element && root.isConnected && visible(root))
      .slice(0, maxRoots);
    let nodeIndex = 0;
    let optionCount = 0;
    let inputCount = 0;
    let buttonCount = 0;
    const rootSummaries = roots.map((root, rootIndex) => {
      const nodes = dynamicDomNodes(root, maxNodesPerRoot).map((node) => briefNode(node, nodeIndex += 1, value, key)).filter(Boolean);
      optionCount += nodes.filter((node) => node.kind === 'option' || node.kind === 'radio' || node.kind === 'checkbox' || node.kind === 'tab').length;
      inputCount += nodes.filter((node) => node.kind === 'input').length;
      buttonCount += nodes.filter((node) => node.kind === 'button').length;
      return {
        index: rootIndex,
        tag: root.tagName.toLowerCase(),
        role: root.getAttribute('role') || '',
        classHint: classHint(root),
        text: compactText(root.textContent || '', 160),
        rect: rectBrief(root),
        nodes
      };
    });
    const candidateNodes = roots.flatMap((root) => dynamicDomNodes(root, maxNodesPerRoot))
      .map((node) => ({ text: optionText(node), score: value ? choiceMatchScore(node, value, key) : 0 }))
      .filter((item) => item.text && item.text.length <= 100)
      .sort((left, right) => right.score - left.score)
      .slice(0, 12)
      .map((item) => [item.text, item.score]);
    const trigger = briefNode(session.displayTrigger || session.trigger, 0, value, key);
    return {
      target: clean(value),
      key: key || '',
      trigger,
      roots: rootSummaries,
      candidates: candidateNodes,
      counts: {
        roots: rootSummaries.length,
        nodes: nodeIndex,
        options: optionCount,
        inputs: inputCount,
        buttons: buttonCount
      }
    };
  }

  function withDynamicDom(session, result, value = '', key = '') {
    if (!result || result.ok || result.dynamicDom) return result;
    return { ...result, dynamicDom: dynamicDomSummary(session, value, key) };
  }

  async function fillRankingPercentInputSelect(element, value) {
    const raw = clean(value);
    const percent = parsePercentValue(raw);
    if (percent === null) {
      return remember(element, {
        ok: false,
        type: 'input-select',
        status: 'failed',
        strategy: 'ranking-visible-options',
        stage: 'normalize',
        reason: 'INVALID_RANKING_PERCENT_VALUE',
        target: raw
      });
    }
    const before = element.value || '';
    const session = beginDynamicInteraction(element);
    let committed = false;
    try {
      const outcome = await waitForRankingPercentInteractionMatch(session, raw, 1600);
      if (outcome.status === 'ambiguous') {
        const candidates = outcome.candidates?.length ? outcome.candidates : interactionVisibleOptionTexts(session);
        const failed = withDynamicDom(session, {
          ok: false,
          type: 'input-select',
          status: 'manual_required',
          strategy: 'ranking-visible-options',
          stage: 'candidate-match',
          reason: outcome.reason || 'AMBIGUOUS_CANDIDATE',
          target: raw,
          normalizedTarget: `${Number(percent.toFixed(4))}%`,
          candidates
        }, raw, 'rankingPercent');
        restoreInputSelect(element, before);
        return remember(element, failed);
      }
      if (outcome.status !== 'matched') {
        const candidates = outcome.candidates?.length ? outcome.candidates : interactionVisibleOptionTexts(session);
        const failed = withDynamicDom(session, {
          ok: false,
          type: 'input-select',
          status: 'failed',
          strategy: 'ranking-visible-options',
          stage: 'candidate-match',
          reason: outcome.reason || 'NO_CANDIDATE_ABOVE_THRESHOLD',
          target: raw,
          normalizedTarget: `${Number(percent.toFixed(4))}%`,
          candidates
        }, raw, 'rankingPercent');
        restoreInputSelect(element, before);
        return remember(element, failed);
      }
      const selectedText = outcome.text || optionText(outcome.option);
      click(outcome.option);
      const ok = await waitForInputSelectOutcome(session, outcome.option, element, raw, 'rankingPercent', 900);
      if (!ok) {
        const candidates = outcome.candidates?.length ? outcome.candidates : interactionVisibleOptionTexts(session);
        const failed = withDynamicDom(session, {
          ok: false,
          type: 'input-select',
          status: 'failed',
          strategy: 'ranking-visible-options',
          stage: 'verify',
          reason: 'VERIFY_FAILED_AFTER_CANDIDATE_CLICK',
          target: raw,
          normalizedTarget: `${Number(percent.toFixed(4))}%`,
          actual: displayedValue(element, session.displayTrigger),
          selected: selectedText,
          candidates
        }, raw, 'rankingPercent');
        restoreInputSelect(element, before);
        return remember(element, failed);
      }
      committed = true;
      return remember(element, {
        ok: true,
        type: 'input-select',
        status: 'success',
        strategy: 'ranking-visible-options',
        stage: 'verify',
        target: raw,
        normalizedTarget: `${Number(percent.toFixed(4))}%`,
        actual: displayedValue(element, session.displayTrigger),
        selected: selectedText,
        confidence: (outcome.score || 100) / 100,
        secondScore: outcome.secondScore || 0,
        candidates: outcome.candidates?.length ? outcome.candidates : interactionVisibleOptionTexts(session)
      });
    } finally {
      if (!committed) dismissTransientPopup(element);
      session.close?.();
    }
  }

  async function waitForInputSelectOutcome(session, option, element, value, key = '', timeout = 900) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (choiceVerified(element, session.displayTrigger, value, key)
        || optionSelected(option)
        || !option.isConnected
        || !visible(option)) return true;
      await wait(30);
    }
    return choiceVerified(element, session.displayTrigger, value, key)
      || optionSelected(option)
      || !option.isConnected
      || !visible(option);
  }

  async function selectDynamicInputOption(element, value, key = '', timeout = 1200) {
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
      return { ok: false, type: 'dynamic-input-option', status: 'unsupported', reason: 'target is not a text input' };
    }
    const target = clean(value);
    if (!target) return { ok: false, type: 'dynamic-input-option', status: 'empty', reason: 'empty target value' };
    const session = beginDynamicInteraction(element);
    let committed = false;
    try {
      nativeSet(element, target);
      element.focus?.();
      await wait(120);
      const outcome = await waitForInputSelectMatch(session, target, key, timeout);
      if (outcome.status !== 'matched') {
        return {
          ok: false,
          type: 'dynamic-input-option',
          status: outcome.status || 'no_match',
          reason: outcome.reason || 'NO_CANDIDATE_ABOVE_THRESHOLD',
          candidates: outcome.candidates || []
        };
      }
      const selectedText = outcome.text || optionText(outcome.option);
      click(outcome.option);
      const ok = await waitForInputSelectOutcome(session, outcome.option, element, target, key, 900);
      if (!ok) {
        return {
          ok: false,
          type: 'dynamic-input-option',
          status: 'failed',
          stage: 'verify',
          reason: 'VERIFY_FAILED_AFTER_CANDIDATE_CLICK',
          selected: selectedText,
          candidates: outcome.candidates || []
        };
      }
      committed = true;
      return {
        ok: true,
        type: 'dynamic-input-option',
        status: 'success',
        selected: selectedText,
        confidence: (outcome.score || 100) / 100,
        secondScore: outcome.secondScore || 0
      };
    } finally {
      if (!committed) dismissTransientPopup(element);
      session.close?.();
    }
  }

  function restoreInputSelect(element, value) {
    nativeSet(element, value || '');
    dismissTransientPopup(element);
    element.blur?.();
  }

  async function fillInputLocationPanelSelect(element, value, key = '') {
    const session = beginDynamicInteraction(element);
    let result = null;
    try {
      await wait(120);
      if (isLocationKey(key)) {
        const tabbed = await fillTabbedLocationSelect(session, element, value, key);
        if (tabbed) {
          result = { ...tabbed, type: 'input-select', sourceType: tabbed.type };
          return result;
        }
      }
      const searchConfirm = await fillSearchConfirmSelect(session, element, value, key);
      if (searchConfirm) {
        result = { ...searchConfirm, type: 'input-select', sourceType: searchConfirm.type };
        return result;
      }
      return null;
    } finally {
      if (!result?.ok) dismissTransientPopup(element);
      session.close?.();
    }
  }

  async function fillInputSelect(element, value, key = '') {
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
      return remember(element, { ok: false, type: 'input-select', reason: 'target is not a writable text input' });
    }
    if (element.readOnly && !element.disabled) {
      return fillSelect(element, value, key);
    }
    if (element.readOnly || element.disabled) {
      return remember(element, { ok: false, type: 'input-select', reason: 'input is readonly or disabled' });
    }
    const before = element.value || '';
    const raw = String(value || '').trim();
    if (raw) {
      const already = controlAlreadySatisfied(element, raw, key);
      if (already) return remember(element, { ...already, type: 'input-select' });
    }
    if (isRankingPercentKey(key)) return fillRankingPercentInputSelect(element, raw);
    const locationLeaf = isLocationKey(key) ? locationPath(raw).at(-1) : '';
    const terms = [...new Set([locationLeaf, raw, ...aliases(raw, key)].map((item) => clean(item)).filter(Boolean))];
    if (!terms.length) return remember(element, { ok: false, type: 'input-select', reason: 'empty profile value' });
    const panelResult = await fillInputLocationPanelSelect(element, raw, key);
    if (panelResult) return remember(element, panelResult);

    const session = beginDynamicInteraction(element);
    let committed = false;
    let lastOutcome = { status: 'no_match', reason: 'NO_CANDIDATE_ABOVE_THRESHOLD', candidates: [] };
    try {
      const minScore = isStudyModeKey(key) ? 84 : 92;
      const minGap = isStudyModeKey(key) ? 8 : 12;
      for (const term of terms) {
        nativeSet(element, term);
        element.focus?.();
        await wait(120);
        let outcome = await waitForInputSelectMatch(session, raw, key, 1400, minScore, minGap);
        if (outcome.status === 'no_match' && term !== raw) {
          outcome = await waitForInputSelectMatch(session, term, key, 700, minScore, minGap);
        }
        lastOutcome = outcome.candidates?.length ? outcome : lastOutcome;
        if (outcome.status === 'ambiguous') {
          const failed = withDynamicDom(session, {
            ok: false,
            type: 'input-select',
            status: 'manual_required',
            strategy: 'autocomplete',
            stage: 'candidate-match',
            reason: outcome.reason || 'AMBIGUOUS_CANDIDATE',
            target: raw,
            confidence: (outcome.score || 0) / 100,
            candidates: outcome.candidates || []
          }, raw, key);
          restoreInputSelect(element, before);
          return remember(element, failed);
        }
        if (outcome.status !== 'matched') continue;

        const selectedText = outcome.text || optionText(outcome.option);
        click(outcome.option);
        const ok = await waitForInputSelectOutcome(session, outcome.option, element, raw, key, 900)
          || (term !== raw && await waitForInputSelectOutcome(session, outcome.option, element, term, key, 200));
        if (ok) {
          committed = true;
          return remember(element, {
            ok: true,
            type: 'input-select',
            status: 'success',
            strategy: 'autocomplete',
            target: raw,
            actual: displayedValue(element, session.displayTrigger),
            selected: selectedText,
            stage: 'verify',
            confidence: (outcome.score || 100) / 100,
            secondScore: outcome.secondScore || 0
          });
        }
        const failed = withDynamicDom(session, {
          ok: false,
          type: 'input-select',
          status: 'failed',
          strategy: 'autocomplete',
          stage: 'verify',
          reason: 'VERIFY_FAILED_AFTER_CANDIDATE_CLICK',
          target: raw,
          actual: displayedValue(element, session.displayTrigger),
          selected: selectedText,
          confidence: (outcome.score || 0) / 100,
          candidates: outcome.candidates || []
        }, raw, key);
        restoreInputSelect(element, before);
        return remember(element, failed);
      }
      if (isOpenTextFallbackKey(key)) {
        nativeSet(element, raw);
        dismissTransientPopup(element);
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        await wait(120);
        const actual = clean(element.value || displayedValue(element, session.displayTrigger));
        const expected = normalizeOpenText(raw);
        const accepted = Boolean(actual) && (
          normalizeOpenText(actual) === expected
          || normalizeOpenText(actual).includes(expected)
        );
        if (accepted) {
          committed = true;
          return remember(element, {
            ok: true,
            type: 'input-select',
            status: 'success',
            strategy: 'open-text-fallback',
            stage: 'candidate-match',
            reason: lastOutcome.reason || 'NO_CANDIDATE_ABOVE_THRESHOLD',
            target: raw,
            actual,
            confidence: 0.72,
            candidates: lastOutcome.candidates || []
          });
        }
      }
      const failed = withDynamicDom(session, {
        ok: false,
        type: 'input-select',
        status: 'failed',
        strategy: 'autocomplete',
        stage: 'candidate-match',
        reason: lastOutcome.reason || 'NO_CANDIDATE_ABOVE_THRESHOLD',
        target: raw,
        confidence: 0,
        candidates: lastOutcome.candidates || []
      }, raw, key);
      restoreInputSelect(element, before);
      return remember(element, failed);
    } finally {
      if (!committed) dismissTransientPopup(element);
      session.close?.();
    }
  }

  function parseDate(value) {
    const match = String(value || '').match(/((?:19|20)\d{2})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?/);
    return match ? { year: match[1], month: String(Number(match[2])), day: match[3] ? String(Number(match[3])) : '', iso: `${match[1]}-${String(Number(match[2])).padStart(2, '0')}${match[3] ? `-${String(Number(match[3])).padStart(2, '0')}` : ''}` } : null;
  }

  function parseDate(value) {
    const text = clean(value);
    const match = text.match(/((?:19|20)\d{2})\s*(?:[-/.年])\s*(\d{1,2})(?:\s*(?:[-/.月])\s*(\d{1,2}))?/);
    if (!match) return null;
    const year = match[1];
    const month = String(Number(match[2]));
    const day = match[3] ? String(Number(match[3])) : '';
    return {
      year,
      month,
      day,
      monthIso: `${year}-${month.padStart(2, '0')}`,
      iso: `${year}-${month.padStart(2, '0')}${day ? `-${day.padStart(2, '0')}` : ''}`
    };
  }

  function normalizeDate(value) {
    return parseDate(value)?.iso || '';
  }

  function normalizeDates(value) {
    const text = clean(value);
    const dates = [];
    const pattern = /((?:19|20)\d{2})\s*(?:[-/.年])\s*(\d{1,2})(?:\s*(?:[-/.月])\s*(\d{1,2}))?/g;
    let match = null;
    while ((match = pattern.exec(text))) {
      const year = match[1];
      const month = String(Number(match[2])).padStart(2, '0');
      const day = match[3] ? String(Number(match[3])).padStart(2, '0') : '';
      dates.push(`${year}-${month}${day ? `-${day}` : ''}`);
    }
    return [...new Set(dates)];
  }

  function dateReadValues(element, trigger) {
    const values = [];
    const push = (value) => {
      for (const date of normalizeDates(value)) {
        if (date && !values.includes(date)) values.push(date);
      }
    };
    for (const node of [element, trigger]) {
      if (!(node instanceof Element)) continue;
      push(node.value);
      push(node.getAttribute?.('data-value'));
      push(node.getAttribute?.('title'));
      for (const control of controls(node)) {
        push(control.value);
        push(control.getAttribute?.('data-value'));
        push(control.getAttribute?.('title'));
      }
    }
    push(trigger?.textContent);
    push(element?.textContent);
    for (const node of [element, trigger]) {
      const field = node instanceof Element
        ? node.closest('.apply-field,.form-item,.form-item--phoenix,[class*="date-picker"],[class*="DatePicker"],[class*="form-item"],[class*="FormItem"]')
        : null;
      if (field instanceof Element) push(field.textContent);
    }
    return values;
  }

  function dateRead(element, trigger) {
    return dateReadValues(element, trigger)[0] || '';
  }

  function daysInMonth(year, month) {
    return new Date(Number(year), Number(month), 0).getDate();
  }

  function datePartValue(date, part, key = '', hasDay = false) {
    if (part === 'year') return date.year;
    if (part === 'month') return String(Number(date.month));
    if (part === 'day') {
      if (date.day) return String(Number(date.day));
      return /end|graduation/i.test(key) ? String(daysInMonth(date.year, date.month)) : hasDay ? '1' : '';
    }
    return '';
  }

  function localPartEvidence(control) {
    return clean([
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('placeholder'),
      control.getAttribute('data-value'),
      control.getAttribute('value'),
      control.getAttribute('name'),
      control.id,
      control.className,
      control.closest('label')?.textContent
    ].filter(Boolean).join(' ')).toLowerCase();
  }

  function partEvidence(control, root) {
    return clean([localPartEvidence(control), root?.textContent].filter(Boolean).join(' ')).toLowerCase();
  }

  function wholeDateControlEvidence(control) {
    const evidence = localPartEvidence(control);
    if (control instanceof HTMLInputElement && /^(?:date|month)$/i.test(control.type || '')) return true;
    return /(?:yyyy|YYYY)\s*[-/.年]\s*(?:mm|MM)(?:\s*[-/.]\s*(?:dd|DD))?|(?:19|20)\d{2}\s*[-/.年]\s*\d{1,2}(?:\s*[-/.月]\s*\d{1,2})?|^\d{4}\s*[-/.]\s*\d{1,2}(?:\s*[-/.]\s*\d{1,2})?$/.test(evidence);
  }

  function explicitDatePart(control) {
    if (wholeDateControlEvidence(control)) return '';
    const evidence = localPartEvidence(control);
    if (/(?:^|[^a-z])year(?:[^a-z]|$)|(?:^|[^a-z])yyyy(?:[^a-z]|$)|年/.test(evidence)) return 'year';
    if (/(?:^|[^a-z])month(?:[^a-z]|$)|(?:^|[^a-z])mm(?:[^a-z]|$)|月/.test(evidence)) return 'month';
    if (/(?:^|[^a-z])day(?:[^a-z]|$)|(?:^|[^a-z])dd(?:[^a-z]|$)|日|号/.test(evidence)) return 'day';
    return '';
  }

  function datePart(control, index, total, root) {
    const explicit = explicitDatePart(control);
    if (explicit) return explicit;
    if (wholeDateControlEvidence(control)) return '';
    if (total >= 2 && index === 0) return 'year';
    if (total >= 2 && index === 1) return 'month';
    if (total >= 3 && index === 2) return 'day';
    return '';
  }

  function looksLikeWholeDateControlGroup(list) {
    const wholeCount = list.filter(wholeDateControlEvidence).length;
    if (wholeCount >= 2) return true;
    if (list.length === 2 && wholeCount >= 1) return true;
    return false;
  }

  function compoundDateRoot(element) {
    let node = element instanceof Element ? element.parentElement : null;
    for (let depth = 0; node instanceof Element && depth < 7; depth += 1, node = node.parentElement) {
      const list = controls(node).filter((control) => visible(control)
        && control.matches('input:not([type="hidden"]),select,[role="combobox"]'));
      const ownsElement = list.some((control) => control === element || control.contains(element) || element.contains(control));
      if (list.length < 2 || list.length > 4 || !ownsElement) continue;
      if (looksLikeWholeDateControlGroup(list)) continue;
      const evidence = clean(`${node.textContent || ''} ${list.map((control) => partEvidence(control, node)).join(' ')}`);
      const parts = list.map((control, index) => datePart(control, index, list.length, node)).filter(Boolean);
      if (parts.includes('year') && parts.includes('month') && /date|time|year|month|day|yyyy|mm|dd|年|月|日|时间|日期|开始|结束|毕业|出生|到岗/i.test(evidence)) {
        return { root: node, controls: list };
      }
    }
    return null;
  }

  function compoundDate(element) {
    const group = compoundDateRoot(element);
    if (!group) return null;
    const entries = group.controls.map((control, index) => ({
      control,
      part: datePart(control, index, group.controls.length, group.root)
    })).filter((entry) => entry.part);
    const partSet = new Set(entries.map((entry) => entry.part));
    if (!partSet.has('year') || !partSet.has('month')) return null;
    return { ...group, entries };
  }

  function compactDateReading(compound) {
    const values = {};
    for (const { control, part } of compound.entries) {
      values[part] = clean(control.value || control.textContent || '');
    }
    return [values.year, values.month, values.day].filter(Boolean).join('-');
  }

  async function fillCompoundDate(element, date, key = '') {
    const compound = compoundDate(element);
    if (!compound) return null;
    const hasDay = compound.entries.some((entry) => entry.part === 'day');
    const selected = [];
    for (const { control, part } of compound.entries) {
      const partValue = datePartValue(date, part, key, hasDay);
      if (!partValue) continue;
      if (inputAlreadySatisfied(control, partValue, key)) {
        selected.push(`${part}:${partValue}:already`);
        continue;
      }
      if (control instanceof HTMLSelectElement || control.readOnly || control.getAttribute('role') === 'combobox') {
        const result = await fillSelect(control, partValue, key);
        if (!result.ok) return remember(element, { ...result, type: `compound-date-${part}`, actual: compactDateReading(compound) });
      } else if (control instanceof HTMLInputElement) {
        const selectedPart = await selectDynamicInputOption(control, partValue, key, 1200);
        if (selectedPart.ok) {
          selected.push(`${part}:${partValue}:${selectedPart.selected || ''}`);
          await wait(80);
          continue;
        }
        nativeSet(control, partValue);
        dismissTransientPopup(control);
        control.dispatchEvent(new Event('blur', { bubbles: true }));
      } else {
        const result = await fillSelect(control, partValue, key);
        if (!result.ok) return remember(element, { ...result, type: `compound-date-${part}`, actual: compactDateReading(compound) });
      }
      selected.push(`${part}:${partValue}`);
      await wait(80);
    }
    return remember(element, { ok: selected.length >= 2, type: 'compound-date', selected, actual: compactDateReading(compound), reason: selected.length >= 2 ? '' : '未找到可填写的年月控件' });
  }

  function dateNodes(trigger, root = document) {
    const scope = root?.querySelectorAll ? root : document;
    const candidates = [...scope.querySelectorAll('[aria-label],[role="gridcell"],[role="option"],button,li,[tabindex],[data-value],[class*="date"],[class*="Date"],[class*="calendar"],[class*="Calendar"],[class*="year"],[class*="Year"],[class*="month"],[class*="Month"],[class*="day"],[class*="Day"]')]
      .filter((node) => visible(node) && !trigger.contains(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true')
      .filter((node) => clean(node.textContent).length <= 20)
      .filter((node) => !/disabled|outside|other.?month|prev.?month|next.?month/i.test(String(node.className || '')));
    return optionLeafNodes([...new Set(candidates)]);
  }

  function dateToken(nodes, pattern, fullDate = '') {
    if (fullDate) {
      const labelled = nodes.filter((node) => normalizeDate(`${node.getAttribute('aria-label') || ''} ${node.getAttribute('data-value') || ''}`) === fullDate);
      if (labelled.length === 1) return labelled[0];
    }
    const matches = nodes.filter((node) => pattern.test(clean(node.textContent)));
    return matches.length === 1 ? matches[0] : null;
  }

  async function clickDateToken(trigger, pattern, fullDate = '') {
    const candidate = dateToken(dateNodes(trigger), pattern, fullDate);
    if (!candidate) return false;
    click(candidate);
    await wait(130);
    return true;
  }

  async function clickDateMonthToken(session, month) {
    const findMonth = (nodes) => {
      const matches = nodes.filter((node) => monthTextMatches(node.textContent, month));
      if (matches.length === 1) return matches[0];
      return matches.find((node) => /^selected|active|current$/i.test(String(node.getAttribute('aria-selected') || ''))) || null;
    };
    for (const root of datePanelRoots(session)) {
      const candidate = findMonth(dateNodes(session.trigger, root));
      if (candidate instanceof Element) {
        click(candidate);
        await wait(130);
        return true;
      }
    }
    const candidate = findMonth(dateNodes(session.trigger));
    if (!(candidate instanceof Element)) return false;
    click(candidate);
    await wait(130);
    return true;
  }

  async function waitUntil(predicate, timeout = 700, interval = 35) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const value = predicate();
      if (value) return value;
      await wait(interval);
    }
    return predicate();
  }

  function dateExpected(date) {
    return date.day ? date.iso : date.monthIso;
  }

  function dateAccepted(element, trigger, date) {
    const expected = dateExpected(date);
    return dateReadValues(element, trigger).some((actual) => (
      actual === expected || (!date.day && actual.startsWith(`${date.monthIso}-`))
    ));
  }

  function atsxPeriodTarget(element, key = '') {
    if (!(element instanceof Element)) return null;
    const period = element.closest('.atsx-date-picker-period-month') || element.querySelector?.('.atsx-date-picker-period-month');
    let label = element.closest('.atsx-date-picker-period-month-label');
    if (!label && period) {
      const labels = [...period.querySelectorAll('.atsx-date-picker-period-month-label')];
      label = /end|graduation/i.test(key)
        ? period.querySelector('[data-cy$="InputEnd"]') || labels[1]
        : period.querySelector('[data-cy$="InputBegin"]') || labels[0];
    }
    if (!(period instanceof Element) || !(label instanceof Element)) return null;
    const role = /InputEnd$/i.test(label.getAttribute('data-cy') || '') || [...period.querySelectorAll('.atsx-date-picker-period-month-label')].indexOf(label) === 1
      ? 'end'
      : 'start';
    return { period, label, role };
  }

  function atsxPeriodLabelRead(label) {
    if (!(label instanceof Element)) return '';
    const normalized = normalizeDates(label.textContent)[0] || '';
    if (normalized) return normalized;
    const year = clean(label.querySelector('[data-cy="year"],.atsx-date-picker-period-month-label-year')?.textContent);
    const month = clean(label.querySelector('[data-cy="month"],.atsx-date-picker-period-month-label-month')?.textContent);
    if (!/^(?:19|20)\d{2}$/.test(year) || !/^\d{1,2}$/.test(month)) return '';
    return `${year}-${String(Number(month)).padStart(2, '0')}`;
  }

  function atsxPeriodMonthPanel(session) {
    const roots = datePanelRoots(session);
    for (const root of roots) {
      if (root.matches?.('.atsx-date-picker-period-month-panel')) return root;
      const panel = root.querySelector?.('.atsx-date-picker-period-month-panel');
      if (panel instanceof Element && visible(panel)) return panel;
    }
    const visiblePanel = [...document.querySelectorAll('.atsx-date-picker-period-month-panel')]
      .find((panel) => visible(panel) && !session.trigger.contains(panel));
    return visiblePanel || null;
  }

  async function waitForAtsxPeriodMonthPanel(session, timeout = 900) {
    return waitUntil(() => atsxPeriodMonthPanel(session), timeout, 35);
  }

  function atsxPeriodMonthPanelItem(panel, columnIndex, value) {
    if (!(panel instanceof Element)) return null;
    const lists = [...panel.querySelectorAll('.atsx-date-picker-period-month-panel-list')];
    const root = lists[columnIndex] || panel;
    const target = String(value).padStart(columnIndex === 1 ? 2 : 0, '0');
    const items = [...root.querySelectorAll('.atsx-date-picker-period-month-panel-list-item,[data-cy]')];
    return items.find((item) => {
      const data = clean(item.getAttribute('data-cy'));
      const text = clean(item.textContent);
      return data === target || text === target || (columnIndex === 1 && Number(text) === Number(target));
    }) || null;
  }

  async function fillAtsxPeriodMonthDate(element, date, key = '') {
    if (date.day) return null;
    const target = atsxPeriodTarget(element, key);
    if (!target) return null;
    if (atsxPeriodLabelRead(target.label) === date.monthIso) {
      return remember(element, { ok: true, type: 'atsx-period-month', status: 'already_satisfied', actual: date.monthIso, reason: '' });
    }
    const session = await probe(target.label, 800);
    if (!session.ok) {
      session.close?.();
      return remember(element, withDynamicDom(session, { ok: false, type: 'atsx-period-month', reason: session.reason || 'ATSX 年月面板未打开' }, date.monthIso, key));
    }
    let ok = false;
    try {
      const panel = await waitForAtsxPeriodMonthPanel(session, 900);
      if (!(panel instanceof Element)) {
        return remember(element, withDynamicDom(session, { ok: false, type: 'atsx-period-month', reason: 'ATSX 年月面板未出现' }, date.monthIso, key));
      }
      const yearItem = atsxPeriodMonthPanelItem(panel, 0, date.year);
      if (!(yearItem instanceof Element)) {
        return remember(element, withDynamicDom(session, { ok: false, type: 'atsx-period-month', reason: `ATSX 年份列没有找到 ${date.year}` }, date.year, key));
      }
      click(yearItem);
      await wait(90);
      const monthItem = atsxPeriodMonthPanelItem(panel, 1, date.month);
      if (!(monthItem instanceof Element)) {
        return remember(element, withDynamicDom(session, { ok: false, type: 'atsx-period-month', reason: `ATSX 月份列没有找到 ${date.month.padStart?.(2, '0') || date.month}` }, date.month, key));
      }
      await clickDateComponentPart(monthItem, () => atsxPeriodLabelRead(target.label) === date.monthIso || !panel.isConnected || !visible(panel), 900);
      await waitUntil(() => atsxPeriodLabelRead(target.label) === date.monthIso || !panel.isConnected || !visible(panel), 900, 35);
      const actual = atsxPeriodLabelRead(target.label);
      ok = actual === date.monthIso;
      return remember(element, withDynamicDom(session, { ok, type: 'atsx-period-month', actual, selected: `${date.year}-${date.month.padStart(2, '0')}`, reason: ok ? '' : 'ATSX 年月已点击，但对应起止标签没有回读到目标值' }, date.monthIso, key));
    } finally {
      if (!ok) dismissTransientPopup(target.label);
      session.close?.();
    }
  }

  async function clickDateComponentPart(target, accepted, timeout = 650) {
    if (!(target instanceof Element) || !visible(target)) return false;
    click(target);
    await waitUntil(accepted, timeout, 35);
    if (accepted()) return true;
    const trusted = await trustedClick(target);
    if (!trusted?.ok) return false;
    await waitUntil(accepted, Math.max(timeout, 900), 35);
    return Boolean(accepted());
  }

  function monthNumberFromText(text) {
    const label = clean(text);
    const numeric = label.match(/^0?([1-9]|1[0-2])(?:月)?$/);
    if (numeric) return Number(numeric[1]);
    const names = ['一','二','三','四','五','六','七','八','九','十','十一','十二'];
    const cn = names.findIndex((name) => label === name || label === `${name}月`);
    if (cn >= 0) return cn + 1;
    const english = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12
    };
    return english[label.toLowerCase().replace(/\./g, '').replace(/\s+/g, '')] || 0;
  }

  function monthTextMatches(text, month) {
    return monthNumberFromText(text) === Number(month);
  }

  async function waitForDatePanel(session, predicate, timeout = 900) {
    return waitUntil(() => {
      const roots = datePanelRoots(session);
      return roots.find((root) => root instanceof Element && predicate(root)) || null;
    }, timeout, 35);
  }

  async function waitForPanelAccepted(panel, element, trigger, date, timeout = 800) {
    return waitUntil(() => dateAccepted(element, trigger, date) || !panel?.isConnected || !visible(panel), timeout, 35);
  }

  function datePanelRoots(session) {
    return overlayRoots(session.trigger, session.changedNodes || new Set())
      .filter((root) => /calendar|date|picker|panel|dialog|popup|popover/i.test(`${root.className || ''} ${root.getAttribute('role') || ''} ${root.textContent || ''}`));
  }

  function dateNavButton(session, direction) {
    const pattern = direction < 0
      ? /上一|上月|上年|前|prev|previous|left/i
      : /下一|下月|下年|后|next|right/i;
    for (const root of datePanelRoots(session)) {
      const candidates = [...root.querySelectorAll('button,[role="button"],a,[tabindex],[aria-label],[title],[class*="prev"],[class*="next"],[class*="Prev"],[class*="Next"]')]
        .filter(visible)
        .filter((node) => !node.disabled && node.getAttribute('aria-disabled') !== 'true');
      const button = candidates.find((node) => pattern.test(clean(`${node.textContent || ''} ${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${node.className || ''}`)));
      if (button) return button;
    }
    return null;
  }

  async function clickYearWithNavigation(session, year) {
    const target = Number(year);
    for (let attempt = 0; attempt < 16; attempt += 1) {
      if (await clickDateToken(session.trigger, new RegExp(`^${year}(?:年)?$`))) return true;
      const years = dateNodes(session.trigger)
        .map((node) => clean(node.textContent).match(/^((?:19|20)\d{2})(?:年)?$/)?.[1])
        .filter(Boolean)
        .map(Number);
      if (!years.length) return false;
      const direction = target < Math.min(...years) ? -1 : target > Math.max(...years) ? 1 : 0;
      if (!direction) return false;
      const button = dateNavButton(session, direction);
      if (!button) return false;
      click(button);
      await wait(160);
    }
    return false;
  }

  async function fillPhoenixMonthPanelDate(element, date, session) {
    if (date.day) return null;
    const trigger = session.trigger;
    const panel = await waitForDatePanel(session, (root) => root.querySelector('.phoenix-calendar-month-panel-year-select-content'), 420);
    if (!panel) return null;
    const targetYear = Number(date.year);
    const yearNumber = () => Number(clean(panel.querySelector('.phoenix-calendar-month-panel-year-select-content')?.textContent).match(/(?:19|20)\d{2}/)?.[0]);
    const previousYear = () => panel.querySelector('.phoenix-calendar-month-panel-prev-year-btn');
    const nextYear = () => panel.querySelector('.phoenix-calendar-month-panel-next-year-btn');
    for (let step = 0; step < 80 && yearNumber() && yearNumber() !== targetYear; step += 1) {
      const before = yearNumber();
      const arrow = targetYear < before ? previousYear() : nextYear();
      if (!(arrow instanceof Element)) return false;
      const changed = await clickDateComponentPart(arrow, () => yearNumber() && yearNumber() !== before, 420);
      if (!changed) return false;
    }
    if (yearNumber() !== targetYear) return false;
    const month = [...panel.querySelectorAll('.phoenix-calendar-month-panel-month')]
      .find((node) => visible(node) && monthTextMatches(node.textContent, date.month));
    const monthCell = month?.closest('[role="gridcell"]') || month;
    if (!(monthCell instanceof Element)) return false;
    await clickDateComponentPart(monthCell, () => dateAccepted(element, trigger, date) || !panel.isConnected || !visible(panel), 900);
    await waitForPanelAccepted(panel, element, trigger, date, 900);
    return dateAccepted(element, trigger, date) || !panel.isConnected || !visible(panel);
  }

  async function fillSdBasicPanelDate(element, date, session) {
    const trigger = session.trigger;
    const panel = await waitForDatePanel(session, (root) => root.querySelector('[class*="basic-selector-year"],[class*="basic-year-container"]'), 360);
    if (!panel) return null;
    const targetYear = Number(date.year);
    const targetMonth = Number(date.month);
    const yearText = () => clean(panel.querySelector('[class*="basic-selector-year"]')?.textContent);
    const yearNumber = () => Number(yearText().match(/(?:19|20)\d{2}/)?.[0]);
    const previousYear = () => panel.querySelector('[class*="icondoubleLeft"],[class*="icon-double-left"],[aria-label*="上一年"],[title*="上一年"]');
    const nextYear = () => panel.querySelector('[class*="icondoubleRight"],[class*="icon-double-right"],[aria-label*="下一年"],[title*="下一年"]');
    for (let step = 0; step < 80 && yearNumber() && yearNumber() !== targetYear; step += 1) {
      const before = yearNumber();
      const arrow = targetYear < before ? previousYear() : nextYear();
      if (!(arrow instanceof Element)) return false;
      const changed = await clickDateComponentPart(arrow, () => yearNumber() && yearNumber() !== before, 450);
      if (!changed) return false;
    }
    if (yearNumber() && yearNumber() !== targetYear) return false;

    const monthCell = [...panel.querySelectorAll('[class*="basic-year-item"],[class*="month"],[class*="Month"],[role="option"],[role="gridcell"],button,li')]
      .filter((node) => visible(node) && clean(node.textContent).length <= 10)
      .find((node) => monthTextMatches(node.textContent, targetMonth));
    if (monthCell) {
      await clickDateComponentPart(
        monthCell.closest('[role="gridcell"],[role="option"],button,li') || monthCell,
        () => dateAccepted(element, trigger, date) || !panel.isConnected || !visible(panel),
        900
      );
      await wait(160);
      if (!date.day) {
        await waitForPanelAccepted(panel, element, trigger, date, 900);
        return dateAccepted(element, trigger, date) || !panel.isConnected || !visible(panel);
      }
    } else {
      const currentMonthNumber = () => {
        const text = clean(panel.querySelector('[class*="basic-selector-month"]')?.textContent);
        const numeric = text.match(/\d{1,2}/)?.[0];
        if (numeric) return Number(numeric);
        return monthNumberFromText(text);
      };
      const previousMonth = () => panel.querySelector('[class*="iconleft-"],[class*="icon-left"],[aria-label*="上一月"],[title*="上一月"]');
      const nextMonth = () => panel.querySelector('[class*="iconright-"],[class*="icon-right"],[aria-label*="下一月"],[title*="下一月"]');
      for (let step = 0; step < 36 && currentMonthNumber() && (yearNumber() !== targetYear || currentMonthNumber() !== targetMonth); step += 1) {
        const before = `${yearNumber()}-${currentMonthNumber()}`;
        const currentIndex = yearNumber() * 12 + currentMonthNumber();
        const targetIndex = targetYear * 12 + targetMonth;
        const arrow = targetIndex < currentIndex ? previousMonth() : nextMonth();
        if (!(arrow instanceof Element)) return false;
        const changed = await clickDateComponentPart(arrow, () => `${yearNumber()}-${currentMonthNumber()}` !== before, 420);
        if (!changed) return false;
      }
      if (!date.day) {
        if (dateAccepted(element, trigger, date)) return true;
        const submitDay = [...panel.querySelectorAll('[class*="basic-item-wrapper"],[role="gridcell"],button,td')]
          .filter((node) => visible(node) && !/fade|disabled|outside|prev|next/i.test(String(node.className || '')))
          .find((node) => Number.isFinite(Number(clean(node.querySelector?.('[class*="basic-date-item"]')?.textContent || node.textContent))));
        if (!(submitDay instanceof Element)) return false;
        await clickDateComponentPart(submitDay, () => dateAccepted(element, trigger, date) || !panel.isConnected || !visible(panel), 900);
        return dateAccepted(element, trigger, date) || !panel.isConnected || !visible(panel);
      }
    }

    if (date.day) {
      const dayCell = [...panel.querySelectorAll('[class*="basic-item-wrapper"],[role="gridcell"],button,td')]
        .filter((node) => visible(node) && !/fade|disabled|outside|prev|next/i.test(String(node.className || '')))
        .find((node) => Number(clean(node.querySelector?.('[class*="basic-date-item"]')?.textContent || node.textContent)) === Number(date.day));
      if (!(dayCell instanceof Element)) return false;
      await clickDateComponentPart(dayCell, () => dateAccepted(element, trigger, date) || !panel.isConnected || !visible(panel), 900);
      await waitForPanelAccepted(panel, element, trigger, date, 900);
      return dateAccepted(element, trigger, date) || !panel.isConnected || !visible(panel);
    }
    return false;
  }

  async function fillCalendarDate(element, date, session) {
    const trigger = session.trigger;
    const phoenixMonth = await fillPhoenixMonthPanelDate(element, date, session);
    if (phoenixMonth !== null) return phoenixMonth;
    const sdBasic = await fillSdBasicPanelDate(element, date, session);
    if (sdBasic !== null) return sdBasic;
    if (date.day && await clickDateToken(trigger, /^$/, date.iso)) return dateRead(element, trigger) === date.iso;
    const headerPattern = /^((?:19|20)\d{2})\s*年?\s*(\d{1,2})\s*月$/;
    let header = dateNodes(trigger).find((node) => headerPattern.test(clean(node.textContent)));
    const headerMatch = clean(header?.textContent).match(headerPattern);
    if (headerMatch && headerMatch[1] === date.year && Number(headerMatch[2]) === Number(date.month) && date.day) {
      const ok = await clickDateToken(trigger, new RegExp(`^0?${date.day}(?:日|号)?$`), date.iso);
      return ok && dateRead(element, trigger) === date.iso;
    }
    if (header) {
      click(header);
      await wait(140);
    }
    if (!await clickYearWithNavigation(session, date.year)) return false;
    if (!await clickDateMonthToken(session, date.month)) return false;
    if (date.day && !await clickDateToken(trigger, new RegExp(`^0?${date.day}(?:日|号)?$`), date.iso)) return false;
    await waitUntil(() => dateAccepted(element, trigger, date), 900, 35);
    return dateAccepted(element, trigger, date);
  }

  async function fillDate(element, value, key = '') {
    const date = parseDate(value);
    if (!date) return remember(element, { ok: false, type: 'date', reason: '资料中的日期格式无效' });
    const initialTrigger = findTrigger(element) || element;
    if (dateAccepted(element, initialTrigger, date)) {
      return remember(element, { ok: true, type: 'date', status: 'already_satisfied', actual: dateRead(element, initialTrigger), reason: '' });
    }
    const atsxPeriodMonth = await fillAtsxPeriodMonthDate(element, date, key);
    if (atsxPeriodMonth) return atsxPeriodMonth;
    const compound = await fillCompoundDate(element, date, key);
    if (compound) return compound;
    if (element instanceof HTMLInputElement && element.type === 'date') {
      nativeSet(element, date.iso);
      return remember(element, { ok: normalizeDate(element.value) === date.iso, type: 'native-date', actual: element.value, reason: normalizeDate(element.value) === date.iso ? '' : '原生日期框未接受目标值' });
    }
    if (!element.readOnly && !findTrigger(element)) {
      nativeSet(element, date.iso);
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      const ok = normalizeDate(element.value) === date.iso;
      return remember(element, { ok, type: 'text-date', actual: element.value, reason: ok ? '' : '文本日期框未接受目标格式' });
    }
    const session = await probe(element, 650);
    if (!session.ok) return remember(element, { ok: false, type: 'unknown-date', reason: session.reason });
    const ok = await fillCalendarDate(element, date, session);
    return remember(element, { ok, type: 'calendar-date', actual: dateRead(element, session.trigger), reason: ok ? '' : '日历已操作，但回读日期与目标日期不一致' });
  }

  async function fillDate(element, value, key = '') {
    const date = parseDate(value);
    if (!date) return remember(element, { ok: false, type: 'date', reason: '资料中的日期格式无效' });
    const initialTrigger = findTrigger(element) || element;
    if (dateAccepted(element, initialTrigger, date)) {
      return remember(element, { ok: true, type: 'date', status: 'already_satisfied', actual: dateRead(element, initialTrigger), reason: '' });
    }
    const atsxPeriodMonth = await fillAtsxPeriodMonthDate(element, date, key);
    if (atsxPeriodMonth) return atsxPeriodMonth;
    const compound = await fillCompoundDate(element, date, key);
    if (compound) return compound;
    if (element instanceof HTMLInputElement && element.type === 'month') {
      nativeSet(element, date.monthIso);
      return remember(element, { ok: element.value === date.monthIso, type: 'native-month', actual: element.value, reason: element.value === date.monthIso ? '' : '原生月份框未接受目标值' });
    }
    if (element instanceof HTMLInputElement && element.type === 'date') {
      const fullDate = date.day ? date.iso : `${date.monthIso}-${datePartValue(date, 'day', key, true).padStart(2, '0')}`;
      nativeSet(element, fullDate);
      return remember(element, { ok: normalizeDate(element.value) === fullDate, type: 'native-date', actual: element.value, reason: normalizeDate(element.value) === fullDate ? '' : '原生日期框未接受目标值' });
    }
    if (!element.readOnly && !findTrigger(element)) {
      const expected = date.day ? date.iso : date.monthIso;
      const selectedDate = await selectDynamicInputOption(element, expected, key, 1200);
      if (selectedDate.ok) {
        return remember(element, {
          ok: true,
          type: 'text-date-option',
          actual: element.value,
          selected: selectedDate.selected,
          reason: ''
        });
      }
      nativeSet(element, expected);
      dismissTransientPopup(element);
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      const ok = normalizeDate(element.value) === expected;
      return remember(element, { ok, type: 'text-date', actual: element.value, reason: ok ? '' : '文本日期框未接受目标格式' });
    }
    const session = await probe(element, 800);
    if (!session.ok) {
      session.close?.();
      return remember(element, withDynamicDom(session, { ok: false, type: 'unknown-date', reason: session.reason }, date.monthIso, key));
    }
    let finalOk = false;
    try {
      const ok = await fillCalendarDate(element, date, session);
      const confirm = confirmationButton(session);
      if (confirm) {
        click(confirm);
        await wait(180);
      }
      const actual = dateRead(element, session.trigger);
      const expected = date.day ? date.iso : date.monthIso;
      finalOk = ok || actual === expected;
      return remember(element, withDynamicDom(session, {
        ok: finalOk,
        type: 'calendar-date',
        status: finalOk ? 'success' : 'manual_required',
        keepAttempt: !finalOk,
        actual,
        expected,
        reason: finalOk ? '' : '日历已操作，但回读日期与目标日期不一致，已保留页面值待人工审核'
      }, expected, key));
    } finally {
      if (!finalOk) dismissTransientPopup(element);
      session.close?.();
    }
  }

  async function fillDatePart(element, value) {
    return fillSelect(element, String(value));
  }

  function remember(element, result) {
    const complete = { ok: false, type: 'unknown', actual: '', reason: '', candidates: [], ...result };
    results.set(element, complete);
    return complete;
  }

  function lastResult(element) {
    return results.get(element) || null;
  }

  globalThis.ResumeComplexControls = {
    version: VERSION,
    findTrigger,
    probe,
    fillInputSelect,
    fillSelect,
    fillDate,
    fillDatePart,
    lastResult,
    displayedValue
  };
})();
