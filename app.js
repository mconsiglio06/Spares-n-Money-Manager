'use strict';

/*
 * Spares 'n Money — prototipo.
 * I dati vengono salvati in locale sul dispositivo (localStorage).
 * Gli importi sono memorizzati in centesimi interi per evitare errori di arrotondamento.
 */

const STORAGE_KEY = 'spares-n-money:v1';
const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fmt = (cents) => euro.format(cents / 100);

// ---------- Stato ----------

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch {
    alert('Impossibile salvare i dati su questo dispositivo.');
  }
}

let transactions = load();

function totals() {
  let income = 0, expense = 0;
  for (const t of transactions) {
    if (t.type === 'in') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
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

// ---------- Rendering ----------

const $ = (id) => document.getElementById(id);
const els = {
  balance: $('balance'), totalIn: $('total-in'), totalOut: $('total-out'),
  list: $('list'), empty: $('empty'),
  dialog: $('dialog'), form: $('form'), title: $('form-title'),
  amount: $('amount'), description: $('description'), descLabel: $('desc-label'),
  month: $('month'), monthLabel: $('month-label'),
  year: $('year'), yearLabel: $('year-label'),
  error: $('error'), submit: $('submit'),
};

function periodKey(t) {
  // Ordinamento: per anno/mese se presenti, altrimenti per data di inserimento.
  if (t.year) return t.year * 100 + (t.month || 0);
  const d = new Date(t.createdAt);
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function periodLabel(t) {
  if (t.month && t.year) return `${MONTHS[t.month - 1]} ${t.year}`;
  if (t.year) return String(t.year);
  if (t.month) return MONTHS[t.month - 1];
  return 'Data non specificata';
}

function render() {
  const { income, expense, balance } = totals();
  els.balance.textContent = fmt(balance);
  els.balance.classList.toggle('negative', balance < 0);
  els.totalIn.textContent = fmt(income);
  els.totalOut.textContent = fmt(expense);

  const sorted = [...transactions].sort(
    (a, b) => periodKey(b) - periodKey(a) || b.createdAt - a.createdAt
  );

  els.list.replaceChildren(...sorted.map((t) => {
    const li = document.createElement('li');
    li.className = `item ${t.type}`;

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = t.type === 'in' ? '+' : '−';

    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = t.description || (t.type === 'in' ? 'Entrata' : 'Spesa');
    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = periodLabel(t);
    info.append(title, date);

    const amount = document.createElement('div');
    amount.className = 'amount';
    amount.textContent = (t.type === 'in' ? '+ ' : '− ') + fmt(t.amount);

    const del = document.createElement('button');
    del.className = 'delete';
    del.type = 'button';
    del.textContent = '✕';
    del.setAttribute('aria-label', `Elimina ${title.textContent}`);
    del.addEventListener('click', () => removeTransaction(t.id));

    li.append(icon, info, amount, del);
    return li;
  }));

  els.empty.hidden = transactions.length > 0;
  $('reset-all').hidden = transactions.length === 0;
}

function resetAll() {
  if (!confirm('Cancellare TUTTI i movimenti e azzerare il totale? L\'operazione non si può annullare.')) return;
  transactions = [];
  save();
  render();
}

// ---------- Azioni ----------

function removeTransaction(id) {
  if (!confirm('Eliminare questo movimento?')) return;
  transactions = transactions.filter((t) => t.id !== id);
  save();
  render();
}

let mode = 'in';

function buildMonthOptions(optional) {
  const opts = [];
  if (optional) opts.push(new Option('—', ''));
  MONTHS.forEach((m, i) => opts.push(new Option(m, String(i + 1))));
  els.month.replaceChildren(...opts);
}

function openForm(type) {
  mode = type;
  const isIn = type === 'in';
  const now = new Date();

  els.form.reset();
  els.error.textContent = '';
  els.amount.classList.remove('invalid');
  els.description.classList.remove('invalid');

  els.title.textContent = isIn ? 'Aggiungi denaro' : 'Sottrai denaro';
  els.submit.textContent = isIn ? 'Aggiungi' : 'Sottrai';
  els.submit.className = `btn ${isIn ? 'btn-in' : 'btn-out'}`;

  els.descLabel.innerHTML = isIn
    ? 'Descrizione <em>(facoltativa)</em>'
    : 'Descrizione <em>(obbligatoria)</em>';
  els.description.placeholder = isIn ? 'Es. Stipendio' : 'Es. Spesa al supermercato';

  els.monthLabel.innerHTML = isIn ? 'Mese di ricezione' : 'Mese <em>(facoltativo)</em>';
  els.yearLabel.innerHTML = isIn ? 'Anno' : 'Anno <em>(facolt.)</em>';

  buildMonthOptions(!isIn);
  // Per le entrate precompila il mese/anno correnti (modificabili).
  els.month.value = isIn ? String(now.getMonth() + 1) : '';
  els.year.value = isIn ? String(now.getFullYear()) : '';

  els.dialog.showModal();
  setTimeout(() => els.amount.focus(), 50);
}

function fail(msg, field) {
  els.error.textContent = msg;
  if (field) { field.classList.add('invalid'); field.focus(); }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  els.amount.classList.remove('invalid');
  els.description.classList.remove('invalid');

  const amount = parseAmount(els.amount.value);
  const description = els.description.value.trim();
  const month = els.month.value ? Number(els.month.value) : null;
  const yearRaw = els.year.value.trim();
  const year = yearRaw ? Number(yearRaw) : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return fail('Inserisci un importo valido maggiore di zero (es. 1250,00).', els.amount);
  }
  if (mode === 'out' && !description) {
    return fail('La descrizione è obbligatoria per le spese.', els.description);
  }
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
    return fail('Inserisci un anno valido (es. 2026).', els.year);
  }
  if (mode === 'in' && (!month || !year)) {
    return fail('Indica mese e anno di ricezione.', !month ? els.month : els.year);
  }
  if (mode === 'out' && month && !year) {
    return fail('Se indichi il mese, indica anche l\'anno.', els.year);
  }

  transactions.push({
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()),
    type: mode,
    amount,
    description,
    month,
    year,
    createdAt: Date.now(),
  });
  save();
  render();
  els.dialog.close();
});

$('open-in').addEventListener('click', () => openForm('in'));
$('open-out').addEventListener('click', () => openForm('out'));
$('reset-all').addEventListener('click', resetAll);
$('cancel').addEventListener('click', () => els.dialog.close());
// Chiudi toccando fuori dal pannello.
els.dialog.addEventListener('click', (e) => { if (e.target === els.dialog) els.dialog.close(); });

render();

// ---------- PWA: funzionamento offline ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
