// ============================================================
// Invoice Generator — Application Logic
// ============================================================

// --- A: DOM References & Constants ---
const $  = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const STORAGE_KEY   = 'invoice_v3';
const HISTORY_KEY   = 'invoice_history';
const THEME_KEY     = 'invoice_theme';
const MAX_HISTORY   = 50;

// Legacy keys for migration
const LEGACY_KEYS = ['invoice_pro_state_v2_no_vat', 'invoice_state'];

// --- B: Utilities ---
function escapeHtml(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return String(s).replace(/[&<>"]/g, c => map[c]);
}

function fmt(n) {
  return (isNaN(n) ? 0 : Number(n)).toFixed(2);
}

function downloadFile(name, type, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

// --- C: Theme ---
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === 'dark' ? 'dark' : 'light');
  } catch (e) {
    applyTheme('light');
  }
}

// --- D: Dropdown Population ---
function populateProductDropdown() {
  const sel = $('productSelect');
  // Remove everything except the placeholder
  while (sel.options.length > 1) sel.remove(1);

  CATALOGUE_GROUPS.forEach(group => {
    const og = document.createElement('optgroup');
    og.label = group.label;

    group.items.forEach(name => {
      if (!CATALOGUE.hasOwnProperty(name)) return;
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      og.appendChild(o);
    });

    if (og.children.length) sel.appendChild(og);
  });
}

// --- E: Row Management ---
function rowToData(row) {
  return {
    qty:  parseFloat(row.querySelector('.qty').value) || 0,
    desc: (row.querySelector('.desc').value || '').trim(),
    hs:   (row.querySelector('.hs').value || '').trim(),
    unit: parseFloat(row.querySelector('.unit').value) || 0,
    sku:  row.dataset.sku || ''
  };
}

function updateRowNumbers() {
  [...$$('#items [data-row]')].forEach((r, i) => {
    const idx = r.querySelector('.rowIndex');
    if (idx) idx.textContent = String(i + 1);
  });
}

function addRow({ qty, desc, hs, unit, sku }) {
  const items = $('items');
  const row = document.createElement('div');
  row.className = 'row gridCols';
  row.setAttribute('data-row', '');
  if (sku) row.dataset.sku = sku;

  row.innerHTML = `
    <div class="cell"><span class="rowIndex"></span></div>
    <div class="cell"><input class="qty" value="${qty}" inputmode="numeric"/></div>
    <div class="cell"><input class="desc" value="${escapeHtml(desc)}"/></div>
    <div class="cell"><input class="hs" value="${escapeHtml(hs)}"/></div>
    <div class="cell"><input class="unit" value="${fmt(unit)}" inputmode="decimal"/></div>
    <div class="cell"><span class="lineTotal">${fmt(qty * unit)}</span></div>
    <div class="cell"><button class="del" onclick="deleteRow(this)">Del</button></div>`;

  items.appendChild(row);
  recalcTotals();
  saveState();
}

function addBlankRow() {
  addRow({ qty: 1, desc: 'New Product', hs: '0000.00.00', unit: 0, sku: '' });
}

function addProduct() {
  const sel = $('productSelect');
  const key = sel.value;
  if (!key) return;
  const p = CATALOGUE[key];
  if (!p) return;

  // Check for existing row with same product
  const existing = [...$$('#items [data-row]')].find(r => {
    const d = rowToData(r);
    return d.desc === key && d.hs === p.hs && fmt(d.unit) === fmt(p.unit);
  });

  if (existing) {
    const qtyInput = existing.querySelector('.qty');
    qtyInput.value = (parseFloat(qtyInput.value || 0) + 1).toString();
    recalcTotals();
    saveState();
  } else {
    addRow({ qty: 1, desc: key, hs: p.hs, unit: p.unit, sku: p.sku || '' });
  }
  sel.selectedIndex = 0;
}

function deleteRow(btn) {
  btn.closest('[data-row]')?.remove();
  recalcTotals();
  saveState();
}

// --- F: Calculation ---
function recalcTotals() {
  let sum = 0;
  $$('#items [data-row]').forEach(row => {
    const d = rowToData(row);
    const line = d.qty * d.unit;
    row.querySelector('.lineTotal').textContent = fmt(line);
    sum += line;
  });
  updateRowNumbers();

  const currency = ($('currency').value || 'USD').toUpperCase();
  const label = $('currencyLabel');
  if (label) label.textContent = currency;
  $('grandTotal').textContent = fmt(sum);
}

// --- G: Print ---
function buildPrintTable() {
  const tbl = $('printTable');
  tbl.innerHTML = '';
  const cur = ($('currency').value || 'USD').toUpperCase();

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th style="width:6%">#</th>
    <th style="width:8%">Qty</th>
    <th>Description</th>
    <th style="width:16%">HS Code</th>
    <th style="width:16%">Unit (${escapeHtml(cur)})</th>
    <th style="width:18%">Line Total</th>
  </tr>`;

  const tbody = document.createElement('tbody');
  const rows = [...$$('#items [data-row]')];

  rows.forEach((row, idx) => {
    const d = rowToData(row);
    const line = d.qty * d.unit;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:right">${idx + 1}</td>
      <td style="text-align:right">${d.qty}</td>
      <td>${escapeHtml(d.desc)}</td>
      <td>${escapeHtml(d.hs)}</td>
      <td style="text-align:right">${fmt(d.unit)}</td>
      <td style="text-align:right">${fmt(line)}</td>`;
    tbody.appendChild(tr);
  });

  const grand = $('grandTotal').textContent || '0.00';
  const trTotal = document.createElement('tr');
  trTotal.innerHTML = `<td></td><td></td><td></td><td></td>
    <td style="text-align:right;font-weight:700">Total</td>
    <td style="text-align:right;font-weight:700">${escapeHtml(grand)}</td>`;
  tbody.appendChild(trTotal);

  tbl.appendChild(thead);
  tbl.appendChild(tbody);
}

function printInvoice() {
  buildPrintTable();
  window.print();
}

window.addEventListener('beforeprint', buildPrintTable);

// --- H: State Persistence ---
function getState() {
  const items = [...$$('#items [data-row]')].map(row => rowToData(row));
  return {
    meta: {
      invoice:  $('invoiceNumber').value || '',
      date:     $('invoiceDate').value || '',
      waybill:  $('waybill').value || '',
      currency: ($('currency').value || 'USD').toUpperCase()
    },
    items,
    totals: { total: $('grandTotal').textContent || '0.00' },
    parties: {
      shipper: $('shipper').value || '',
      soldto:  $('soldto').value || ''
    }
  };
}

function setState(st) {
  if (!st) return;

  // Handle both old flat format and new nested format
  const meta = st.meta || {};
  $('invoiceNumber').value = meta.invoice || st.invoiceNumber || '';
  $('invoiceDate').value   = meta.date || st.invoiceDate || '';
  $('waybill').value       = meta.waybill || st.waybill || '';
  $('currency').value      = meta.currency || st.currency || 'USD';

  const parties = st.parties || {};
  $('shipper').value = parties.shipper || st.shipper || '';
  $('soldto').value  = parties.soldto || st.soldto || '';

  // Clear existing rows
  [...$$('#items [data-row]')].forEach(r => r.remove());

  // Add items
  const items = st.items || [];
  items.forEach(i => addRow({
    qty:  i.qty,
    desc: i.desc,
    hs:   i.hs,
    unit: i.unit,
    sku:  i.sku || ''
  }));
  recalcTotals();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
  } catch (e) {
    console.warn('Could not save invoice state:', e);
  }
}

function loadState() {
  try {
    // Try current key first
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const st = JSON.parse(raw);
      setState(st);
      return true;
    }

    // Try legacy keys for migration
    for (const key of LEGACY_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) {
        const st = JSON.parse(raw);
        setState(st);
        saveState(); // re-save under new key
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn('Could not load invoice state:', e);
    return false;
  }
}

// --- I: Invoice History ---
function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function setHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Could not save history:', e);
  }
}

function saveToHistory() {
  const st = getState();
  // Don't save empty invoices
  if (!st.items.length && !st.meta.invoice) return;

  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    invoiceNumber: st.meta.invoice || 'No number',
    date: st.meta.date || '',
    state: st
  };

  const history = getHistory();
  history.unshift(entry);

  // Cap at MAX_HISTORY
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  setHistory(history);
}

function loadFromHistory(id) {
  const history = getHistory();
  const entry = history.find(h => h.id === id);
  if (entry) {
    setState(entry.state);
    saveState();
    toggleHistoryPanel(false);
  }
}

function deleteFromHistory(id, event) {
  event.stopPropagation();
  const history = getHistory().filter(h => h.id !== id);
  setHistory(history);
  renderHistoryList();
}

function renderHistoryList() {
  const panel = $('historyPanel');
  const history = getHistory();

  if (!history.length) {
    panel.innerHTML = '<div class="history-empty">No saved invoices</div>';
    return;
  }

  panel.innerHTML = history.map(h => `
    <div class="history-item" onclick="loadFromHistory(${h.id})">
      <div class="history-item-info">
        <div class="history-item-label">#${escapeHtml(h.invoiceNumber)}</div>
        <div class="history-item-date">${escapeHtml(h.date || h.timestamp.slice(0, 10))}</div>
      </div>
      <button class="history-item-del" onclick="deleteFromHistory(${h.id}, event)">Del</button>
    </div>`).join('');
}

function toggleHistoryPanel(forceState) {
  const panel = $('historyPanel');
  const shouldOpen = forceState !== undefined ? forceState : !panel.classList.contains('open');
  if (shouldOpen) {
    renderHistoryList();
    panel.classList.add('open');
  } else {
    panel.classList.remove('open');
  }
}

// Close history panel when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.history-wrap');
  if (wrap && !wrap.contains(e.target)) {
    toggleHistoryPanel(false);
  }
});

// --- J: Export ---
function exportCSV() {
  const st = getState();
  const header = ['SKU', 'Description', 'HS Code', 'Qty', 'Unit', 'Line Total'];
  const rows = st.items.map(i =>
    [i.sku || '', i.desc, i.hs, i.qty, fmt(i.unit), fmt(i.qty * i.unit)]
  );
  rows.push([]);
  rows.push(['', '', '', 'Total', '', st.totals.total]);

  const csv = [
    header.join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  downloadFile('invoice.csv', 'text/csv', csv);
}

function exportJSON() {
  downloadFile('invoice.json', 'application/json', JSON.stringify(getState(), null, 2));
}

// --- K: Auto-date ---
function setAutoDate() {
  const el = $('invoiceDate');
  if (el && !el.value) {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    el.value = `${dd}-${mm}-${d.getFullYear()}`;
  }
}

// --- L: Invoice Number ---
function generateInvoiceNumber() {
  $('invoiceNumber').value = Math.floor(100000 + Math.random() * 900000);
  saveState();
}

// --- M: New Invoice ---
function newInvoice() {
  // Save current invoice to history before clearing
  saveToHistory();

  // Clear all rows
  [...$$('#items [data-row]')].forEach(r => r.remove());
  $('grandTotal').textContent = '0.00';

  // Reset with defaults
  generateInvoiceNumber();
  setAutoDate();
  addRow({ qty: 2, desc: 'Ray-Ban Meta Sunglasses', hs: '9004.10.3', unit: 299, sku: '' });
  addRow({ qty: 3, desc: 'Meta Quest Link Cable', hs: '9504.90', unit: 79.99, sku: '' });
  saveState();
}

// --- N: Event Bindings & Initialization ---
function init() {
  loadTheme();
  populateProductDropdown();

  // Auto-save on meta field edits
  ['invoiceNumber', 'invoiceDate', 'waybill', 'currency', 'shipper', 'soldto'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', () => {
      if (id === 'currency') recalcTotals();
      saveState();
    });
  });

  // Live recalc + auto-save on item edits (event delegation)
  $('items').addEventListener('input', e => {
    if (e.target.matches('.qty, .unit, .desc, .hs')) {
      recalcTotals();
      saveState();
    }
  });

  // Restore saved state or create default invoice
  if (!loadState()) {
    generateInvoiceNumber();
    setAutoDate();
    addRow({ qty: 2, desc: 'Ray-Ban Meta Sunglasses', hs: '9004.10.3', unit: 299, sku: '' });
    addRow({ qty: 3, desc: 'Meta Quest Link Cable', hs: '9504.90', unit: 79.99, sku: '' });
  }
}

init();
