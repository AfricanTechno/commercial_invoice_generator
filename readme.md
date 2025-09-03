# Invoice App

A secure web application for creating, editing, and printing **A4-ready commercial invoices**.  
Built with **React (Vite)**, **Supabase** for authentication and data storage, and deployed on **Vercel**.

—

## Features
- **User authentication** (Supabase Auth: email magic link or password).
- **Address book** with saved contacts (Shipper / Sold To).
- **Invoice editor** with:
  - Add/remove products from a predefined list.
  - Auto-calculated line totals and invoice total.
  - Sticky headers and scrollable product table (mobile-friendly).
- **A4 print mode**: one-click print to PDF with repeating table headers.

—

## Tech Stack
- **Frontend**: React + Vite
- **Backend / DB**: Supabase (Postgres + Row Level Security)
- **Deployment**: Vercel
- **Auth**: Supabase (magic link)

—

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project with the SQL schema applied (see `/supabase/schema.sql`).

### Install & Run
```bash
npm install
npm run dev