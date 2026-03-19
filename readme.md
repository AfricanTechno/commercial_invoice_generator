# Commercial Invoice Generator

A lightweight web app for creating, editing, and printing customs-compliant commercial invoices compatible with DHL, FedEx, UPS, and Aramex. The invoice editor still works as a static app, and the address book can now be upgraded to a private cloud-backed mode with Supabase auth plus offline caching.

## Features

- **Customs-compliant layout** — structured for DHL, FedEx, UPS, and Aramex international shipments
- **Product catalogue** with 40+ items organised in grouped categories (Eyewear, VR/Gaming, Cameras, etc.) with HS tariff codes, SKUs, country of origin, and net weights
- **Structured party cards** — Shipper/Exporter, Consignee/Receiver, and optional Importer of Record with name, split address fields, phone, email, and Tax / VAT Number / Importer Code / ID Number
- **Shipment details** — Default Country of Origin, auto-calculated total weight, number of packages, shipping method, and carrier selection
- **Incoterms & Reason for Export** — DAP, DDP, EXW, FCA, FOB, CIF, CPT, CIP; Sale, Gift, Sample, Repair/Return, etc.
- **10-column items grid** — Qty, Description, HS Code, Unit of Measure, Unit Price, Country of Origin, Net Weight, Line Total
- **Shipment summary** — Subtotal, editable Shipping Cost and Insurance, calculated Grand Total
- **Declaration section** — exportable statement with signature line for customs clearance
- **Auto-calculated totals** — line totals, subtotal, grand total, and total weight update live
- **Sticky toolbar** — stays fixed at the top when scrolling so all actions remain accessible
- **Product catalogue panel** — browse all products by category with search, view HS codes and prices, add to invoice with one click
- **Cloud-ready address book** — private per-user contacts with sign-in, sync status, local migration prompt, backup import/export, and offline cache fallback
- **Company profile** — separate shipper defaults that can be applied to new invoices without shipping demo contacts to every user
- **Settings panel** — slide-in overlay to toggle section visibility without leaving the invoice
- **PDF download** — client-side PDF generation via html2canvas + jsPDF, bundled locally for offline use
- **Toast notifications** — visual feedback on save, load, and delete actions
- **Dark mode** toggle (print always stays black-on-white)
- **Invoice history** — automatically saves invoices when you create a new one; load or delete past invoices (up to 50)
- **Export** to CSV, JSON, or PDF (includes all customs fields)
- **Print-ready** A4 layout — clean print block with title, meta, parties, shipment bar, 9-column table, summary, and declaration (no duplicate sections or form chrome)
- **LocalStorage persistence** — your current invoice survives browser refreshes; migrates from older versions automatically
- **Responsive** layout for mobile and desktop

## Usage

Open `index.html` directly in any modern browser (`file://` works), or serve it locally:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Cloud Address Book Setup

The commercial-ready address book flow expects Supabase.

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
3. Edit [`js/app-config.js`](js/app-config.js) and set:
   - `supabaseUrl`
   - `supabaseAnonKey`
   - optional `enableSampleData`
4. Reload the app and sign in from the Contacts panel.

Notes:
- Contacts are private per signed-in user through Row Level Security.
- The app keeps an IndexedDB cache for address-book data and queued sync operations.
- Existing local-only contacts under `invoice_addressbook` trigger a one-time migration prompt after sign-in.
- In local mode only, optional private bootstrap files at `local-data/address-book.local.json`, `local-data/products.local.json`, and `local-data/invoice.local.json` are auto-imported once into the local cache or invoice state when present.

## Local Test Data

For local testing only, you can keep a private backup file outside version control.

- This repo now ignores `local-data/*.local.json`
- A local-only test file can live at `local-data/address-book.local.json`
- A local-only product file can live at `local-data/products.local.json`
- A local-only invoice seed file can live at `local-data/invoice.local.json`
- That file is meant for your machine only and should not be committed

To load your own contacts locally:

1. Copy the JSON structure shown below or start from your own exported backup.
2. Put the file anywhere convenient, for example `local-data/my-address-book.local.json`.
3. Start the app and open the Contacts panel.
4. Open `Contacts`.
5. Click `Import Backup`.
6. Select your JSON file.

To preload local test data automatically in local mode:

1. Put contacts in `local-data/address-book.local.json`.
2. Put custom products in `local-data/products.local.json`.
3. Put starter invoice rows in `local-data/invoice.local.json`.
4. Start the app with the local server.
5. On first load, the app imports those files into the browser cache automatically if present.

You can also load those same files on demand from the app by opening `Library` and clicking `Load Local Data`.

If you specifically want to test the legacy migration banner:

1. Open DevTools in the browser.
2. Run:
   ```js
   localStorage.setItem('invoice_addressbook', JSON.stringify(YOUR_CONTACT_ARRAY));
   ```
3. Reload the app.
4. If cloud sync is configured, sign in.
5. Use `Import Local Contacts` from the migration banner.

## Address Book File Format

The import/export format is a plain JSON array. Each contact is an object with these fields:

- `name`
- `address1`
- `address2`
- `city`
- `stateProvince`
- `postalCode`
- `country`
- `phone`
- `email`
- `taxId`

Example:

```json
[
  {
    "name": "Example Receiver",
    "address1": "123 Example Street",
    "address2": "Westlake Business Park",
    "city": "Cape Town",
    "stateProvince": "Western Cape",
    "postalCode": "7945",
    "country": "ZA",
    "phone": "+27 21 555 1234",
    "email": "receiver@example.com",
    "taxId": "VAT-123"
  },
  {
    "name": "Example Importer",
    "address1": "45 Harbour Road",
    "address2": "",
    "city": "Durban",
    "stateProvince": "KwaZulu-Natal",
    "postalCode": "4001",
    "country": "ZA",
    "phone": "",
    "email": "",
    "taxId": ""
  }
]
```

JSON is the best format here.

- It already matches the app’s native import/export behavior.
- It keeps each address part editable without guessing how to re-split a multiline block later.
- It is safer than CSV for addresses because CSV gets awkward once you have multiline text.
- It is still easy enough to edit in any text editor.

If someone wants the least friction, the best workflow is:

1. Create or import contacts in the app once.
2. Click `Export Backup`.
3. Edit that JSON file in a text editor.
4. Re-import it with `Import Backup`.

## File Structure

```
index.html            # HTML shell — toolbar, meta fields, parties, shipment details, items grid, summary, declaration
css/
  invoice.css         # All styles: light/dark themes, print, responsive
js/
  app-config.js       # Browser config for Supabase and demo/sample-data flags
  address-book-service.js # Cloud auth, IndexedDB cache, sync queue, company profile repository
  catalogue.js        # Product data + category groupings (edit here to add products)
  invoice.js          # Application logic: invoice state, UI, address-book wiring, calculations
lib/
  html2canvas.min.js  # PDF rendering (bundled locally for offline use)
  jspdf.umd.min.js    # PDF generation (bundled locally for offline use)
supabase/
  schema.sql          # Contacts and company_profiles tables + RLS policies
```

## Adding Products

Edit `js/catalogue.js`:

1. Add an entry to the `CATALOGUE` object:
   ```js
   "Product Name": { hs: "1234.56.78", unit: 99.99, sku: "SKU-001", origin: "US", weight: 0.25 }
   ```
2. Add the product name to the appropriate category in `CATALOGUE_GROUPS`

## Print & PDF Output

The print layout (Cmd/Ctrl+P) and PDF download both produce a clean A4 document with:
- Title, invoice number, date, AWB, and currency header
- Shipper and Consignee details side by side, Importer below (if enabled)
- Shipment details bar (origin, weight, packages, method, carrier, incoterms, reason)
- 9-column items table (no delete button or form chrome)
- Summary with subtotal, shipping, insurance, and grand total
- Declaration with signature line

All interactive form elements (dropdowns, inputs, checkboxes) are hidden in print — only clean text renders. The PDF button uses html2canvas + jsPDF bundled locally in `lib/` — no server or internet required, works on mobile and `file://`.

## Storage & Migration

- Invoice drafts still use `localStorage` key `invoice_v4`. The app automatically migrates older invoice keys (`invoice_v3`, `invoice_pro_state_v2_no_vat`, `invoice_state`).
- Address-book data no longer ships as hardcoded defaults.
- Online address-book data is cached in IndexedDB and synced to Supabase when a user is signed in.
- Older invoice state, older local address-book backups, and older Supabase rows with a single `address` field are auto-migrated into the new structured address fields on load/import.
- Legacy local contacts under `invoice_addressbook` are treated as migration data and can be imported into the cloud-backed address book once per browser.
