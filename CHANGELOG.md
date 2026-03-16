# Changelog

## v5.3 — 2026-03-16 — Print Fix & Offline PDF

### Fixed
- **Duplicate parties in print** — shipper, consignee, and importer no longer appear twice (interactive form is now hidden, only the clean print block renders)
- **"Same as Consignee" checkbox hidden in print** — no longer visible in print or PDF output
- **Meta fields cleaned up in print** — invoice number, date, AWB, and currency now render inside the print block without dropdown arrows or input borders; incoterms and reason only appear in the shipment details bar
- **PDF generation works offline** — html2canvas and jsPDF bundled locally in `lib/` instead of loaded from CDN, so PDF export works on `file://` without internet

### Changed
- Print layout now renders entirely from `#printBlock` — interactive form sections (`.meta`, `.parties`, `.shipment-details`, `.itemsWrap`, `.totals`, `.declaration`) are all hidden via `@media print`
- `buildPrintBlock()` now generates title and meta header (invoice no, date, AWB, currency, shipment ref)
- CDN `<script>` tags replaced with local `lib/html2canvas.min.js` and `lib/jspdf.umd.min.js`
- Cache-busted to `v=5.3`

## v5.2 — 2026-03-16 — Side Panels, Sticky Toolbar & Product Browser

### Added
- **Sticky toolbar** — stays fixed at the top of the page when scrolling
- **Product catalogue panel** — browsable by category with search, HS codes, origin, prices, and one-click "+ Add" buttons
- **Contacts panel** — address book separated from settings into its own dedicated panel
- **Generic side panel system** — Products, Contacts, and Settings each slide in from the right; only one open at a time

### Changed
- Address textareas enlarged from 50px to 80px so full multi-line addresses display without cropping
- Settings panel trimmed to visibility toggles only (address book moved to Contacts)
- Toolbar buttons reorganised: Products | Contacts | Settings
- Side panels use shared `.side-panel` base class instead of per-panel CSS
- Cache-busted to `v=5.2`

## v5 — 2026-03-16 — Floating Settings, PDF Download & Enhanced Address Book

### Added
- **Floating settings panel** — slides in from the right as a fixed overlay (320px) with dimmed backdrop; close via × button, backdrop click, or Settings button
- **PDF download** — client-side PDF generation using html2canvas + jsPDF (loaded from CDN); respects all visibility toggles, handles multi-page invoices, names file with invoice number
- **Toast notifications** — visual feedback on save, load, delete, and export/import actions; auto-fades after 2 seconds
- **Contact picker dropdowns** on all 3 party card headers (Shipper, Consignee, Importer) for instant one-click loading from address book
- **Save Importer** button in address book (was missing; Save Shipper/Consignee already existed)
- **Address book search/filter** — type to instantly filter contacts by name, address, email, phone, or tax ID
- **Inline edit** for address book entries — click Edit to modify any saved contact in place
- **Export/Import contacts** — backup and restore address book as JSON files; merge by name on import
- **Delete confirmation** dialog before removing address book entries
- **Richer address book display** — entries show name, first line of address, phone, and email (truncated with ellipsis)

### Changed
- Settings panel restyled from push-down block to `position: fixed` right-side overlay with backdrop and close button
- `renderAddressBook()` now supports search filtering and tracks original indices for correct load/delete targeting
- Cache-busted all script/CSS tags to `v=5.1`
- Print/PDF hide rules updated to include toast, contact pickers, and settings overlay
- Test suite expanded from 95 to 119 tests covering all new features

## v4 — 2026-03-16 — DHL Customs-Compliant Redesign

### Added
- **Incoterms select** (DAP, DDP, EXW, FCA, FOB, CIF, CPT, CIP)
- **Reason for Export select** (Sale, Gift, Sample, Repair/Return, Personal Effects, Temporary Import, Other)
- **Shipment Reference** field
- **Structured party cards** replacing plain textareas:
  - Shipper/Exporter: Name, Address, Phone, Email, Tax/VAT ID
  - Consignee/Receiver: Name, Address, Phone, Email, Tax/VAT ID
  - Importer of Record: same fields + "Same as Consignee" checkbox
- **Shipment Details section**: Default Country of Origin, auto-calculated Total Weight, Number of Packages, Shipping Method (Express/Economy/Standard/Freight), Carrier (DHL/FedEx/UPS/Aramex/Other)
- **Unit of Measure (UoM)** column in items grid (pcs, kg, set, pair, box, unit)
- **Country of Origin** column in items grid (defaults from shipment-level setting)
- **Net Weight** column in items grid (per-unit, in kg)
- **Subtotal, Shipping Cost, Insurance** breakdown in totals (shipping/insurance are editable inputs)
- **Declaration section** with exportable name, signature line, and date
- **Full print block** replacing simple print table: parties → shipment details → 9-column items table → summary → declaration
- **`origin` and `weight` fields** in product catalogue for all entries
- **`DEFAULT_ORIGIN`** global in catalogue.js
- **Storage migration** from v3 (structured parties from plain strings, `soldto` → `consignee`)
- Expanded CSV export with UoM, Country of Origin, Net Weight columns and summary rows

### Changed
- Items grid expanded from 7 columns to 10 columns
- Storage key bumped from `invoice_v3` to `invoice_v4`
- Legacy key list expanded to include `invoice_v3`
- `recalcTotals()` now calculates subtotal, reads shipping/insurance inputs, computes grand total, and auto-sums total weight
- `buildPrintTable()` renamed to `buildPrintBlock()` with full structured output
- `newInvoice()` resets all new fields (incoterms, reason, carrier, method, declaration date)
- CSS grid updated for 10-column layout with select styling
- Print styles updated for structured block layout with party cards, shipment bar, and declaration

## v3 — Modular File Structure

### Added
- Split monolithic HTML into 4 files: `index.html`, `css/invoice.css`, `js/catalogue.js`, `js/invoice.js`
- Dark mode with CSS custom properties
- Invoice history panel (save/load/delete, up to 50 entries)
- CSV and JSON export
- SKU field in catalogue
- Row numbering
- Currency label in totals
- Legacy state migration from `invoice_pro_state_v2_no_vat` and `invoice_state`

### Changed
- Storage key: `invoice_v3`
- Improved print layout with proper `<thead>`/`<tbody>` table
- Responsive grid adjustments for mobile

## v1 — Original Prototype

- Single-file HTML with inline CSS and JS
- Basic catalogue with HS codes and unit prices
- 4 meta fields (Invoice No, Date, Waybill, Currency)
- 2 plain textarea addresses (Shipper, Sold To)
- 7-column items grid
- Simple grand total
- Basic print table
- LocalStorage autosave (`invoice_state`)
