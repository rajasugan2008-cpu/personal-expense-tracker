'use strict';

/* ============================================================
   Personal Expense Tracker – plain HTML/CSS/JS, data in LocalStorage
   ============================================================ */

// ---------- Constants ----------
const KEYS = { tx: 'pet.transactions', budget: 'pet.budget', theme: 'pet.theme' };
const CATEGORIES = {
  expense: ['Food', 'Transport', 'Education', 'Shopping', 'Bills', 'Entertainment', 'Healthcare', 'Other'],
  income: ['Salary', 'Freelance', 'Scholarship', 'Allowance', 'Other']
};
const ICONS = {
  Food: '🍔', Transport: '🚌', Education: '📚', Shopping: '🛍️', Bills: '🧾', Entertainment: '🎬',
  Healthcare: '💊', Other: '📦', Salary: '💼', Freelance: '💻', Scholarship: '🎓', Allowance: '👛'
};
const ALL_CATS = [...new Set([...CATEGORIES.expense, ...CATEGORIES.income])];
const TITLES = { dashboard: 'Dashboard', transactions: 'Transactions', budget: 'Budget', data: 'Data' };
const CSV_HEADER = ['Date', 'Type', 'Title', 'Category', 'Amount', 'Notes'];

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const money = (n) => inr.format(n);
const round2 = (n) => Math.round(n * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const monthOf = (s) => s.slice(0, 7);
function shiftMonth(key, n) { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthLabel(key, short) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
}
function fmtDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return y >= 1900 && y <= 2100 && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Safe DOM builder: user text is only ever inserted as text nodes.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  kids.flat().filter(Boolean).forEach((c) => el.append(c));
  return el;
}
function emptyState(title, msg) { return h('div', { class: 'empty' }, h('strong', { text: title }), h('span', { text: msg })); }

let toastTimer;
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3400);
}

function confirmBox(msg, okLabel = 'Confirm') {
  return new Promise((resolve) => {
    const d = $('#confirmDialog');
    $('#confirmMsg').textContent = msg;
    $('#confirmOk').textContent = okLabel;
    d.returnValue = '';
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

// ---------- State & storage ----------
const state = { tx: [], budget: 0, month: todayStr().slice(0, 7), editId: null };

function validTx(t) {
  return t && typeof t === 'object' && typeof t.id === 'string' && (t.type === 'income' || t.type === 'expense') &&
    typeof t.title === 'string' && t.title.trim() !== '' && typeof t.amount === 'number' && Number.isFinite(t.amount) && t.amount > 0 &&
    CATEGORIES[t.type].includes(t.category) && isDate(t.date);
}
function loadTx() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.tx) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(validTx).map((t) => ({ ...t, notes: typeof t.notes === 'string' ? t.notes : '', created: Number(t.created) || 0, demo: t.demo === true }));
  } catch { return []; }
}
function loadBudget() {
  try { const b = Number(JSON.parse(localStorage.getItem(KEYS.budget))); return Number.isFinite(b) && b > 0 ? b : 0; } catch { return 0; }
}
function store(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch { toast('Could not save: browser storage is unavailable or full.', 'err'); return false; }
}
const saveTx = () => store(KEYS.tx, JSON.stringify(state.tx));
const saveBudget = () => store(KEYS.budget, JSON.stringify(state.budget));

// ---------- Calculations ----------
const sumType = (list, type) => round2(list.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0));
const inMonth = (key) => state.tx.filter((t) => monthOf(t.date) === key);
const byNewest = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.created - a.created);

// ---------- Rendering ----------
function renderAll() {
  renderHeader(); renderSummary(); renderMonthly(); renderCategories(); renderRecent(); renderTable(); renderBudget();
}

function renderHeader() {
  const cur = todayStr().slice(0, 7) === state.month;
  $('#monthLabel').textContent = monthLabel(state.month) + (cur ? ' (current month)' : '');
  $('#monthPicker').value = state.month;
}

function renderSummary() {
  const month = inMonth(state.month);
  const balance = round2(sumType(state.tx, 'income') - sumType(state.tx, 'expense'));
  const spent = sumType(month, 'expense');
  $('#sBalance').textContent = money(balance);
  $('#sBalance').className = 'num ' + (balance < 0 ? 'neg' : '');
  $('#sIncome').textContent = money(sumType(month, 'income'));
  $('#sExpense').textContent = money(spent);
  const rem = $('#sRemaining');
  if (state.budget > 0) {
    const left = round2(state.budget - spent);
    rem.textContent = money(left);
    rem.className = 'num ' + (left < 0 ? 'neg' : '');
  } else { rem.textContent = 'Not set'; rem.className = 'num'; }
}

function renderMonthly() {
  const box = $('#monthlyChart'); box.replaceChildren();
  const months = [-5, -4, -3, -2, -1, 0].map((n) => shiftMonth(state.month, n));
  const data = months.map((m) => { const l = inMonth(m); return { m, inc: sumType(l, 'income'), exp: sumType(l, 'expense') }; });
  const max = Math.max(...data.flatMap((d) => [d.inc, d.exp]));
  if (max === 0) { box.append(emptyState('No data for these months', 'Add a transaction to see income and expenses.')); return; }
  const bars = h('div', { class: 'bars', role: 'img', 'aria-label': 'Income and expenses for the last six months' });
  data.forEach((d) => bars.append(h('div', { class: 'bar-group' },
    h('div', { class: 'bar-pair' },
      h('div', { class: 'bar inc', style: `height:${(d.inc / max) * 100}%`, title: `${monthLabel(d.m)} income: ${money(d.inc)}` }),
      h('div', { class: 'bar exp', style: `height:${(d.exp / max) * 100}%`, title: `${monthLabel(d.m)} expenses: ${money(d.exp)}` })),
    h('span', { class: 'bar-label', text: monthLabel(d.m, true) }))));
  box.append(bars, h('div', { class: 'legend' },
    h('span', {}, h('i', { class: 'dot', style: 'background:var(--pos)' }), 'Income'),
    h('span', {}, h('i', { class: 'dot', style: 'background:var(--neg)' }), 'Expenses')));
}

function renderCategories() {
  const box = $('#categoryChart'); box.replaceChildren();
  const exp = inMonth(state.month).filter((t) => t.type === 'expense');
  const total = sumType(exp, 'expense');
  if (!exp.length) { box.append(emptyState('No expenses this month', 'Spending by category will appear here.')); return; }
  const totals = {};
  exp.forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
  Object.entries(totals).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
    const pct = (amt / total) * 100;
    box.append(h('div', { class: 'cat-row' },
      h('div', { class: 'cat-head' }, h('span', { text: `${ICONS[cat]} ${cat}` }), h('span', { text: `${money(round2(amt))} · ${pct.toFixed(0)}%` })),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${pct}%` }))));
  });
}

function txIcon(cat) { return h('span', { class: 'ico', 'aria-hidden': 'true', text: ICONS[cat] || '📦' }); }
function amountEl(t) { return h('span', { class: 'amt ' + (t.type === 'income' ? 'pos' : 'neg'), text: (t.type === 'income' ? '+' : '−') + money(t.amount) }); }
function titleBlock(t) {
  return h('div', { style: 'min-width:0' },
    h('div', { class: 'tx-title' }, t.title, t.demo ? h('span', { class: 'badge', text: 'Demo' }) : null),
    t.notes ? h('div', { class: 'tx-note', text: t.notes }) : null);
}

function renderRecent() {
  const box = $('#recentList'); box.replaceChildren();
  const list = [...state.tx].sort(byNewest).slice(0, 5);
  if (!list.length) { box.append(emptyState('No transactions yet', 'Use “Add transaction” to record your first one.')); return; }
  list.forEach((t) => box.append(h('div', { class: 'recent-item' },
    h('div', { class: 'tx-main' }, txIcon(t.category), titleBlock(t)),
    h('div', { style: 'text-align:right' }, amountEl(t), h('div', { class: 'tx-note', text: fmtDate(t.date) })))));
}

function filteredTx() {
  const q = $('#fSearch').value.trim().toLowerCase();
  const type = $('#fType').value, cat = $('#fCat').value, from = $('#fFrom').value, to = $('#fTo').value, sort = $('#fSort').value;
  const list = state.tx.filter((t) =>
    (!q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q)) &&
    (type === 'all' || t.type === type) && (cat === 'all' || t.category === cat) &&
    (!from || t.date >= from) && (!to || t.date <= to));
  const sorts = {
    new: byNewest, old: (a, b) => -byNewest(a, b),
    high: (a, b) => b.amount - a.amount, low: (a, b) => a.amount - b.amount
  };
  return list.sort(sorts[sort] || byNewest);
}

function renderTable() {
  const body = $('#txBody'), empty = $('#txEmpty');
  body.replaceChildren(); empty.replaceChildren();
  const list = filteredTx();
  const from = $('#fFrom').value, to = $('#fTo').value;
  $('#resultCount').textContent = from && to && from > to
    ? 'The “From” date is after the “To” date.'
    : `Showing ${list.length} of ${state.tx.length} transactions`;
  if (!state.tx.length) { empty.append(emptyState('No transactions yet', 'Add one, or load demo data from the Data page.')); return; }
  if (!list.length) { empty.append(emptyState('No matching transactions', 'Try changing or resetting the filters.')); return; }
  list.forEach((t) => body.append(h('tr', {},
    h('td', {}, h('div', { class: 'tx-main' }, txIcon(t.category), titleBlock(t))),
    h('td', {}, t.category, h('div', { class: 'tx-note', text: t.type === 'income' ? 'Income' : 'Expense' })),
    h('td', { text: fmtDate(t.date) }),
    h('td', { class: 'right' }, amountEl(t)),
    h('td', { class: 'right' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Edit ${t.title}`, text: 'Edit', onclick: () => openTx(t.id) }),
      h('button', { class: 'icon-btn del', type: 'button', 'aria-label': `Delete ${t.title}`, text: 'Delete', onclick: () => deleteTx(t.id) })))));
}

function renderBudget() {
  const box = $('#budgetPanel'); box.replaceChildren();
  $('#budgetInput').value = state.budget || '';
  if (!state.budget) { box.append(emptyState('No budget set', 'Enter a monthly amount above to track your spending.')); return; }
  const spent = sumType(inMonth(state.month), 'expense');
  const pct = (spent / state.budget) * 100, left = round2(state.budget - spent);
  const cls = pct > 100 ? 'over' : pct >= 80 ? 'warn' : '';
  const msg = pct > 100 ? `Budget exceeded by ${money(-left)}.`
    : pct >= 80 ? `Warning: you have used ${pct.toFixed(0)}% of your budget.`
    : `On track: ${pct.toFixed(0)}% of your budget used.`;
  box.append(h('div', { class: 'budget-box' },
    h('div', { class: 'cat-head' }, h('span', { text: `Spent in ${monthLabel(state.month)}: ${money(spent)}` }), h('span', { text: `Budget: ${money(state.budget)}` })),
    h('div', { class: 'track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.min(100, Math.round(pct))) },
      h('div', { class: 'fill ' + cls, style: `width:${Math.min(pct, 100)}%` })),
    h('p', { class: 'muted small mini-budget', text: left >= 0 ? `Remaining: ${money(left)}` : `Over by: ${money(-left)}` }),
    h('div', { class: 'alert ' + (cls || 'ok'), role: 'alert', text: msg })));
}

// ---------- Views, theme ----------
function setView(v) {
  document.querySelectorAll('.view').forEach((s) => { s.hidden = s.id !== 'view-' + v; });
  document.querySelectorAll('.nav-btn[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === v);
    if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#pageTitle').textContent = TITLES[v];
}
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#themeIcon').textContent = t === 'dark' ? '☀' : '☾';
  $('#themeLabel').textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
}

// ---------- Add / edit / delete ----------
function fillCategories(selected) {
  const type = document.querySelector('input[name="type"]:checked').value;
  const sel = $('#category'); sel.replaceChildren();
  CATEGORIES[type].forEach((c) => sel.append(h('option', { value: c, text: c })));
  if (CATEGORIES[type].includes(selected)) sel.value = selected;
}
function clearErrors() { document.querySelectorAll('#txForm .error').forEach((e) => { e.textContent = ''; }); }

function openTx(id) {
  const t = id ? state.tx.find((x) => x.id === id) : null;
  state.editId = t ? t.id : null;
  clearErrors();
  $('#txDialogTitle').textContent = t ? 'Edit transaction' : 'Add transaction';
  $('#txSave').textContent = t ? 'Save changes' : 'Save transaction';
  document.querySelector(`input[name="type"][value="${t ? t.type : 'expense'}"]`).checked = true;
  fillCategories(t && t.category);
  $('#title').value = t ? t.title : '';
  $('#amount').value = t ? t.amount : '';
  $('#date').value = t ? t.date : todayStr();
  $('#notes').value = t ? t.notes : '';
  $('#txDialog').showModal();
  $('#title').focus();
}

function submitTx(e) {
  e.preventDefault(); clearErrors();
  const type = document.querySelector('input[name="type"]:checked').value;
  const title = $('#title').value.trim(), notes = $('#notes').value.trim();
  const amount = Number($('#amount').value), rawAmount = $('#amount').value.trim();
  const date = $('#date').value, category = $('#category').value;
  const errs = {};
  if (!title) errs.title = 'Enter a title.';
  else if (title.length > 60) errs.title = 'Keep the title under 60 characters.';
  if (rawAmount === '' || !Number.isFinite(amount)) errs.amount = 'Enter an amount.';
  else if (amount <= 0) errs.amount = 'Amount must be greater than zero.';
  else if (amount > 1e9) errs.amount = 'Amount is too large.';
  else if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) errs.amount = 'Use at most 2 decimal places.';
  if (!isDate(date)) errs.date = 'Choose a valid date.';
  if (!CATEGORIES[type].includes(category)) errs.category = 'Choose a category.';
  if (Object.keys(errs).length) {
    for (const [k, v] of Object.entries(errs)) $('#err-' + k).textContent = v;
    toast('Please fix the highlighted fields.', 'err');
    return;
  }
  const data = { type, title, amount: round2(amount), category, date, notes };
  if (state.editId) {
    const i = state.tx.findIndex((t) => t.id === state.editId);
    state.tx[i] = { ...state.tx[i], ...data };
    toast('Transaction updated.');
  } else {
    state.tx.push({ id: newId(), created: Date.now(), demo: false, ...data });
    toast('Transaction added.');
  }
  saveTx(); $('#txDialog').close(); renderAll();
}

async function deleteTx(id) {
  const t = state.tx.find((x) => x.id === id);
  if (!t || !(await confirmBox(`Delete “${t.title}”? This cannot be undone.`, 'Delete'))) return;
  state.tx = state.tx.filter((x) => x.id !== id);
  saveTx(); renderAll(); toast('Transaction deleted.');
}

// ---------- Budget ----------
function submitBudget(e) {
  e.preventDefault();
  const raw = $('#budgetInput').value.trim(), v = Number(raw), err = $('#budgetError');
  err.textContent = '';
  if (raw === '' || !Number.isFinite(v) || v <= 0 || v > 1e9) { err.textContent = 'Enter a budget greater than zero.'; return; }
  state.budget = round2(v); saveBudget(); renderAll(); toast('Budget saved.');
}

// ---------- CSV export / import ----------
function csvCell(v) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // prevents spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCSV() {
  if (!state.tx.length) { toast('There are no transactions to export.', 'err'); return; }
  const rows = [...state.tx].sort(byNewest).map((t) => [t.date, t.type, t.title, t.category, t.amount.toFixed(2), t.notes]);
  const csv = '\ufeff' + [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: `expense-tracker-${todayStr()}.csv` });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('CSV exported.');
}
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}
async function importCSV(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('File is too large (max 2 MB).', 'err'); return; }
  let rows;
  try { rows = parseCSV((await file.text()).replace(/^\ufeff/, '')); } catch { toast('Could not read that file.', 'err'); return; }
  const head = (rows[0] || []).map((x) => x.trim().toLowerCase());
  if (head.join() !== CSV_HEADER.map((x) => x.toLowerCase()).join()) { toast('Invalid CSV: expected columns Date, Type, Title, Category, Amount, Notes.', 'err'); return; }
  if (rows.length - 1 > 5000) { toast('Too many rows (max 5000).', 'err'); return; }
  const sig = (t) => [t.date, t.type, t.title, t.category, t.amount, t.notes].join('|');
  const seen = new Set(state.tx.map(sig));
  let added = 0, invalid = 0, dupes = 0;
  rows.slice(1).forEach((r) => {
    const clean = (v) => String(v ?? '').trim().replace(/^'(?=[=+\-@])/, '');
    const type = clean(r[1]).toLowerCase();
    const cat = (CATEGORIES[type] || []).find((c) => c.toLowerCase() === clean(r[3]).toLowerCase());
    const amount = Number(clean(r[4])), title = clean(r[2]);
    const t = { id: newId(), created: Date.now() + added, demo: false, date: clean(r[0]), type, title, category: cat, amount: round2(amount), notes: clean(r[5]).slice(0, 200) };
    if (r.length !== 6 || !title || title.length > 60 || !cat || !isDate(t.date) || !Number.isFinite(amount) || amount <= 0 || amount > 1e9) { invalid++; return; }
    if (seen.has(sig(t))) { dupes++; return; }
    seen.add(sig(t)); state.tx.push(t); added++;
  });
  if (added) saveTx();
  renderAll();
  toast(`Imported ${added}. Skipped ${invalid} invalid and ${dupes} duplicate rows.`, added ? '' : 'err');
}

// ---------- Demo data & reset ----------
function loadDemo() {
  if (state.tx.some((t) => t.demo)) { toast('Demo data is already loaded.'); return; }
  const items = [
    ['income', 'Monthly allowance', 12000, 'Allowance', 1], ['income', 'Freelance project', 4500, 'Freelance', 10],
    ['expense', 'Canteen and groceries', 2800, 'Food', 4], ['expense', 'Bus pass', 600, 'Transport', 6],
    ['expense', 'Course materials', 1500, 'Education', 9], ['expense', 'Mobile recharge', 399, 'Bills', 12],
    ['expense', 'Movie night', 450, 'Entertainment', 15]
  ];
  const now = Date.now(); let n = 0;
  [0, -1, -2].forEach((off) => {
    const key = shiftMonth(todayStr().slice(0, 7), off);
    items.forEach(([type, title, amount, category, day]) =>
      state.tx.push({ id: newId(), created: now + n++, demo: true, type, title, amount, category, date: `${key}-${pad(day)}`, notes: 'Sample entry' }));
  });
  saveTx(); renderAll(); toast('Demo data loaded. You can remove it any time.');
}
async function removeDemo() {
  if (!state.tx.some((t) => t.demo)) { toast('There is no demo data to remove.'); return; }
  if (!(await confirmBox('Remove all demo transactions? Your own transactions stay.', 'Remove demo data'))) return;
  state.tx = state.tx.filter((t) => !t.demo); saveTx(); renderAll(); toast('Demo data removed.');
}
async function resetAll() {
  if (!(await confirmBox('Delete ALL transactions and your budget from this browser? This cannot be undone.', 'Reset all data'))) return;
  try { localStorage.removeItem(KEYS.tx); localStorage.removeItem(KEYS.budget); } catch { /* storage unavailable */ }
  state.tx = []; state.budget = 0; renderAll(); toast('All data was reset.');
}

// ---------- Init ----------
function init() {
  state.tx = loadTx(); state.budget = loadBudget();
  let theme = null;
  try { theme = localStorage.getItem(KEYS.theme); } catch { /* ignore */ }
  applyTheme(theme === 'dark' || theme === 'light' ? theme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  $('#fCat').append(h('option', { value: 'all', text: 'All categories' }), ...ALL_CATS.map((c) => h('option', { value: c, text: c })));
  fillCategories();

  document.querySelectorAll('.nav-btn[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.goto)));
  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next); store(KEYS.theme, next);
  });
  $('#monthPicker').addEventListener('change', (e) => {
    if (/^\d{4}-\d{2}$/.test(e.target.value)) state.month = e.target.value;
    else toast('Enter a month as YYYY-MM.', 'err');
    renderAll();
  });
  $('#addBtn').addEventListener('click', () => openTx(null));
  $('#txCancel').addEventListener('click', () => $('#txDialog').close());
  $('#txForm').addEventListener('submit', submitTx);
  document.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', () => fillCategories()));

  ['fSearch', 'fType', 'fCat', 'fFrom', 'fTo', 'fSort'].forEach((id) => {
    $('#' + id).addEventListener('input', renderTable); $('#' + id).addEventListener('change', renderTable);
  });
  $('#filters').addEventListener('submit', (e) => e.preventDefault());
  $('#resetFilters').addEventListener('click', () => { $('#filters').reset(); renderTable(); });

  $('#budgetForm').addEventListener('submit', submitBudget);
  $('#clearBudget').addEventListener('click', () => { state.budget = 0; saveBudget(); $('#budgetError').textContent = ''; renderAll(); toast('Budget removed.'); });

  $('#exportBtn').addEventListener('click', exportCSV);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => { importCSV(e.target.files[0]); e.target.value = ''; });
  $('#demoBtn').addEventListener('click', loadDemo);
  $('#removeDemoBtn').addEventListener('click', removeDemo);
  $('#resetBtn').addEventListener('click', resetAll);

  setView('dashboard');
  renderAll();
}
document.addEventListener('DOMContentLoaded', init);
