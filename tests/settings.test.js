/**
 * Tests for settings panel, visibility toggles, and address book
 */
const { createInvoiceDOM } = require('./setup');

let env;

beforeEach(() => {
  env = createInvoiceDOM();
});

afterEach(() => {
  env.dom.window.close();
});

function call(fn, ...args) {
  return env.window[fn](...args);
}

function $(id) {
  return env.document.getElementById(id);
}

function $$(sel) {
  return env.document.querySelectorAll(sel);
}

// ============================================================
// Settings Panel
// ============================================================
describe('Settings panel', () => {
  test('settings panel exists and is hidden by default', () => {
    const panel = $('settingsPanel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('open')).toBe(false);
  });

  test('toggleSettingsPanel() opens and closes the panel', () => {
    call('toggleSettingsPanel');
    expect($('settingsPanel').classList.contains('open')).toBe(true);
    call('toggleSettingsPanel');
    expect($('settingsPanel').classList.contains('open')).toBe(false);
  });

  test('all toggle checkboxes exist', () => {
    const toggleIds = [
      'togShipmentRef', 'togIncoterms', 'togReasonForExport',
      'togImporter', 'togShipmentDetails',
      'togUom', 'togOrigin', 'togWeight',
      'togShippingCost', 'togInsurance', 'togDeclaration'
    ];
    toggleIds.forEach(id => {
      const el = $(id);
      expect(el).not.toBeNull();
      expect(el.type).toBe('checkbox');
    });
  });

  test('all toggles default to checked', () => {
    const toggleIds = [
      'togShipmentRef', 'togIncoterms', 'togReasonForExport',
      'togImporter', 'togShipmentDetails',
      'togUom', 'togOrigin', 'togWeight',
      'togShippingCost', 'togInsurance', 'togDeclaration'
    ];
    toggleIds.forEach(id => {
      expect($(id).checked).toBe(true);
    });
  });
});

// ============================================================
// Visibility Toggles
// ============================================================
describe('Visibility toggles', () => {
  test('toggling declaration off hides declarationSection', () => {
    $('togDeclaration').checked = false;
    call('applyVisibility');
    expect($('declarationSection').classList.contains('section-hidden')).toBe(true);
  });

  test('toggling declaration back on shows declarationSection', () => {
    $('togDeclaration').checked = false;
    call('applyVisibility');
    $('togDeclaration').checked = true;
    call('applyVisibility');
    expect($('declarationSection').classList.contains('section-hidden')).toBe(false);
  });

  test('toggling importer off hides importerSection', () => {
    $('togImporter').checked = false;
    call('applyVisibility');
    expect($('importerSection').classList.contains('section-hidden')).toBe(true);
  });

  test('toggling shipment details off hides shipmentDetailsSection', () => {
    $('togShipmentDetails').checked = false;
    call('applyVisibility');
    expect($('shipmentDetailsSection').classList.contains('section-hidden')).toBe(true);
  });

  test('toggling shipping cost off hides shippingCostRow', () => {
    $('togShippingCost').checked = false;
    call('applyVisibility');
    expect($('shippingCostRow').classList.contains('section-hidden')).toBe(true);
  });

  test('toggling insurance off hides insuranceRow', () => {
    $('togInsurance').checked = false;
    call('applyVisibility');
    expect($('insuranceRow').classList.contains('section-hidden')).toBe(true);
  });

  test('toggling shipmentRef off hides the field wrapper', () => {
    $('togShipmentRef').checked = false;
    call('applyVisibility');
    const wrapper = $('shipmentRef').closest('.field');
    expect(wrapper.classList.contains('section-hidden')).toBe(true);
  });

  test('toggling incoterms off hides the field wrapper', () => {
    $('togIncoterms').checked = false;
    call('applyVisibility');
    const wrapper = $('incoterms').closest('.field');
    expect(wrapper.classList.contains('section-hidden')).toBe(true);
  });
});

// ============================================================
// Settings Persistence
// ============================================================
describe('Settings persistence', () => {
  test('saveSettings and loadSettings round-trip', () => {
    $('togDeclaration').checked = false;
    $('togWeight').checked = false;
    call('saveSettings');

    // Reset checkboxes
    $('togDeclaration').checked = true;
    $('togWeight').checked = true;

    // Load should restore
    call('loadSettings');
    expect($('togDeclaration').checked).toBe(false);
    expect($('togWeight').checked).toBe(false);
  });
});

// ============================================================
// Print respects visibility
// ============================================================
describe('Print respects visibility', () => {
  test('declaration hidden from print when toggled off', () => {
    $('togDeclaration').checked = false;
    call('applyVisibility');
    call('buildPrintBlock');
    const html = $('printBlock').innerHTML;
    expect(html).not.toContain('declare');
  });

  test('declaration shown in print when toggled on', () => {
    $('togDeclaration').checked = true;
    call('applyVisibility');
    call('buildPrintBlock');
    const html = $('printBlock').innerHTML;
    expect(html).toContain('declare');
  });

  test('shipment details hidden from print when toggled off', () => {
    $('togShipmentDetails').checked = false;
    call('applyVisibility');
    call('buildPrintBlock');
    const html = $('printBlock').innerHTML;
    expect(html).not.toContain('print-shipment');
  });

  test('UoM column hidden from print when toggled off', () => {
    $('togUom').checked = false;
    call('applyVisibility');
    call('buildPrintBlock');
    const ths = [...$('printBlock').querySelectorAll('th')].map(th => th.textContent);
    expect(ths).not.toContain('UoM');
  });

  test('importer hidden from print when toggled off', () => {
    // Set importer name and ensure not same-as-consignee
    $('importerName').value = 'Test Importer';
    const cb = $('importerSameAsConsignee');
    if (cb) cb.checked = false;

    $('togImporter').checked = false;
    call('applyVisibility');
    call('buildPrintBlock');
    const html = $('printBlock').innerHTML;
    expect(html).not.toContain('Test Importer');
  });
});

// ============================================================
// Address Book
// ============================================================
describe('Address book', () => {
  test('address book starts empty', () => {
    const book = call('getAddressBook');
    expect(book).toEqual([]);
  });

  test('saveToAddressBook saves a party', () => {
    $('shipperName').value = 'Test Shipper';
    $('shipperAddr').value = '123 Test Street';
    $('shipperPhone').value = '+1555000';
    $('shipperEmail').value = 'test@test.com';

    call('saveToAddressBook', 'shipper');
    const book = call('getAddressBook');
    expect(book.length).toBe(1);
    expect(book[0].name).toBe('Test Shipper');
    expect(book[0].phone).toBe('+1555000');
  });

  test('saveToAddressBook updates existing entry by name', () => {
    $('shipperName').value = 'Test Shipper';
    $('shipperPhone').value = '+1111';
    call('saveToAddressBook', 'shipper');

    $('shipperPhone').value = '+2222';
    call('saveToAddressBook', 'shipper');

    const book = call('getAddressBook');
    expect(book.length).toBe(1);
    expect(book[0].phone).toBe('+2222');
  });

  test('loadFromAddressBook fills target party fields', () => {
    $('shipperName').value = 'Saved Contact';
    $('shipperAddr').value = '456 Saved Lane';
    $('shipperPhone').value = '+999';
    $('shipperEmail').value = 'saved@test.com';
    call('saveToAddressBook', 'shipper');

    // Clear consignee
    $('consigneeName').value = '';
    $('consigneeAddr').value = '';

    // Load to consignee
    call('loadFromAddressBook', 0, 'consignee');
    expect($('consigneeName').value).toBe('Saved Contact');
    expect($('consigneeAddr').value).toBe('456 Saved Lane');
    expect($('consigneePhone').value).toBe('+999');
  });

  test('deleteFromAddressBook removes an entry', () => {
    $('shipperName').value = 'Delete Me';
    $('shipperAddr').value = 'Somewhere';
    call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(1);

    call('deleteFromAddressBook', 0);
    expect(call('getAddressBook').length).toBe(0);
  });

  test('saveToAddressBook ignores empty entries', () => {
    $('shipperName').value = '';
    $('shipperAddr').value = '';
    call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(0);
  });
});

// ============================================================
// Default Contact Info
// ============================================================
describe('Default contact info', () => {
  test('shipper phone starts blank', () => {
    expect($('shipperPhone').value).toBe('');
  });

  test('shipper email starts blank', () => {
    expect($('shipperEmail').value).toBe('');
  });

  test('consignee phone starts blank', () => {
    expect($('consigneePhone').value).toBe('');
  });

  test('consignee email starts blank', () => {
    expect($('consigneeEmail').value).toBe('');
  });

  test('importer name starts blank', () => {
    expect($('importerName').value).toBe('');
  });

  test('importer email starts blank', () => {
    expect($('importerEmail').value).toBe('');
  });
});
