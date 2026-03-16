# Changelog

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
