/**
 * Tests for js/invoice.js — core application logic
 * Uses jsdom to simulate a browser environment
 */
const { createInvoiceDOM } = require('./setup');

let env;

beforeEach(async () => {
  env = createInvoiceDOM();
  await env.ready;
});

afterEach(() => {
  env.dom.window.close();
});

// Helper to call functions on the window
function call(fn, ...args) {
  return env.window[fn](...args);
}

function $(id) {
  return env.document.getElementById(id);
}

function $$(sel) {
  return env.document.querySelectorAll(sel);
}

function setPartyAddress(prefix, fields) {
  if (fields.address1 !== undefined) $(prefix + 'Address1').value = fields.address1;
  if (fields.address2 !== undefined) $(prefix + 'Address2').value = fields.address2;
  if (fields.city !== undefined) $(prefix + 'City').value = fields.city;
  if (fields.stateProvince !== undefined) $(prefix + 'StateProvince').value = fields.stateProvince;
  if (fields.postalCode !== undefined) $(prefix + 'PostalCode').value = fields.postalCode;
  if (fields.country !== undefined) $(prefix + 'Country').value = fields.country;
}

// ============================================================
// Initialization
// ============================================================
describe('Initialization', () => {
  test('page loads with default invoice number', () => {
    const val = $('invoiceNumber').value;
    expect(val).toMatch(/^\d{6}$/);
  });

  test('page loads with today\'s date in DD-MM-YYYY format', () => {
    const val = $('invoiceDate').value;
    expect(val).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  });

  test('currency defaults to USD', () => {
    expect($('currency').value).toBe('USD');
  });

  test('default rows are created on fresh load', () => {
    const rows = $$('#items [data-row]');
    expect(rows.length).toBe(2);
  });

  test('grand total is calculated on init', () => {
    const total = parseFloat($('grandTotal').textContent);
    expect(total).toBeGreaterThan(0);
  });

  test('subtotal element exists and has value', () => {
    const sub = $('subtotal');
    expect(sub).not.toBeNull();
    expect(parseFloat(sub.textContent)).toBeGreaterThan(0);
  });
});

// ============================================================
// Row Management
// ============================================================
describe('Row management', () => {
  test('addBlankRow() adds a new row', () => {
    const before = $$('#items [data-row]').length;
    call('addBlankRow');
    const after = $$('#items [data-row]').length;
    expect(after).toBe(before + 1);
  });

  test('blank row has default values', () => {
    call('addBlankRow');
    const rows = $$('#items [data-row]');
    const last = rows[rows.length - 1];
    expect(last.querySelector('.qty').value).toBe('1');
    expect(last.querySelector('.desc').value).toBe('New Product');
    expect(last.querySelector('.uom').value).toBe('pcs');
    expect(last.querySelector('.origin').value).toBe('CN');
  });

  test('deleteRow() removes a row', () => {
    const before = $$('#items [data-row]').length;
    const firstDel = $$('#items [data-row]')[0].querySelector('.del');
    call('deleteRow', firstDel);
    const after = $$('#items [data-row]').length;
    expect(after).toBe(before - 1);
  });

  test('row numbers update after add/delete', () => {
    call('addBlankRow');
    call('addBlankRow');
    const indices = [...$$('#items [data-row] .rowIndex')].map(el => el.textContent);
    expect(indices).toEqual(['1', '2', '3', '4']);
  });
});

// ============================================================
// Product Addition
// ============================================================
describe('Product addition', () => {
  test('addProductFromPanel() adds a catalogue product', () => {
    const before = $$('#items [data-row]').length;
    call('addProductFromPanel', 'RANGE 2 3D Scanner');
    const after = $$('#items [data-row]').length;
    expect(after).toBe(before + 1);

    const lastRow = $$('#items [data-row]')[after - 1];
    expect(lastRow.querySelector('.desc').value).toBe('RANGE 2 3D Scanner');
    expect(lastRow.querySelector('.hs').value).toBe('9031.49.90');
    expect(lastRow.querySelector('.unit').value).toBe('621.62');
    expect(lastRow.querySelector('.origin').value).toBe('CN');
  });

  test('addProductFromPanel() increments qty for duplicate product', () => {
    call('addProductFromPanel', 'Ray-Ban Meta Sunglasses');
    const row = $$('#items [data-row]')[0];
    expect(row.querySelector('.qty').value).toBe('3');
  });

  test('invoice page no longer shows the product picker controls', () => {
    expect($('productSelect')).toBeNull();
  });

  test('product library entries can be created and used on the invoice', async () => {
    await call('startNewProduct');
    call('updateProductEditDraft', 'name', 'Library Test Product');
    call('updateProductEditDraft', 'category', 'Other');
    call('updateProductEditDraft', 'hs', '9006.91.00');
    call('updateProductEditDraft', 'unit', '149.99');
    call('updateProductEditDraft', 'origin', 'US');
    call('updateProductEditDraft', 'weight', '0.75');
    await call('saveProductEntry', '__new__');

    call('addProductFromPanel', 'Library Test Product');
    const lastRow = $$('#items [data-row]')[$$('#items [data-row]').length - 1];
    expect(lastRow.querySelector('.desc').value).toBe('Library Test Product');
    expect(lastRow.querySelector('.origin').value).toBe('US');
  });
});

// ============================================================
// Calculations
// ============================================================
describe('Calculations', () => {
  test('line totals are calculated correctly', () => {
    // Default row 1: qty=2, unit=299 => 598.00
    const row1 = $$('#items [data-row]')[0];
    expect(row1.querySelector('.lineTotal').textContent).toBe('598.00');
  });

  test('subtotal sums all line totals', () => {
    // 2*299 + 3*79.99 = 598 + 239.97 = 837.97
    expect($('subtotal').textContent).toBe('837.97');
  });

  test('grand total includes shipping and insurance', () => {
    $('shippingCost').value = '25.00';
    $('insurance').value = '10.00';
    call('recalcTotals');
    // 837.97 + 25 + 10 = 872.97
    expect($('grandTotal').textContent).toBe('872.97');
  });

  test('total weight is auto-calculated', () => {
    // Row 1: 2 * 0.05 = 0.10, Row 2: 3 * 0.10 = 0.30 => 0.40
    expect($('totalWeight').value).toBe('0.40');
  });

  test('currency label updates', () => {
    $('currency').value = 'EUR';
    call('recalcTotals');
    expect($('currencyLabel').textContent).toBe('EUR');
  });

  test('recalcTotals handles zero rows', () => {
    // Remove all rows
    [...$$('#items [data-row]')].forEach(r => r.remove());
    call('recalcTotals');
    expect($('subtotal').textContent).toBe('0.00');
    expect($('grandTotal').textContent).toBe('0.00');
    expect($('totalWeight').value).toBe('0.00');
  });
});

// ============================================================
// State Persistence
// ============================================================
describe('State persistence', () => {
  test('getState() returns complete state object', () => {
    const st = call('getState');
    expect(st).toHaveProperty('meta');
    expect(st).toHaveProperty('parties');
    expect(st).toHaveProperty('shipment');
    expect(st).toHaveProperty('items');
    expect(st).toHaveProperty('totals');
    expect(st).toHaveProperty('declaration');
  });

  test('meta fields are captured correctly', () => {
    $('invoiceNumber').value = 'TEST-001';
    $('waybill').value = 'AWB-12345';
    const st = call('getState');
    expect(st.meta.invoice).toBe('TEST-001');
    expect(st.meta.waybill).toBe('AWB-12345');
    expect(st.meta.currency).toBe('USD');
  });

  test('parties are captured as structured objects', () => {
    $('shipperName').value = 'Test Shipper';
    $('shipperPhone').value = '+1234567890';
    const st = call('getState');
    expect(st.parties.shipper.name).toBe('Test Shipper');
    expect(st.parties.shipper.phone).toBe('+1234567890');
  });

  test('items include uom, origin, weight fields', () => {
    const st = call('getState');
    expect(st.items.length).toBeGreaterThan(0);
    const item = st.items[0];
    expect(item).toHaveProperty('uom');
    expect(item).toHaveProperty('origin');
    expect(item).toHaveProperty('weight');
  });

  test('setState() restores state correctly', () => {
    const state = {
      meta: { invoice: 'RESTORE-99', date: '01-01-2026', waybill: 'AWB-999', currency: 'GBP', shipmentRef: 'REF-1', incoterms: 'FOB', reasonForExport: 'Gift' },
      parties: {
        shipper: { name: 'Restored Shipper', address1: '123 Test St', city: 'London', postalCode: 'SW1A 1AA', country: 'GB', phone: '555-1234', email: 'test@test.com', taxId: 'TX-99' },
        consignee: { name: 'Restored Buyer', address1: '456 Buy St', city: 'Manchester', country: 'GB', phone: '', email: '', taxId: '' },
        importer: { name: '', address1: '', phone: '', email: '', taxId: '', sameAsConsignee: false }
      },
      shipment: { defaultOrigin: 'GB', totalWeight: '1.00', numPackages: '2', shippingMethod: 'Economy', carrier: 'FedEx', carrierContactName: 'Jamie' },
      items: [
        { qty: 5, desc: 'Test Item', hs: '1234.56', unit: 10, sku: 'TST', uom: 'box', origin: 'GB', weight: 0.2 }
      ],
      totals: { subtotal: '50.00', shippingCost: '0.00', insurance: '0.00', total: '50.00' },
      declaration: { name: 'Test Signer', date: '01-01-2026' }
    };

    call('setState', state);

    expect($('invoiceNumber').value).toBe('RESTORE-99');
    expect($('currency').value).toBe('GBP');
    expect($('shipperName').value).toBe('Restored Shipper');
    expect($('shipperAddress1').value).toBe('123 Test St');
    expect($('shipperCity').value).toBe('London');
    expect($('consigneeName').value).toBe('Restored Buyer');
    expect($('consigneeAddress1').value).toBe('456 Buy St');
    expect($('defaultOrigin').value).toBe('GB');
    expect($('carrierContactName').value).toBe('Jamie');
    expect($('declarantName').value).toBe('Test Signer');

    const rows = $$('#items [data-row]');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.desc').value).toBe('Test Item');
    expect(rows[0].querySelector('.uom').value).toBe('box');
    expect(rows[0].querySelector('.origin').value).toBe('GB');
  });

  test('saveState() and loadState() round-trip', () => {
    $('invoiceNumber').value = 'ROUND-TRIP';
    call('saveState');

    // Modify DOM
    $('invoiceNumber').value = 'CHANGED';

    // Reload
    call('loadState');
    expect($('invoiceNumber').value).toBe('ROUND-TRIP');
  });

  test('legacy v3 state migration (string parties)', () => {
    const legacyState = {
      meta: { invoice: 'LEGACY-V3', date: '01-01-2025', waybill: '', currency: 'USD' },
      parties: { shipper: '123 Old Address', soldto: '456 Old Buyer' },
      items: [{ qty: 1, desc: 'Old Item', hs: '0000.00', unit: 5, sku: '' }],
      totals: { total: '5.00' }
    };

    call('setState', legacyState);
    expect($('shipperAddress1').value).toBe('123 Old Address');
    expect($('consigneeAddress1').value).toBe('456 Old Buyer');
  });

  test('legacy object addresses migrate into structured address fields', () => {
    call('setState', {
      parties: {
        shipper: { name: 'Legacy Shipper', address: 'Line 1\nLine 2\nLine 3' }
      },
      items: []
    });

    expect($('shipperAddress1').value).toBe('Line 1');
    expect($('shipperAddress2').value).toBe('Line 2, Line 3');
  });
});

// ============================================================
// Importer "Same as Consignee"
// ============================================================
describe('Importer same as consignee', () => {
  test('checking the box copies consignee to importer', () => {
    $('consigneeName').value = 'Buyer Co';
    setPartyAddress('consignee', { address1: '1 Test Rd', city: 'Johannesburg', country: 'ZA' });
    $('consigneePhone').value = '+27123456';
    const cb = $('importerSameAsConsignee');
    cb.checked = true;
    call('toggleImporterSame');

    expect($('importerName').value).toBe('Buyer Co');
    expect($('importerAddress1').value).toBe('1 Test Rd');
    expect($('importerCity').value).toBe('Johannesburg');
    expect($('importerPhone').value).toBe('+27123456');
    expect($('importerName').hasAttribute('readonly')).toBe(true);
    expect($('importerCountry').disabled).toBe(true);
  });

  test('unchecking the box re-enables importer fields', () => {
    const cb = $('importerSameAsConsignee');
    cb.checked = true;
    call('toggleImporterSame');
    cb.checked = false;
    call('toggleImporterSame');

    expect($('importerName').hasAttribute('readonly')).toBe(false);
    expect($('importerCountry').disabled).toBe(false);
  });
});

// ============================================================
// New Invoice
// ============================================================
describe('New invoice', () => {
  test('newInvoice() resets to default state', () => {
    // Modify state
    $('invoiceNumber').value = 'OLD-123';
    call('addBlankRow');
    call('addBlankRow');

    call('newInvoice');

    // Should have new invoice number
    expect($('invoiceNumber').value).not.toBe('OLD-123');
    expect($('invoiceNumber').value).toMatch(/^\d{6}$/);

    // Should have 2 default rows
    expect($$('#items [data-row]').length).toBe(2);

    // Defaults
    expect($('incoterms').value).toBe('DAP');
    expect($('reasonForExport').value).toBe('Sale');
    expect($('carrier').value).toBe('DHL');
    expect($('shippingMethod').value).toBe('Express');
    expect($('shippingCost').value).toBe('0.00');
    expect($('insurance').value).toBe('0.00');
  });
});

// ============================================================
// Theme
// ============================================================
describe('Theme', () => {
  test('toggleTheme() switches between light and dark', () => {
    call('toggleTheme');
    expect(env.document.documentElement.getAttribute('data-theme')).toBe('dark');
    call('toggleTheme');
    expect(env.document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('theme toggle button label updates', () => {
    call('applyTheme', 'dark');
    expect($('themeToggle').textContent).toBe('Light');
    call('applyTheme', 'light');
    expect($('themeToggle').textContent).toBe('Dark');
  });
});

// ============================================================
// Export
// ============================================================
describe('Export', () => {
  test('exportCSV() generates valid CSV content', () => {
    // Mock URL.createObjectURL and Blob
    let capturedData = null;
    env.window.URL.createObjectURL = (blob) => {
      capturedData = blob;
      return 'blob:test';
    };
    env.window.URL.revokeObjectURL = () => {};

    // Mock click
    const origCreate = env.document.createElement.bind(env.document);
    env.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = () => {};
      return el;
    };

    call('exportCSV');
    expect(capturedData).not.toBeNull();

    // Read the blob content
    const reader = capturedData.stream ? null : capturedData;
    expect(reader).toBeTruthy();
  });

  test('exportJSON() generates valid JSON', () => {
    let capturedData = null;
    env.window.URL.createObjectURL = (blob) => {
      capturedData = blob;
      return 'blob:test';
    };
    env.window.URL.revokeObjectURL = () => {};

    const origCreate = env.document.createElement.bind(env.document);
    env.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = () => {};
      return el;
    };

    call('exportJSON');
    expect(capturedData).not.toBeNull();
  });
});

// ============================================================
// Print Block
// ============================================================
describe('Print block', () => {
  test('buildPrintBlock() populates the print-only div', () => {
    call('buildPrintBlock');
    const block = $('printBlock');
    expect(block.innerHTML).not.toBe('');
    expect(block.querySelector('table')).not.toBeNull();
  });

  test('print block contains 7 table columns with the new default visibility', () => {
    call('buildPrintBlock');
    const ths = $('printBlock').querySelectorAll('th');
    expect(ths.length).toBe(7);
  });

  test('print block contains party info', () => {
    call('buildPrintBlock');
    const html = $('printBlock').innerHTML;
    expect(html).toContain('Shipper');
    expect(html).toContain('Consignee');
  });

  test('print block contains declaration when toggled on', () => {
    $('togDeclaration').checked = true;
    call('applyVisibility');
    call('buildPrintBlock');
    const html = $('printBlock').innerHTML;
    expect(html).toContain('declare');
    expect(html).toContain('true and correct');
  });

  test('print block contains shipment details', () => {
    $('carrierContactName').value = 'Alex';
    call('buildPrintBlock');
    const html = $('printBlock').innerHTML;
    expect(html).toContain('Incoterms');
    expect(html).toContain('Carrier');
    expect(html).toContain('Carrier Contact');
  });
});

// ============================================================
// History
// ============================================================
describe('Invoice history', () => {
  test('saveToHistory() stores an entry', () => {
    $('carrier').value = 'UPS';
    $('carrierContactName').value = 'Daliso';
    call('saveToHistory');
    const history = call('getHistory');
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty('id');
    expect(history[0]).toHaveProperty('state');
    expect(history[0].carrier).toBe('UPS');
    expect(history[0].carrierContactName).toBe('Daliso');
  });

  test('loadFromHistory() restores a saved invoice', () => {
    $('invoiceNumber').value = 'HIST-001';
    call('saveToHistory');
    const history = call('getHistory');
    const id = history[0].id;

    $('invoiceNumber').value = 'CHANGED';
    call('loadFromHistory', id);
    expect($('invoiceNumber').value).toBe('HIST-001');
  });

  test('history is capped at MAX_HISTORY entries', () => {
    for (let i = 0; i < 55; i++) {
      $('invoiceNumber').value = 'HIST-' + i;
      call('saveToHistory');
    }
    const history = call('getHistory');
    expect(history.length).toBeLessThanOrEqual(50);
  });

  test('renderHistoryList shows a carrier filter', () => {
    call('saveToHistory');
    call('renderHistoryList');
    expect($('historyCarrierFilter')).not.toBeNull();
  });

  test('history can be filtered by carrier', () => {
    $('invoiceNumber').value = 'DHL-1';
    $('carrier').value = 'DHL';
    call('saveToHistory');
    $('invoiceNumber').value = 'UPS-1';
    $('carrier').value = 'UPS';
    call('saveToHistory');

    call('renderHistoryList');
    $('historyCarrierFilter').value = 'UPS';
    call('renderHistoryList');

    const items = [...env.document.querySelectorAll('.history-item')].map((item) => item.textContent);
    expect(items.length).toBe(1);
    expect(items[0]).toContain('UPS-1');
  });

  test('history shows optional carrier contact name when present', () => {
    $('invoiceNumber').value = 'CONTACT-1';
    $('carrier').value = 'DHL';
    $('carrierContactName').value = 'Alice';
    call('saveToHistory');

    call('renderHistoryList');
    const html = $('historyPanel').textContent;
    expect(html).toContain('Carrier Contact: Alice');
  });
});

// ============================================================
// Utility functions
// ============================================================
describe('Utility functions', () => {
  test('escapeHtml escapes special characters', () => {
    expect(call('escapeHtml', '<b>"test" & \'more\'</b>')).toBe('&lt;b&gt;&quot;test&quot; &amp; \'more\'&lt;/b&gt;');
  });

  test('fmt formats numbers to 2 decimal places', () => {
    expect(call('fmt', 10)).toBe('10.00');
    expect(call('fmt', 10.5)).toBe('10.50');
    expect(call('fmt', 10.999)).toBe('11.00');
    expect(call('fmt', NaN)).toBe('0.00');
  });
});

// ============================================================
// DOM Structure
// ============================================================
describe('DOM structure', () => {
  test('all meta field IDs exist', () => {
    ['invoiceNumber', 'invoiceDate', 'waybill', 'currency', 'shipmentRef', 'incoterms', 'reasonForExport'].forEach(id => {
      expect($(id)).not.toBeNull();
    });
  });

  test('all party field IDs exist', () => {
    ['shipper', 'consignee', 'importer'].forEach(prefix => {
      ['Name', 'Address1', 'Address2', 'City', 'StateProvince', 'PostalCode', 'Country', 'Phone', 'Email', 'TaxId'].forEach(suffix => {
        expect($(prefix + suffix)).not.toBeNull();
      });
    });
  });

  test('all shipment detail IDs exist', () => {
    ['defaultOrigin', 'totalWeight', 'numPackages', 'shippingMethod', 'carrier', 'carrierContactName'].forEach(id => {
      expect($(id)).not.toBeNull();
    });
  });

  test('all totals IDs exist', () => {
    ['subtotal', 'shippingCost', 'insurance', 'grandTotal', 'currencyLabel'].forEach(id => {
      expect($(id)).not.toBeNull();
    });
  });

  test('declaration fields exist', () => {
    expect($('declarantName')).not.toBeNull();
    expect($('declarantDate')).not.toBeNull();
  });

  test('importerSameAsConsignee checkbox exists', () => {
    const cb = $('importerSameAsConsignee');
    expect(cb).not.toBeNull();
    expect(cb.type).toBe('checkbox');
  });

  test('incoterms has expected options', () => {
    const opts = [...$('incoterms').options].map(o => o.value);
    expect(opts).toEqual(['DAP', 'DDP', 'EXW', 'FCA', 'FOB', 'CIF', 'CPT', 'CIP']);
  });

  test('reasonForExport has expected options', () => {
    const opts = [...$('reasonForExport').options].map(o => o.value);
    expect(opts).toContain('Sale');
    expect(opts).toContain('Gift');
    expect(opts).toContain('Sample');
    expect(opts).toContain('Repair/Return');
  });

  test('carrier has expected options', () => {
    const opts = [...$('carrier').options].map(o => o.value);
    expect(opts).toEqual(['DHL', 'FedEx', 'UPS', 'Aramex', 'Other']);
  });
});
