// ============================================================
// Invoice Generator — Application Logic
// DHL customs-compliant commercial invoice
// ============================================================

// --- A: DOM References & Constants ---
const $  = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const APP_VIEW = document.body && document.body.dataset && document.body.dataset.view
  ? document.body.dataset.view
  : 'invoice';

const STORAGE_KEY   = 'invoice_v4';
const HISTORY_KEY   = 'invoice_history';
const THEME_KEY     = 'invoice_theme';
const MAX_HISTORY   = 50;
const CLEAR_ONCE_KEY = 'invoice_clear_once';

const LEGACY_KEYS = ['invoice_v3', 'invoice_pro_state_v2_no_vat', 'invoice_state'];
const SETTINGS_KEY = 'invoice_settings';
const ADDRESSBOOK_KEY = 'invoice_addressbook';
const APP_STATE = {
  repo: null,
  repoReady: null,
  addressBook: [],
  visibleAddressBook: [],
  companyProfile: null,
  loadedSavedInvoice: false,
  bootProfileApplied: false,
  authConfigured: false,
  authSignedIn: false,
  editingContactId: '',
  contactEditDraft: null,
  contactEditDirty: false,
  productLibrary: [],
  editingProductName: '',
  productEditDraft: null,
  productEditDirty: false
};

const UOM_OPTIONS = ['pcs', 'kg', 'set', 'pair', 'box', 'unit'];

// ISO 3166-1 alpha-2 country codes (common trading countries)
const COUNTRY_OPTIONS = [
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','BN','BG','BF','BI',
  'KH','CM','CA','CV','CF','TD','CL','CN','CO','KM','CG','CD','CR','CI','HR','CU','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE',
  'SZ','ET','FJ','FI','FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IL','IT',
  'JM','JP','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MR',
  'MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA','NR','NP','NL','NZ','NI','NE','NG','MK','NO','OM','PK','PW','PA','PG','PY','PE','PH',
  'PL','PT','QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO','ZA','SS','ES','LK','SD','SR',
  'SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV','UG','UA','AE','GB','US','UY','UZ','VU','VE','VN','YE','ZM','ZW'
];

const PARTY_FIELD_SUFFIXES = {
  name: 'Name',
  address1: 'Address1',
  address2: 'Address2',
  city: 'City',
  stateProvince: 'StateProvince',
  postalCode: 'PostalCode',
  country: 'Country',
  phone: 'Phone',
  email: 'Email',
  taxId: 'TaxId'
};

const PARTY_VALUE_KEYS = Object.keys(PARTY_FIELD_SUFFIXES);
const ADDRESS_VALUE_KEYS = ['address1', 'address2', 'city', 'stateProvince', 'postalCode', 'country'];

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

async function fetchJsonIfAvailable(url) {
  if (!url || typeof window.fetch !== 'function') return null;
  try {
    const response = await window.fetch(url, { cache: 'no-store' });
    if (!response || !response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
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

function getRepo() {
  if (!APP_STATE.repo) {
    APP_STATE.repo = window.AddressBookService.createAddressBookRepository({
      legacyLocalStorageKey: ADDRESSBOOK_KEY,
      legacyProductStorageKey: 'invoice_product_library_v1',
      seedProducts: getBaseProductEntries()
    });
  }
  return APP_STATE.repo;
}

function ensureRepoReady() {
  if (!APP_STATE.repoReady) {
    const repo = getRepo();
    repo.onChange(handleRepoChange);
    APP_STATE.repoReady = repo.init();
  }
  return APP_STATE.repoReady;
}

function mergeRoleHints() {
  const hints = Array.from(arguments).flat().filter(Boolean);
  return [...new Set(hints.map(h => String(h).trim().toLowerCase()).filter(Boolean))];
}

function normalizeRoleHintsList(roleHints) {
  return mergeRoleHints(roleHints || []);
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function getBaseProductEntries() {
  const categoryByName = {};
  CATALOGUE_GROUPS.forEach((group) => {
    group.items.forEach((name) => {
      categoryByName[name] = group.label;
    });
  });
  return Object.keys(CATALOGUE).map((name) => {
    const product = CATALOGUE[name];
    return {
      name,
      category: categoryByName[name] || 'Other',
      hs: trimString(product.hs),
      unit: Number(product.unit) || 0,
      sku: trimString(product.sku),
      origin: trimString(product.origin || DEFAULT_ORIGIN).toUpperCase(),
      weight: Number(product.weight) || 0
    };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function normalizeProductEntry(entry) {
  const source = entry || {};
  const name = trimString(source.name);
  if (!name) return null;
  return {
    name,
    category: trimString(source.category) || 'Other',
    hs: trimString(source.hs),
    unit: Number(source.unit) || 0,
    sku: trimString(source.sku),
    origin: trimString(source.origin || DEFAULT_ORIGIN).toUpperCase(),
    weight: Number(source.weight) || 0
  };
}

function getProductByName(name) {
  return APP_STATE.productLibrary.find((entry) => entry.name === name) || null;
}

function getProductCategories() {
  const categories = [...new Set(APP_STATE.productLibrary.map((entry) => entry.category).filter(Boolean))];
  if (!categories.includes('Other')) categories.push('Other');
  return categories.sort();
}

function trimString(value) {
  return String(value || '').trim();
}

function clearSavedBrowserState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(CLEAR_ONCE_KEY);
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (e) {}
  APP_STATE.loadedSavedInvoice = false;
}

function markBlankInvoiceReload() {
  try {
    localStorage.setItem(CLEAR_ONCE_KEY, 'true');
  } catch (e) {}
}

function consumeBlankInvoiceReload() {
  try {
    const shouldClear = localStorage.getItem(CLEAR_ONCE_KEY) === 'true';
    if (shouldClear) localStorage.removeItem(CLEAR_ONCE_KEY);
    return shouldClear;
  } catch (e) {
    return false;
  }
}

function reloadAfterLocalDataClear() {
  if (typeof window.__testReloadHook === 'function') {
    window.__testReloadHook();
    return;
  }
  if (window.location && typeof window.location.reload === 'function') {
    window.setTimeout(function() {
      window.location.reload();
    }, 50);
  }
}

function createEmptyParty() {
  return {
    name: '',
    address1: '',
    address2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    taxId: ''
  };
}

function splitLegacyAddress(address) {
  const lines = trimString(address)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    address1: lines[0] || '',
    address2: lines.slice(1).join(', '),
    city: '',
    stateProvince: '',
    postalCode: '',
    country: ''
  };
}

function normalizeAddressFields(source) {
  const hasStructured = ADDRESS_VALUE_KEYS.some((key) => trimString(source && source[key]));
  if (hasStructured) {
    return {
      address1: trimString(source.address1),
      address2: trimString(source.address2),
      city: trimString(source.city),
      stateProvince: trimString(source.stateProvince),
      postalCode: trimString(source.postalCode),
      country: trimString(source.country).toUpperCase()
    };
  }
  return splitLegacyAddress(source && source.address);
}

function normalizePartyData(party) {
  const source = typeof party === 'string' ? { address: party } : (party || {});
  return {
    ...createEmptyParty(),
    name: trimString(source.name),
    ...normalizeAddressFields(source),
    phone: trimString(source.phone),
    email: trimString(source.email),
    taxId: trimString(source.taxId)
  };
}

function getPartyFieldId(prefix, key) {
  return prefix + PARTY_FIELD_SUFFIXES[key];
}

function getPartyFieldIds(prefix) {
  return PARTY_VALUE_KEYS.map((key) => getPartyFieldId(prefix, key));
}

function formatLocalityLine(party) {
  const next = normalizePartyData(party);
  const locality = [];
  if (next.city) locality.push(next.city);
  if (next.stateProvince) locality.push(next.stateProvince);
  const localityText = locality.join(', ');
  if (localityText && next.postalCode) return localityText + ' ' + next.postalCode;
  return localityText || next.postalCode;
}

function getAddressBlockLines(party) {
  const next = normalizePartyData(party);
  const lines = [];
  if (next.address1) lines.push(next.address1);
  if (next.address2) lines.push(next.address2);
  const locality = formatLocalityLine(next);
  if (locality) lines.push(locality);
  if (next.country) lines.push(next.country);
  return lines;
}

function getAddressPreview(party) {
  const next = normalizePartyData(party);
  return [next.address1, [next.city, next.country].filter(Boolean).join(', ')].filter(Boolean).join(' | ');
}

function getCountrySelectOptionsHtml(selected) {
  const sel = trimString(selected).toUpperCase();
  return ['<option value=""></option>']
    .concat(COUNTRY_OPTIONS.map((country) =>
      `<option value="${country}"${country === sel ? ' selected' : ''}>${country}</option>`))
    .join('');
}

function populateCountrySelects() {
  document.querySelectorAll('select.country-select').forEach((select) => {
    const current = trimString(select.value || select.dataset.selected).toUpperCase();
    select.innerHTML = getCountrySelectOptionsHtml(current);
  });
}

function setPartyReadonly(prefix, readOnly) {
  getPartyFieldIds(prefix).forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (readOnly) el.setAttribute('readonly', '');
    else el.removeAttribute('readonly');
    if (el.tagName === 'SELECT') el.disabled = !!readOnly;
  });
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
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);

  const grouped = {};
  APP_STATE.productLibrary.forEach((product) => {
    const category = product.category || 'Other';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(product.name);
  });

  Object.keys(grouped).sort().forEach((category) => {
    const og = document.createElement('optgroup');
    og.label = category;
    grouped[category].sort().forEach(name => {
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

function buildOriginSelect(selected) {
  const sel = (selected || '').toUpperCase();
  const opts = COUNTRY_OPTIONS.map(c =>
    `<option value="${c}"${c === sel ? ' selected' : ''}>${c}</option>`
  ).join('');
  return `<select class="origin">${opts}</select>`;
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
    <div class="cell">${buildOriginSelect(defOrigin)}</div>
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

function applyInvoiceItems(items) {
  const rows = Array.isArray(items) ? items.map((item) => ({
    qty: parseFloat(item && item.qty) || 0,
    desc: trimString(item && item.desc),
    hs: trimString(item && item.hs),
    unit: parseFloat(item && item.unit) || 0,
    sku: trimString(item && item.sku),
    uom: trimString(item && item.uom) || 'pcs',
    origin: trimString(item && item.origin).toUpperCase(),
    weight: parseFloat(item && item.weight) || 0
  })) : [];
  const normalizedRows = rows.filter((item) => item.desc);
  if (!normalizedRows.length) return 0;
  [...$$('#items [data-row]')].forEach((row) => row.remove());
  normalizedRows.forEach((item) => {
    addRow(item);
  });
  saveState();
  return normalizedRows.length;
}

function addProduct() {
  const sel = $('productSelect');
  if (!sel) return;
  const key = sel.value;
  if (!key) return;
  const p = getProductByName(key);
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

  // Title + Meta header
  let metaHtml = '<h1 style="font-size:16px;margin:0 0 8px;text-transform:uppercase;">Commercial Invoice</h1>';
  metaHtml += '<div class="print-meta" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:2px 12px;margin-bottom:8px;font-size:10px;">';
  if (st.meta.invoice) metaHtml += `<div><strong>Invoice No:</strong> ${escapeHtml(st.meta.invoice)}</div>`;
  if (st.meta.date) metaHtml += `<div><strong>Date:</strong> ${escapeHtml(st.meta.date)}</div>`;
  if (st.meta.waybill) metaHtml += `<div><strong>AWB:</strong> ${escapeHtml(st.meta.waybill)}</div>`;
  metaHtml += `<div><strong>Currency:</strong> ${escapeHtml(cur)}</div>`;
  if (st.meta.shipmentRef) metaHtml += `<div><strong>Ref:</strong> ${escapeHtml(st.meta.shipmentRef)}</div>`;
  metaHtml += '</div>';

  // Parties
  let partiesHtml = '<div class="print-parties" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;margin-bottom:14px;font-size:10px;">';
  partiesHtml += buildPrintParty('Shipper / Exporter', st.parties.shipper);
  partiesHtml += buildPrintParty('Consignee / Receiver', st.parties.consignee);
  partiesHtml += '</div>';

  const togImporter = $('togImporter');
  const showImporter = !togImporter || togImporter.checked;
  if (showImporter && hasPartyValues(st.parties.importer) && !st.parties.importer.sameAsConsignee) {
    partiesHtml += '<div class="print-parties" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;margin-bottom:14px;font-size:10px;">';
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
  const shipHtml = !showShipDetails ? '' : `<div class="print-shipment" style="font-size:10px;margin-top:4px;margin-bottom:8px;padding:5px 0;border-top:1px solid #ccc;border-bottom:1px solid #ccc;">
    <strong>Origin:</strong> ${escapeHtml(st.shipment.defaultOrigin)}
    &nbsp; <strong>Weight:</strong> ${st.shipment.totalWeight} kg
    &nbsp; <strong>Packages:</strong> ${escapeHtml(st.shipment.numPackages)}
    &nbsp; <strong>Method:</strong> ${escapeHtml(st.shipment.shippingMethod)}
    &nbsp; <strong>Carrier:</strong> ${escapeHtml(st.shipment.carrier)}
    ${st.shipment.carrierContactName ? '&nbsp; <strong>Carrier Contact:</strong> ' + escapeHtml(st.shipment.carrierContactName) : ''}
    &nbsp; <strong>Incoterms:</strong> ${escapeHtml(st.meta.incoterms)}
    &nbsp; <strong>Reason:</strong> ${escapeHtml(st.meta.reasonForExport)}
  </div>`

  // Items table — respect column visibility
  const thBase = 'padding:2px 3px;font-size:10px;border-bottom:2px solid #000;';
  let tableHtml = `<table style="width:100%;border-collapse:collapse;"><thead><tr>
      <th style="${thBase}text-align:right;width:4%;">#</th>
      <th style="${thBase}text-align:right;width:5%;">Qty</th>
      <th style="${thBase}text-align:left;">Description</th>
      <th style="${thBase}text-align:left;width:10%;">HS Code</th>
      ${showUom ? '<th style="' + thBase + 'text-align:center;width:6%;">UoM</th>' : ''}
      <th style="${thBase}text-align:right;width:10%;">Unit (${escapeHtml(cur)})</th>
      ${showOrigin ? '<th style="' + thBase + 'text-align:center;width:5%;">CoO</th>' : ''}
      ${showWeight ? '<th style="' + thBase + 'text-align:right;width:7%;">Wt (kg)</th>' : ''}
      <th style="${thBase}text-align:right;width:11%;">Total</th>
    </tr></thead><tbody>`;

  st.items.forEach((item, idx) => {
    const line = item.qty * item.unit;
    const tdStyle = 'padding:2px 3px;font-size:10px;border-bottom:1px solid #ddd;';
    tableHtml += `<tr>
      <td style="${tdStyle}text-align:right">${idx + 1}</td>
      <td style="${tdStyle}text-align:right">${item.qty}</td>
      <td style="${tdStyle}">${escapeHtml(item.desc)}</td>
      <td style="${tdStyle}">${escapeHtml(item.hs)}</td>
      ${showUom ? '<td style="' + tdStyle + 'text-align:center">' + escapeHtml(item.uom) + '</td>' : ''}
      <td style="${tdStyle}text-align:right">${fmt(item.unit)}</td>
      ${showOrigin ? '<td style="' + tdStyle + 'text-align:center">' + escapeHtml(item.origin) + '</td>' : ''}
      ${showWeight ? '<td style="' + tdStyle + 'text-align:right">' + fmt(item.weight) + '</td>' : ''}
      <td style="${tdStyle}text-align:right">${fmt(line)}</td>
    </tr>`;
  });
  tableHtml += '</tbody></table>';

  // Summary
  const summaryHtml = `<div class="print-summary" style="margin-top:6px;font-size:10px;text-align:right;">
    <div class="line" style="margin:1px 0;">Subtotal: ${escapeHtml(st.totals.subtotal)}</div>
    ${parseFloat(st.totals.shippingCost) ? '<div class="line" style="margin:1px 0;">Shipping: ' + escapeHtml(st.totals.shippingCost) + '</div>' : ''}
    ${parseFloat(st.totals.insurance) ? '<div class="line" style="margin:1px 0;">Insurance: ' + escapeHtml(st.totals.insurance) + '</div>' : ''}
    <div class="line grand" style="font-weight:700;border-top:1px solid #000;padding-top:2px;margin-top:3px;">Grand Total (${escapeHtml(cur)}): ${escapeHtml(st.totals.total)}</div>
  </div>`;

  // Declaration
  const declHtml = !showDecl ? '' : `<div class="print-declaration" style="margin-top:12px;padding-top:6px;border-top:1px solid #ccc;font-size:10px;">
    <p style="margin:0 0 8px;line-height:1.3;">I/We hereby declare that the information on this invoice is true and correct
    and that the contents of this shipment are as stated above.</p>
    <div class="print-sig-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:20px;">
      <div style="border-top:1px solid #000;padding-top:2px;font-size:9px;">${escapeHtml(st.declaration.name || '')}<br>Name</div>
      <div style="border-top:1px solid #000;padding-top:2px;font-size:9px;"><br>Signature</div>
      <div style="border-top:1px solid #000;padding-top:2px;font-size:9px;">${escapeHtml(st.declaration.date || '')}<br>Date</div>
    </div>
  </div>`;

  block.innerHTML = metaHtml + partiesHtml + shipHtml + tableHtml + summaryHtml + declHtml;
}

function buildPrintParty(title, party) {
  if (!party) return '';
  const normalized = normalizePartyData(party);
  const addressLines = getAddressBlockLines(normalized);
  let lines = `<div class="print-party"><h4 style="margin:0 0 2px;font-size:10px;text-transform:uppercase;">${escapeHtml(title)}</h4>`;
  if (normalized.name) lines += `<p style="margin:0;line-height:1.3;"><strong>${escapeHtml(normalized.name)}</strong></p>`;
  if (addressLines.length) lines += `<p style="margin:0;line-height:1.3;">${escapeHtml(addressLines.join('\n')).replace(/\n/g, '<br>')}</p>`;
  if (normalized.phone) lines += `<p style="margin:0;line-height:1.3;">Tel: ${escapeHtml(normalized.phone)}</p>`;
  if (normalized.email) lines += `<p style="margin:0;line-height:1.3;">Email: ${escapeHtml(normalized.email)}</p>`;
  if (normalized.taxId) lines += `<p style="margin:0;line-height:1.3;">Tax / VAT Number / Importer Code / ID Number: ${escapeHtml(normalized.taxId)}</p>`;
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
  return normalizePartyData({
    name: val(getPartyFieldId(prefix, 'name')),
    address1: val(getPartyFieldId(prefix, 'address1')),
    address2: val(getPartyFieldId(prefix, 'address2')),
    city: val(getPartyFieldId(prefix, 'city')),
    stateProvince: val(getPartyFieldId(prefix, 'stateProvince')),
    postalCode: val(getPartyFieldId(prefix, 'postalCode')),
    country: val(getPartyFieldId(prefix, 'country')),
    phone: val(getPartyFieldId(prefix, 'phone')),
    email: val(getPartyFieldId(prefix, 'email')),
    taxId: val(getPartyFieldId(prefix, 'taxId'))
  });
}

function writePartyFields(prefix, party) {
  const next = normalizePartyData(party);
  PARTY_VALUE_KEYS.forEach((key) => {
    const id = getPartyFieldId(prefix, key);
    if (key === 'country') setSel(id, next[key]);
    else setVal(id, next[key]);
  });
}

function clearPartyFields(prefix) {
  writePartyFields(prefix, createEmptyParty());
}

function hasPartyValues(party) {
  const next = normalizePartyData(party);
  return PARTY_VALUE_KEYS.some((key) => !!next[key]);
}

function readCompanyProfileFields() {
  const next = normalizePartyData({
    name: val('profileName'),
    address1: val('profileAddress1'),
    address2: val('profileAddress2'),
    city: val('profileCity'),
    stateProvince: val('profileStateProvince'),
    postalCode: val('profilePostalCode'),
    country: val('profileCountry'),
    phone: val('profilePhone'),
    email: val('profileEmail'),
    taxId: val('profileTaxId')
  });
  next.linkedContactId = val('profileContactPicker');
  next.syncWithContact = $('profileSyncWithContact') ? $('profileSyncWithContact').checked : false;
  return next;
}

function writeCompanyProfileFields(profile) {
  const next = normalizePartyData(profile);
  setVal('profileName', next.name);
  setVal('profileAddress1', next.address1);
  setVal('profileAddress2', next.address2);
  setVal('profileCity', next.city);
  setVal('profileStateProvince', next.stateProvince);
  setVal('profilePostalCode', next.postalCode);
  setSel('profileCountry', next.country);
  setVal('profilePhone', next.phone);
  setVal('profileEmail', next.email);
  setVal('profileTaxId', next.taxId);
  setSel('profileContactPicker', profile && profile.linkedContactId ? profile.linkedContactId : '');
  if ($('profileSyncWithContact')) $('profileSyncWithContact').checked = !!(profile && profile.syncWithContact);
}

function getAddressBookContactById(contactId) {
  return APP_STATE.addressBook.find((entry) => entry.id === contactId && !entry.deleted_at) || null;
}

function getAddressBookContactForRole(role) {
  const normalizedRole = trimString(role).toLowerCase();
  if (!normalizedRole) return null;
  return APP_STATE.addressBook.find((entry) =>
    !entry.deleted_at && normalizeRoleHintsList(entry.role_hints).includes(normalizedRole)
  ) || null;
}

function resolveCompanyProfile(profile, contacts) {
  if (!profile) return null;
  const next = cloneData(profile);
  if (!next.syncWithContact || !next.linkedContactId) return next;
  const sourceContacts = Array.isArray(contacts) ? contacts : APP_STATE.addressBook;
  const linked = sourceContacts.find((entry) => entry.id === next.linkedContactId && !entry.deleted_at);
  if (!linked) return next;
  return Object.assign({}, next, normalizePartyData(linked), {
    id: next.id,
    owner_user_id: next.owner_user_id || '',
    linkedContactId: next.linkedContactId,
    syncWithContact: true,
    created_at: next.created_at,
    updated_at: next.updated_at
  });
}

function renderCompanyProfileContactPicker() {
  const picker = $('profileContactPicker');
  if (!picker) return;
  const selected = picker.value || (APP_STATE.companyProfile && APP_STATE.companyProfile.linkedContactId) || '';
  const options = ['<option value="">No linked contact</option>']
    .concat(APP_STATE.addressBook
      .filter((entry) => !entry.deleted_at)
      .map((entry) => `<option value="${escapeHtml(entry.id)}"${entry.id === selected ? ' selected' : ''}>${escapeHtml(entry.name || 'Unnamed contact')}</option>`));
  picker.innerHTML = options.join('');
}

function syncLinkedContactIntoProfileFields() {
  const linkedContact = getAddressBookContactById(val('profileContactPicker'));
  if (!linkedContact) return;
  const merged = Object.assign({}, readCompanyProfileFields(), normalizePartyData(linkedContact), {
    linkedContactId: linkedContact.id,
    syncWithContact: $('profileSyncWithContact') ? $('profileSyncWithContact').checked : false
  });
  writeCompanyProfileFields(merged);
}

function handleProfileContactChange() {
  syncLinkedContactIntoProfileFields();
}

function handleProfileSyncToggle() {
  if ($('profileSyncWithContact') && $('profileSyncWithContact').checked) {
    syncLinkedContactIntoProfileFields();
  }
}

function applyCompanyProfileToShipperFields(profile) {
  if (!profile) {
    clearPartyFields('shipper');
    return;
  }
  writePartyFields('shipper', profile);
}

function applyLoadedLocalContactsToInvoice() {
  if (APP_VIEW !== 'invoice') return 0;
  const assignments = [
    ['shipper', 'shipper'],
    ['consignee', 'consignee'],
    ['importer', 'importer']
  ];
  let applied = 0;
  assignments.forEach(([role, target]) => {
    const contact = getAddressBookContactForRole(role);
    if (!contact) return;
    writePartyFields(target, contact);
    applied += 1;
  });
  const cb = $('importerSameAsConsignee');
  if (cb) cb.checked = false;
  setPartyReadonly('importer', false);
  if (applied) saveState();
  return applied;
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
      carrier:        val('carrier'),
      carrierContactName: val('carrierContactName')
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
  writePartyFields('shipper', parties.shipper || '');
  writePartyFields('consignee', parties.consignee || parties.soldto || '');
  writePartyFields('importer', parties.importer || '');
  const cb = $('importerSameAsConsignee');
  if (cb) {
    cb.checked = !!(parties.importer && parties.importer.sameAsConsignee);
    if (cb.checked) {
      PARTY_VALUE_KEYS.forEach((key) => {
        const importerEl = $(getPartyFieldId('importer', key));
        const consigneeEl = $(getPartyFieldId('consignee', key));
        if (!importerEl || !consigneeEl) return;
        importerEl.value = consigneeEl.value;
      });
    }
    setPartyReadonly('importer', cb.checked);
  }

  // Shipment details
  const ship = st.shipment || {};
  setVal('defaultOrigin',  ship.defaultOrigin || DEFAULT_ORIGIN);
  setVal('totalWeight',    ship.totalWeight || '0.00');
  setVal('numPackages',    ship.numPackages || '1');
  setSel('shippingMethod', ship.shippingMethod || 'Express');
  setSel('carrier',        ship.carrier || 'DHL');
  setVal('carrierContactName', ship.carrierContactName || '');

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

function getHistoryEntryCarrier(entry) {
  if (entry && entry.carrier) return entry.carrier;
  return entry && entry.state && entry.state.shipment ? (entry.state.shipment.carrier || '') : '';
}

function getHistoryEntryCarrierContactName(entry) {
  if (entry && entry.carrierContactName) return entry.carrierContactName;
  return entry && entry.state && entry.state.shipment ? (entry.state.shipment.carrierContactName || '') : '';
}

function getHistoryFilters() {
  return {
    carrier: val('historyCarrierFilter')
  };
}

function getHistoryCarrierOptions(history) {
  const carriers = [...new Set(history.map((entry) => getHistoryEntryCarrier(entry)).filter(Boolean))];
  return carriers.sort();
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
    carrier: st.shipment.carrier || '',
    carrierContactName: st.shipment.carrierContactName || '',
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

  const filters = getHistoryFilters();
  const carrierOptions = getHistoryCarrierOptions(history)
    .map((carrier) => `<option value="${escapeHtml(carrier)}"${carrier === filters.carrier ? ' selected' : ''}>${escapeHtml(carrier)}</option>`)
    .join('');
  const filteredHistory = history.filter((entry) => {
    const carrier = getHistoryEntryCarrier(entry);
    if (filters.carrier && carrier !== filters.carrier) return false;
    return true;
  });

  const listHtml = filteredHistory.length
    ? filteredHistory.map(h => `
    <div class="history-item" onclick="loadFromHistory(${h.id})">
      <div class="history-item-info">
        <div class="history-item-label">#${escapeHtml(h.invoiceNumber)}</div>
        <div class="history-item-date">${escapeHtml(h.date || h.timestamp.slice(0, 10))}</div>
        ${getHistoryEntryCarrier(h) ? '<div class="history-item-meta">Carrier: ' + escapeHtml(getHistoryEntryCarrier(h)) + '</div>' : ''}
        ${getHistoryEntryCarrierContactName(h) ? '<div class="history-item-meta">Carrier Contact: ' + escapeHtml(getHistoryEntryCarrierContactName(h)) + '</div>' : ''}
      </div>
      <button class="history-item-del" onclick="deleteFromHistory(${h.id}, event)">Del</button>
    </div>`).join('')
    : '<div class="history-empty">No matching invoices</div>';

  panel.innerHTML = `
    <div class="history-filters">
      <select id="historyCarrierFilter" onchange="renderHistoryList()">
        <option value="">All carriers</option>
        ${carrierOptions}
      </select>
    </div>
    <div class="history-list">${listHtml}</div>
  `;
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

  const st = getState();

  // Create a temporary container styled for PDF capture
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:12px;padding:20px;';

  // Use the print block content directly (already has title, meta, parties, items, etc.)
  container.innerHTML = $('printBlock').innerHTML;
  document.body.appendChild(container);

  // Use html2canvas + jsPDF
  if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
    alert('PDF libraries not loaded. Please ensure lib/html2canvas.min.js and lib/jspdf.umd.min.js exist and reload.');
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
  if (!cb) return;

  if (cb.checked) {
    PARTY_VALUE_KEYS.forEach((key) => {
      const importerId = getPartyFieldId('importer', key);
      const consigneeId = getPartyFieldId('consignee', key);
      const importerEl = $(importerId);
      const consigneeEl = $(consigneeId);
      if (!importerEl || !consigneeEl) return;
      if (importerEl.tagName === 'SELECT') importerEl.value = consigneeEl.value;
      else importerEl.value = consigneeEl.value;
    });
  }
  setPartyReadonly('importer', cb.checked);
  saveState();
}

// --- L: Invoice Number ---
function generateInvoiceNumber() {
  $('invoiceNumber').value = Math.floor(100000 + Math.random() * 900000);
  saveState();
}

function applyBlankInvoiceState() {
  [...$$('#items [data-row]')].forEach(r => r.remove());
  if ($('subtotal')) $('subtotal').textContent = '0.00';
  if ($('grandTotal')) $('grandTotal').textContent = '0.00';
  if ($('totalWeight')) $('totalWeight').value = '0.00';

  setVal('invoiceNumber', '');
  setVal('invoiceDate', '');
  setVal('waybill', '');
  setVal('shipmentRef', '');
  setVal('currency', 'USD');
  if ($('currencyLabel')) $('currencyLabel').textContent = 'USD';
  setSel('incoterms', 'DAP');
  setSel('reasonForExport', 'Sale');

  setVal('defaultOrigin', '');
  setVal('numPackages', '');
  setSel('shippingMethod', 'Express');
  setSel('carrier', 'DHL');
  setVal('carrierContactName', '');

  setVal('shippingCost', '0.00');
  setVal('insurance', '0.00');

  setVal('declarantName', '');
  setVal('declarantDate', '');

  clearPartyFields('shipper');
  clearPartyFields('consignee');
  clearPartyFields('importer');

  const cb = $('importerSameAsConsignee');
  if (cb) cb.checked = false;
  setPartyReadonly('importer', false);
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
  setVal('carrierContactName', '');

  // Reset totals
  setVal('shippingCost', '0.00');
  setVal('insurance', '0.00');

  // Reset declaration
  setVal('declarantName', '');
  setVal('declarantDate', todayStr());

  // Reset parties
  clearPartyFields('consignee');
  clearPartyFields('importer');
  if (APP_STATE.companyProfile) applyCompanyProfileToShipperFields(APP_STATE.companyProfile);
  else clearPartyFields('shipper');

  // Uncheck importer same
  const cb = $('importerSameAsConsignee');
  if (cb) cb.checked = false;
  setPartyReadonly('importer', false);

  // Default items
  addRow({ qty: 2, desc: 'Ray-Ban Meta Sunglasses', hs: '9004.10.3', unit: 299, sku: '', uom: 'pcs', origin: 'US', weight: 0.05 });
  addRow({ qty: 3, desc: 'Meta Quest Link Cable', hs: '9504.90', unit: 79.99, sku: '', uom: 'pcs', origin: 'CN', weight: 0.10 });
  saveState();
}

// --- N: Settings & Visibility ---
const PANEL_IDS = ['settingsPanel', 'contactsPanel', 'productsPanel'];

function closeAllPanels() {
  PANEL_IDS.forEach(id => {
    const el = $(id);
    if (el) el.classList.remove('open');
  });
  const overlay = $('settingsOverlay');
  if (overlay) overlay.classList.remove('open');
}

function togglePanel(panelId) {
  const panel = $(panelId);
  if (!panel) return;
  const wasOpen = panel.classList.contains('open');
  closeAllPanels();
  if (!wasOpen) {
    panel.classList.add('open');
    const overlay = $('settingsOverlay');
    if (overlay) overlay.classList.add('open');
    // Render product panel content on open
    if (panelId === 'productsPanel') renderProductPanel();
  }
}

// Legacy alias
function toggleSettingsPanel() { togglePanel('settingsPanel'); }

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
  return APP_STATE.addressBook.filter(entry => !entry.deleted_at).slice();
}

function setAddressBook(book) {
  APP_STATE.addressBook = (book || []).slice();
  renderAddressBook();
  renderContactPickers();
}

function getFilteredAddressBook() {
  const search = (val('addressBookSearch') || '').toLowerCase();
  const active = APP_STATE.addressBook.filter(entry => !entry.deleted_at);
  APP_STATE.visibleAddressBook = search
    ? active.filter(entry => [entry.name, entry.address1, entry.address2, entry.city, entry.stateProvince, entry.postalCode, entry.country, entry.phone, entry.email, entry.taxId]
        .some(field => (field || '').toLowerCase().includes(search)))
    : active;
  return APP_STATE.visibleAddressBook;
}

function maybeApplyBootCompanyProfile() {
  if (APP_STATE.bootProfileApplied || APP_STATE.loadedSavedInvoice) return;
  APP_STATE.bootProfileApplied = true;
  if (APP_STATE.companyProfile && !hasPartyValues(readPartyFields('shipper'))) {
    applyCompanyProfileToShipperFields(APP_STATE.companyProfile);
    saveState();
  }
}

function updateAuthUi(snapshot) {
  const authStatus = $('authStatus');
  const configNote = $('cloudConfigNote');
  const syncStatus = $('syncStatus');
  const localSaveIndicator = $('localSaveIndicator');
  const invoiceLocalModeBar = $('invoiceLocalModeBar');
  const signInBtn = $('signInBtn');
  const signUpBtn = $('signUpBtn');
  const signOutBtn = $('signOutBtn');
  const syncBtn = $('syncContactsBtn');
  const searchEl = $('addressBookSearch');
  const loadLocalDataBtn = $('loadLocalDataBtn');
  const invoiceLoadLocalDataBtn = $('invoiceLoadLocalDataBtn');
  const invoiceClearLocalDataBtn = $('invoiceClearLocalDataBtn');
  const loadSampleBtn = $('loadSampleContactsBtn');
  const authFields = $('authFields');
  const authActions = $('authActions');

  APP_STATE.authConfigured = !!snapshot.auth.configured;
  APP_STATE.authSignedIn = !!snapshot.auth.signedIn;
  const localMode = !snapshot.auth.configured;
  const canManageContacts = localMode || !!snapshot.auth.signedIn;
  const canManageProducts = localMode || !!snapshot.auth.signedIn;

  if (authStatus) {
    if (localMode) authStatus.textContent = 'Local mode: contacts and products are stored only in this browser.';
    else if (snapshot.auth.signedIn) authStatus.textContent = 'Signed in as ' + (snapshot.auth.email || 'user');
    else authStatus.textContent = 'Library sign-in required.';
  }

  if (configNote) {
    configNote.classList.toggle('section-hidden', !!snapshot.auth.configured);
  }
  if (authFields) authFields.classList.toggle('section-hidden', localMode);
  if (authActions) authActions.classList.toggle('section-hidden', localMode);

  if (syncStatus) {
    if (localMode) syncStatus.textContent = 'No sign-in required. Saved contacts and products stay local to this browser.';
    else if (!snapshot.auth.signedIn) syncStatus.textContent = 'Sign in to load, edit, and sync contacts and products.';
    else if (!snapshot.online) syncStatus.textContent = 'Offline mode: cached contacts and products stay available and changes will sync later.';
    else if (snapshot.syncing) syncStatus.textContent = 'Syncing contacts and products...';
    else if (snapshot.syncError) syncStatus.textContent = 'Sync issue: ' + snapshot.syncError;
    else syncStatus.textContent = 'Cloud sync ready for contacts and products.';
  }
  if (localSaveIndicator) {
    localSaveIndicator.classList.toggle('section-hidden', !localMode);
    localSaveIndicator.textContent = localMode ? 'Contacts and products are saved locally in this browser' : '';
  }
  if (invoiceLocalModeBar) {
    invoiceLocalModeBar.classList.toggle('section-hidden', !localMode);
  }

  if (signInBtn) signInBtn.disabled = localMode || snapshot.auth.signedIn;
  if (signUpBtn) signUpBtn.disabled = localMode || snapshot.auth.signedIn;
  if (signOutBtn) signOutBtn.disabled = localMode || !snapshot.auth.signedIn;
  if (syncBtn) syncBtn.disabled = localMode || !snapshot.auth.signedIn;
  if (searchEl) searchEl.disabled = !canManageContacts;

  document.querySelectorAll('[data-contact-action="true"]').forEach(btn => {
    btn.disabled = !canManageContacts;
  });
  document.querySelectorAll('[data-product-action="true"]').forEach(btn => {
    btn.disabled = !canManageProducts;
  });
  ['shipperPicker', 'consigneePicker', 'importerPicker'].forEach(id => {
    const el = $(id);
    if (el) el.disabled = !canManageContacts;
  });
  ['saveProfileBtn', 'useProfileBtn', 'clearProfileBtn'].forEach(id => {
    const el = $(id);
    if (el) el.disabled = !canManageContacts;
  });
  ['profileContactPicker', 'profileSyncWithContact', 'profileName', 'profileAddress1', 'profileAddress2', 'profileCity', 'profileStateProvince', 'profilePostalCode', 'profileCountry', 'profilePhone', 'profileEmail', 'profileTaxId'].forEach(id => {
    const el = $(id);
    if (el) el.disabled = !canManageContacts;
  });
  const profileNote = $('profileAuthNote');
  if (profileNote) {
    profileNote.textContent = canManageContacts
      ? 'Saved company profile fills the shipper section on new invoices.'
      : 'Sign in to save your shipper defaults.';
  }

  if (loadSampleBtn) {
    loadSampleBtn.classList.toggle('section-hidden', !snapshot.enableSampleData);
    loadSampleBtn.disabled = !canManageContacts;
  }
  if (loadLocalDataBtn) {
    loadLocalDataBtn.classList.toggle('section-hidden', !localMode);
    loadLocalDataBtn.disabled = !localMode;
  }
  if (invoiceLoadLocalDataBtn) {
    invoiceLoadLocalDataBtn.disabled = !localMode;
  }
  if (invoiceClearLocalDataBtn) {
    invoiceClearLocalDataBtn.disabled = !localMode;
  }
}

function renderMigrationBanner(snapshot) {
  const banner = $('migrationBanner');
  if (!banner) return;
  banner.classList.toggle('section-hidden', !snapshot.migrationAvailable);
}

function handleRepoChange(snapshot) {
  APP_STATE.addressBook = (snapshot.contacts || []).slice();
  APP_STATE.productLibrary = (snapshot.products || []).filter((product) => !product.deleted_at);
  APP_STATE.companyProfile = resolveCompanyProfile(snapshot.companyProfile || null, snapshot.contacts || []);
  if (APP_STATE.editingContactId && !APP_STATE.addressBook.some((entry) => entry.id === APP_STATE.editingContactId && !entry.deleted_at)) {
    APP_STATE.editingContactId = '';
    APP_STATE.contactEditDraft = null;
    APP_STATE.contactEditDirty = false;
  }
  renderCompanyProfileContactPicker();
  writeCompanyProfileFields(APP_STATE.companyProfile);
  maybeApplyBootCompanyProfile();
  updateAuthUi(snapshot);
  renderMigrationBanner(snapshot);
  renderAddressBook();
  renderContactPickers();
  populateProductDropdown();
  renderProductPanel();
}

async function saveToAddressBook(prefix) {
  await ensureRepoReady();
  const repo = getRepo();
  const party = readPartyFields(prefix);
  if (!hasPartyValues(party)) return;

  const existing = APP_STATE.addressBook.find(entry =>
    !entry.deleted_at && ((entry.id && party.id && entry.id === party.id) || entry.name === party.name)
  );

  try {
    await repo.upsertContact({
      id: existing ? existing.id : '',
      name: party.name,
      address1: party.address1,
      address2: party.address2,
      city: party.city,
      stateProvince: party.stateProvince,
      postalCode: party.postalCode,
      country: party.country,
      phone: party.phone,
      email: party.email,
      taxId: party.taxId,
      role_hints: mergeRoleHints(existing ? existing.role_hints : [], [prefix])
    });
    showToast('Saved "' + (party.name || 'contact') + '"');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not save contact');
  }
}

function saveSelectedContact() {
  return saveToAddressBook(val('saveContactSource') || 'shipper');
}

function loadFromAddressBook(contactId, target) {
  const entry = APP_STATE.addressBook.find(item => item.id === contactId && !item.deleted_at);
  if (!entry) return;
  writePartyFields(target, entry);
  saveState();
  showToast('Loaded "' + (entry.name || 'contact') + '" as ' + target);
}

async function deleteFromAddressBook(contactId, event) {
  if (event) event.stopPropagation();
  const entry = APP_STATE.addressBook.find(item => item.id === contactId && !item.deleted_at);
  if (!entry) return;
  const name = entry.name || 'this contact';
  if (!confirm('Delete "' + name + '" from cloud contacts?')) return;
  try {
    await getRepo().deleteContact(contactId);
    showToast('Deleted "' + name + '"');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not delete contact');
  }
}

function renderAddressBook() {
  const list = $('addressBookList');
  if (!list) return;
  const filtered = getFilteredAddressBook();

  if (APP_STATE.authConfigured && !APP_STATE.authSignedIn) {
    list.innerHTML = '<div class="address-book-empty-state">Sign in to load your private address book.</div>';
    return;
  }

  if (!filtered.length) {
    list.innerHTML = '<div class="address-book-empty-state">' + (val('addressBookSearch') ? 'No matching contacts' : 'No saved contacts') + '</div>';
    return;
  }

  const editingNew = APP_STATE.editingContactId === '__new__'
    ? buildAddressBookEditForm({
        id: '__new__',
        name: '',
        address1: '',
        address2: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        country: '',
        phone: '',
        email: '',
        taxId: '',
        role_hints: []
      })
    : '';

  list.innerHTML = editingNew + filtered.map(entry => {
    if (APP_STATE.editingContactId === entry.id) {
      return buildAddressBookEditForm(entry);
    }
    const detail = [getAddressPreview(entry), entry.phone, entry.email].filter(Boolean).join(' | ');
    const roles = mergeRoleHints(entry.role_hints || []).join(', ');
    return `<div class="address-book-entry">
      <div class="address-book-entry-info">
        <div class="address-book-entry-name">${escapeHtml(entry.name || 'No name')}</div>
        ${roles ? '<div class="address-book-entry-meta">' + escapeHtml(roles) + '</div>' : ''}
        ${detail ? '<div class="address-book-entry-detail">' + escapeHtml(detail) + '</div>' : ''}
      </div>
      <div class="address-book-entry-actions">
        <button onclick="loadFromAddressBook('${escapeHtml(entry.id)}', 'shipper')" title="Load as Shipper">Shipper</button>
        <button onclick="loadFromAddressBook('${escapeHtml(entry.id)}', 'consignee')" title="Load as Consignee">Consignee</button>
        <button onclick="loadFromAddressBook('${escapeHtml(entry.id)}', 'importer')" title="Load as Importer">Importer</button>
        <button onclick="editAddressBookEntry('${escapeHtml(entry.id)}')" title="Edit">Edit</button>
        <button onclick="deleteFromAddressBook('${escapeHtml(entry.id)}', event)" title="Delete">Del</button>
      </div>
    </div>`;
  }).join('');
}

// --- O2: Contact Pickers (quick-access on party cards) ---
function renderContactPickers() {
  const book = APP_STATE.addressBook.filter(entry => !entry.deleted_at);
  ['shipperPicker', 'consigneePicker', 'importerPicker'].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    book.forEach((entry, i) => {
      const o = document.createElement('option');
      o.value = entry.id;
      o.textContent = entry.name || entry.email || 'Contact ' + (i + 1);
      sel.appendChild(o);
    });
  });
}

function pickContact(selectEl, target) {
  const contactId = selectEl.value;
  if (!contactId) return;
  loadFromAddressBook(contactId, target);
  selectEl.selectedIndex = 0;
}

// --- O3: Inline Edit ---
function buildAddressBookEditForm(entry) {
  const draft = APP_STATE.contactEditDraft || createContactEditDraft(entry);
  const roles = new Set(normalizeRoleHintsList(draft.role_hints));
  const statusClass = APP_STATE.contactEditDirty ? 'address-book-edit-status is-dirty' : 'address-book-edit-status';
  const statusText = APP_STATE.contactEditDirty ? 'Unsaved changes' : 'Saved';
  return `<div class="address-book-edit-form">
    <div class="${statusClass}">${statusText}</div>
    <input type="text" value="${escapeHtml(draft.name || '')}" placeholder="Name" oninput="updateContactEditDraft('name', this.value)" />
    <div class="address-fields">
      <input type="text" value="${escapeHtml(draft.address1 || '')}" placeholder="Address 1" oninput="updateContactEditDraft('address1', this.value)" />
      <input type="text" value="${escapeHtml(draft.address2 || '')}" placeholder="Address 2" oninput="updateContactEditDraft('address2', this.value)" />
      <input type="text" value="${escapeHtml(draft.city || '')}" placeholder="City" oninput="updateContactEditDraft('city', this.value)" />
      <input type="text" value="${escapeHtml(draft.stateProvince || '')}" placeholder="State / Province" oninput="updateContactEditDraft('stateProvince', this.value)" />
      <input type="text" value="${escapeHtml(draft.postalCode || '')}" placeholder="Postal / ZIP Code" oninput="updateContactEditDraft('postalCode', this.value)" />
      <select class="country-select" onchange="updateContactEditDraft('country', this.value)">${getCountrySelectOptionsHtml(draft.country || '')}</select>
    </div>
    <div class="address-book-role-grid">
      <label><input type="checkbox" ${roles.has('shipper') ? 'checked' : ''} onchange="toggleContactRoleHint('shipper', this.checked)" /> Shipper</label>
      <label><input type="checkbox" ${roles.has('consignee') ? 'checked' : ''} onchange="toggleContactRoleHint('consignee', this.checked)" /> Consignee</label>
      <label><input type="checkbox" ${roles.has('importer') ? 'checked' : ''} onchange="toggleContactRoleHint('importer', this.checked)" /> Importer</label>
    </div>
    <input type="text" value="${escapeHtml(draft.phone || '')}" placeholder="Phone" oninput="updateContactEditDraft('phone', this.value)" />
    <input type="text" value="${escapeHtml(draft.email || '')}" placeholder="Email" oninput="updateContactEditDraft('email', this.value)" />
    <input type="text" value="${escapeHtml(draft.taxId || '')}" placeholder="Tax / VAT Number / Importer Code / ID Number" oninput="updateContactEditDraft('taxId', this.value)" />
    <div class="address-book-edit-actions">
      <button onclick="saveEditedEntry('${escapeHtml(entry.id)}')">Save</button>
      <button onclick="cancelAddressBookEdit()">Cancel</button>
    </div>
  </div>`;
}

function createContactEditDraft(entry) {
  return {
    id: entry.id,
    name: entry.name || '',
    address1: entry.address1 || '',
    address2: entry.address2 || '',
    city: entry.city || '',
    stateProvince: entry.stateProvince || '',
    postalCode: entry.postalCode || '',
    country: entry.country || '',
    phone: entry.phone || '',
    email: entry.email || '',
    taxId: entry.taxId || '',
    role_hints: normalizeRoleHintsList(entry.role_hints)
  };
}

async function startNewContact() {
  await ensureRepoReady();
  if (APP_STATE.authConfigured && !APP_STATE.authSignedIn) {
    showToast('Sign in is required to manage contacts');
    return;
  }
  APP_STATE.editingContactId = '__new__';
  APP_STATE.contactEditDraft = createContactEditDraft({
    id: '__new__',
    name: '',
    address1: '',
    address2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    taxId: '',
    role_hints: []
  });
  APP_STATE.contactEditDirty = false;
  renderAddressBook();
}

function editAddressBookEntry(contactId) {
  const entry = APP_STATE.addressBook.find(item => item.id === contactId && !item.deleted_at);
  if (!entry) return;
  APP_STATE.editingContactId = contactId;
  APP_STATE.contactEditDraft = createContactEditDraft(entry);
  APP_STATE.contactEditDirty = false;
  renderAddressBook();
}

function cancelAddressBookEdit() {
  APP_STATE.editingContactId = '';
  APP_STATE.contactEditDraft = null;
  APP_STATE.contactEditDirty = false;
  renderAddressBook();
}

function updateContactEditStatus() {
  const statusEl = document.querySelector('.address-book-edit-status');
  if (!statusEl) return;
  statusEl.textContent = APP_STATE.contactEditDirty ? 'Unsaved changes' : 'Saved';
  statusEl.classList.toggle('is-dirty', !!APP_STATE.contactEditDirty);
}

function updateContactEditDraft(field, value) {
  if (!APP_STATE.contactEditDraft) return;
  APP_STATE.contactEditDraft[field] = field === 'country' ? String(value || '').toUpperCase() : value;
  APP_STATE.contactEditDirty = true;
  updateContactEditStatus();
}

function toggleContactRoleHint(role, checked) {
  if (!APP_STATE.contactEditDraft) return;
  const roles = new Set(normalizeRoleHintsList(APP_STATE.contactEditDraft.role_hints));
  if (checked) roles.add(role);
  else roles.delete(role);
  APP_STATE.contactEditDraft.role_hints = Array.from(roles);
  APP_STATE.contactEditDirty = true;
  updateContactEditStatus();
}

async function saveEditedEntry(contactId) {
  const existing = APP_STATE.addressBook.find(item => item.id === contactId);
  if (!APP_STATE.contactEditDraft) return;
  const contactName = trimString(APP_STATE.contactEditDraft.name) || trimString(existing && existing.name) || 'contact';
  const saveId = contactId === '__new__' ? '' : contactId;

  try {
    await getRepo().upsertContact({
      id: saveId,
      name: trimString(APP_STATE.contactEditDraft.name),
      address1: trimString(APP_STATE.contactEditDraft.address1),
      address2: trimString(APP_STATE.contactEditDraft.address2),
      city: trimString(APP_STATE.contactEditDraft.city),
      stateProvince: trimString(APP_STATE.contactEditDraft.stateProvince),
      postalCode: trimString(APP_STATE.contactEditDraft.postalCode),
      country: trimString(APP_STATE.contactEditDraft.country).toUpperCase(),
      phone: trimString(APP_STATE.contactEditDraft.phone),
      email: trimString(APP_STATE.contactEditDraft.email),
      taxId: trimString(APP_STATE.contactEditDraft.taxId),
      role_hints: normalizeRoleHintsList(APP_STATE.contactEditDraft.role_hints || (existing ? existing.role_hints : []))
    });
    APP_STATE.contactEditDirty = false;
    APP_STATE.editingContactId = '';
    APP_STATE.contactEditDraft = null;
    showToast('Updated "' + contactName + '"');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not update contact');
  }
}

// --- O4: Export / Import Address Book ---
async function exportAddressBook() {
  await ensureRepoReady();
  const book = await getRepo().exportContacts();
  if (!book.length) { showToast('Address book is empty'); return; }
  downloadFile('address-book-backup.json', 'application/json', JSON.stringify(book, null, 2));
  showToast('Address book backup exported (' + book.length + ' contacts)');
}

function importAddressBook() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!Array.isArray(imported)) throw new Error('Not an array');
        const results = await getRepo().importContacts(imported);
        showToast('Imported ' + results.length + ' contacts');
      } catch (err) {
        showToast('Invalid address book file');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

async function signInAddressBook() {
  await ensureRepoReady();
  try {
    await getRepo().auth.signIn(val('authEmail').trim(), val('authPassword'));
    setVal('authPassword', '');
    showToast('Signed in');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Sign in failed');
  }
}

async function signUpAddressBook() {
  await ensureRepoReady();
  try {
    await getRepo().auth.signUp(val('authEmail').trim(), val('authPassword'));
    setVal('authPassword', '');
    showToast('Account created. Check your email if confirmation is enabled.');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Sign up failed');
  }
}

async function signOutAddressBook() {
  await ensureRepoReady();
  try {
    await getRepo().auth.signOut();
    showToast('Signed out');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Sign out failed');
  }
}

async function syncAddressBook() {
  await ensureRepoReady();
  await getRepo().sync();
}

async function importLegacyLocalContacts() {
  await ensureRepoReady();
  try {
    const clearLegacy = APP_STATE.authConfigured
      ? confirm('Clear the old local-only contacts after import?')
      : true;
    const results = await getRepo().importLegacyLocalContacts({ clearLegacy });
    showToast('Imported ' + results.length + ' local contacts');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not import local contacts');
  }
}

async function dismissLegacyMigration() {
  await ensureRepoReady();
  getRepo().dismissMigration();
}

async function loadSampleContacts() {
  await ensureRepoReady();
  try {
    const results = await getRepo().loadSampleContacts();
    showToast('Loaded ' + results.length + ' sample contacts');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Sample data is disabled');
  }
}

async function loadLocalData() {
  await ensureRepoReady();
  try {
    const results = await getRepo().loadLocalBootstrapData({
      baseProducts: getBaseProductEntries()
    });
    const appliedRoles = applyLoadedLocalContactsToInvoice();
    let invoiceItemsLoaded = 0;
    if (APP_VIEW === 'invoice') {
      const invoiceConfig = window.APP_CONFIG || {};
      const invoiceBootstrap = await fetchJsonIfAvailable(invoiceConfig.localInvoiceBootstrapUrl || '/local-data/invoice.local.json');
      const bootstrapItems = invoiceBootstrap && Array.isArray(invoiceBootstrap.items) ? invoiceBootstrap.items : [];
      invoiceItemsLoaded = applyInvoiceItems(bootstrapItems);
    }
    if (!results.contactsLoaded && !results.productsLoaded) {
      showToast('No local data files were found');
      return;
    }
    let message = 'Loaded ' + results.contactsLoaded + ' contacts and ' + results.productsLoaded + ' products from local data';
    if (appliedRoles) {
      message += ' and filled ' + appliedRoles + ' invoice contact sections';
    }
    if (invoiceItemsLoaded) {
      message += ' with ' + invoiceItemsLoaded + ' invoice line items';
    }
    showToast(message);
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not load local data');
  }
}

async function clearLocalData() {
  await ensureRepoReady();
  if (!confirm('Clear locally saved contacts, products, and company profile from this browser?')) return;
  try {
    const results = await getRepo().clearLocalData();
    clearSavedBrowserState();
    markBlankInvoiceReload();
    applyBlankInvoiceState();
    APP_STATE.editingContactId = '';
    APP_STATE.contactEditDraft = null;
    APP_STATE.contactEditDirty = false;
    APP_STATE.editingProductName = '';
    APP_STATE.productEditDraft = null;
    APP_STATE.productEditDirty = false;
    if ($('addressBookSearch')) $('addressBookSearch').value = '';
    if ($('productSearch')) $('productSearch').value = '';
    renderAddressBook();
    renderProductPanel();
    renderContactPickers();
    showToast('Cleared ' + results.contactsCleared + ' contacts and ' + results.productsCleared + ' products. Refreshing...');
    reloadAfterLocalDataClear();
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not clear local data');
  }
}

async function saveCompanyProfile() {
  await ensureRepoReady();
  try {
    const repo = getRepo();
    const draft = readCompanyProfileFields();
    const saved = await repo.saveCompanyProfile(draft);
    APP_STATE.companyProfile = resolveCompanyProfile(saved);
    if (saved && draft.syncWithContact && draft.linkedContactId) {
      const existingContact = getAddressBookContactById(draft.linkedContactId);
      const syncedContact = await repo.upsertContact({
        id: existingContact ? existingContact.id : draft.linkedContactId,
        name: draft.name,
        address1: draft.address1,
        address2: draft.address2,
        city: draft.city,
        stateProvince: draft.stateProvince,
        postalCode: draft.postalCode,
        country: draft.country,
        phone: draft.phone,
        email: draft.email,
        taxId: draft.taxId,
        role_hints: existingContact && existingContact.role_hints && existingContact.role_hints.length
          ? existingContact.role_hints
          : ['shipper']
      });
      APP_STATE.companyProfile = resolveCompanyProfile(Object.assign({}, saved, {
        linkedContactId: syncedContact ? syncedContact.id : draft.linkedContactId,
        syncWithContact: true
      }));
      writeCompanyProfileFields(APP_STATE.companyProfile);
    }
    if (saved) {
      applyCompanyProfileToShipperFields(APP_STATE.companyProfile);
      saveState();
      showToast('Company profile saved');
    } else {
      showToast('Company profile cleared');
    }
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not save company profile');
  }
}

function applySavedCompanyProfile() {
  if (!APP_STATE.companyProfile) {
    showToast('No saved company profile');
    return;
  }
  applyCompanyProfileToShipperFields(APP_STATE.companyProfile);
  saveState();
  showToast('Applied company profile to shipper');
}

async function clearSavedCompanyProfile() {
  await ensureRepoReady();
  try {
    await getRepo().clearCompanyProfile();
    APP_STATE.companyProfile = null;
    renderCompanyProfileContactPicker();
    writeCompanyProfileFields(null);
    showToast('Company profile cleared');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not clear company profile');
  }
}

// --- O5: Product Library ---
function createProductEditDraft(product) {
  return normalizeProductEntry(product) || {
    name: '',
    category: 'Other',
    hs: '',
    unit: 0,
    sku: '',
    origin: DEFAULT_ORIGIN,
    weight: 0
  };
}

function buildProductEditForm(product) {
  const draft = APP_STATE.productEditDraft || createProductEditDraft(product);
  const statusClass = APP_STATE.productEditDirty ? 'address-book-edit-status product-edit-status is-dirty' : 'address-book-edit-status product-edit-status';
  const statusText = APP_STATE.productEditDirty ? 'Unsaved changes' : 'Saved';
  const categoryOptions = getProductCategories()
    .map((category) => `<option value="${escapeHtml(category)}"${category === draft.category ? ' selected' : ''}>${escapeHtml(category)}</option>`)
    .join('');
  return `<div class="address-book-edit-form">
    <div class="${statusClass}">${statusText}</div>
    <input type="text" value="${escapeHtml(draft.name || '')}" placeholder="Product name" oninput="updateProductEditDraft('name', this.value)" />
    <select onchange="updateProductEditDraft('category', this.value)">${categoryOptions}</select>
    <input type="text" value="${escapeHtml(draft.hs || '')}" placeholder="HS code" oninput="updateProductEditDraft('hs', this.value)" />
    <input type="text" value="${escapeHtml(draft.sku || '')}" placeholder="SKU" oninput="updateProductEditDraft('sku', this.value)" />
    <input type="number" step="0.01" value="${escapeHtml(draft.unit || 0)}" placeholder="Unit price" oninput="updateProductEditDraft('unit', this.value)" />
    <input type="number" step="0.01" value="${escapeHtml(draft.weight || 0)}" placeholder="Weight (kg)" oninput="updateProductEditDraft('weight', this.value)" />
    <select class="country-select" onchange="updateProductEditDraft('origin', this.value)">${getCountrySelectOptionsHtml(draft.origin || DEFAULT_ORIGIN)}</select>
    <div class="address-book-edit-actions">
      <button onclick="saveProductEntry('${escapeHtml(product.name || '__new__')}')">Save</button>
      <button onclick="cancelProductEdit()">Cancel</button>
      ${product.name ? `<button onclick="deleteProductEntry('${escapeHtml(product.name)}')">Delete</button>` : ''}
    </div>
  </div>`;
}

async function startNewProduct() {
  await ensureRepoReady();
  if (APP_STATE.authConfigured && !APP_STATE.authSignedIn) {
    showToast('Sign in is required to manage products');
    return;
  }
  APP_STATE.editingProductName = '__new__';
  APP_STATE.productEditDraft = createProductEditDraft({
    name: '',
    category: 'Other',
    hs: '',
    unit: 0,
    sku: '',
    origin: DEFAULT_ORIGIN,
    weight: 0
  });
  APP_STATE.productEditDirty = false;
  renderProductPanel();
}

function editProductEntry(name) {
  const product = getProductByName(name);
  if (!product) return;
  APP_STATE.editingProductName = name;
  APP_STATE.productEditDraft = createProductEditDraft(product);
  APP_STATE.productEditDirty = false;
  renderProductPanel();
}

function cancelProductEdit() {
  APP_STATE.editingProductName = '';
  APP_STATE.productEditDraft = null;
  APP_STATE.productEditDirty = false;
  renderProductPanel();
}

function updateProductEditDraft(field, value) {
  if (!APP_STATE.productEditDraft) return;
  if (field === 'unit' || field === 'weight') {
    APP_STATE.productEditDraft[field] = value === '' ? '' : Number(value);
  } else if (field === 'origin') {
    APP_STATE.productEditDraft[field] = String(value || '').toUpperCase();
  } else {
    APP_STATE.productEditDraft[field] = value;
  }
  APP_STATE.productEditDirty = true;
  updateProductEditStatus();
}

function updateProductEditStatus() {
  const statusEl = document.querySelector('.product-edit-status');
  if (!statusEl) return;
  statusEl.textContent = APP_STATE.productEditDirty ? 'Unsaved changes' : 'Saved';
  statusEl.classList.toggle('is-dirty', !!APP_STATE.productEditDirty);
}

async function saveProductEntry(originalName) {
  await ensureRepoReady();
  const draft = normalizeProductEntry(APP_STATE.productEditDraft);
  if (!draft) {
    showToast('Product name is required');
    return;
  }
  const collision = APP_STATE.productLibrary.find((entry) => entry.name === draft.name && entry.name !== originalName);
  if (collision) {
    showToast('A product with that name already exists');
    return;
  }
  const existing = originalName === '__new__' ? null : APP_STATE.productLibrary.find((entry) => entry.name === originalName);
  try {
    await getRepo().upsertProduct({
      id: existing ? existing.id : '',
      name: draft.name,
      category: draft.category,
      hs: draft.hs,
      unit: draft.unit,
      sku: draft.sku,
      origin: draft.origin,
      weight: draft.weight
    });
    APP_STATE.editingProductName = '';
    APP_STATE.productEditDraft = null;
    APP_STATE.productEditDirty = false;
    showToast('Saved "' + draft.name + '"');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not save product');
  }
}

async function deleteProductEntry(name) {
  await ensureRepoReady();
  if (!confirm('Delete "' + name + '" from the product library?')) return;
  const existing = APP_STATE.productLibrary.find((entry) => entry.name === name);
  if (!existing) return;
  try {
    await getRepo().deleteProduct(existing.id);
    APP_STATE.editingProductName = '';
    APP_STATE.productEditDraft = null;
    APP_STATE.productEditDirty = false;
    showToast('Deleted "' + name + '"');
  } catch (error) {
    showToast(error && error.message ? error.message : 'Could not delete product');
  }
}

// --- O6: Product Panel ---
function renderProductPanel() {
  const list = $('productPanelList');
  if (!list) return;

  const searchEl = $('productSearch');
  const search = searchEl ? (searchEl.value || '').toLowerCase() : '';

  let html = '';
  const filteredProducts = APP_STATE.productLibrary.filter((product) => {
    if (!search) return true;
    return [product.name, product.category, product.hs, product.sku, product.origin]
      .some((field) => String(field || '').toLowerCase().includes(search));
  });
  const grouped = {};
  filteredProducts.forEach((product) => {
    const category = product.category || 'Other';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(product);
  });

  Object.keys(grouped).sort().forEach((category) => {
    html += '<div class="product-group-label">' + escapeHtml(category) + '</div>';
    grouped[category].sort((a, b) => a.name.localeCompare(b.name)).forEach((product) => {
      const detail = ['HS: ' + product.hs, product.origin || DEFAULT_ORIGIN, fmt(product.unit) + ' ' + (val('currency') || 'USD')]
        .filter(Boolean).join(' | ');
      if (APP_VIEW === 'library') {
        const canManageProducts = !APP_STATE.authConfigured || APP_STATE.authSignedIn;
        if (APP_STATE.editingProductName === product.name) {
          html += buildProductEditForm(product);
          return;
        }
        html += `<div class="product-item">
          <div class="product-item-info">
            <div class="product-item-name">${escapeHtml(product.name)}</div>
            <div class="product-item-detail">${escapeHtml(detail)}</div>
          </div>
          ${canManageProducts ? `<button class="product-item-add" data-product-action="true" onclick="editProductEntry('${escapeHtml(product.name)}')">Edit</button>` : ''}
        </div>`;
        return;
      }
      html += `<div class="product-item" onclick="addProductFromPanel('${escapeHtml(product.name)}')">
        <div class="product-item-info">
          <div class="product-item-name">${escapeHtml(product.name)}</div>
          <div class="product-item-detail">${escapeHtml(detail)}</div>
        </div>
        <button class="product-item-add" onclick="event.stopPropagation(); addProductFromPanel('${escapeHtml(product.name)}')">+ Add</button>
      </div>`;
    });
  });

  if (APP_VIEW === 'library' && APP_STATE.editingProductName === '__new__') {
    html = buildProductEditForm({
      name: '',
      category: 'Other',
      hs: '',
      unit: 0,
      sku: '',
      origin: DEFAULT_ORIGIN,
      weight: 0
    }) + html;
  }

  if (!html) {
    html = '<div class="history-empty">No matching products</div>';
  }
  list.innerHTML = html;
}

function addProductFromPanel(key) {
  const p = getProductByName(key);
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
    addRow({
      qty: 1, desc: key, hs: p.hs, unit: p.unit, sku: p.sku || '',
      uom: 'pcs', origin: p.origin || DEFAULT_ORIGIN, weight: p.weight || 0
    });
  }
  showToast('Added "' + key + '"');
}

// --- P: Event Bindings & Initialization ---
function init() {
  loadTheme();
  populateCountrySelects();

  if (APP_VIEW === 'library') {
    renderAddressBook();
    renderProductPanel();
    return ensureRepoReady();
  }

  populateProductDropdown();
  loadSettings();
  applyVisibility();
  renderAddressBook();
  renderContactPickers();

  // Auto-save on all form field edits
  const autoSaveFields = [
    'invoiceNumber', 'invoiceDate', 'waybill', 'currency', 'shipmentRef',
    'incoterms', 'reasonForExport',
    'shipperName', 'shipperAddress1', 'shipperAddress2', 'shipperCity', 'shipperStateProvince', 'shipperPostalCode', 'shipperCountry', 'shipperPhone', 'shipperEmail', 'shipperTaxId',
    'consigneeName', 'consigneeAddress1', 'consigneeAddress2', 'consigneeCity', 'consigneeStateProvince', 'consigneePostalCode', 'consigneeCountry', 'consigneePhone', 'consigneeEmail', 'consigneeTaxId',
    'importerName', 'importerAddress1', 'importerAddress2', 'importerCity', 'importerStateProvince', 'importerPostalCode', 'importerCountry', 'importerPhone', 'importerEmail', 'importerTaxId',
    'profileContactPicker', 'profileSyncWithContact', 'profileName', 'profileAddress1', 'profileAddress2', 'profileCity', 'profileStateProvince', 'profilePostalCode', 'profileCountry', 'profilePhone', 'profileEmail', 'profileTaxId',
    'defaultOrigin', 'numPackages', 'shippingMethod', 'carrier', 'carrierContactName',
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
    if (e.target.matches('.qty, .unit, .desc, .hs, .weight')) {
      recalcTotals();
      saveState();
    }
  });
  $('items').addEventListener('change', e => {
    if (e.target.matches('.uom, .origin')) {
      saveState();
    }
  });

  // Restore saved state or create default invoice
  APP_STATE.loadedSavedInvoice = loadState();
  if (consumeBlankInvoiceReload()) {
    APP_STATE.loadedSavedInvoice = false;
    applyBlankInvoiceState();
  } else if (!APP_STATE.loadedSavedInvoice) {
    generateInvoiceNumber();
    setVal('invoiceDate', todayStr());
    setVal('declarantDate', todayStr());
    addRow({ qty: 2, desc: 'Ray-Ban Meta Sunglasses', hs: '9004.10.3', unit: 299, sku: '', uom: 'pcs', origin: 'US', weight: 0.05 });
    addRow({ qty: 3, desc: 'Meta Quest Link Cable', hs: '9504.90', unit: 79.99, sku: '', uom: 'pcs', origin: 'CN', weight: 0.10 });
  }
  const repoReady = ensureRepoReady();
  return repoReady;
}

window.__appReadyPromise = init();
