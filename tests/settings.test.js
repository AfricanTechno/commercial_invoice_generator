/**
 * Tests for settings panel, visibility toggles, and address book
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

async function signInCloudTest() {
  const repo = call('getRepo');
  repo.__debugSetAuthState({
    configured: true,
    signedIn: true,
    user: { id: 'test-user', email: 'test@example.com' },
    email: 'test@example.com'
  });
  await call('syncAddressBook');
}

async function enterSignedOutCloudMode() {
  const repo = call('getRepo');
  repo.__debugSetAuthState({
    configured: true,
    signedIn: false,
    user: null,
    email: ''
  });
  await call('syncAddressBook');
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

  test('togglePanel() opens and closes settings panel and overlay', () => {
    call('togglePanel', 'settingsPanel');
    expect($('settingsPanel').classList.contains('open')).toBe(true);
    expect($('settingsOverlay').classList.contains('open')).toBe(true);

    call('togglePanel', 'settingsPanel');
    expect($('settingsPanel').classList.contains('open')).toBe(false);
    expect($('settingsOverlay').classList.contains('open')).toBe(false);
  });

  test('close button exists in settings panel', () => {
    const closeBtn = env.document.querySelector('#settingsPanel .panel-close');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.textContent).toBe('×');
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

  test('toggles default to expected states', () => {
    const checkedByDefault = [
      'togIncoterms',
      'togShipmentDetails',
      'togUom'
    ];
    checkedByDefault.forEach(id => {
      expect($(id).checked).toBe(true);
    });
    // All other toggles are off by default
    [
      'togShipmentRef', 'togReasonForExport', 'togImporter',
      'togOrigin', 'togWeight', 'togShippingCost',
      'togInsurance', 'togDeclaration'
    ].forEach(id => {
      expect($(id).checked).toBe(false);
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
  beforeEach(async () => {
    call('setAddressBook', []);
    await signInCloudTest();
  });

  test('address book starts empty after clear', () => {
    const book = call('getAddressBook');
    expect(book).toEqual([]);
  });

  test('saveToAddressBook saves a party', async () => {
    $('shipperName').value = 'Test Shipper';
    setPartyAddress('shipper', { address1: '123 Test Street', city: 'Cape Town', country: 'ZA' });
    $('shipperPhone').value = '+1555000';
    $('shipperEmail').value = 'test@test.com';

    await call('saveToAddressBook', 'shipper');
    const book = call('getAddressBook');
    expect(book.length).toBe(1);
    expect(book[0].name).toBe('Test Shipper');
    expect(book[0].phone).toBe('+1555000');
  });

  test('saveToAddressBook updates existing entry by name', async () => {
    $('shipperName').value = 'Test Shipper';
    $('shipperPhone').value = '+1111';
    await call('saveToAddressBook', 'shipper');

    $('shipperPhone').value = '+2222';
    await call('saveToAddressBook', 'shipper');

    const book = call('getAddressBook');
    expect(book.length).toBe(1);
    expect(book[0].phone).toBe('+2222');
  });

  test('loadFromAddressBook fills target party fields', async () => {
    $('shipperName').value = 'Saved Contact';
    setPartyAddress('shipper', { address1: '456 Saved Lane', city: 'Johannesburg', country: 'ZA' });
    $('shipperPhone').value = '+999';
    $('shipperEmail').value = 'saved@test.com';
    await call('saveToAddressBook', 'shipper');

    // Clear consignee
    $('consigneeName').value = '';
    setPartyAddress('consignee', { address1: '', city: '', country: '' });

    // Load to consignee
    const contactId = call('getAddressBook')[0].id;
    call('loadFromAddressBook', contactId, 'consignee');
    expect($('consigneeName').value).toBe('Saved Contact');
    expect($('consigneeAddress1').value).toBe('456 Saved Lane');
    expect($('consigneeCity').value).toBe('Johannesburg');
    expect($('consigneePhone').value).toBe('+999');
  });

  test('deleteFromAddressBook removes an entry when confirmed', async () => {
    $('shipperName').value = 'Delete Me';
    setPartyAddress('shipper', { address1: 'Somewhere' });
    await call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(1);

    env.window.confirm = () => true;
    const contactId = call('getAddressBook')[0].id;
    await call('deleteFromAddressBook', contactId);
    expect(call('getAddressBook').length).toBe(0);
  });

  test('deleteFromAddressBook preserves entry when cancelled', async () => {
    $('shipperName').value = 'Keep Me';
    setPartyAddress('shipper', { address1: 'Somewhere' });
    await call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(1);

    env.window.confirm = () => false;
    const contactId = call('getAddressBook')[0].id;
    await call('deleteFromAddressBook', contactId);
    expect(call('getAddressBook').length).toBe(1);
  });

  test('saveToAddressBook ignores empty entries', async () => {
    $('shipperName').value = '';
    setPartyAddress('shipper', { address1: '' });
    await call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(0);
  });

  test('saveToAddressBook for importer works', async () => {
    $('importerName').value = 'Test Importer Co';
    setPartyAddress('importer', { address1: '789 Import Ave', postalCode: '2196', country: 'ZA' });
    await call('saveToAddressBook', 'importer');
    const book = call('getAddressBook');
    expect(book.length).toBe(1);
    expect(book[0].name).toBe('Test Importer Co');
    expect(book[0].role_hints).toContain('importer');
  });

  test('signed-out users cannot save contacts', async () => {
    await enterSignedOutCloudMode();

    $('shipperName').value = 'Blocked Contact';
    setPartyAddress('shipper', { address1: 'No Save Road' });
    await call('saveToAddressBook', 'shipper');

    expect(call('getAddressBook')).toEqual([]);
    const toast = env.document.querySelector('.toast');
    expect(toast.textContent).toContain('Sign in');
  });

  test('editing a contact shows role toggles and only one edit form stays open', async () => {
    $('shipperName').value = 'Contact One';
    setPartyAddress('shipper', { address1: '1 Main St' });
    await call('saveToAddressBook', 'shipper');

    $('shipperName').value = 'Contact Two';
    setPartyAddress('shipper', { address1: '2 Main St' });
    await call('saveToAddressBook', 'shipper');

    const contacts = call('getAddressBook');
    call('editAddressBookEntry', contacts[0].id);
    call('editAddressBookEntry', contacts[1].id);

    const forms = env.document.querySelectorAll('.address-book-edit-form');
    expect(forms.length).toBe(1);
    expect(forms[0].textContent).toContain('Shipper');
    expect(forms[0].textContent).toContain('Consignee');
    expect(forms[0].textContent).toContain('Importer');
  });

  test('editing a contact tracks saved and unsaved state', async () => {
    $('shipperName').value = 'Editable Contact';
    setPartyAddress('shipper', { address1: '5 Draft Rd' });
    await call('saveToAddressBook', 'shipper');

    const contact = call('getAddressBook')[0];
    call('editAddressBookEntry', contact.id);
    expect(env.document.querySelector('.address-book-edit-status').textContent).toContain('Saved');

    call('updateContactEditDraft', 'name', 'Editable Contact Updated');
    expect(env.document.querySelector('.address-book-edit-status').textContent).toContain('Unsaved changes');
  });

  test('editing a contact can update role hints', async () => {
    $('shipperName').value = 'Role Contact';
    setPartyAddress('shipper', { address1: '7 Role St' });
    await call('saveToAddressBook', 'shipper');

    const contact = call('getAddressBook')[0];
    call('editAddressBookEntry', contact.id);
    call('toggleContactRoleHint', 'consignee', true);
    await call('saveEditedEntry', contact.id);

    const updated = call('getAddressBook')[0];
    expect(updated.role_hints).toContain('shipper');
    expect(updated.role_hints).toContain('consignee');
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

  test('saveToAddressBook triggers toast', async () => {
    await signInCloudTest();
    $('shipperName').value = 'Toast Test';
    setPartyAddress('shipper', { address1: '123 Street' });
    await call('saveToAddressBook', 'shipper');
    const toast = env.document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Toast Test');
  });
});

// ============================================================
// Contact Pickers
// ============================================================
describe('Contact pickers', () => {
  beforeEach(async () => {
    call('setAddressBook', []);
    await signInCloudTest();
  });

  test('shipper picker exists', () => {
    expect($('shipperPicker')).not.toBeNull();
  });

  test('consignee picker exists', () => {
    expect($('consigneePicker')).not.toBeNull();
  });

  test('importer picker exists', () => {
    expect($('importerPicker')).not.toBeNull();
  });

  test('renderContactPickers populates pickers from address book', async () => {
    $('shipperName').value = 'Picker Test';
    setPartyAddress('shipper', { address1: '999 Lane' });
    await call('saveToAddressBook', 'shipper');
    call('renderContactPickers');
    const picker = $('shipperPicker');
    // Default option + 1 contact
    expect(picker.options.length).toBe(2);
    expect(picker.options[1].textContent).toBe('Picker Test');
  });

  test('pickContact loads entry into target fields', async () => {
    $('shipperName').value = 'Pick Me';
    setPartyAddress('shipper', { address1: '100 Pick St', city: 'Pretoria', country: 'ZA' });
    $('shipperPhone').value = '+111';
    await call('saveToAddressBook', 'shipper');
    call('renderContactPickers');

    const picker = $('consigneePicker');
    picker.value = call('getAddressBook')[0].id;
    call('pickContact', picker, 'consignee');
    expect($('consigneeName').value).toBe('Pick Me');
    expect($('consigneeAddress1').value).toBe('100 Pick St');
    expect($('consigneeCity').value).toBe('Pretoria');
  });
});

// ============================================================
// Address Book Search
// ============================================================
describe('Address book search', () => {
  beforeEach(async () => {
    call('setAddressBook', []);
    await signInCloudTest();
  });

  test('search input exists', () => {
    expect($('addressBookSearch')).not.toBeNull();
  });

  test('search filters entries', async () => {
    // Add two contacts
    $('shipperName').value = 'Alice Smith';
    setPartyAddress('shipper', { address1: '1 Main St', city: 'Cape Town' });
    await call('saveToAddressBook', 'shipper');
    $('shipperName').value = 'Bob Jones';
    setPartyAddress('shipper', { address1: '2 Oak Ave', city: 'Durban' });
    await call('saveToAddressBook', 'shipper');
    expect(call('getAddressBook').length).toBe(2);

    // Search for Alice
    $('addressBookSearch').value = 'alice';
    call('renderAddressBook');
    const entries = env.document.querySelectorAll('.address-book-entry');
    expect(entries.length).toBe(1);
    expect(entries[0].textContent).toContain('Alice Smith');
  });

  test('empty search shows all entries', async () => {
    $('shipperName').value = 'Contact A';
    setPartyAddress('shipper', { address1: 'Addr A' });
    await call('saveToAddressBook', 'shipper');
    $('shipperName').value = 'Contact B';
    setPartyAddress('shipper', { address1: 'Addr B' });
    await call('saveToAddressBook', 'shipper');

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
  beforeEach(async () => {
    call('setAddressBook', []);
    await signInCloudTest();
  });

  test('exportAddressBook toasts when empty', async () => {
    await call('exportAddressBook');
    const toast = env.document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('empty');
  });
});

// ============================================================
// PDF Download
// ============================================================
describe('PDF download', () => {
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
  test('shipper fields start blank', () => {
    expect($('shipperName').value).toBe('');
    expect($('shipperPhone').value).toBe('');
    expect($('shipperEmail').value).toBe('');
  });

  test('consignee fields start blank', () => {
    expect($('consigneeName').value).toBe('');
    expect($('consigneePhone').value).toBe('');
    expect($('consigneeEmail').value).toBe('');
  });

  test('importer fields start blank', () => {
    expect($('importerName').value).toBe('');
    expect($('importerEmail').value).toBe('');
    expect($('importerTaxId').value).toBe('');
  });
});

// ============================================================
// Cloud Address Book Defaults
// ============================================================
describe('Cloud address book defaults', () => {
  test('address book starts with no seeded contacts', () => {
    const book = call('getAddressBook');
    expect(book).toEqual([]);
  });

  test('local mode keeps the address book enabled without sign-in', () => {
    expect($('addressBookSearch').disabled).toBe(false);
    expect($('shipperPicker').disabled).toBe(false);
    expect(env.document.querySelector('#addressBookList').textContent).toContain('No saved contacts');
  });

  test('local mode shows a saved locally indicator', () => {
    expect($('localSaveIndicator').classList.contains('section-hidden')).toBe(false);
    expect($('localSaveIndicator').textContent).toContain('saved locally');
  });

  test('local mode shows an explicit load local data action on the invoice page', () => {
    expect($('invoiceLocalModeBar').classList.contains('section-hidden')).toBe(false);
    expect($('invoiceLoadLocalDataBtn')).not.toBeNull();
    expect($('invoiceLoadLocalDataBtn').disabled).toBe(false);
    expect($('invoiceClearLocalDataBtn')).not.toBeNull();
    expect($('invoiceClearLocalDataBtn').disabled).toBe(false);
  });

  test('configured cloud mode disables the address book while signed out', async () => {
    await enterSignedOutCloudMode();
    expect($('addressBookSearch').disabled).toBe(true);
    expect($('shipperPicker').disabled).toBe(true);
    expect(env.document.querySelector('#addressBookList').textContent).toContain('Sign in');
  });

  test('configured cloud mode hides the invoice local data action', async () => {
    await enterSignedOutCloudMode();
    expect($('invoiceLocalModeBar').classList.contains('section-hidden')).toBe(true);
    expect($('invoiceLoadLocalDataBtn').disabled).toBe(true);
    expect($('invoiceClearLocalDataBtn').disabled).toBe(true);
  });
});

describe('Local data loader', () => {
  test('loadLocalData imports local contacts and products on demand', async () => {
    env.window.fetch = async (url) => {
      const href = String(url || '');
      if (href.includes('address-book.local.json')) {
        return {
          ok: true,
          async json() {
            return [
              {
                name: 'Repo Test Shipper',
                address1: '1 Repo Way',
                city: 'Pretoria',
                country: 'ZA',
                role_hints: ['shipper'],
                phone: '+27110000001'
              },
              {
                name: 'Repo Test Consignee',
                address1: '2 Repo Way',
                city: 'Pretoria',
                country: 'ZA',
                role_hints: ['consignee'],
                phone: '+27110000002'
              },
              {
                name: 'Repo Test Importer',
                address1: '3 Repo Way',
                city: 'Pretoria',
                country: 'ZA',
                role_hints: ['importer'],
                phone: '+27110000003'
              }
            ];
          }
        };
      }
      if (href.includes('products.local.json')) {
        return {
          ok: true,
          async json() {
            return [
              {
                name: 'Repo Test Product',
                category: 'Other',
                hs: '1234.56.78',
                unit: 99.99,
                sku: 'REPO-1',
                origin: 'ZA',
                weight: 0.5
              }
            ];
          }
        };
      }
      if (href.includes('invoice.local.json')) {
        return {
          ok: true,
          async json() {
            return {
              items: [
                {
                  qty: 2,
                  desc: 'Repo Test Invoice Product',
                  hs: '1234.56.78',
                  unit: 99.99,
                  sku: 'REPO-ROW',
                  uom: 'pcs',
                  origin: 'ZA',
                  weight: 0.5
                },
                {
                  qty: 3,
                  desc: 'Repo Test Cable',
                  hs: '2222.33.44',
                  unit: 49.5,
                  sku: '',
                  uom: 'pcs',
                  origin: 'US',
                  weight: 0.2
                }
              ]
            };
          }
        };
      }
      return { ok: false, async json() { return []; } };
    };

    await call('loadLocalData');
    const repo = call('getRepo');
    const contacts = await repo.listContacts();
    const products = await repo.listProducts();

    expect(contacts.some((entry) => entry.name === 'Repo Test Shipper')).toBe(true);
    expect(products.some((entry) => entry.name === 'Repo Test Product')).toBe(true);
    expect($('shipperName').value).toBe('Repo Test Shipper');
    expect($('consigneeName').value).toBe('Repo Test Consignee');
    expect($('importerName').value).toBe('Repo Test Importer');
    expect(env.document.querySelectorAll('#items [data-row]').length).toBe(2);
    expect(env.document.querySelector('#items [data-row] .desc').value).toBe('Repo Test Invoice Product');
  });

  test('clearLocalData removes local contacts and products after loading them', async () => {
    env.window.fetch = async (url) => {
      const href = String(url || '');
      if (href.includes('address-book.local.json')) {
        return {
          ok: true,
          async json() {
            return [
              { name: 'Repo Test Contact', address1: '1 Repo Way', city: 'Pretoria', country: 'ZA' }
            ];
          }
        };
      }
      if (href.includes('products.local.json')) {
        return {
          ok: true,
          async json() {
            return [
              { name: 'Repo Test Product', category: 'Other', hs: '1234.56.78', unit: 99.99, origin: 'ZA', weight: 0.5 }
            ];
          }
        };
      }
      if (href.includes('invoice.local.json')) {
        return {
          ok: true,
          async json() {
            return {
              items: [
                { qty: 1, desc: 'Repo Test Invoice Product', hs: '1234.56.78', unit: 99.99, origin: 'ZA', weight: 0.5 }
              ]
            };
          }
        };
      }
      return { ok: false, async json() { return []; } };
    };

    await call('loadLocalData');
    env.window.localStorage.setItem('invoice_v4', JSON.stringify({ meta: { invoice: 'TEST-123' } }));
    env.window.localStorage.setItem('invoice_history', JSON.stringify([{ id: 1 }]));
    env.window.localStorage.setItem('invoice_settings', JSON.stringify({ togIncoterms: true }));
    env.window.confirm = () => true;
    const reloadHook = jest.fn();
    env.window.__testReloadHook = reloadHook;
    await call('clearLocalData');

    const repo = call('getRepo');
    const contacts = await repo.listContacts();
    const products = await repo.listProducts();

    expect(contacts).toEqual([]);
    expect(products).toEqual([]);
    expect(env.window.localStorage.getItem('invoice_v4')).toBeNull();
    expect(env.window.localStorage.getItem('invoice_history')).toBeNull();
    expect(env.window.localStorage.getItem('invoice_settings')).toBeNull();
    expect(env.window.localStorage.getItem('invoice_clear_once')).toBe('true');
    expect($('invoiceNumber').value).toBe('');
    expect($('invoiceDate').value).toBe('');
    expect($('declarantDate').value).toBe('');
    expect(env.document.querySelectorAll('#items [data-row]').length).toBe(0);
    expect(reloadHook).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// Product Panel
// ============================================================
describe('Product panel', () => {
  test('productsPanel exists in DOM', () => {
    expect(env.document.getElementById('productsPanel')).not.toBeNull();
  });

  test('togglePanel opens and closeAllPanels closes', () => {
    call('togglePanel', 'productsPanel');
    expect(env.document.getElementById('productsPanel').classList.contains('open')).toBe(true);
    call('closeAllPanels');
    expect(env.document.getElementById('productsPanel').classList.contains('open')).toBe(false);
  });
});

// ============================================================
// Company Profile
// ============================================================
describe('Company profile', () => {
  beforeEach(async () => {
    await signInCloudTest();
  });

  test('saveCompanyProfile stores shipper defaults and can apply them to the invoice', async () => {
    $('profileName').value = 'Acme Exports';
    $('profileAddress1').value = '1 Export Way';
    $('profileCity').value = 'Johannesburg';
    $('profileCountry').value = 'ZA';
    $('profilePhone').value = '+12345';
    $('profileEmail').value = 'ops@acme.test';
    $('profileTaxId').value = 'VAT-123';

    await call('saveCompanyProfile');
    call('newInvoice');

    expect($('shipperName').value).toBe('Acme Exports');
    expect($('shipperAddress1').value).toBe('1 Export Way');
    expect($('shipperCity').value).toBe('Johannesburg');
    expect($('shipperPhone').value).toBe('+12345');
  });

  test('clearSavedCompanyProfile removes stored defaults', async () => {
    $('profileName').value = 'Acme Exports';
    $('profileAddress1').value = '1 Export Way';
    await call('saveCompanyProfile');
    await call('clearSavedCompanyProfile');

    call('newInvoice');
    expect($('shipperName').value).toBe('');
    expect($('profileName').value).toBe('');
  });

  test('company profile can link to a contact and stay in sync when enabled', async () => {
    $('shipperName').value = 'Linked Exporter';
    $('shipperAddress1').value = '1 Sync Road';
    $('shipperCity').value = 'Centurion';
    $('shipperCountry').value = 'ZA';
    await call('saveToAddressBook', 'shipper');

    const repo = call('getRepo');
    const [contact] = await repo.listContacts();
    $('profileContactPicker').value = contact.id;
    call('handleProfileContactChange');
    $('profileSyncWithContact').checked = true;
    call('handleProfileSyncToggle');
    await call('saveCompanyProfile');

    await repo.upsertContact({
      id: contact.id,
      name: 'Linked Exporter Updated',
      address1: '9 Updated Lane',
      city: 'Johannesburg',
      country: 'ZA',
      phone: '+27110000000',
      email: 'sync@example.com',
      taxId: 'VAT-999',
      role_hints: ['shipper']
    });

    expect($('profileName').value).toBe('Linked Exporter Updated');
    expect($('profileAddress1').value).toBe('9 Updated Lane');
    expect($('profileCity').value).toBe('Johannesburg');

    call('newInvoice');
    expect($('shipperName').value).toBe('Linked Exporter Updated');
    expect($('shipperAddress1').value).toBe('9 Updated Lane');
  });

  test('company profile keeps its own values when linked contact sync is off', async () => {
    $('shipperName').value = 'Standalone Exporter';
    $('shipperAddress1').value = '5 Profile Ave';
    $('shipperCity').value = 'Cape Town';
    $('shipperCountry').value = 'ZA';
    await call('saveToAddressBook', 'shipper');

    const repo = call('getRepo');
    const [contact] = await repo.listContacts();
    $('profileContactPicker').value = contact.id;
    call('handleProfileContactChange');
    $('profileSyncWithContact').checked = false;
    $('profileName').value = 'Manual Profile Name';
    await call('saveCompanyProfile');

    await repo.upsertContact({
      id: contact.id,
      name: 'Changed Contact Name',
      address1: '99 Changed Street',
      city: 'Durban',
      country: 'ZA',
      role_hints: ['shipper']
    });

    expect($('profileName').value).toBe('Manual Profile Name');
    expect($('profileAddress1').value).toBe('5 Profile Ave');
  });
});
