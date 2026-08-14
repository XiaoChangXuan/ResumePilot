(() => {
  if (globalThis.ResumeComplexControls) return;

  const VERSION = '0.5.2';
  const results = new WeakMap();
  const OPTION_SELECTOR = [
    '[role="option"]', '[role="treeitem"]', '[role="gridcell"]', '[aria-selected]',
    '[role="listbox"] li', '[role="menu"] li', '[data-value]', '[data-key]',
    '[class*="option"]', '[class*="Option"]', '[class*="menu"] li', '[class*="Menu"] li',
    '[class*="item"]', '[class*="Item"]', 'li', 'button'
  ].join(',');

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function clean(value) {
    return String(value || '').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
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

  function nativeSet(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter ? setter.call(element, value) : (element.value = value);
    for (const type of ['input', 'change']) element.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function click(element) {
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.click();
  }

  function optionLeafNodes(nodes) {
    return nodes.filter((candidate) => !nodes.some((other) => {
      return other !== candidate && candidate.contains(other) && clean(candidate.textContent) === clean(other.textContent);
    }));
  }

  function collectOptions(trigger, beforeVisible = new Set()) {
    const candidates = [...document.querySelectorAll(OPTION_SELECTOR)]
      .filter((node) => !beforeVisible.has(node) && visible(node) && !trigger.contains(node) && !node.contains(trigger))
      .filter((node) => !node.disabled && node.getAttribute('aria-disabled') !== 'true')
      .filter((node) => clean(node.innerText || node.textContent) && clean(node.innerText || node.textContent).length <= 100);
    return optionLeafNodes([...new Set(candidates)]);
  }

  function overlayRoots(trigger, changedNodes) {
    const roots = [...document.querySelectorAll('[role="listbox"],[role="dialog"],[role="menu"],[role="tree"],[class*="dropdown"],[class*="Dropdown"],[class*="popup"],[class*="Popup"],[class*="calendar"],[class*="Calendar"],[class*="picker"],[class*="Picker"]')]
      .filter((node) => visible(node) && !trigger.contains(node));
    for (const node of changedNodes) {
      if (!(node instanceof Element) || !visible(node) || trigger.contains(node)) continue;
      const root = node.closest('[role="listbox"],[role="dialog"],[role="menu"],[role="tree"]') || node;
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
      options = collectOptions(trigger, beforeVisible);
      if (options.length) break;
    }
    observer.disconnect();
    const roots = overlayRoots(trigger, changedNodes);
    const text = clean(roots.map((root) => root.textContent).join(' '));
    const dateEvidence = /(?:19|20)\d{2}\s*年|\d{1,2}\s*月|calendar|date|日期/i.test(`${text} ${roots.map((root) => root.className).join(' ')}`);
    const columnCount = roots.reduce((max, root) => Math.max(max, [...root.children].filter((child) => visible(child)).length), 0);
    const searchable = !element.readOnly && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement);
    const type = dateEvidence ? 'calendar' : columnCount >= 2 && options.length >= 4 ? 'cascader' : searchable ? 'searchable-select' : 'custom-select';
    return { ok: Boolean(options.length || roots.length), trigger, beforeVisible, options, roots, type, reason: options.length || roots.length ? '' : '点击后未检测到候选项或弹层' };
  }

  function aliases(value) {
    const string = String(value || '');
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
    return normalized.replace(/(?:特别行政区|自治区|自治州|地区|省|市|区|县|旗)$/i, '');
  }

  function exactOption(options, value) {
    const targets = aliases(value).map(normalizeChoice).filter(Boolean);
    const matches = options.filter((option) => targets.includes(normalizeChoice(option.innerText || option.textContent)));
    if (matches.length === 1) return { option: matches[0] };
    if (matches.length > 1) return { reason: `出现 ${matches.length} 个同名候选项，无法唯一确定` };
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

  function displayedValue(element, trigger) {
    return clean(`${element.value || ''} ${trigger?.textContent || ''}`);
  }

  function choiceVerified(element, trigger, value) {
    const actual = normalizeChoice(displayedValue(element, trigger));
    return aliases(value).some((candidate) => actual.includes(normalizeChoice(candidate)));
  }

  async function refreshedOptions(session, timeout = 450) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const options = collectOptions(session.trigger, session.beforeVisible);
      if (options.length) return options;
      await wait(50);
    }
    return [];
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
    if (!session.ok) return remember(element, { ok: false, type: 'unknown-select', reason: session.reason });
    const isLocation = ['nativePlace', 'studentOrigin', 'householdRegistration', 'currentResidence', 'city', 'desiredCity'].includes(key);
    const path = isLocation ? locationPath(value) : [String(value)];
    const selected = [];
    for (let level = 0; level < path.length; level += 1) {
      let options = level === 0 ? session.options : await refreshedOptions(session);
      let match = exactOption(options, path[level]);
      if (!match.option && session.type === 'searchable-select' && !element.readOnly) {
        nativeSet(element, path[level]);
        await wait(250);
        options = await refreshedOptions(session);
        match = exactOption(options, path[level]);
      }
      if (!match.option) return remember(element, { ok: false, type: session.type, reason: `${path[level]}：${match.reason}`, candidates: options.slice(0, 20).map((node) => clean(node.textContent)) });
      click(match.option);
      selected.push(clean(match.option.textContent));
      await wait(150);
      if (level < path.length - 1 && !(await refreshedOptions(session)).length) {
        click(session.trigger);
        await wait(120);
      }
    }
    const ok = choiceVerified(element, session.trigger, path.at(-1)) || selected.length === path.length && (session.type === 'cascader' || !element.isConnected);
    return remember(element, { ok, type: session.type, actual: displayedValue(element, session.trigger), selected, reason: ok ? '' : '候选项已点击，但页面没有显示目标值' });
  }

  function parseDate(value) {
    const match = String(value || '').match(/((?:19|20)\d{2})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?/);
    return match ? { year: match[1], month: String(Number(match[2])), day: match[3] ? String(Number(match[3])) : '', iso: `${match[1]}-${String(Number(match[2])).padStart(2, '0')}${match[3] ? `-${String(Number(match[3])).padStart(2, '0')}` : ''}` } : null;
  }

  function normalizeDate(value) {
    return parseDate(value)?.iso || '';
  }

  function dateRead(element, trigger) {
    const candidates = [element.value, trigger?.getAttribute('data-value'), trigger?.textContent];
    for (const candidate of candidates) {
      const parsed = normalizeDate(candidate);
      if (parsed) return parsed;
    }
    return '';
  }

  function dateNodes(trigger) {
    const candidates = [...document.querySelectorAll('[aria-label],[role="gridcell"],[role="option"],button,li,[tabindex],[data-value],[class*="date"],[class*="Date"],[class*="calendar"],[class*="Calendar"],[class*="year"],[class*="Year"],[class*="month"],[class*="Month"],[class*="day"],[class*="Day"]')]
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

  async function fillCalendarDate(element, date, session) {
    const trigger = session.trigger;
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
      if (!dateToken(dateNodes(trigger), new RegExp(`^${date.year}(?:年)?$`))) {
        const yearOnly = dateNodes(trigger).find((node) => /^(?:19|20)\d{2}(?:年)?$/.test(clean(node.textContent)));
        if (yearOnly) { click(yearOnly); await wait(120); }
      }
    }
    if (!await clickDateToken(trigger, new RegExp(`^${date.year}(?:年)?$`))) return false;
    const monthNames = ['一','二','三','四','五','六','七','八','九','十','十一','十二'];
    if (!await clickDateToken(trigger, new RegExp(`^(?:0?${date.month}|${monthNames[Number(date.month) - 1]})(?:月)?$`))) return false;
    if (date.day && !await clickDateToken(trigger, new RegExp(`^0?${date.day}(?:日|号)?$`), date.iso)) return false;
    return dateRead(element, trigger) === date.iso;
  }

  async function fillDate(element, value) {
    const date = parseDate(value);
    if (!date) return remember(element, { ok: false, type: 'date', reason: '资料中的日期格式无效' });
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
    fillSelect,
    fillDate,
    fillDatePart,
    lastResult,
    displayedValue
  };
})();
