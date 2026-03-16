// ============================================================
// Invoice Generator — Application Logic
// DHL customs-compliant commercial invoice
// ============================================================

// --- A: DOM References & Constants ---
const $  = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const STORAGE_KEY   = 'invoice_v4';
const HISTORY_KEY   = 'invoice_history';
const THEME_KEY     = 'invoice_theme';
const MAX_HISTORY   = 50;

const LEGACY_KEYS = ['invoice_v3', 'invoice_pro_state_v2_no_vat', 'invoice_state'];
const SETTINGS_KEY = 'invoice_settings';
const ADDRESSBOOK_KEY = 'invoice_addressbook';

const UOM_OPTIONS = ['pcs', 'kg', 'set', 'pair', 'box', 'unit'];

// Toggle IDs mapped to the DOM elements/classes they control
const VISIBILITY_MAP = {
  togShipmentRef:     { field: 'shipmentRef', type: 'field' },
  togIncoterms:       { field: 'incoterms', type: 'field' },
  togReasonForExport: { field: 'reasonForExport', type: 'field' },
  togImporter:        { id: 'importerSection' },
  togShipmentDetails: { id: 'shipmentDetailsSection' },
  togUom:             { col: 4, headerClass: 'col-uom' },
  togOrigin:          { col: 6, headerClass: 'col-origin' },
  togWeight:          { col: 7, headerClass: 'col-weight' },
  togShippingCost:    { id: 'shippingCostRow' },
  togInsurance:       { id: 'insuranceRow' },
  togDeclaration:     { id: 'declarationSection' }
};

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

function showToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('toast-fade'), 1800);
  setTimeout(() => el.remove(), 2200);
}

function todayStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function val(id) { const el = $(id); return el ? el.value || '' : ''; }
function setVal(id, v) { const el = $(id); if (el) el.value = v || ''; }
function setSel(id, v) {
  const el = $(id);
  if (!el) return;
  for (let i = 0; i < el.options.length; i++) {
    if (el.options[i].value === v) { el.selectedIndex = i; return; }
  }
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
  const uomEl = row.querySelector('.uom');
  return {
    qty:    parseFloat(row.querySelector('.qty').value) || 0,
    desc:   (row.querySelector('.desc').value || '').trim(),
    hs:     (row.querySelector('.hs').value || '').trim(),
    unit:   parseFloat(row.querySelector('.unit').value) || 0,
    sku:    row.dataset.sku || '',
    uom:    uomEl ? uomEl.value : 'pcs',
    origin: (row.querySelector('.origin').value || '').trim().toUpperCase(),
    weight: parseFloat(row.querySelector('.weight').value) || 0
  };
}

function updateRowNumbers() {
  [...$$('#items [data-row]')].forEach((r, i) => {
    const idx = r.querySelector('.rowIndex');
    if (idx) idx.textContent = String(i + 1);
  });
}

function buildUomSelect(selected) {
  const opts = UOM_OPTIONS.map(u =>
    `<option value="${u}"${u === selected ? ' selected' : ''}>${u}</option>`
  ).join('');
  return `<select class="uom">${opts}</select>`;
}

function addRow({ qty, desc, hs, unit, sku, uom, origin, weight }) {
  const items = $('items');
  const row = document.createElement('div');
  row.className = 'row gridCols';
  row.setAttribute('data-row', '');
  if (sku) row.dataset.sku = sku;

  const defOrigin = origin || val('defaultOrigin') || DEFAULT_ORIGIN;
  const defUom = uom || 'pcs';
  const defWeight = weight || 0;

  row.innerHTML = `
    <div class="cell"><span class="rowIndex"></span></div>
    <div class="cell"><input class="qty" value="${qty}" inputmode="numeric"/></div>
    <div class="cell"><input class="desc" value="${escapeHtml(desc)}"/></div>
    <div class="cell"><input class="hs" value="${escapeHtml(hs)}"/></div>
    <div class="cell">${buildUomSelect(defUom)}</div>
    <div class="cell"><input class="unit" value="${fmt(unit)}" inputmode="decimal"/></div>
    <div class="cell"><input class="origin" value="${escapeHtml(defOrigin)}" maxlength="2"/></div>
    <div class="cell"><input class="weight" value="${fmt(defWeight)}" inputmode="decimal"/></div>
    <div class="cell"><span class="lineTotal">${fmt(qty * unit)}</span></div>
    <div class="cell"><button class="del" onclick="deleteRow(this)">Del</button></div>`;

  items.appendChild(row);
  recalcTotals();
  applyVisibility();
  saveState();
}

function addBlankRow() {
  addRow({
    qty: 1, desc: 'New Product', hs: '0000.00.00', unit: 0, sku: '',
    uom: 'pcs', origin: val('defaultOrigin') || DEFAULT_ORIGIN, weight: 0
  });
}

function addProduct() {
  const sel = $('productSelect');
  const key = sel.value;
  if (!key) return;
  const p = CATALOGUE[key];
  if (!p) return;

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
    addRow({
      qty: 1, desc: key, hs: p.hs, unit: p.unit, sku: p.sku || '',
      uom: 'pcs', origin: p.origin || DEFAULT_ORIGIN, weight: p.weight || 0
    });
  }
  sel.selectedIndex = 0;
}

function deleteRow(btn) {
  const row = btn.closest('[data-row]');
  if (row) row.remove();
  recalcTotals();
  saveState();
}

// --- F: Calculation ---
function recalcTotals() {
  let subtotal = 0;
  let totalWeight = 0;

  $$('#items [data-row]').forEach(row => {
    const d = rowToData(row);
    const line = d.qty * d.unit;
    row.querySelector('.lineTotal').textContent = fmt(line);
    subtotal += line;
    totalWeight += d.qty * d.weight;
  });
  updateRowNumbers();

  const currency = (val('currency') || 'USD').toUpperCase();
  const label = $('currencyLabel');
  if (label) label.textContent = currency;

  const shippingCost = parseFloat(val('shippingCost')) || 0;
  const insurance = parseFloat(val('insurance')) || 0;
  const grandTotal = subtotal + shippingCost + insurance;

  const subtotalEl = $('subtotal');
  if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
  $('grandTotal').textContent = fmt(grandTotal);

  const weightEl = $('totalWeight');
  if (weightEl) weightEl.value = fmt(totalWeight);
}

// --- G: Print ---
function buildPrintBlock() {
  const block = $('printBlock');
  block.innerHTML = '';
  const st = getState();
  const cur = st.meta.currency || 'USD';

  // Parties
  let partiesHtml = '<div class="print-parties">';
  partiesHtml += buildPrintParty('Shipper / Exporter', st.parties.shipper);
  partiesHtml += buildPrintParty('Consignee / Receiver', st.parties.consignee);
  partiesHtml += '</div>';

  const togImporter = $('togImporter');
  const showImporter = !togImporter || togImporter.checked;
  if (showImporter && st.parties.importer && st.parties.importer.name && !st.parties.importer.sameAsConsignee) {
    partiesHtml += '<div class="print-parties">';
    partiesHtml += buildPrintParty('Importer of Record', st.parties.importer);
    partiesHtml += '</div>';
  }

  // Visibility checks for print
  const showUom = !$('togUom') || $('togUom').checked;
  const showOrigin = !$('togOrigin') || $('togOrigin').checked;
  const showWeight = !$('togWeight') || $('togWeight').checked;
  const showShipDetails = !$('togShipmentDetails') || $('togShipmentDetails').checked;
  const showDecl = !$('togDeclaration') || $('togDeclaration').checked;

  // Shipment details
  const shipHtml = !showShipDetails ? '' : `<div class="print-shipment">
    <strong>Origin:</strong> ${escapeHtml(st.shipment.defaultOrigin)}
    &nbsp; <strong>Weight:</strong> ${st.shipment.totalWeight} kg
    &nbsp; <strong>Packages:</strong> ${escapeHtml(st.shipment.numPackages)}
    &nbsp; <strong>Method:</strong> ${escapeHtml(st.shipment.shippingMethod)}
    &nbsp; <strong>Carrier:</strong> ${escapeHtml(st.shipment.carrier)}
    &nbsp; <strong>Incoterms:</strong> ${escapeHtml(st.meta.incoterms)}
    &nbsp; <strong>Reason:</strong> ${escapeHtml(st.meta.reasonForExport)}
  </div>`

  // Items table — respect column visibility
  let tableHtml = `<table><thead><tr>
      <th style="width:4%">#</th>
      <th style="width:5%">Qty</th>
      <th>Description</th>
      <th style="width:10%">HS Code</th>
      ${showUom ? '<th style="width:6%">UoM</th>' : ''}
      <th style="width:10%">Unit (${escapeHtml(cur)})</th>
      ${showOrigin ? '<th style="width:5%">CoO</th>' : ''}
      ${showWeight ? '<th style="width:7%">Wt (kg)</th>' : ''}
      <th style="width:11%">Total</th>
    </tr></thead><tbody>`;

  st.items.forEach((item, idx) => {
    const line = item.qty * item.unit;
    tableHtml += `<tr>
      <td style="text-align:right">${idx + 1}</td>
      <td style="text-align:right">${item.qty}</td>
      <td>${escapeHtml(item.desc)}</td>
      <td>${escapeHtml(item.hs)}</td>
      ${showUom ? '<td style="text-align:center">' + escapeHtml(item.uom) + '</td>' : ''}
      <td style="text-align:right">${fmt(item.unit)}</td>
      ${showOrigin ? '<td style="text-align:center">' + escapeHtml(item.origin) + '</td>' : ''}
      ${showWeight ? '<td style="text-align:right">' + fmt(item.weight) + '</td>' : ''}
      <td style="text-align:right">${fmt(line)}</td>
    </tr>`;
  });
  tableHtml += '</tbody></table>';

  // Summary
  const summaryHtml = `<div class="print-summary">
    <div class="line">Subtotal: ${escapeHtml(st.totals.subtotal)}</div>
    ${parseFloat(st.totals.shippingCost) ? '<div class="line">Shipping: ' + escapeHtml(st.totals.shippingCost) + '</div>' : ''}
    ${parseFloat(st.totals.insurance) ? '<div class="line">Insurance: ' + escapeHtml(st.totals.insurance) + '</div>' : ''}
    <div class="line grand">Grand Total (${escapeHtml(cur)}): ${escapeHtml(st.totals.total)}</div>
  </div>`;

  // Declaration
  const declHtml = !showDecl ? '' : `<div class="print-declaration">
    <p>I/We hereby declare that the information on this invoice is true and correct
    and that the contents of this shipment are as stated above.</p>
    <div class="print-sig-row">
      <div>${escapeHtml(st.declaration.name || '')}<br>Name</div>
      <div><br>Signature</div>
      <div>${escapeHtml(st.declaration.date || '')}<br>Date</div>
    </div>
  </div>`;

  block.innerHTML = partiesHtml + shipHtml + tableHtml + summaryHtml + declHtml;
}

function buildPrintParty(title, party) {
  if (!party) return '';
  let lines = `<div class="print-party"><h4>${escapeHtml(title)}</h4>`;
  if (party.name) lines += `<p><strong>${escapeHtml(party.name)}</strong></p>`;
  if (party.address) lines += `<p>${escapeHtml(party.address).replace(/\n/g, '<br>')}</p>`;
  if (party.phone) lines += `<p>Tel: ${escapeHtml(party.phone)}</p>`;
  if (party.email) lines += `<p>Email: ${escapeHtml(party.email)}</p>`;
  if (party.taxId) lines += `<p>Tax/VAT: ${escapeHtml(party.taxId)}</p>`;
  lines += '</div>';
  return lines;
}

function printInvoice() {
  buildPrintBlock();
  window.print();
}

window.addEventListener('beforeprint', buildPrintBlock);

// --- H: State Persistence ---
function readPartyFields(prefix) {
  return {
    name:    val(prefix + 'Name'),
    address: val(prefix + 'Addr'),
    phone:   val(prefix + 'Phone'),
    email:   val(prefix + 'Email'),
    taxId:   val(prefix + 'TaxId')
  };
}

function writePartyFields(prefix, party) {
  if (!party) return;
  // Handle legacy format (plain string)
  if (typeof party === 'string') {
    setVal(prefix + 'Addr', party);
    return;
  }
  setVal(prefix + 'Name', party.name);
  setVal(prefix + 'Addr', party.address);
  setVal(prefix + 'Phone', party.phone);
  setVal(prefix + 'Email', party.email);
  setVal(prefix + 'TaxId', party.taxId);
}

function getState() {
  const items = [...$$('#items [data-row]')].map(row => rowToData(row));
  const shippingCost = val('shippingCost') || '0.00';
  const insurance = val('insurance') || '0.00';

  return {
    meta: {
      invoice:         val('invoiceNumber'),
      date:            val('invoiceDate'),
      waybill:         val('waybill'),
      currency:        (val('currency') || 'USD').toUpperCase(),
      shipmentRef:     val('shipmentRef'),
      incoterms:       val('incoterms'),
      reasonForExport: val('reasonForExport')
    },
    parties: {
      shipper:   readPartyFields('shipper'),
      consignee: readPartyFields('consignee'),
      importer:  {
        ...readPartyFields('importer'),
        sameAsConsignee: $('importerSameAsConsignee') ? $('importerSameAsConsignee').checked : false
      }
    },
    shipment: {
      defaultOrigin:  val('defaultOrigin'),
      totalWeight:    val('totalWeight'),
      numPackages:    val('numPackages'),
      shippingMethod: val('shippingMethod'),
      carrier:        val('carrier')
    },
    items,
    totals: {
      subtotal:     $('subtotal') ? $('subtotal').textContent : '0.00',
      shippingCost: shippingCost,
      insurance:    insurance,
      total:        $('grandTotal').textContent || '0.00'
    },
    declaration: {
      name: val('declarantName'),
      date: val('declarantDate')
    }
  };
}

function setState(st) {
  if (!st) return;

  // Meta fields
  const meta = st.meta || {};
  setVal('invoiceNumber', meta.invoice || st.invoiceNumber || '');
  setVal('invoiceDate',   meta.date || st.invoiceDate || '');
  setVal('waybill',       meta.waybill || st.waybill || '');
  setVal('currency',      meta.currency || st.currency || 'USD');
  setVal('shipmentRef',   meta.shipmentRef || '');
  setSel('incoterms',     meta.incoterms || 'DAP');
  setSel('reasonForExport', meta.reasonForExport || 'Sale');

  // Parties — handle v3 legacy (plain strings) and v4 (objects)
  const parties = st.parties || {};
  if (typeof parties.shipper === 'string') {
    // v3 legacy migration
    writePartyFields('shipper', parties.shipper);
  } else {
    writePartyFields('shipper', parties.shipper);
  }

  if (typeof parties.soldto === 'string') {
    // v3 legacy: soldto → consignee
    writePartyFields('consignee', parties.soldto);
  } else if (parties.consignee) {
    writePartyFields('consignee', parties.consignee);
  }

  if (parties.importer) {
    if (typeof parties.importer === 'object') {
      writePartyFields('importer', parties.importer);
      const cb = $('importerSameAsConsignee');
      if (cb) cb.checked = !!parties.importer.sameAsConsignee;
    }
  }

  // Shipment details
  const ship = st.shipment || {};
  setVal('defaultOrigin',  ship.defaultOrigin || DEFAULT_ORIGIN);
  setVal('totalWeight',    ship.totalWeight || '0.00');
  setVal('numPackages',    ship.numPackages || '1');
  setSel('shippingMethod', ship.shippingMethod || 'Express');
  setSel('carrier',        ship.carrier || 'DHL');

  // Totals
  const totals = st.totals || {};
  setVal('shippingCost', totals.shippingCost || '0.00');
  setVal('insurance',    totals.insurance || '0.00');

  // Declaration
  const decl = st.declaration || {};
  setVal('declarantName', decl.name || '');
  setVal('declarantDate', decl.date || '');

  // Clear existing rows and rebuild items
  [...$$('#items [data-row]')].forEach(r => r.remove());
  const items = st.items || [];
  items.forEach(i => addRow({
    qty: i.qty, desc: i.desc, hs: i.hs, unit: i.unit, sku: i.sku || '',
    uom: i.uom || 'pcs', origin: i.origin || '', weight: i.weight || 0
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
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      setState(JSON.parse(raw));
      return true;
    }
    for (const key of LEGACY_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) {
        setState(JSON.parse(raw));
        saveState();
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

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.history-wrap');
  if (wrap && !wrap.contains(e.target)) {
    toggleHistoryPanel(false);
  }
});

// --- J: Export ---
function exportCSV() {
  const st = getState();
  const header = ['SKU', 'Description', 'HS Code', 'UoM', 'Qty', 'Unit Price', 'Origin', 'Net Weight (kg)', 'Line Total'];
  const rows = st.items.map(i =>
    [i.sku || '', i.desc, i.hs, i.uom, i.qty, fmt(i.unit), i.origin, fmt(i.weight), fmt(i.qty * i.unit)]
  );
  rows.push([]);
  rows.push(['', '', '', '', '', 'Subtotal', '', '', st.totals.subtotal]);
  if (parseFloat(st.totals.shippingCost)) {
    rows.push(['', '', '', '', '', 'Shipping', '', '', st.totals.shippingCost]);
  }
  if (parseFloat(st.totals.insurance)) {
    rows.push(['', '', '', '', '', 'Insurance', '', '', st.totals.insurance]);
  }
  rows.push(['', '', '', '', '', 'Grand Total', '', '', st.totals.total]);

  const csv = [
    header.join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  downloadFile('invoice.csv', 'text/csv', csv);
}

function exportJSON() {
  downloadFile('invoice.json', 'application/json', JSON.stringify(getState(), null, 2));
}

// --- J2: PDF Download ---
function downloadPDF() {
  // Build print block first so it has current data
  buildPrintBlock();

  // Create a temporary container styled for PDF capture
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:12px;padding:20px;';

  const st = getState();
  const cur = st.meta.currency || 'USD';

  // Build a clean HTML representation for capture
  let html = '<h1 style="font-size:16px;margin:0 0 10px;text-transform:uppercase;">Commercial Invoice</h1>';

  // Meta info
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px 12px;margin-bottom:10px;font-size:10px;">';
  if (st.meta.invoice) html += `<div><strong>Invoice No:</strong> ${escapeHtml(st.meta.invoice)}</div>`;
  if (st.meta.date) html += `<div><strong>Date:</strong> ${escapeHtml(st.meta.date)}</div>`;
  if (st.meta.waybill) html += `<div><strong>AWB:</strong> ${escapeHtml(st.meta.waybill)}</div>`;
  html += `<div><strong>Currency:</strong> ${escapeHtml(cur)}</div>`;
  if (st.meta.shipmentRef) html += `<div><strong>Ref:</strong> ${escapeHtml(st.meta.shipmentRef)}</div>`;
  if (st.meta.incoterms) html += `<div><strong>Incoterms:</strong> ${escapeHtml(st.meta.incoterms)}</div>`;
  if (st.meta.reasonForExport) html += `<div><strong>Reason:</strong> ${escapeHtml(st.meta.reasonForExport)}</div>`;
  html += '</div>';

  // Use the print block content (already respects visibility toggles)
  html += $('printBlock').innerHTML;

  container.innerHTML = html;
  document.body.appendChild(container);

  // Use html2canvas + jsPDF
  if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
    alert('PDF libraries not loaded. Please check your internet connection and reload.');
    document.body.removeChild(container);
    return;
  }

  html2canvas(container, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  }).then(function(canvas) {
    var pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    var pageWidth = 210;
    var pageHeight = 297;
    var margin = 10;
    var contentWidth = pageWidth - margin * 2;
    var imgWidth = contentWidth;
    var imgHeight = (canvas.height * imgWidth) / canvas.width;
    var imgData = canvas.toDataURL('image/png');

    var heightLeft = imgHeight;
    var position = margin;

    // First page
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    // Additional pages if needed
    while (heightLeft > 0) {
      position = position - (pageHeight - margin * 2);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }

    var filename = 'invoice' + (st.meta.invoice ? '_' + st.meta.invoice : '') + '.pdf';
    pdf.save(filename);
    document.body.removeChild(container);
  }).catch(function(err) {
    console.error('PDF generation failed:', err);
    alert('PDF generation failed. Please try Print instead.');
    document.body.removeChild(container);
  });
}

// --- K: Importer "Same as Consignee" ---
function toggleImporterSame() {
  const cb = $('importerSameAsConsignee');
  const fields = ['importerName', 'importerAddr', 'importerPhone', 'importerEmail', 'importerTaxId'];
  const sources = ['consigneeName', 'consigneeAddr', 'consigneePhone', 'consigneeEmail', 'consigneeTaxId'];

  if (cb.checked) {
    fields.forEach((fid, i) => {
      const el = $(fid);
      const src = $(sources[i]);
      if (el && src) el.value = src.value;
      if (el) el.setAttribute('readonly', '');
      if (el && el.tagName === 'TEXTAREA') el.setAttribute('readonly', '');
    });
  } else {
    fields.forEach(fid => {
      const el = $(fid);
      if (el) el.removeAttribute('readonly');
    });
  }
  saveState();
}

// --- L: Invoice Number ---
function generateInvoiceNumber() {
  $('invoiceNumber').value = Math.floor(100000 + Math.random() * 900000);
  saveState();
}

// --- M: New Invoice ---
function newInvoice() {
  saveToHistory();

  // Clear items
  [...$$('#items [data-row]')].forEach(r => r.remove());
  $('grandTotal').textContent = '0.00';
  if ($('subtotal')) $('subtotal').textContent = '0.00';

  // Reset meta
  generateInvoiceNumber();
  setVal('invoiceDate', todayStr());
  setVal('waybill', '');
  setVal('shipmentRef', '');
  setSel('incoterms', 'DAP');
  setSel('reasonForExport', 'Sale');

  // Reset shipment
  setVal('defaultOrigin', DEFAULT_ORIGIN);
  setVal('numPackages', '1');
  setSel('shippingMethod', 'Express');
  setSel('carrier', 'DHL');

  // Reset totals
  setVal('shippingCost', '0.00');
  setVal('insurance', '0.00');

  // Reset declaration
  setVal('declarantName', '');
  setVal('declarantDate', todayStr());

  // Uncheck importer same
  const cb = $('importerSameAsConsignee');
  if (cb) cb.checked = false;

  // Default items
  addRow({ qty: 2, desc: 'Ray-Ban Meta Sunglasses', hs: '9004.10.3', unit: 299, sku: '', uom: 'pcs', origin: 'US', weight: 0.05 });
  addRow({ qty: 3, desc: 'Meta Quest Link Cable', hs: '9504.90', unit: 79.99, sku: '', uom: 'pcs', origin: 'CN', weight: 0.10 });
  saveState();
}

// --- N: Settings & Visibility ---
function toggleSettingsPanel() {
  const panel = $('settingsPanel');
  const overlay = $('settingsOverlay');
  if (!panel) return;
  panel.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

function getSettings() {
  const settings = {};
  Object.keys(VISIBILITY_MAP).forEach(togId => {
    const el = $(togId);
    if (el) settings[togId] = el.checked;
  });
  return settings;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(getSettings()));
  } catch (e) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const settings = JSON.parse(raw);
    Object.keys(settings).forEach(togId => {
      const el = $(togId);
      if (el) el.checked = !!settings[togId];
    });
  } catch (e) {}
}

function applyVisibility() {
  // Field-level toggles (meta fields like shipmentRef, incoterms, reasonForExport)
  Object.keys(VISIBILITY_MAP).forEach(togId => {
    const el = $(togId);
    if (!el) return;
    const show = el.checked;
    const map = VISIBILITY_MAP[togId];

    // Section by ID
    if (map.id) {
      const section = $(map.id);
      if (section) {
        if (show) section.classList.remove('section-hidden');
        else section.classList.add('section-hidden');
      }
    }

    // Individual field (wrapped in label.field)
    if (map.field) {
      const field = $(map.field);
      if (field) {
        const wrapper = field.closest('.field');
        if (wrapper) {
          if (show) wrapper.classList.remove('section-hidden');
          else wrapper.classList.add('section-hidden');
        }
      }
    }

    // Grid column toggles (UoM, Origin, Weight)
    if (map.col !== undefined) {
      const colIdx = map.col;
      // Header cells
      const headCells = document.querySelectorAll('.head.gridCols > div');
      if (headCells[colIdx]) {
        if (show) headCells[colIdx].classList.remove('section-hidden');
        else headCells[colIdx].classList.add('section-hidden');
      }
      // Row cells
      document.querySelectorAll('#items [data-row]').forEach(row => {
        const cells = row.querySelectorAll('.cell');
        if (cells[colIdx]) {
          if (show) cells[colIdx].classList.remove('section-hidden');
          else cells[colIdx].classList.add('section-hidden');
        }
      });
    }
  });

  saveSettings();
}

// --- O: Address Book ---
function getAddressBook() {
  try {
    const raw = localStorage.getItem(ADDRESSBOOK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function setAddressBook(book) {
  try {
    localStorage.setItem(ADDRESSBOOK_KEY, JSON.stringify(book));
  } catch (e) {}
}

function saveToAddressBook(prefix) {
  const party = readPartyFields(prefix);
  if (!party.name && !party.address) return;

  const book = getAddressBook();
  const existing = book.findIndex(e => e.name === party.name);
  if (existing >= 0) {
    book[existing] = party;
  } else {
    book.push(party);
  }
  setAddressBook(book);
  renderAddressBook();
  showToast('Saved "' + (party.name || 'contact') + '" to address book');
}

function loadFromAddressBook(index, target) {
  const book = getAddressBook();
  const entry = book[index];
  if (!entry) return;
  writePartyFields(target, entry);
  saveState();
  showToast('Loaded "' + (entry.name || 'contact') + '" as ' + target);
}

function deleteFromAddressBook(index, event) {
  if (event) event.stopPropagation();
  const book = getAddressBook();
  if (!book[index]) return;
  var name = book[index].name || 'this contact';
  if (!confirm('Delete "' + name + '" from address book?')) return;
  book.splice(index, 1);
  setAddressBook(book);
  renderAddressBook();
  showToast('Deleted "' + name + '" from address book');
}

function renderAddressBook() {
  const list = $('addressBookList');
  if (!list) return;
  const book = getAddressBook();

  // Search/filter
  const searchEl = $('addressBookSearch');
  const search = searchEl ? (searchEl.value || '').toLowerCase() : '';
  const entries = book.map((entry, i) => ({ ...entry, _idx: i }));
  const filtered = search
    ? entries.filter(e => [e.name, e.address, e.email, e.phone, e.taxId]
        .some(f => (f || '').toLowerCase().includes(search)))
    : entries;

  if (!filtered.length) {
    list.innerHTML = '<div class="history-empty">' + (search ? 'No matching contacts' : 'No saved addresses') + '</div>';
    renderContactPickers();
    return;
  }

  list.innerHTML = filtered.map(entry => {
    const i = entry._idx;
    const addrPreview = (entry.address || '').split('\n')[0];
    const detail = [addrPreview, entry.phone, entry.email].filter(Boolean).join(' | ');
    return `<div class="address-book-entry">
      <div class="address-book-entry-info">
        <div class="address-book-entry-name">${escapeHtml(entry.name || 'No name')}</div>
        ${detail ? '<div class="address-book-entry-detail">' + escapeHtml(detail) + '</div>' : ''}
      </div>
      <div class="address-book-entry-actions">
        <button onclick="loadFromAddressBook(${i}, 'shipper')" title="Load as Shipper">Shipper</button>
        <button onclick="loadFromAddressBook(${i}, 'consignee')" title="Load as Consignee">Consignee</button>
        <button onclick="loadFromAddressBook(${i}, 'importer')" title="Load as Importer">Importer</button>
        <button onclick="editAddressBookEntry(${i})" title="Edit">Edit</button>
        <button onclick="deleteFromAddressBook(${i}, event)" title="Delete">Del</button>
      </div>
    </div>`;
  }).join('');

  renderContactPickers();
}

// --- O2: Contact Pickers (quick-access on party cards) ---
function renderContactPickers() {
  const book = getAddressBook();
  ['shipperPicker', 'consigneePicker', 'importerPicker'].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    // Preserve only the first default option
    while (sel.options.length > 1) sel.remove(1);
    book.forEach((entry, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = entry.name || entry.email || 'Contact ' + (i + 1);
      sel.appendChild(o);
    });
  });
}

function pickContact(selectEl, target) {
  const idx = parseInt(selectEl.value, 10);
  if (isNaN(idx)) return;
  loadFromAddressBook(idx, target);
  selectEl.selectedIndex = 0;
}

// --- O3: Inline Edit ---
function editAddressBookEntry(index) {
  const book = getAddressBook();
  const entry = book[index];
  if (!entry) return;

  const list = $('addressBookList');
  if (!list) return;

  // Find the entry element by index in the rendered list
  const entryEls = list.querySelectorAll('.address-book-entry');
  // Find which rendered element corresponds to this book index
  let targetEl = null;
  entryEls.forEach(el => {
    const editBtn = el.querySelector('[onclick*="editAddressBookEntry(' + index + ')"]');
    if (editBtn) targetEl = el;
  });
  if (!targetEl) return;

  const form = document.createElement('div');
  form.className = 'address-book-edit-form';
  form.innerHTML = `
    <input type="text" class="edit-name" value="${escapeHtml(entry.name || '')}" placeholder="Name" />
    <textarea class="edit-address" placeholder="Address">${escapeHtml(entry.address || '')}</textarea>
    <input type="text" class="edit-phone" value="${escapeHtml(entry.phone || '')}" placeholder="Phone" />
    <input type="text" class="edit-email" value="${escapeHtml(entry.email || '')}" placeholder="Email" />
    <input type="text" class="edit-taxid" value="${escapeHtml(entry.taxId || '')}" placeholder="Tax/VAT ID" />
    <div class="address-book-edit-actions">
      <button onclick="saveEditedEntry(${index}, this)">Save</button>
      <button onclick="renderAddressBook()">Cancel</button>
    </div>`;

  targetEl.replaceWith(form);
}

function saveEditedEntry(index, btn) {
  const form = btn.closest('.address-book-edit-form');
  if (!form) return;

  const book = getAddressBook();
  book[index] = {
    name:    form.querySelector('.edit-name').value.trim(),
    address: form.querySelector('.edit-address').value.trim(),
    phone:   form.querySelector('.edit-phone').value.trim(),
    email:   form.querySelector('.edit-email').value.trim(),
    taxId:   form.querySelector('.edit-taxid').value.trim()
  };
  setAddressBook(book);
  renderAddressBook();
  showToast('Updated "' + (book[index].name || 'contact') + '"');
}

// --- O4: Export / Import Address Book ---
function exportAddressBook() {
  const book = getAddressBook();
  if (!book.length) { showToast('Address book is empty'); return; }
  downloadFile('address-book.json', 'application/json', JSON.stringify(book, null, 2));
  showToast('Address book exported (' + book.length + ' contacts)');
}

function importAddressBook() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(evt) {
      try {
        var imported = JSON.parse(evt.target.result);
        if (!Array.isArray(imported)) throw new Error('Not an array');
        var book = getAddressBook();
        var added = 0;
        imported.forEach(function(entry) {
          if (!entry.name && !entry.address) return;
          var existing = book.findIndex(function(e) { return e.name === entry.name; });
          if (existing >= 0) {
            book[existing] = { name: entry.name || '', address: entry.address || '', phone: entry.phone || '', email: entry.email || '', taxId: entry.taxId || '' };
          } else {
            book.push({ name: entry.name || '', address: entry.address || '', phone: entry.phone || '', email: entry.email || '', taxId: entry.taxId || '' });
            added++;
          }
        });
        setAddressBook(book);
        renderAddressBook();
        showToast('Imported ' + added + ' new, ' + (imported.length - added) + ' updated');
      } catch (err) {
        showToast('Invalid address book file');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// --- P: Event Bindings & Initialization ---
function init() {
  loadTheme();
  populateProductDropdown();
  loadSettings();
  applyVisibility();
  renderAddressBook();
  renderContactPickers();

  // Auto-save on all form field edits
  const autoSaveFields = [
    'invoiceNumber', 'invoiceDate', 'waybill', 'currency', 'shipmentRef',
    'incoterms', 'reasonForExport',
    'shipperName', 'shipperAddr', 'shipperPhone', 'shipperEmail', 'shipperTaxId',
    'consigneeName', 'consigneeAddr', 'consigneePhone', 'consigneeEmail', 'consigneeTaxId',
    'importerName', 'importerAddr', 'importerPhone', 'importerEmail', 'importerTaxId',
    'defaultOrigin', 'numPackages', 'shippingMethod', 'carrier',
    'shippingCost', 'insurance',
    'declarantName', 'declarantDate'
  ];

  autoSaveFields.forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', () => {
        if (id === 'currency' || id === 'shippingCost' || id === 'insurance') recalcTotals();
        saveState();
      });
      el.addEventListener('change', () => {
        if (id === 'currency' || id === 'shippingCost' || id === 'insurance') recalcTotals();
        saveState();
      });
    }
  });

  // Live recalc + auto-save on item edits (event delegation)
  $('items').addEventListener('input', e => {
    if (e.target.matches('.qty, .unit, .desc, .hs, .origin, .weight')) {
      recalcTotals();
      saveState();
    }
  });
  $('items').addEventListener('change', e => {
    if (e.target.matches('.uom')) {
      saveState();
    }
  });

  // Restore saved state or create default invoice
  if (!loadState()) {
    generateInvoiceNumber();
    setVal('invoiceDate', todayStr());
    setVal('declarantDate', todayStr());
    addRow({ qty: 2, desc: 'Ray-Ban Meta Sunglasses', hs: '9004.10.3', unit: 299, sku: '', uom: 'pcs', origin: 'US', weight: 0.05 });
    addRow({ qty: 3, desc: 'Meta Quest Link Cable', hs: '9504.90', unit: 79.99, sku: '', uom: 'pcs', origin: 'CN', weight: 0.10 });
  }
}

init();
