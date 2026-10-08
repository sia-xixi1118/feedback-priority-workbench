const STORAGE_KEY = "feedback-merge-placements-v1";
const REGISTER_KEY = "feedback-merge-registered-v1";
const GROUPS_KEY = "feedback-merge-groups-v1";
const HIDDEN_KEY = "feedback-merge-hidden-v1";
const RELEASED_KEY = "feedback-merge-released-v1";
const DISMISS_KEY = "feedback-merge-dismissed-v1";
const LANE_KEY = "feedback-merge-priority-lane-v1";
const COMPLETED_KEY = "feedback-merge-completed-v1";
const BRIEF_KEY = "feedback-merge-briefs-v1";
const SAMPLE_COMPLETED = [
  { id: "sample_print", label: "报表打印", formedAt: "2026-09-02", completedAt: "2026-09-16", person: "周宁", customers: ["客户甲", "客户乙"], simulated: true },
  { id: "sample_perm", label: "权限无法分配", formedAt: "2026-09-04", completedAt: "2026-09-19", person: "林可", customers: ["客户丙", "客户丁"], simulated: true },
  { id: "sample_batch", label: "批量发送", formedAt: "2026-09-06", completedAt: "2026-09-21", person: "周宁", customers: ["客户05", "客户08"], simulated: true },
  { id: "sample_zoom", label: "图表无法缩放", formedAt: "2026-09-08", completedAt: "2026-09-27", person: "陈朔", customers: ["客户乙", "客户10"], simulated: true },
];
const PRODUCT = [
  { id: "saved_filters", label: "保存常用筛选" },
  { id: "export_columns", label: "自选导出列" },
  { id: "scheduled_report", label: "定时发送" },
  { id: "export_error", label: "导出失败" },
];
const ASIDE = [
  { id: "usage", label: "使用指导" },
  { id: "quota", label: "配置额度" },
  { id: "commercial", label: "加购套餐" },
];
const SEED_GROUPS = [...PRODUCT, ...ASIDE];
const SUGGESTION = {
  export_columns: "自选导出列",
  scheduled_report: "定时发送",
  export_error: "导出失败",
  saved_filters: "保存常用筛选",
  usage_export_button: "使用指导",
  quota_setting: "配置额度",
  commercial_upgrade: "加购套餐",
  unclear: "先不放进产品组",
};
const ASIDE_IDS = new Set(ASIDE.map((group) => group.id));
const LANE_LABEL = { urgent: "加急处理", upgrade: "产品升级" };
const TAB_TITLE = {
  register: "意见反馈",
  classify: "需求分类",
  list: "需求列表",
  priority: "迭代优先级",
  board: "需求看板",
};

const state = {
  feedback: [],
  byId: new Map(),
  baseline: new Map(),
  placements: loadPlacements(),
  groups: loadGroups(),
  hidden: loadHidden(),
  released: loadReleased(),
  dismissed: loadDismissed(),
  priorityLanes: loadPriorityLanes(),
  completed: loadCompleted(),
  briefs: loadBriefs(),
  completeError: null,
  listSelection: null,
  listFocusId: "",
  selectedId: null,
  lastStatus: "",
  queueOpen: true,
  tab: "board",
  editor: null,
  editorError: "",
  focusEditor: false,
  priorityFocusId: "",
  registered: loadRegistered(),
};

const phoneQuery = window.matchMedia("(max-width: 800px)");

function loadPlacements() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function savePlacements() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.placements));
}

function loadRegistered() {
  try {
    const saved = JSON.parse(localStorage.getItem(REGISTER_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveRegistered() {
  localStorage.setItem(REGISTER_KEY, JSON.stringify(state.registered));
}

function absorbRegistered(rows) {
  state.registered = rows;
  for (const row of rows) {
    if (!row || !row.feedback_id || state.byId.has(row.feedback_id)) continue;
    state.feedback.push(row);
    state.byId.set(row.feedback_id, row);
  }
}

function isCustomGroup(group) {
  return Boolean(group && (group.custom || String(group.id || "").startsWith("custom_")));
}

function loadGroups() {
  const seeds = SEED_GROUPS.map((group) => ({ ...group }));
  try {
    const saved = JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]");
    const list = Array.isArray(saved) ? saved : [];
    const custom = list
      .filter((group) => isCustomGroup(group) && group.id && group.label)
      .map((group) => ({ ...group, custom: true, createdAt: group.createdAt || todayISO() }));
    const renamed = new Map(
      list
        .filter((group) => group && !isCustomGroup(group) && group.id && group.label)
        .map((group) => [group.id, group.label]),
    );
    for (const seed of seeds) {
      if (renamed.has(seed.id)) seed.label = renamed.get(seed.id);
    }
    return [...seeds, ...custom];
  } catch {
    return seeds;
  }
}

function saveGroups() {
  const seedLabels = new Map(SEED_GROUPS.map((group) => [group.id, group.label]));
  const renamedSeeds = state.groups
    .filter((group) => !group.custom && seedLabels.get(group.id) && seedLabels.get(group.id) !== group.label)
    .map((group) => ({ id: group.id, label: group.label }));
  const custom = state.groups.filter((group) => group.custom);
  localStorage.setItem(GROUPS_KEY, JSON.stringify([...renamedSeeds, ...custom]));
}

function loadHidden() {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "{}");
    return {
      groups: Array.isArray(saved.groups) ? saved.groups : [],
      quotes: Array.isArray(saved.quotes) ? saved.quotes : [],
    };
  } catch {
    return { groups: [], quotes: [] };
  }
}

function saveHidden() {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(state.hidden));
}

function loadReleased() {
  try {
    const saved = JSON.parse(localStorage.getItem(RELEASED_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveReleased() {
  localStorage.setItem(RELEASED_KEY, JSON.stringify(state.released));
}

function loadDismissed() {
  try {
    const saved = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveDismissed() {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(state.dismissed));
}

function loadPriorityLanes() {
  try {
    const saved = JSON.parse(localStorage.getItem(LANE_KEY) || "{}");
    if (!saved || typeof saved !== "object") return {};
    return Object.fromEntries(
      Object.entries(saved).filter(([, lane]) => lane === "urgent" || lane === "upgrade"),
    );
  } catch {
    return {};
  }
}

function savePriorityLanes() {
  localStorage.setItem(LANE_KEY, JSON.stringify(state.priorityLanes));
}

function loadCompleted() {
  try {
    const saved = JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item && item.id && item.label && item.formedAt && item.completedAt && item.person);
  } catch {
    return [];
  }
}

function saveCompleted() {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(state.completed));
}

function loadBriefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(BRIEF_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(
      Object.entries(saved).filter(([, text]) => typeof text === "string" && text.trim()),
    );
  } catch {
    return {};
  }
}

function saveBriefs() {
  localStorage.setItem(BRIEF_KEY, JSON.stringify(state.briefs));
}

function forgetBrief(groupId) {
  if (!state.briefs[groupId]) return;
  delete state.briefs[groupId];
  saveBriefs();
}

function markDateFilled(input) {
  input.classList.toggle("is-filled", Boolean(input.value));
}

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function dateNumber(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return NaN;
  return Date.UTC(year, month - 1, day) / 86400000;
}

function daysBetween(start, end) {
  const span = dateNumber(end) - dateNumber(start);
  return Number.isFinite(span) ? Math.max(0, span) : 0;
}

function formedAtOf(group, members) {
  const dates = members.map((row) => row.occurred_at).filter(Boolean).sort();
  if (dates.length) return dates[0];
  if (group.createdAt) return group.createdAt;
  return todayISO();
}

function completionRecords() {
  const seen = new Set(SAMPLE_COMPLETED.map((item) => item.id));
  return [
    ...SAMPLE_COMPLETED,
    ...state.completed.filter((item) => !seen.has(item.id)),
  ];
}

function nameMarksUrgent(label) {
  const text = String(label || "")
    .normalize("NFKC")
    .replace(/[\s\u200b\u200c\u200d\u2060\ufeff\u3000]/g, "")
    .replaceAll("失敗", "失败")
    .replaceAll("無法", "无法");
  return text.includes("失败") || text.includes("无法");
}

function automaticLane(group, members) {
  const nameUrgent = nameMarksUrgent(group.label);
  const quoteUrgent = members.some((row) => /打不开|导不出|用不了/.test(String(row.text)));
  return nameUrgent || quoteUrgent ? "urgent" : "upgrade";
}

function laneOf(group, members) {
  if (nameMarksUrgent(group.label)) {
    if (state.priorityLanes[group.id]) {
      delete state.priorityLanes[group.id];
      savePriorityLanes();
    }
    return "urgent";
  }
  const manual = state.priorityLanes[group.id];
  if (manual === "urgent" || manual === "upgrade") return manual;
  return automaticLane(group, members);
}

function visibleGroups() {
  const hidden = new Set(state.hidden.groups);
  return state.groups.filter((group) => !hidden.has(group.id));
}

function groupsOnRequirementList() {
  return visibleGroups().filter((group) => group.custom || group.id === "saved_filters" || membersOf(group.id).length > 0);
}

function groupsOnLaterPages() {
  return groupsOnRequirementList().filter((group) => {
    if (group.custom) return true;
    const members = membersOf(group.id);
    const nameUrgent = nameMarksUrgent(group.label);
    if (ASIDE_IDS.has(group.id) && !nameUrgent) return false;
    if (group.id === "saved_filters" && !members.length && !nameUrgent) return false;
    return true;
  });
}

function queueRows() {
  const released = new Set(state.released);
  const placed = new Set([
    ...[...state.baseline.values()].flat().filter((id) => !released.has(id)),
    ...Object.keys(state.placements),
  ]);
  const dismissed = new Set(state.dismissed);
  const hiddenQuotes = new Set(state.hidden.quotes);
  const byTime = (a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.feedback_id.localeCompare(b.feedback_id);
  const waiting = state.feedback.filter((row) => !placed.has(row.feedback_id) && !dismissed.has(row.feedback_id) && !hiddenQuotes.has(row.feedback_id));
  return waiting.sort(byTime);
}

function currentRow() {
  const rows = queueRows();
  if (!rows.length) return null;
  if (!rows.some((row) => row.feedback_id === state.selectedId)) {
    state.selectedId = rows[0].feedback_id;
  }
  return state.byId.get(state.selectedId);
}

function suggestionFor(row) {
  return SUGGESTION[row.topic_key] || proposedCategory(row.text);
}

function plainFeedback(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/^模拟[:：]\s*/, "")
    .replace(/[\s\u3000\u200b]+/g, "");
}

function firstLabel(raw, pairs) {
  for (const [pattern, label] of pairs) {
    if (pattern.test(raw)) return label;
  }
  return "";
}

function matchKnownLabel(raw) {
  return firstLabel(raw, [
    [/无法打开|打不开|开不了/, "无法打开"],
    [/导出.*(失败|报错)|导不出|下不来/, "导出失败"],
    [/权限.*无法|无法.*权限/, "权限无法分配"],
    [/用不了|无法使用/, "无法使用"],
    [/筛选.*(保存|存成|记住|套用|常用)|(保存|存成|记住).*(筛选|条件)/, "保存常用筛选"],
    [/勾选|自选|导出列|导出字段|选择列/, "自选导出列"],
    [/定时|自动发送|预约发送/, "定时发送"],
    [/额度|配额|剩余次数/, "配置额度"],
    [/加购|套餐|报价|销售/, "加购套餐"],
    [/在哪|哪个菜单|怎么导出|操作顺序|点哪里|入口/, "使用指导"],
    [/打印/, "报表打印"],
    [/权限/, "权限分配"],
    [/缩放|放大缩小|图表放大/, "图表缩放"],
    [/批量/, "批量发送"],
  ]);
}

function summarizeLabel(raw) {
  const action = firstLabel(raw, [
    [/填写|填报/, "填写"],
    [/打印/, "打印"],
    [/导出/, "导出"],
    [/导入/, "导入"],
    [/上传/, "上传"],
    [/下载/, "下载"],
    [/发送/, "发送"],
    [/保存|存成/, "保存"],
    [/打开/, "打开"],
    [/审批/, "审批"],
    [/搜索|查找/, "搜索"],
    [/缩放|放大|缩小/, "缩放"],
    [/勾选|挑选/, "勾选"],
    [/筛选/, "筛选"],
  ]);
  const object = firstLabel(raw, [
    [/页边|页眉|页脚/, "页边"],
    [/坐标/, "坐标"],
    [/图表/, "图表"],
    [/周报/, "周报"],
    [/报表/, "报表"],
    [/邮件|邮箱/, "邮件"],
    [/权限/, "权限"],
    [/额度/, "额度"],
    [/套餐/, "套餐"],
    [/字段|导出列/, "列"],
  ]);
  const issue = firstLabel(raw, [
    [/报错|出错|错误/, "报错"],
    [/失败/, "失败"],
    [/看不清|模糊/, "看不清"],
    [/裁掉|裁切|被切|显示不全|超出/, "被裁"],
    [/太慢|很慢|卡顿|卡住/, "太慢"],
    [/找不到|没找到|没有入口/, "找不到"],
    [/无法|不能/, "无法完成"],
  ]);
  let label = [action, object, issue].filter((part, index, list) => part && list.indexOf(part) === index).join("");
  if (label.length > 10 && object && issue) label = `${object}${issue}`;
  if (label.length > 10) label = label.slice(0, 10);
  return label.length >= 2 ? label : "";
}

function proposedCategory(text) {
  const raw = plainFeedback(text);
  if (/说不清|还没整理|再补充|再问问|也可能不是|有些不满意|有点怪|具体我也/.test(raw)) {
    return "先不放进产品组";
  }
  const known = matchKnownLabel(raw);
  if (known && visibleGroups().some((group) => group.label === known)) return known;
  const summary = summarizeLabel(raw);
  if (known && summary && known.length <= summary.length && summary.includes(known.slice(0, 2))) return known;
  if (summary) return summary;
  return known || "待补充分类";
}

function suggestionHint(row) {
  return `规则演示建议：${suggestionFor(row)}。`;
}

function membersOf(groupId) {
  const moved = new Set(Object.keys(state.placements));
  const released = new Set(state.released);
  const ids = new Set((state.baseline.get(groupId) || []).filter((id) => !moved.has(id) && !released.has(id)));
  for (const [feedbackId, destinationId] of Object.entries(state.placements)) {
    if (destinationId === groupId) ids.add(feedbackId);
  }
  const hiddenQuotes = new Set(state.hidden.quotes);
  return [...ids]
    .map((id) => state.byId.get(id))
    .filter((row) => row && !hiddenQuotes.has(row.feedback_id))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.feedback_id.localeCompare(b.feedback_id));
}

function render() {
  const viewingOnPhone = phoneQuery.matches;
  document.body.dataset.tab = state.tab;
  document.getElementById("page-title").textContent = TAB_TITLE[state.tab];
  const deleteButton = document.getElementById("delete-selected");
  deleteButton.hidden = state.tab !== "list";
  deleteButton.disabled = viewingOnPhone;
  for (const [id, tab] of [["tab-register", "register"], ["tab-classify", "classify"], ["tab-list", "list"], ["tab-priority", "priority"], ["tab-board", "board"]]) {
    document.getElementById(id).setAttribute("aria-selected", String(state.tab === tab));
  }
  document.getElementById("panel-register").hidden = state.tab !== "register";
  document.getElementById("panel-list").hidden = state.tab !== "list";
  document.getElementById("panel-priority").hidden = state.tab !== "priority";
  document.getElementById("panel-board").hidden = state.tab !== "board";
  document.getElementById("phone-note").hidden = !(viewingOnPhone && state.tab === "classify");
  const rows = queueRows();
  const current = currentRow();
  document.getElementById("app").hidden = state.tab !== "classify" || !current;
  document.getElementById("empty").hidden = state.tab !== "classify" || Boolean(current);
  document.getElementById("status").textContent = state.lastStatus;
  renderQueue(rows, current, viewingOnPhone);
  renderQuoteAndChoices(current, viewingOnPhone);
  renderRequirementList(viewingOnPhone);
  renderPriority(viewingOnPhone);
  renderBoard();
  if (state.focusEditor) {
    state.focusEditor = false;
    document.getElementById("group-name")?.focus();
  }
}

function renderQueue(rows, current, viewingOnPhone) {
  const queue = document.getElementById("queue");
  const toggle = document.getElementById("queue-toggle");
  document.querySelector(".queue").classList.toggle("is-collapsed", !state.queueOpen);
  queue.hidden = false;
  toggle.textContent = state.queueOpen ? "收起" : "展开";
  toggle.setAttribute("aria-expanded", String(state.queueOpen));
  toggle.onclick = () => {
    state.queueOpen = !state.queueOpen;
    render();
  };
  queue.replaceChildren();
  const visibleRows = state.queueOpen ? rows : rows.slice(0, 1);
  for (const row of visibleRows) {
    const item = document.createElement("li");
    item.className = "queue-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "queue-item";
    button.disabled = viewingOnPhone;
    if (current && row.feedback_id === current.feedback_id) button.setAttribute("aria-current", "true");
    button.innerHTML = `<small>${escapeText(row.account_label)} · ${escapeText(row.occurred_at)}</small>${escapeText(row.text)}`;
    button.addEventListener("click", () => {
      state.selectedId = row.feedback_id;
      state.lastStatus = "";
      render();
    });
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "dismiss-check";
    check.disabled = viewingOnPhone;
    check.title = "使用问题，无需成为产品需求";
    check.setAttribute("aria-label", `${row.feedback_id} 是使用问题，勾选后消除，不进入产品需求`);
    check.addEventListener("change", () => {
      if (check.checked) dismissAsUsage(row);
    });
    item.append(button, check);
    queue.appendChild(item);
  }
}

function dismissAsUsage(row) {
  if (!state.dismissed.includes(row.feedback_id)) state.dismissed.push(row.feedback_id);
  saveDismissed();
  if (state.selectedId === row.feedback_id) state.selectedId = null;
  state.lastStatus = `${row.feedback_id}不进入产品需求。`;
  render();
}

function renderQuoteAndChoices(current, viewingOnPhone) {
  const quote = document.getElementById("current");
  const choices = document.getElementById("choices");
  quote.replaceChildren();
  choices.replaceChildren();
  if (!current) return;
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `${current.account_label} · ${current.occurred_at} · ${current.feedback_id}`;
  const text = document.createElement("p");
  text.className = "quote-text";
  text.textContent = current.text;
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = suggestionHint(current);
  quote.append(meta, text, hint);

  for (const destination of visibleGroups()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.disabled = viewingOnPhone;
    button.textContent = destination.label;
    button.addEventListener("click", () => place(current, destination));
    choices.appendChild(button);
  }

  if (Object.keys(state.placements).length) {
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "undo";
    undo.disabled = viewingOnPhone;
    undo.textContent = "撤销上一条";
    undo.addEventListener("click", undoLast);
    choices.appendChild(undo);
  }

  const tools = document.createElement("div");
  tools.className = "choice-tools";
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "新增";
  add.disabled = viewingOnPhone;
  add.addEventListener("click", () => {
    state.editor = state.editor === "add" ? null : "add";
    state.editorError = "";
    state.focusEditor = state.editor === "add";
    render();
  });
  tools.appendChild(add);
  choices.appendChild(tools);
  if (state.editor === "add") choices.appendChild(groupEditor(viewingOnPhone));
}

function groupEditor(viewingOnPhone) {
  const editor = document.createElement("div");
  editor.className = "group-editor";
  if (state.editor === "add") {
    const label = document.createElement("label");
    label.textContent = "分组名称";
    const input = document.createElement("input");
    input.id = "group-name";
    input.maxLength = 20;
    input.autocomplete = "off";
    label.appendChild(input);
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = "确定";
    confirm.disabled = viewingOnPhone;
    confirm.addEventListener("click", () => addGroup(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addGroup(input.value);
      }
    });
    editor.append(label, confirm);
  }
  if (state.editorError) {
    const error = document.createElement("p");
    error.className = "form-error";
    error.textContent = state.editorError;
    editor.appendChild(error);
  }
  return editor;
}

function isSelected(kind, groupId, feedbackId) {
  const selected = state.listSelection;
  if (!selected || selected.kind !== kind || selected.groupId !== groupId) return false;
  return kind === "group" || selected.feedbackId === feedbackId;
}

function selectListItem(kind, groupId, feedbackId) {
  if (isSelected(kind, groupId, feedbackId)) {
    state.listSelection = null;
  } else {
    state.listSelection = kind === "group" ? { kind, groupId } : { kind, groupId, feedbackId };
  }
  state.lastStatus = "";
  render();
}

function renderRequirementList(viewingOnPhone) {
  const board = document.getElementById("panel-list");
  board.replaceChildren();
  let dragged = false;
  const visible = groupsOnRequirementList();
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有分好的需求。";
    board.appendChild(empty);
  }
  for (const group of visible) {
    const members = membersOf(group.id);
    const card = document.createElement("article");
    card.className = "req-card";
    card.dataset.groupId = group.id;
    const head = document.createElement("button");
    head.type = "button";
    head.className = "req-head";
    head.disabled = viewingOnPhone;
    head.setAttribute("aria-pressed", String(isSelected("group", group.id)));
    const title = document.createElement("strong");
    title.textContent = group.label;
    const meta = document.createElement("span");
    meta.className = "meta";
    const customers = [...new Set(members.map((row) => row.account_label))];
    meta.textContent = members.length
      ? `${members.length} 条 · ${customers.join("、")}`
      : "还没有归入的原话";
    head.append(title, meta);
    head.addEventListener("click", () => {
      if (head.querySelector(".req-rename")) return;
      clearTimeout(head._clickTimer);
      head._clickTimer = setTimeout(() => selectListItem("group", group.id), 280);
    });
    head.addEventListener("dblclick", (event) => {
      event.preventDefault();
      clearTimeout(head._clickTimer);
      if (viewingOnPhone) return;
      const input = document.createElement("input");
      input.className = "req-rename";
      input.value = group.label;
      input.maxLength = 20;
      input.autocomplete = "off";
      input.setAttribute("aria-label", `修改「${group.label}」`);
      title.replaceWith(input);
      input.focus();
      input.select();
      const finish = (nextValue) => {
        if (input.dataset.done) return;
        input.dataset.done = "1";
        renameGroup(group.id, nextValue);
      };
      input.addEventListener("keydown", (keyEvent) => {
        if (keyEvent.key === "Enter") {
          keyEvent.preventDefault();
          finish(input.value);
        } else if (keyEvent.key === "Escape") {
          keyEvent.preventDefault();
          finish(group.label);
        }
      });
      input.addEventListener("blur", () => finish(input.value));
    });
    card.appendChild(head);
    if (members.length) {
      const list = document.createElement("ul");
      for (const row of members) {
        const item = document.createElement("li");
        const line = document.createElement("button");
        line.type = "button";
        line.className = "req-line";
        line.disabled = viewingOnPhone;
        line.draggable = !viewingOnPhone;
        line.setAttribute("aria-pressed", String(isSelected("quote", group.id, row.feedback_id)));
        const who = document.createElement("small");
        who.textContent = `${row.account_label} · ${row.occurred_at} · ${row.feedback_id}`;
        line.append(who, document.createTextNode(row.text));
        line.addEventListener("click", () => {
          if (dragged) return;
          selectListItem("quote", group.id, row.feedback_id);
        });
        line.addEventListener("dragstart", (event) => {
          dragged = true;
          line.classList.add("is-dragging");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", JSON.stringify({
            feedbackId: row.feedback_id,
            groupId: group.id,
          }));
        });
        line.addEventListener("dragend", () => {
          line.classList.remove("is-dragging");
          setTimeout(() => { dragged = false; }, 0);
        });
        item.appendChild(line);
        list.appendChild(item);
      }
      card.appendChild(list);
    }
    card.addEventListener("dragover", (event) => {
      if (viewingOnPhone || !event.dataTransfer.types.includes("text/plain")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      card.classList.add("is-drop");
    });
    card.addEventListener("dragleave", (event) => {
      if (card.contains(event.relatedTarget)) return;
      card.classList.remove("is-drop");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-drop");
      let payload;
      try {
        payload = JSON.parse(event.dataTransfer.getData("text/plain"));
      } catch {
        return;
      }
      if (!payload || payload.groupId === group.id) return;
      moveQuote(payload.feedbackId, group.id);
    });
    board.appendChild(card);
  }
  if (state.listFocusId) {
    const focusId = state.listFocusId;
    state.listFocusId = "";
    const target = board.querySelector(`[data-group-id="${CSS.escape(focusId)}"]`);
    if (target) target.scrollIntoView({ block: "center" });
  }
}

function priorityBoard() {
  const items = [];
  for (const group of groupsOnLaterPages()) {
    const members = membersOf(group.id);
    const customers = [...new Set(members.map((row) => row.account_label))];
    items.push({
      group,
      members,
      customers,
      count: members.length,
      blocksUse: laneOf(group, members) === "urgent",
    });
  }
  const byCount = (a, b) => b.count - a.count || a.group.label.localeCompare(b.group.label, "zh");
  const urgent = items.filter((item) => item.blocksUse).sort(byCount);
  const upgrades = items.filter((item) => !item.blocksUse).sort(byCount);
  let rank = 0;
  let previousCount = null;
  for (const item of upgrades) {
    if (item.count !== previousCount) {
      rank += 1;
      previousCount = item.count;
    }
    item.rank = rank;
  }
  return { urgent, upgrades };
}

function requirementSummary(members) {
  const texts = members.map((row) => String(row.text).replace(/^模拟：/, "").trim()).filter(Boolean);
  const blob = texts.join("\n");
  if (/打不开|导不出|用不了|无法打开/.test(blob)) {
    return "客户现在打不开、导不出或用不了。需要先恢复能打开并使用。";
  }
  if (/导出/.test(blob) && /失败|报错|下不来|没有下来|数出不去/.test(blob)) {
    return "客户导出报表时会失败或中途报错，文件下不来。需要先让导出能完成并拿到文件。";
  }
  if (/导出/.test(blob) && /列|字段/.test(blob) && /勾选|选择|挑选|自选/.test(blob)) {
    return "客户希望导出前自己勾选需要的列，不要每次导出全部字段后再手工整理。";
  }
  if (/定时|自动发送|自动把报表|预约发送|自动发出/.test(blob)) {
    return "客户希望报表按固定时间自动发送，不用每次有人守着手动导出。";
  }
  if (/筛选/.test(blob) && /保存|存成|记住|套用|重选|重设/.test(blob)) {
    return "客户希望把常用的部门、时间和指标筛选保存下来，下次打开直接套用。";
  }
  if (/提交/.test(blob) && /失败|无法|报错|出错/.test(blob)) {
    return "客户提交报表时会失败或报错，需要先让提交能完成。";
  }
  return composedSummary(plainFeedback(blob));
}

function composedSummary(raw) {
  if (!raw) return "这一组已归入的原话还没有写出具体要改什么。";
  const action = firstLabel(raw, [
    [/提交/, "提交"],
    [/填写|填报/, "填写"],
    [/打印/, "打印"],
    [/导出/, "导出"],
    [/导入/, "导入"],
    [/上传/, "上传"],
    [/下载/, "下载"],
    [/发送/, "发送"],
    [/保存|存成/, "保存"],
    [/打开/, "打开"],
    [/审批/, "审批"],
    [/搜索|查找/, "搜索"],
    [/缩放|放大|缩小/, "缩放"],
    [/勾选|挑选/, "勾选"],
    [/筛选/, "筛选"],
  ]);
  const object = firstLabel(raw, [
    [/页边|页眉|页脚/, "页边"],
    [/图表/, "图表"],
    [/周报/, "周报"],
    [/报表/, "报表"],
    [/邮件|邮箱/, "邮件"],
    [/权限/, "权限"],
    [/额度/, "额度"],
    [/套餐/, "套餐"],
    [/字段|导出列/, "列"],
  ]);
  const target = action && object ? `${action}${object}` : (object || action || "这一步");
  const hasError = /报错|出错|错误/.test(raw);
  const hasFail = /失败|无法|打不开|导不出|用不了|下不来|没有下来/.test(raw);
  if (hasFail && hasError) return `客户${target}时会失败或报错，需要先让这一步能完成。`;
  if (hasFail) return `客户现在无法顺利完成${target}，需要先恢复能正常使用。`;
  if (hasError) return `客户${target}时会报错，需要先让这一步能完成。`;
  if (/希望|能不能|能否/.test(raw) && action && object) {
    return `客户希望${action}${object}可以按需要完成，不用每次再手工处理。`;
  }
  if (object) return `客户反馈集中在${object}，需要收成一个可开发的改动。`;
  return "这一组已归入的原话还没有写出具体要改什么。";
}

function generatedBrief(item) {
  if (item.count) return requirementSummary(item.members);
  return item.blocksUse
    ? "分组名称里带「失败」或「无法」，新增后就放入加急处理。"
    : "还没有归入的原话。";
}

function shownBrief(item) {
  const custom = state.briefs[item.group.id];
  return custom || generatedBrief(item);
}

function saveBrief(groupId, raw) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return;
  const text = String(raw || "").trim();
  const members = membersOf(group.id);
  const generated = generatedBrief({
    count: members.length,
    members,
    blocksUse: laneOf(group, members) === "urgent",
    group,
  });
  const current = state.briefs[groupId] || generated;
  if (!text) {
    state.lastStatus = "说明不能为空。";
    render();
    return;
  }
  if ([...text].length > 120) {
    state.lastStatus = "说明最多 120 个字。";
    render();
    return;
  }
  if (text === current) {
    render();
    return;
  }
  if (text === generated) delete state.briefs[groupId];
  else state.briefs[groupId] = text;
  saveBriefs();
  state.lastStatus = `「${group.label}」的说明已改。`;
  render();
}

function openListGroup(groupId) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group || !groupsOnRequirementList().some((item) => item.id === groupId)) return;
  state.tab = "list";
  state.listSelection = { kind: "group", groupId };
  state.listFocusId = groupId;
  state.lastStatus = `已打开需求列表里的「${group.label}」。`;
  render();
}

function movePriorityLane(groupId, lane) {
  const group = state.groups.find((item) => item.id === groupId);
  const members = group ? membersOf(group.id) : [];
  if (!group || ASIDE_IDS.has(group.id) || (lane !== "urgent" && lane !== "upgrade")) return;
  if (nameMarksUrgent(group.label)) {
    if (lane === "upgrade") {
      state.lastStatus = `「${group.label}」名称里带「失败」或「无法」，留在加急处理。`;
      render();
    }
    return;
  }
  if (laneOf(group, members) === lane) return;
  if (automaticLane(group, members) === lane) delete state.priorityLanes[group.id];
  else state.priorityLanes[group.id] = lane;
  savePriorityLanes();
  state.lastStatus = `${group.label} 已挪到「${LANE_LABEL[lane]}」。`;
  render();
}

function priorityCard(item, viewingOnPhone) {
  const card = document.createElement("article");
  card.className = item.blocksUse ? "priority-card is-urgent" : "priority-card";
  card.dataset.priorityGroup = item.group.id;
  if (state.priorityFocusId === item.group.id) card.classList.add("is-fresh");
  card.draggable = !viewingOnPhone;
  if (!viewingOnPhone) {
    card.title = "双击打开需求列表里的这一类";
    let draggedCard = false;
    card.addEventListener("dblclick", (event) => {
      if (draggedCard || event.target.closest(".priority-brief, .brief-edit")) return;
      openListGroup(item.group.id);
    });
    card.addEventListener("dragstart", (event) => {
      if (card.querySelector(".brief-edit")) {
        event.preventDefault();
        return;
      }
      draggedCard = true;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({ groupId: item.group.id }));
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      setTimeout(() => {
        draggedCard = false;
      }, 0);
    });
  }
  const flag = document.createElement("p");
  flag.className = "priority-flag";
  flag.textContent = item.blocksUse ? "加急处理" : `第 ${item.rank} 位`;
  const title = document.createElement("h3");
  title.textContent = item.group.label;
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = item.count
    ? `${item.count} 条 · ${item.customers.join("、")}`
    : "还没有归入的原话";
  const brief = document.createElement("p");
  brief.className = "priority-brief";
  brief.textContent = shownBrief(item);
  if (!viewingOnPhone) {
    brief.title = "双击修改";
    brief.addEventListener("pointerdown", () => {
      card.draggable = false;
    });
    brief.addEventListener("pointerup", () => {
      if (!card.querySelector(".brief-edit")) card.draggable = true;
    });
    brief.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      card.draggable = false;
      const input = document.createElement("textarea");
      input.className = "brief-edit";
      input.value = shownBrief(item);
      input.maxLength = 120;
      input.rows = 3;
      input.setAttribute("aria-label", `修改「${item.group.label}」的说明`);
      brief.replaceWith(input);
      input.focus();
      input.select();
      const finish = (nextValue) => {
        if (input.dataset.done) return;
        input.dataset.done = "1";
        saveBrief(item.group.id, nextValue);
      };
      input.addEventListener("keydown", (keyEvent) => {
        if (keyEvent.key === "Enter" && !keyEvent.shiftKey) {
          keyEvent.preventDefault();
          finish(input.value);
        } else if (keyEvent.key === "Escape") {
          keyEvent.preventDefault();
          finish(shownBrief(item));
        }
      });
      input.addEventListener("blur", () => finish(input.value));
    });
  }
  const reason = document.createElement("p");
  reason.className = item.blocksUse ? "priority-severe" : "meta";
  reason.textContent = item.blocksUse ? "严重影响使用。" : "产品功能升级需求";
  const source = document.createElement("p");
  source.className = "meta";
  source.textContent = item.count ? "根据本组已归入的原话整理。" : "按分组名称检测。规则演示。";
  card.append(flag, title, meta, brief, reason, source);
  return card;
}

function renderPriority(viewingOnPhone) {
  const board = document.getElementById("panel-priority");
  board.replaceChildren();
  const { urgent, upgrades } = priorityBoard();
  if (!urgent.length && !upgrades.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有已归入的产品需求。";
    board.appendChild(empty);
    return;
  }
  const lanes = [
    ["urgent", "加急处理", urgent],
    ["upgrade", "产品升级", upgrades],
  ];
  for (const [laneId, label, items] of lanes) {
    const lane = document.createElement("section");
    lane.className = "priority-lane";
    const heading = document.createElement("h2");
    heading.textContent = label;
    lane.appendChild(heading);
    if (!items.length) {
      const hint = document.createElement("p");
      hint.className = "priority-hint";
      hint.textContent = viewingOnPhone ? "这一档还没有需求。" : "把卡片拖到这里。";
      lane.appendChild(hint);
    }
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "priority-row";
      row.append(priorityCard(item, viewingOnPhone), completeForm(item, viewingOnPhone));
      lane.appendChild(row);
    }
    if (!viewingOnPhone) {
      lane.addEventListener("dragover", (event) => {
        if (!event.dataTransfer.types.includes("text/plain")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        lane.classList.add("is-drop");
      });
      lane.addEventListener("dragleave", (event) => {
        if (lane.contains(event.relatedTarget)) return;
        lane.classList.remove("is-drop");
      });
      lane.addEventListener("drop", (event) => {
        event.preventDefault();
        lane.classList.remove("is-drop");
        let payload;
        try {
          payload = JSON.parse(event.dataTransfer.getData("text/plain"));
        } catch {
          return;
        }
        if (!payload || !payload.groupId) return;
        movePriorityLane(payload.groupId, laneId);
      });
    }
    board.appendChild(lane);
  }
}

function completeForm(item, viewingOnPhone) {
  const form = document.createElement("form");
  form.className = "complete-form";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const completedAt = form.querySelector("[name=completed-at]").value;
    const person = form.querySelector("[name=person]").value.trim();
    finishGroup(item.group.id, completedAt, person);
  });
  const title = document.createElement("p");
  title.textContent = "完成登记";
  const timeLabel = document.createElement("label");
  timeLabel.textContent = "完成时间";
  const time = document.createElement("input");
  time.type = "date";
  time.name = "completed-at";
  time.disabled = viewingOnPhone;
  time.addEventListener("input", () => markDateFilled(time));
  time.addEventListener("change", () => markDateFilled(time));
  timeLabel.appendChild(time);
  const personLabel = document.createElement("label");
  personLabel.textContent = "完成人员";
  const person = document.createElement("input");
  person.type = "text";
  person.name = "person";
  person.maxLength = 20;
  person.autocomplete = "off";
  person.disabled = viewingOnPhone;
  personLabel.appendChild(person);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "完成登记";
  submit.disabled = viewingOnPhone;
  form.append(title, timeLabel, personLabel, submit);
  if (state.completeError && state.completeError.id === item.group.id) {
    const error = document.createElement("p");
    error.className = "form-error";
    error.textContent = state.completeError.text;
    form.appendChild(error);
  }
  return form;
}

function finishGroup(groupId, completedAt, person) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group || ASIDE_IDS.has(group.id)) return;
  if (!completedAt || !person) {
    state.completeError = { id: groupId, text: "完成时间和完成人员都要填写。" };
    render();
    return;
  }
  const members = membersOf(group.id);
  const formedAt = formedAtOf(group, members);
  if (completedAt < formedAt) {
    state.completeError = { id: groupId, text: "完成时间不能早于这条需求的形成日期。" };
    render();
    return;
  }
  const gone = new Set(members.map((row) => row.feedback_id));
  for (const id of gone) {
    if (!state.hidden.quotes.includes(id)) state.hidden.quotes.push(id);
    delete state.placements[id];
    if (state.registered.some((row) => row.feedback_id === id)) state.byId.delete(id);
  }
  state.registered = state.registered.filter((row) => !gone.has(row.feedback_id));
  state.feedback = state.feedback.filter((row) => !gone.has(row.feedback_id) || state.byId.has(row.feedback_id));
  saveRegistered();
  savePlacements();
  if (group.custom) {
    state.groups = state.groups.filter((item) => item.id !== group.id);
    saveGroups();
  } else if (!state.hidden.groups.includes(group.id)) {
    state.hidden.groups.push(group.id);
  }
  saveHidden();
  delete state.priorityLanes[group.id];
  savePriorityLanes();
  forgetBrief(group.id);
  const customers = [...new Set(members.map((row) => row.account_label))];
  state.completed = state.completed.filter((item) => item.id !== group.id);
  state.completed.push({
    id: group.id,
    label: group.label,
    formedAt,
    completedAt,
    person,
    customers,
    simulated: false,
  });
  saveCompleted();
  state.completeError = null;
  state.listSelection = null;
  state.lastStatus = `「${group.label}」已完成登记，已从需求列表和客户反馈中移除。`;
  render();
}

function summaryStrip(waiting, openCount, urgentCount, doneCount) {
  const strip = document.createElement("section");
  strip.className = "home-stats";
  for (const [label, value] of [
    ["待分类", waiting],
    ["未完成", openCount],
    ["加急处理", urgentCount],
    ["已完成", doneCount],
  ]) {
    const card = document.createElement("article");
    card.className = "home-stat";
    const name = document.createElement("span");
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = String(value);
    card.append(name, number);
    strip.appendChild(card);
  }
  return strip;
}

function renderBoard() {
  const board = document.getElementById("panel-board");
  board.replaceChildren();
  const today = todayISO();
  const { urgent, upgrades } = priorityBoard();
  const openItems = [...urgent, ...upgrades];
  const done = completionRecords();

  const duration = document.createElement("section");
  duration.className = "board-block";
  const durationTitle = document.createElement("h2");
  durationTitle.textContent = "未完成需求";
  duration.appendChild(durationTitle);
  if (!openItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "目前没有未完成的需求。";
    duration.appendChild(empty);
  } else {
    const table = document.createElement("table");
    table.className = "duration-table";
    const head = document.createElement("tr");
    for (const label of ["需求", "形成日期", "已建立时长", "登记条数", "所在档"]) {
      const cell = document.createElement("th");
      cell.textContent = label;
      head.appendChild(cell);
    }
    table.appendChild(head);
    const rows = openItems
      .map((item) => ({
        label: item.group.label,
        formedAt: formedAtOf(item.group, item.members),
        count: item.count,
        lane: item.blocksUse ? "加急处理" : "产品升级",
      }))
      .sort((a, b) => daysBetween(b.formedAt, today) - daysBetween(a.formedAt, today) || a.label.localeCompare(b.label, "zh"));
    for (const row of rows) {
      const line = document.createElement("tr");
      const cells = [
        row.label,
        row.formedAt,
        `已建立 ${daysBetween(row.formedAt, today)} 天`,
        `${row.count} 条`,
        row.lane,
      ];
      cells.forEach((text, index) => {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (index === 4 && row.lane === "加急处理") cell.className = "is-urgent-cell";
        line.appendChild(cell);
      });
      table.appendChild(line);
    }
    duration.appendChild(table);
  }

  const people = document.createElement("section");
  people.className = "board-block";
  const peopleTitle = document.createElement("h2");
  peopleTitle.textContent = "完成人员";
  people.appendChild(peopleTitle);
  const byPerson = new Map();
  for (const item of done) {
    if (!byPerson.has(item.person)) byPerson.set(item.person, []);
    byPerson.get(item.person).push(item);
  }
  const personRows = [...byPerson.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh"));
  const maxCount = Math.max(1, ...personRows.map(([, items]) => items.length));
  const bars = document.createElement("div");
  bars.className = "person-bars";
  for (const [person, items] of personRows) {
    const row = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = person;
    const detail = document.createElement("div");
    const track = document.createElement("div");
    track.className = "person-track";
    const bar = document.createElement("div");
    bar.className = "person-bar";
    bar.style.width = `${Math.max(18, Math.round((items.length / maxCount) * 100))}%`;
    bar.textContent = `${items.length} 个`;
    track.appendChild(bar);
    const names = document.createElement("p");
    names.className = "person-names";
    names.textContent = items
      .map((item) => item.simulated ? `${item.label}（模拟）` : item.label)
      .join("、");
    detail.append(track, names);
    row.className = "person-row";
    row.append(name, detail);
    bars.appendChild(row);
  }
  people.appendChild(bars);

  const timeline = document.createElement("section");
  timeline.className = "board-block";
  const timelineTitle = document.createElement("h2");
  timelineTitle.textContent = "已完成需求";
  timeline.appendChild(timelineTitle);
  const doneTable = document.createElement("table");
  doneTable.className = "duration-table";
  const doneHead = document.createElement("tr");
  for (const label of ["需求", "完成时间", "完成人员", "提出客户"]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    doneHead.appendChild(cell);
  }
  doneTable.appendChild(doneHead);
  const doneRows = [...done].sort((a, b) => b.completedAt.localeCompare(a.completedAt) || a.label.localeCompare(b.label, "zh"));
  for (const item of doneRows) {
    const line = document.createElement("tr");
    const customers = Array.isArray(item.customers) && item.customers.length
      ? item.customers.join("、")
      : "还没有客户提出";
    const values = [
      item.simulated ? `${item.label}（模拟）` : item.label,
      item.completedAt,
      item.person,
      customers,
    ];
    for (const text of values) {
      const cell = document.createElement("td");
      cell.textContent = text;
      line.appendChild(cell);
    }
    doneTable.appendChild(line);
  }
  timeline.appendChild(doneTable);
  const marks = doneRows
    .map((item) => {
      const customers = Array.isArray(item.customers) && item.customers.length
        ? item.customers.join("、")
        : "还没有客户提出";
      return {
        label: item.label,
        start: item.formedAt,
        end: item.completedAt,
        meta: `${item.person} · ${item.completedAt} 完成 · ${customers}${item.simulated ? " · 模拟" : ""}`,
        done: true,
      };
    })
    .sort((a, b) => b.end.localeCompare(a.end) || a.label.localeCompare(b.label, "zh"));
  const numbers = marks.flatMap((item) => [dateNumber(item.start), dateNumber(item.end)]).filter(Number.isFinite);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = Math.max(1, max - min);
  const scale = document.createElement("div");
  scale.className = "gantt-scale";
  const scaleStart = document.createElement("span");
  scaleStart.textContent = marks.map((item) => item.start).sort()[0];
  const scaleEnd = document.createElement("span");
  scaleEnd.textContent = marks.map((item) => item.end).sort().at(-1);
  scale.append(scaleStart, scaleEnd);
  const chart = document.createElement("div");
  chart.className = "gantt";
  chart.appendChild(scale);
  for (const item of marks) {
    const row = document.createElement("div");
    row.className = "gantt-row";
    const name = document.createElement("strong");
    name.textContent = item.label;
    const track = document.createElement("div");
    track.className = "gantt-track";
    const bar = document.createElement("span");
    bar.className = item.done ? "gantt-bar is-done" : "gantt-bar is-open";
    const start = dateNumber(item.start);
    const end = dateNumber(item.end);
    bar.style.left = `${((start - min) / span) * 100}%`;
    bar.style.width = `${Math.max(2, ((end - start) / span) * 100)}%`;
    track.appendChild(bar);
    const meta = document.createElement("p");
    meta.className = "gantt-meta";
    meta.textContent = `${item.start} → ${item.end} · ${item.meta}`;
    const column = document.createElement("div");
    column.append(track, meta);
    row.append(name, column);
    chart.appendChild(row);
  }
  timeline.appendChild(chart);
  board.append(summaryStrip(queueRows().length, openItems.length, urgent.length, done.length), duration, people, timeline);
}

function moveQuote(feedbackId, groupId) {
  const row = state.byId.get(feedbackId);
  const group = state.groups.find((item) => item.id === groupId);
  if (!row || !group || state.hidden.groups.includes(group.id)) return;
  state.placements[feedbackId] = group.id;
  savePlacements();
  state.listSelection = { kind: "quote", groupId: group.id, feedbackId };
  state.lastStatus = `${feedbackId} 已挪到「${group.label}」。`;
  render();
}

function place(row, destination) {
  state.placements[row.feedback_id] = destination.id;
  savePlacements();
  state.selectedId = null;
  state.lastStatus = `你的决定：${row.feedback_id} 放到「${destination.label}」。规则演示建议是「${suggestionFor(row)}」。`;
  render();
}

function undoLast() {
  const ids = Object.keys(state.placements);
  const lastId = ids[ids.length - 1];
  if (!lastId) return;
  delete state.placements[lastId];
  savePlacements();
  state.selectedId = lastId;
  state.lastStatus = `已撤销 ${lastId}。`;
  render();
}

function customNumber(id) {
  if (!String(id).startsWith("custom_")) return 0;
  return Number(String(id).replace("custom_", "")) || 0;
}

function nextCustomId() {
  const numbers = [
    ...state.groups.map((group) => customNumber(group.id)),
    ...state.completed.map((item) => customNumber(item.id)),
  ];
  const next = Math.max(0, ...numbers) + 1;
  return `custom_${String(next).padStart(3, "0")}`;
}

function separateCompletedIds() {
  const used = new Set(state.completed.map((item) => item.id));
  let maxCustom = Math.max(0, ...[...used].map((id) => customNumber(id)));
  let changed = false;
  for (const group of state.groups) {
    if (!group.custom || !used.has(group.id)) {
      used.add(group.id);
      continue;
    }
    const oldId = group.id;
    maxCustom += 1;
    group.id = `custom_${String(maxCustom).padStart(3, "0")}`;
    used.add(group.id);
    for (const [feedbackId, destinationId] of Object.entries(state.placements)) {
      if (destinationId === oldId) state.placements[feedbackId] = group.id;
    }
    if (state.priorityLanes[oldId]) {
      state.priorityLanes[group.id] = state.priorityLanes[oldId];
      delete state.priorityLanes[oldId];
    }
    if (state.briefs[oldId]) {
      state.briefs[group.id] = state.briefs[oldId];
      delete state.briefs[oldId];
    }
    changed = true;
  }
  if (!changed) return;
  saveGroups();
  savePlacements();
  savePriorityLanes();
  saveBriefs();
}

function renameGroup(groupId, rawName) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return;
  const label = String(rawName || "").trim();
  if (!label || label === group.label) {
    render();
    return;
  }
  if ([...label].length > 20) {
    state.lastStatus = "分组名称最多 20 个字。";
    render();
    return;
  }
  if (state.groups.some((item) => item.id !== group.id && item.label === label)) {
    state.lastStatus = "已经有这个分组。";
    render();
    return;
  }
  const wasUrgent = nameMarksUrgent(group.label);
  group.label = label;
  saveGroups();
  const nowUrgent = nameMarksUrgent(label);
  if (!wasUrgent && nowUrgent) {
    if (state.priorityLanes[group.id]) {
      delete state.priorityLanes[group.id];
      savePriorityLanes();
    }
    state.lastStatus = `「${label}」已改名，已放入加急处理。`;
  } else {
    state.lastStatus = `分组已改为「${label}」。`;
  }
  render();
}

function addGroup(name) {
  const label = name.trim();
  if (!label) {
    state.editorError = "先写分组名称。";
    state.focusEditor = true;
    render();
    return;
  }
  if (state.groups.some((group) => group.label === label)) {
    state.editorError = "已经有这个分组。";
    state.focusEditor = true;
    render();
    return;
  }
  const group = { id: nextCustomId(), label, custom: true, createdAt: todayISO() };
  state.groups.push(group);
  saveGroups();
  state.editor = null;
  state.editorError = "";
  state.priorityFocusId = nameMarksUrgent(label) ? group.id : "";
  state.lastStatus = nameMarksUrgent(label)
    ? `已新增分组「${label}」，已放入加急处理。`
    : `已新增分组「${label}」。`;
  render();
}

function deleteSelection() {
  const selected = state.listSelection;
  if (!selected) {
    state.tab = "list";
    state.lastStatus = "先点一条原话或一个分组，再点删除。";
    render();
    return;
  }
  const group = state.groups.find((item) => item.id === selected.groupId);
  if (!group) return;
  if (selected.kind === "quote") {
    if (state.placements[selected.feedbackId]) {
      delete state.placements[selected.feedbackId];
      savePlacements();
    }
    if (!state.hidden.quotes.includes(selected.feedbackId)) {
      state.hidden.quotes.push(selected.feedbackId);
      saveHidden();
    }
    state.lastStatus = `已删除「${group.label}」里的 ${selected.feedbackId}。`;
  } else {
    const members = membersOf(group.id);
    for (const row of members) {
      delete state.placements[row.feedback_id];
      if (!state.released.includes(row.feedback_id)) state.released.push(row.feedback_id);
    }
    savePlacements();
    saveReleased();
    if (group.custom) {
      state.groups = state.groups.filter((item) => item.id !== group.id);
      saveGroups();
    } else if (!state.hidden.groups.includes(group.id)) {
      state.hidden.groups.push(group.id);
      saveHidden();
    }
    forgetBrief(group.id);
    state.lastStatus = members.length
      ? `已删除「${group.label}」，里面的客户反馈已回到需求分类。`
      : `已删除「${group.label}」。`;
  }
  state.listSelection = null;
  render();
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function nextRegisteredId() {
  const numbers = state.registered.map((row) => Number(String(row.feedback_id).replace("N", "")) || 0);
  const next = Math.max(0, ...numbers) + 1;
  return `N${String(next).padStart(3, "0")}`;
}

function registerNeed(event) {
  event.preventDefault();
  const customer = document.getElementById("field-customer").value.trim();
  const time = document.getElementById("field-time").value;
  const need = document.getElementById("field-need").value.trim();
  const error = document.getElementById("form-error");
  if (!customer || !time || !need) {
    error.hidden = false;
    error.textContent = "反馈主体、提交时间和意见反馈都要填写。";
    return;
  }
  error.hidden = true;
  absorbRegistered(loadRegistered());
  const row = {
    feedback_id: nextRegisteredId(),
    account_id: "",
    account_label: customer,
    occurred_at: time,
    source_kind: "client_feedback",
    channel: "登记",
    topic_key: "registered",
    suggested_type: "待判断",
    text: need,
  };
  state.registered.push(row);
  saveRegistered();
  state.feedback.push(row);
  state.byId.set(row.feedback_id, row);
  state.selectedId = row.feedback_id;
  state.queueOpen = true;
  state.tab = "register";
  state.lastStatus = `${row.feedback_id} 已记入意见反馈，已进入需求分类。`;
  event.target.reset();
  markDateFilled(document.getElementById("field-time"));
  render();
}

function baselineFrom(feedback, decisions) {
  const groups = new Map(PRODUCT.map((item) => [item.id, []]));
  for (const decision of decisions) {
    if (decision.status !== "confirmed_keep" || !groups.has(decision.topic_key)) continue;
    const ids = decision.feedback_ids || feedback
      .filter((row) => row.topic_key === decision.topic_key)
      .map((row) => row.feedback_id);
    groups.set(decision.topic_key, ids);
  }
  return groups;
}

async function main() {
  const [feedbackPayload, decisionPayload, savedFiltersPayload] = await Promise.all([
    fetch("../data/feedback-60.json").then((response) => response.json()),
    fetch("../data/group-decisions.json").then((response) => response.json()),
    fetch("../data/saved-filters-10.json").then((response) => response.json()),
  ]);
  if (feedbackPayload.data_mode !== "synthetic" || savedFiltersPayload.data_mode !== "synthetic") {
    throw new Error("data must stay synthetic");
  }
  state.feedback = [...feedbackPayload.feedback, ...savedFiltersPayload.feedback, ...state.registered];
  state.byId = new Map(state.feedback.map((row) => [row.feedback_id, row]));
  state.baseline = baselineFrom(feedbackPayload.feedback, decisionPayload.decisions);
  document.getElementById("tab-register").addEventListener("click", () => {
    state.tab = "register";
    state.lastStatus = "";
    render();
  });
  document.getElementById("tab-classify").addEventListener("click", () => {
    state.tab = "classify";
    state.lastStatus = "";
    render();
  });
  document.getElementById("tab-list").addEventListener("click", () => {
    state.tab = "list";
    state.lastStatus = "";
    render();
  });
  document.getElementById("tab-priority").addEventListener("click", () => {
    state.tab = "priority";
    state.lastStatus = "";
    render();
  });
  document.getElementById("tab-board").addEventListener("click", () => {
    state.tab = "board";
    state.lastStatus = "";
    render();
  });
  document.getElementById("delete-selected").addEventListener("click", deleteSelection);
  document.getElementById("register-form").addEventListener("submit", registerNeed);
  const intakeLink = document.getElementById("intake-link");
  intakeLink.href = new URL("intake.html", location.href).href;
  intakeLink.textContent = intakeLink.href;
  window.addEventListener("storage", (event) => {
    if (event.key !== REGISTER_KEY) return;
    absorbRegistered(loadRegistered());
    const incoming = state.registered.filter((row) => row && row.topic_key === "registered" && !state.placements[row.feedback_id]);
    const last = incoming[incoming.length - 1];
    if (last) {
      state.selectedId = last.feedback_id;
      state.queueOpen = true;
      state.lastStatus = `${last.feedback_id} 已从客户反馈表单进入需求分类。`;
    }
    render();
  });
  const timeField = document.getElementById("field-time");
  timeField.addEventListener("input", () => markDateFilled(timeField));
  timeField.addEventListener("change", () => markDateFilled(timeField));
  phoneQuery.addEventListener("change", render);
  separateCompletedIds();
  render();
}

main().catch((error) => {
  document.getElementById("status").textContent = `页面没有读到模拟资料：${error.message}。请从项目目录启动本地页面后再打开。`;
});
