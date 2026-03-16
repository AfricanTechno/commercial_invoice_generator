# Commercial Invoice Generator

A lightweight web app for creating, editing, and printing customs-compliant commercial invoices compatible with DHL, FedEx, UPS, and Aramex. No frameworks, no build tools — just open `index.html` in a browser.

## Features

- **Customs-compliant layout** — structured for DHL, FedEx, UPS, and Aramex international shipments
- **Product catalogue** with 40+ items organised in grouped categories (Eyewear, VR/Gaming, Cameras, etc.) with HS tariff codes, SKUs, country of origin, and net weights
- **Structured party cards** — Shipper/Exporter, Consignee/Receiver, and optional Importer of Record with name, address, phone, email, and Tax/VAT ID
- **Shipment details** — Default Country of Origin, auto-calculated total weight, number of packages, shipping method, and carrier selection
- **Incoterms & Reason for Export** — DAP, DDP, EXW, FCA, FOB, CIF, CPT, CIP; Sale, Gift, Sample, Repair/Return, etc.
- **10-column items grid** — Qty, Description, HS Code, Unit of Measure, Unit Price, Country of Origin, Net Weight, Line Total
- **Shipment summary** — Subtotal, editable Shipping Cost and Insurance, calculated Grand Total
- **Declaration section** — exportable statement with signature line for customs clearance
- **Auto-calculated totals** — line totals, subtotal, grand total, and total weight update live
- **Dark mode** toggle (print always stays black-on-white)
- **Invoice history** — automatically saves invoices when you create a new one; load or delete past invoices (up to 50)
- **Export** to CSV or JSON (includes all customs fields)
- **Print-ready** A4 layout with parties, shipment info, 9-column table, summary, and declaration
- **LocalStorage persistence** — your current invoice survives browser refreshes; migrates from older versions automatically
- **Responsive** layout for mobile and desktop

## Usage

Open `index.html` directly in any modern browser (`file://` works), or serve it locally:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## File Structure

```
index.html            # HTML shell — toolbar, meta fields, parties, shipment details, items grid, summary, declaration
css/
  invoice.css         # All styles: light/dark themes, print, responsive
js/
  catalogue.js        # Product data + category groupings (edit here to add products)
  invoice.js          # Application logic: state, history, export, calculations
```

## Adding Products

Edit `js/catalogue.js`:

1. Add an entry to the `CATALOGUE` object:
   ```js
   "Product Name": { hs: "1234.56.78", unit: 99.99, sku: "SKU-001", origin: "US", weight: 0.25 }
   ```
2. Add the product name to the appropriate category in `CATALOGUE_GROUPS`

## Print Output

The print layout (Cmd/Ctrl+P) produces a clean A4 document with:
- Shipper and Consignee details side by side
- Shipment details bar (origin, weight, packages, method, carrier, incoterms, reason)
- 9-column items table (no delete button)
- Summary with subtotal, shipping, insurance, and grand total
- Declaration with signature line

## Storage & Migration

The app uses `localStorage` key `invoice_v4`. It automatically migrates data from older versions (`invoice_v3`, `invoice_pro_state_v2_no_vat`, `invoice_state`), including converting plain-text address fields to the new structured party format.
