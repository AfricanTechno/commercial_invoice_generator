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
// Settings Panel (floating overlay)
// ============================================================
describe('Settings panel', () => {
  test('settings panel exists and is hidden by default', () => {
    const panel = $('settingsPanel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('open')).toBe(false);
  });

  test('settings overlay exists and is hidden by default', () => {
    const overlay = $('settingsOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.classList.contains('open')).toBe(false);
  });

  test('toggleSettingsPanel() opens both panel and overlay', () => {
    call('toggleSettingsPanel');
    expect($('settingsPanel').classList.contains('open')).toBe(true);
    expect($('settingsOverlay').classList.contains('open')).toBe(true);
  });

  test('toggleSettingsPanel() closes both panel and overlay', () => {
    call('toggleSettingsPanel');
    call('toggleSettingsPanel');
    expect($('settingsPanel').classList.contains('open')).toBe(false);
    expect($('settingsOverlay').classList.contains('open')).toBe(false);
  });

  test('close button exists in settings panel', () => {
    const closeBtn = env.document.querySelector('#settingsPanel .panel-close');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.textContent).toBe('×');
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

  test('deleteFromAddressBook removes an entry when confirmed', () => {
    $('shipperName').value = 'Delete Me';
    $('shipperAddr').value = 'Somewhere';
    call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(1);

    env.window.confirm = () => true;
    call('deleteFromAddressBook', 0);
    expect(call('getAddressBook').length).toBe(0);
  });

  test('deleteFromAddressBook preserves entry when cancelled', () => {
    $('shipperName').value = 'Keep Me';
    $('shipperAddr').value = 'Somewhere';
    call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(1);

    env.window.confirm = () => false;
    call('deleteFromAddressBook', 0);
    expect(call('getAddressBook').length).toBe(1);
  });

  test('saveToAddressBook ignores empty entries', () => {
    $('shipperName').value = '';
    $('shipperAddr').value = '';
    call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(0);
  });

  test('saveToAddressBook for importer works', () => {
    $('importerName').value = 'Test Importer Co';
    $('importerAddr').value = '789 Import Ave';
    call('saveToAddressBook', 'importer');
    const book = call('getAddressBook');
    expect(book.length).toBe(1);
    expect(book[0].name).toBe('Test Importer Co');
  });
});

// ============================================================
// Toast Notifications
// ============================================================
describe('Toast notifications', () => {
  test('showToast function exists', () => {
    expect(typeof env.window.showToast).toBe('function');
  });

  test('showToast creates a toast element', () => {
    call('showToast', 'Test message');
    const toast = env.document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Test message');
  });

  test('saveToAddressBook triggers toast', () => {
    $('shipperName').value = 'Toast Test';
    $('shipperAddr').value = '123 Street';
    call('saveToAddressBook', 'shipper');
    const toast = env.document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Toast Test');
  });
});

// ============================================================
// Contact Pickers
// ============================================================
describe('Contact pickers', () => {
  test('shipper picker exists', () => {
    expect($('shipperPicker')).not.toBeNull();
  });

  test('consignee picker exists', () => {
    expect($('consigneePicker')).not.toBeNull();
  });

  test('importer picker exists', () => {
    expect($('importerPicker')).not.toBeNull();
  });

  test('renderContactPickers populates pickers from address book', () => {
    $('shipperName').value = 'Picker Test';
    $('shipperAddr').value = '999 Lane';
    call('saveToAddressBook', 'shipper');
    call('renderContactPickers');
    const picker = $('shipperPicker');
    // Default option + 1 contact
    expect(picker.options.length).toBe(2);
    expect(picker.options[1].textContent).toBe('Picker Test');
  });

  test('pickContact loads entry into target fields', () => {
    $('shipperName').value = 'Pick Me';
    $('shipperAddr').value = '100 Pick St';
    $('shipperPhone').value = '+111';
    call('saveToAddressBook', 'shipper');
    call('renderContactPickers');

    const picker = $('consigneePicker');
    picker.value = '0';
    call('pickContact', picker, 'consignee');
    expect($('consigneeName').value).toBe('Pick Me');
    expect($('consigneeAddr').value).toBe('100 Pick St');
  });
});

// ============================================================
// Address Book Search
// ============================================================
describe('Address book search', () => {
  test('search input exists', () => {
    expect($('addressBookSearch')).not.toBeNull();
  });

  test('search filters entries', () => {
    // Add two contacts
    $('shipperName').value = 'Alice Smith';
    $('shipperAddr').value = '1 Main St';
    call('saveToAddressBook', 'shipper');
    $('shipperName').value = 'Bob Jones';
    $('shipperAddr').value = '2 Oak Ave';
    call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(2);

    // Search for Alice
    $('addressBookSearch').value = 'alice';
    call('renderAddressBook');
    const entries = env.document.querySelectorAll('.address-book-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('Alice Smith');
  });

  test('empty search shows all entries', () => {
    $('shipperName').value = 'Contact A';
    $('shipperAddr').value = 'Addr A';
    call('saveToAddressBook', 'shipper');
    $('shipperName').value = 'Contact B';
    $('shipperAddr').value = 'Addr B';
    call('saveToAddressBook', 'shipper');

    $('addressBookSearch').value = '';
    call('renderAddressBook');
    const entries = env.document.querySelectorAll('.address-book-entry');
    expect(entries.length).toBe(2);
  });
});

// ============================================================
// Address Book Export/Import
// ============================================================
describe('Address book export/import', () => {
  test('exportAddressBook function exists', () => {
    expect(typeof env.window.exportAddressBook).toBe('function');
  });

  test('exportAddressBook toasts when empty', () => {
    call('exportAddressBook');
    const toast = env.document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('empty');
  });

  test('importAddressBook function exists', () => {
    expect(typeof env.window.importAddressBook).toBe('function');
  });
});

// ============================================================
// Inline Edit
// ============================================================
describe('Address book inline edit', () => {
  test('editAddressBookEntry function exists', () => {
    expect(typeof env.window.editAddressBookEntry).toBe('function');
  });

  test('saveEditedEntry function exists', () => {
    expect(typeof env.window.saveEditedEntry).toBe('function');
  });
});

// ============================================================
// PDF Download
// ============================================================
describe('PDF download', () => {
  test('downloadPDF function exists', () => {
    expect(typeof env.window.downloadPDF).toBe('function');
  });

  test('downloadPDF alerts when libraries not loaded', () => {
    let alertMsg = null;
    env.window.alert = (msg) => { alertMsg = msg; };
    call('downloadPDF');
    expect(alertMsg).toContain('PDF libraries not loaded');
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
