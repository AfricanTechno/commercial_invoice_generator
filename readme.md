# Commercial Invoice Generator

A lightweight web app for creating, editing, and printing A4-ready commercial invoices. No frameworks, no build tools — just open `index.html` in a browser.

## Features

- **Product catalogue** with 40+ items organised in grouped categories (Eyewear, VR/Gaming, Cameras, etc.) with HS tariff codes and SKUs
- **Auto-calculated totals** — line totals and grand total update as you type
- **Dark mode** toggle (print always stays black-on-white)
- **Invoice history** — automatically saves invoices when you create a new one; load or delete past invoices (up to 50)
- **Export** to CSV or JSON
- **Print-ready** A4 layout with clean table output via Cmd/Ctrl+P
- **LocalStorage persistence** — your current invoice survives browser refreshes
- **Responsive** layout for smaller screens

## Usage

Open `index.html` directly in any modern browser, or serve it locally:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## File Structure

```
index.html            # HTML shell — toolbar, meta fields, addresses, items grid
css/
  invoice.css         # All styles: light/dark themes, print, responsive
js/
  catalogue.js        # Product data + category groupings (edit here to add products)
  invoice.js          # Application logic: state, history, export, calculations
```

## Adding Products

Edit `js/catalogue.js`:

1. Add an entry to the `CATALOGUE` object with `hs`, `unit` (price), and `sku` fields
2. Add the product name to the appropriate category in `CATALOGUE_GROUPS`
