'use strict';

/*
 * Spares 'n Money — prototipo.
 * I dati vengono salvati in locale sul dispositivo (localStorage).
 * Gli importi sono memorizzati in centesimi interi per evitare errori di arrotondamento.
 *
 * Tipi di movimento:
 *  - 'in'   entrata (con un "tipo": stipendio, tredicesima, quattordicesima, TFR, paghetta…)
 *  - 'out'  spesa
 *  - 'debt' indebito: denaro uscito dal saldo che deve rientrare. Finché è aperto viene
 *           sottratto dal saldo e mostrato nel riquadro "Indebiti da rientrare";
 *           quando è segnato come rientrato torna nel saldo.
 */

const STORAGE_KEY = 'spares-n-money:v1';
const CATEGORIES_KEY = 'spares-n-money:categories:v1';

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const INCOME_KINDS = [
  ['generic', 'Entrata generica'],
  ['stipendio', 'Stipendio'],
  ['tredicesima', 'Tredicesima'],
  ['quattordicesima', 'Quattordicesima'],
  ['tfr', 'TFR'],
  ['paghetta', 'Paghetta'],
];
const KIND_LABEL = Object.fromEntries(INCOME_KINDS);

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fmt = (cents) => euro.format(cents / 100);
const newId = () => (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());

// ---------- Stato ----------

function loadList(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    alert('Impossibile salvare i dati su questo dispositivo.');
  }
}

let transactions = loadList(STORAGE_KEY);
let categories = loadList(CATEGORIES_KEY);

const categoryName = (id) => categories.find((c) => c.id === id)?.name || '';

function totals() {
  let income = 0, expense = 0, debtOpen = 0, debtCount = 0;
  for (const t of transactions) {
    if (t.ignored) continue; // le transazioni trascurate restano solo in cronologia
    if (t.type === 'in') income += t.amount;
    else if (t.type === 'out') expense += t.amount;
    else if (t.type === 'debt' && !t.settled) { debtOpen += t.amount; debtCount++; }
  }
  const balance = income - expense - debtOpen;
  return { income, expense, debtOpen, debtCount, balance, withDebts: balance + debtOpen };
}

// Converte "1.234,56" / "1234.56" / "1234,5" in centesimi. Restituisce NaN se non valido.
function parseAmount(raw) {
  let s = String(raw).trim().replace(/[€\s]/g, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const decSep = lastComma > lastDot ? ',' : '.';
  const thouSep = decSep === ',' ? '.' : ',';
  s = s.split(thouSep).join('');
  if (decSep === ',') s = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

const centsToInput = (c) => (c / 100).toFixed(2).replace('.', ',');

// ---------- Elementi ----------

const $ = (id) => document.getElementById(id);
const els = {
  balance: $('balance'), totalIn: $('total-in'), totalOut: $('total-out'),
  debtOpen: $('debt-open'), debtCount: $('debt-count'), debtTotal: $('debt-total'),
  list: $('list'), empty: $('empty'), reset: $('reset-all'),
  dialog: $('dialog'), form: $('form'), title: $('form-title'),
  amount: $('amount'), kind: $('kind'), kindField: $('kind-field'),
  description: $('description'), descLabel: $('desc-label'),
  category: $('category'), categoryField: $('category-field'),
  newCatRow: $('new-cat-row'), newCat: $('new-cat'),
  month: $('month'), monthLabel: $('month-label'),
  year: $('year'), yearLabel: $('year-label'),
  settled: $('settled'), settledField: $('settled-field'), ignored: $('ignored'),
  error: $('error'), submit: $('submit'),
};

// ---------- Elenco movimenti ----------

function periodKey(t) {
  // Ordinamento: per anno/mese se presenti, altrimenti per data di inserimento.
  if (t.year) return t.year * 100 + (t.month || 0);
  const d = new Date(t.createdAt);
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function periodLabel(t) {
  if (t.month && t.year) return `${MONTHS[t.month - 1]} ${t.year}`;
  if (t.year) return String(t.year);
  return 'Data non specificata';
}

function itemTitle(t) {
  if (t.description) return t.description;
  if (t.type === 'in') return KIND_LABEL[t.kind] || 'Entrata';
  return t.type === 'out' ? 'Spesa' : 'Indebito';
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function renderItem(t) {
  const li = el('li', `item ${t.type}${t.type === 'debt' && t.settled ? ' settled' : ''}${t.ignored ? ' ignored' : ''}`);

  const icon = el('div', 'icon', t.type === 'in' ? '+' : t.type === 'out' ? '−' : '↺');

  // Tutta la parte testuale è un pulsante che apre la modifica.
  const info = el('button', 'info');
  info.type = 'button';
  info.setAttribute('aria-label', `Modifica ${itemTitle(t)}`);
  info.addEventListener('click', () => openForm(t.type, t));
  info.append(el('span', 'title', itemTitle(t)));

  const meta = el('span', 'meta');
  meta.append(el('span', 'date', periodLabel(t)));
  if (t.type === 'in' && t.kind && t.kind !== 'generic' && t.description) {
    meta.append(el('span', 'badge kind', KIND_LABEL[t.kind]));
  }
  if (t.type === 'debt' && !t.ignored) {
    meta.append(el('span', `badge ${t.settled ? 'ok' : 'debt'}`, t.settled ? 'Rientrato' : 'Da rientrare'));
  }
  const cat = categoryName(t.category);
  if (cat) meta.append(el('span', 'badge cat', cat));
  if (t.ignored) meta.append(el('span', 'badge ignored', 'Trascurata'));
  info.append(meta);

  const sign = t.type === 'in' ? '+ ' : t.type === 'out' ? '− ' : t.settled ? '' : '− ';
  const amount = el('div', 'amount', sign + fmt(t.amount));

  const tools = el('div', 'tools');
  if (t.type === 'debt' && !t.ignored) {
    const settle = el('button', 'tool settle', t.settled ? '↩' : '✓');
    settle.type = 'button';
    const label = t.settled ? 'Segna come non rientrato' : 'Segna come rientrato';
    settle.title = label;
    settle.setAttribute('aria-label', `${label}: ${itemTitle(t)}`);
    settle.addEventListener('click', () => toggleSettled(t.id));
    tools.append(settle);
  }
  const del = el('button', 'tool delete', '✕');
  del.type = 'button';
  del.title = 'Elimina';
  del.setAttribute('aria-label', `Elimina ${itemTitle(t)}`);
  del.addEventListener('click', () => removeTransaction(t.id));
  tools.append(del);

  li.append(icon, info, amount, tools);
  return li;
}

function render() {
  const s = totals();
  els.balance.textContent = fmt(s.balance);
  els.balance.classList.toggle('negative', s.balance < 0);
  els.totalIn.textContent = fmt(s.income);
  els.totalOut.textContent = fmt(s.expense);
  els.debtOpen.textContent = fmt(s.debtOpen);
  els.debtTotal.textContent = fmt(s.withDebts);
  els.debtCount.textContent = s.debtCount === 0 ? 'Nessun indebito aperto'
    : s.debtCount === 1 ? '1 indebito aperto' : `${s.debtCount} indebiti aperti`;

  const sorted = [...transactions].sort(
    (a, b) => periodKey(b) - periodKey(a) || b.createdAt - a.createdAt
  );
  els.list.replaceChildren(...sorted.map(renderItem));
  els.empty.hidden = transactions.length > 0;
  els.reset.hidden = transactions.length === 0 && categories.length === 0;

  renderCategoryManager();
  if (!$('panel-charts').hidden) renderCharts();
}

// ---------- Azioni sui movimenti ----------

function removeTransaction(id) {
  if (!confirm('Eliminare questo movimento?')) return;
  transactions = transactions.filter((t) => t.id !== id);
  save();
  render();
}

function toggleSettled(id) {
  const t = transactions.find((x) => x.id === id);
  if (!t) return;
  t.settled = !t.settled;
  t.settledAt = t.settled ? Date.now() : null;
  save();
  render();
}

function resetAll() {
  if (!confirm('Cancellare TUTTI i movimenti e le categorie e azzerare il totale? L\'operazione non si può annullare.')) return;
  transactions = [];
  categories = [];
  save();
  render();
}

// ---------- Categorie ----------

// Crea una categoria (o restituisce quella esistente con lo stesso nome).
function addCategory(rawName) {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const c = { id: newId(), name };
  categories.push(c);
  categories.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  save();
  return c;
}

function buildCategoryOptions(selected) {
  const opts = [new Option('Nessuna', '')];
  for (const c of categories) opts.push(new Option(c.name, c.id));
  opts.push(new Option('+ Nuova categoria…', '__new'));
  els.category.replaceChildren(...opts);
  els.category.value = selected && categories.some((c) => c.id === selected) ? selected : '';
  els.newCatRow.hidden = true;
}

els.category.addEventListener('change', () => {
  const isNew = els.category.value === '__new';
  els.newCatRow.hidden = !isNew;
  if (isNew) { els.newCat.value = ''; els.newCat.focus(); }
});

function createCategoryFromForm() {
  const c = addCategory(els.newCat.value);
  if (!c) { els.newCat.focus(); return null; }
  buildCategoryOptions(c.id);
  render();
  return c;
}
$('new-cat-add').addEventListener('click', createCategoryFromForm);
els.newCat.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); createCategoryFromForm(); }
});

const catsDialog = $('cats-dialog');

function renderCategoryManager() {
  const counts = {};
  for (const t of transactions) if (t.category) counts[t.category] = (counts[t.category] || 0) + 1;

  $('cats-list').replaceChildren(...categories.map((c) => {
    const li = el('li', 'cat-row');
    const n = counts[c.id] || 0;
    const info = el('div', 'cat-info');
    info.append(el('span', 'title', c.name), el('span', 'date', n === 1 ? '1 movimento' : `${n} movimenti`));

    const rename = el('button', 'tool', '✎');
    rename.type = 'button';
    rename.title = 'Rinomina';
    rename.setAttribute('aria-label', `Rinomina ${c.name}`);
    rename.addEventListener('click', () => {
      const name = prompt('Nuovo nome della categoria:', c.name);
      if (name == null) return;
      const clean = name.trim().replace(/\s+/g, ' ');
      if (!clean) return;
      if (categories.some((x) => x.id !== c.id && x.name.toLowerCase() === clean.toLowerCase())) {
        alert('Esiste già una categoria con questo nome.');
        return;
      }
      c.name = clean;
      categories.sort((a, b) => a.name.localeCompare(b.name, 'it'));
      save();
      render();
    });

    const del = el('button', 'tool delete', '✕');
    del.type = 'button';
    del.title = 'Elimina';
    del.setAttribute('aria-label', `Elimina ${c.name}`);
    del.addEventListener('click', () => {
      const msg = `Eliminare la categoria "${c.name}"?` + (n === 0 ? ''
        : n === 1 ? ' Il movimento che la usa resterà senza categoria.'
        : ` I ${n} movimenti che la usano resteranno senza categoria.`);
      if (!confirm(msg)) return;
      categories = categories.filter((x) => x.id !== c.id);
      for (const t of transactions) if (t.category === c.id) t.category = null;
      save();
      render();
    });

    li.append(info, rename, del);
    return li;
  }));
  $('cats-empty').hidden = categories.length > 0;
}

$('cats-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('cats-new');
  const name = input.value.trim();
  $('cats-error').textContent = '';
  if (!name) { $('cats-error').textContent = 'Scrivi un nome per la categoria.'; input.focus(); return; }
  if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    $('cats-error').textContent = 'Questa categoria esiste già.';
    return;
  }
  addCategory(name);
  input.value = '';
  render();
  input.focus();
});
$('open-cats').addEventListener('click', () => {
  $('cats-error').textContent = '';
  $('cats-new').value = '';
  renderCategoryManager();
  catsDialog.showModal();
});
$('cats-close').addEventListener('click', () => catsDialog.close());
catsDialog.addEventListener('click', (e) => { if (e.target === catsDialog) catsDialog.close(); });

// ---------- Form movimento ----------

let mode = 'in';
let editingId = null;

function buildMonthOptions(optional) {
  const opts = [];
  if (optional) opts.push(new Option('—', ''));
  MONTHS.forEach((m, i) => opts.push(new Option(m, String(i + 1))));
  els.month.replaceChildren(...opts);
}

els.kind.replaceChildren(...INCOME_KINDS.map(([v, l]) => new Option(l, v)));

const FORM_TEXT = {
  in:   { title: 'Aggiungi denaro', edit: 'Modifica entrata', submit: 'Aggiungi', btn: 'btn-in',
          desc: 'Descrizione <em>(facoltativa)</em>', ph: 'Es. Stipendio di novembre' },
  out:  { title: 'Sottrai denaro', edit: 'Modifica spesa', submit: 'Sottrai', btn: 'btn-out',
          desc: 'Descrizione <em>(obbligatoria)</em>', ph: 'Es. Spesa al supermercato' },
  debt: { title: 'Nuovo indebito', edit: 'Modifica indebito', submit: 'Registra indebito', btn: 'btn-debt',
          desc: 'Descrizione <em>(obbligatoria)</em>', ph: 'Es. Prestito a Marco' },
};

function openForm(type, existing = null) {
  mode = type;
  editingId = existing ? existing.id : null;
  const txt = FORM_TEXT[type];
  const isIn = type === 'in';
  const now = new Date();

  els.form.reset();
  els.error.textContent = '';
  for (const f of [els.amount, els.description, els.year]) f.classList.remove('invalid');

  els.title.textContent = existing ? txt.edit : txt.title;
  els.submit.textContent = existing ? 'Salva modifiche' : txt.submit;
  els.submit.className = `btn ${txt.btn}`;
  els.descLabel.innerHTML = txt.desc;
  els.description.placeholder = txt.ph;
  els.monthLabel.innerHTML = isIn ? 'Mese di ricezione' : 'Mese <em>(facoltativo)</em>';
  els.yearLabel.innerHTML = isIn ? 'Anno' : 'Anno <em>(facolt.)</em>';

  els.kindField.hidden = !isIn;
  els.categoryField.hidden = type === 'debt';
  els.settledField.hidden = type !== 'debt' || !existing;

  buildMonthOptions(!isIn);
  buildCategoryOptions(existing?.category);

  if (existing) {
    els.amount.value = centsToInput(existing.amount);
    els.description.value = existing.description || '';
    els.kind.value = existing.kind || 'generic';
    els.month.value = existing.month ? String(existing.month) : '';
    els.year.value = existing.year ? String(existing.year) : '';
    els.settled.checked = !!existing.settled;
    els.ignored.checked = !!existing.ignored;
  } else {
    els.kind.value = 'stipendio';
    // Per le entrate precompila il mese/anno correnti (modificabili).
    els.month.value = isIn ? String(now.getMonth() + 1) : '';
    els.year.value = isIn ? String(now.getFullYear()) : '';
  }

  els.dialog.showModal();
  if (!existing) setTimeout(() => els.amount.focus(), 50);
}

function fail(msg, field) {
  els.error.textContent = msg;
  if (field) { field.classList.add('invalid'); field.focus(); }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  for (const f of [els.amount, els.description, els.year]) f.classList.remove('invalid');

  const amount = parseAmount(els.amount.value);
  const description = els.description.value.trim();
  const month = els.month.value ? Number(els.month.value) : null;
  const yearRaw = els.year.value.trim();
  const year = yearRaw ? Number(yearRaw) : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return fail('Inserisci un importo valido maggiore di zero (es. 1250,00).', els.amount);
  }
  if (mode !== 'in' && !description) {
    return fail(mode === 'out' ? 'La descrizione è obbligatoria per le spese.'
      : 'La descrizione è obbligatoria per gli indebiti.', els.description);
  }
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
    return fail('Inserisci un anno valido (es. 2026).', els.year);
  }
  if (mode === 'in' && (!month || !year)) {
    return fail('Indica mese e anno di ricezione.', !month ? els.month : els.year);
  }
  if (mode !== 'in' && month && !year) {
    return fail('Se indichi il mese, indica anche l\'anno.', els.year);
  }

  let category = null;
  if (mode !== 'debt') {
    if (els.category.value === '__new') {
      if (!els.newCat.value.trim()) return fail('Scrivi il nome della nuova categoria o scegline una.', els.newCat);
      category = addCategory(els.newCat.value).id;
    } else {
      category = els.category.value || null;
    }
  }

  const data = {
    amount, description, month, year, category,
    kind: mode === 'in' ? els.kind.value : null,
    ignored: els.ignored.checked,
  };

  if (editingId) {
    const t = transactions.find((x) => x.id === editingId);
    if (t) {
      Object.assign(t, data);
      if (mode === 'debt' && t.settled !== els.settled.checked) {
        t.settled = els.settled.checked;
        t.settledAt = t.settled ? Date.now() : null;
      }
    }
  } else {
    transactions.push({
      id: newId(), type: mode, ...data,
      settled: mode === 'debt' ? false : undefined,
      createdAt: Date.now(),
    });
  }
  save();
  render();
  els.dialog.close();
});

$('open-in').addEventListener('click', () => openForm('in'));
$('open-out').addEventListener('click', () => openForm('out'));
$('open-debt').addEventListener('click', () => openForm('debt'));
$('cancel').addEventListener('click', () => els.dialog.close());
els.reset.addEventListener('click', resetAll);
// Chiudi toccando fuori dal pannello.
els.dialog.addEventListener('click', (e) => { if (e.target === els.dialog) els.dialog.close(); });

// ---------- Schede ----------

function selectTab(name) {
  const charts = name === 'charts';
  $('tab-list').setAttribute('aria-selected', String(!charts));
  $('tab-charts').setAttribute('aria-selected', String(charts));
  $('panel-list').hidden = charts;
  $('panel-charts').hidden = !charts;
  if (charts) renderCharts();
  try { localStorage.setItem('spares-n-money:tab', name); } catch { /* facoltativo */ }
}
$('tab-list').addEventListener('click', () => selectTab('list'));
$('tab-charts').addEventListener('click', () => selectTab('charts'));

// ---------- Grafici ----------

const periodSelect = $('chart-period');
const tooltip = $('tooltip');

// Mese di competenza di una spesa: mese/anno indicati, altrimenti la data di inserimento.
function expenseMonth(t) {
  if (t.year && t.month) return { y: t.year, m: t.month };
  if (t.year) return { y: t.year, m: null };
  const d = new Date(t.createdAt);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function buildPeriodOptions() {
  const years = new Set();
  for (const t of transactions) if (t.type === 'out' && !t.ignored) years.add(expenseMonth(t).y);
  const current = periodSelect.value || 'last12';
  const opts = [new Option('Ultimi 12 mesi', 'last12')];
  [...years].sort((a, b) => b - a).forEach((y) => opts.push(new Option(`Anno ${y}`, String(y))));
  opts.push(new Option('Tutto', 'all'));
  periodSelect.replaceChildren(...opts);
  periodSelect.value = opts.some((o) => o.value === current) ? current : 'last12';
}

function renderCharts() {
  hideTooltip();
  buildPeriodOptions();
  const period = periodSelect.value;
  const now = new Date();

  // Mesi da mostrare nel grafico a barre.
  let months = [];
  if (period === 'last12') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
    }
  } else if (period === 'all') {
    const keys = transactions.filter((t) => t.type === 'out' && !t.ignored && expenseMonth(t).m)
      .map((t) => { const e = expenseMonth(t); return e.y * 12 + e.m - 1; });
    if (keys.length) {
      const min = Math.min(...keys), max = Math.max(...keys, now.getFullYear() * 12 + now.getMonth());
      for (let k = Math.max(min, max - 59); k <= max; k++) months.push({ y: Math.floor(k / 12), m: (k % 12) + 1 });
    }
  } else {
    const y = Number(period);
    for (let m = 1; m <= 12; m++) months.push({ y, m });
  }

  const inPeriod = (e) => {
    if (period === 'all') return true;
    if (period === 'last12') return months.some((x) => x.y === e.y && x.m === e.m);
    return e.y === Number(period);
  };

  const expenses = transactions.filter((t) => t.type === 'out' && !t.ignored && inPeriod(expenseMonth(t)));
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const noMonth = expenses.filter((t) => !expenseMonth(t).m);

  const byMonth = new Map(months.map((x) => [`${x.y}-${x.m}`, 0]));
  for (const t of expenses) {
    const e = expenseMonth(t);
    const k = `${e.y}-${e.m}`;
    if (byMonth.has(k)) byMonth.set(k, byMonth.get(k) + t.amount);
  }
  const monthsCount = Math.max(1, months.length);

  $('chart-total').textContent = fmt(total);
  $('chart-avg').textContent = fmt(Math.round((total - noMonth.reduce((s, t) => s + t.amount, 0)) / monthsCount));

  renderMonthBars(months, byMonth);
  $('chart-months-note').textContent = noMonth.length
    ? `${noMonth.length === 1 ? '1 spesa indica' : `${noMonth.length} spese indicano`} solo l'anno: ${noMonth.length === 1 ? 'è inclusa' : 'sono incluse'} nel totale e nelle categorie, ma non nel grafico mensile.`
    : '';

  // Spese per categoria (ordinate dalla più alta).
  const byCat = new Map();
  for (const t of expenses) {
    const key = categoryName(t.category) ? t.category : '';
    byCat.set(key, (byCat.get(key) || 0) + t.amount);
  }
  const rows = [...byCat.entries()]
    .map(([id, v]) => ({ name: id ? categoryName(id) : 'Senza categoria', value: v, none: !id }))
    .sort((a, b) => b.value - a.value);
  renderCategoryBars(rows, total);
}

function renderMonthBars(months, byMonth) {
  const box = $('chart-months');
  const values = months.map((x) => byMonth.get(`${x.y}-${x.m}`) || 0);
  const max = Math.max(0, ...values);
  if (!months.length || max === 0) {
    box.replaceChildren(el('p', 'chart-empty', 'Nessuna spesa in questo periodo.'));
    return;
  }
  // Scala con un valore "tondo" per le linee guida.
  const step = niceStep(max / 3);
  const top = Math.ceil(max / step) * step;
  const showYear = new Set(months.map((x) => x.y)).size > 1;
  const maxIdx = values.indexOf(max);

  const plot = el('div', 'bars-plot');
  plot.style.setProperty('--cols', months.length);
  for (let v = step; v <= top; v += step) {
    const g = el('div', 'grid-line');
    g.style.bottom = `${(v / top) * 100}%`;
    g.append(el('span', 'grid-label', compact(v)));
    plot.append(g);
  }
  months.forEach((x, i) => {
    const v = values[i];
    const col = el('button', 'bar-col');
    col.type = 'button';
    const label = `${MONTHS[x.m - 1]} ${x.y}: ${fmt(v)}`;
    col.setAttribute('aria-label', label);
    const bar = el('span', 'bar');
    bar.style.height = v ? `max(3px, ${(v / top) * 100}%)` : '0';
    if (i === maxIdx) bar.append(el('span', 'bar-value', compact(v)));
    col.append(bar);
    col.addEventListener('mouseenter', () => showTooltip(bar, label));
    col.addEventListener('focus', () => showTooltip(bar, label));
    col.addEventListener('click', () => showTooltip(bar, label));
    col.addEventListener('mouseleave', hideTooltip);
    col.addEventListener('blur', hideTooltip);
    plot.append(col);
  });

  const axis = el('div', 'bars-axis');
  axis.style.setProperty('--cols', months.length);
  months.forEach((x, i) => {
    const narrow = box.clientWidth < 460;
    const every = months.length > 24 ? 6 : months.length > 12 ? 3 : narrow ? 2 : 1;
    const text = i % every === 0
      ? MONTHS_SHORT[x.m - 1] + (showYear && (x.m === 1 || i === 0) ? ` ${String(x.y).slice(2)}` : '')
      : '';
    axis.append(el('span', '', text));
  });
  box.replaceChildren(plot, axis);
}

function renderCategoryBars(rows, total) {
  const box = $('chart-cats');
  if (!rows.length) {
    box.replaceChildren(el('p', 'chart-empty', 'Nessuna spesa in questo periodo.'));
    return;
  }
  const max = rows[0].value;
  const list = rows.map((r) => {
    const row = el('div', `hbar-row${r.none ? ' none' : ''}`);
    const pct = total ? Math.round((r.value / total) * 100) : 0;
    const head = el('div', 'hbar-head');
    head.append(el('span', 'hbar-name', r.name), el('span', 'hbar-value', `${fmt(r.value)} · ${pct}%`));
    const track = el('div', 'hbar-track');
    const bar = el('div', 'hbar');
    bar.style.width = `max(4px, ${(r.value / max) * 100}%)`;
    track.append(bar);
    row.append(head, track);
    return row;
  });
  const out = [...list];
  if (!categories.length) {
    out.push(el('p', 'chart-note', 'Assegna una categoria alle spese per vedere come si distribuiscono.'));
  }
  box.replaceChildren(...out);
}

function niceStep(raw) {
  if (raw <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

// Etichette brevi per gli assi: 1.250 € → "1,3k €".
function compact(cents) {
  const v = cents / 100;
  if (v >= 1000) return `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k €`;
  return `${Math.round(v).toLocaleString('it-IT')} €`;
}

function showTooltip(target, text) {
  tooltip.textContent = text;
  tooltip.hidden = false;
  const panel = $('panel-charts').getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const tw = tooltip.offsetWidth;
  let left = r.left - panel.left + $('panel-charts').scrollLeft + r.width / 2 - tw / 2;
  left = Math.max(4, Math.min(left, panel.width - tw - 4));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${r.top - panel.top + $('panel-charts').scrollTop - tooltip.offsetHeight - 6}px`;
}
function hideTooltip() { tooltip.hidden = true; }

periodSelect.addEventListener('change', renderCharts);

// ---------- Avvio ----------

render();
try { if (localStorage.getItem('spares-n-money:tab') === 'charts') selectTab('charts'); } catch { /* facoltativo */ }

// ---------- PWA: funzionamento offline ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
