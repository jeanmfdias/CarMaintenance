# Car Maintenance

A web app for individual car owners to track vehicle maintenance, costs, fuel, insurance, and operational data throughout the entire ownership lifecycle.

## Stack

- **Frontend:** Vue 3 + TypeScript + Vite
- **UI:** Vuetify 3 + Material Design Icons
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Auth:** Magic link (passwordless email) via Supabase Auth
- **Charts:** Chart.js via vue-chartjs
- **Export:** jsPDF + jspdf-autotable (PDF), native Blob (CSV)
- **i18n:** vue-i18n — English and PT-BR
- **PWA:** vite-plugin-pwa (read-only offline cache)
- **Hosting:** Vercel (frontend) + Supabase (backend)

## Status

Core features implemented:

- [x] Authentication (magic link)
- [x] Vehicle management (create, edit, archive, photo upload)
- [x] Odometer log
- [x] Maintenance & cost records
- [x] Fuel log with efficiency calculation (L/100km and km/L)
- [x] Insurance policy tracker
- [x] Service providers directory
- [x] Per-vehicle dashboard with charts
- [x] Data export (PDF and CSV)
- [x] Legacy data import (CSV)
- [x] User settings (language)
- [x] PWA support

Deferred to v2:

- [ ] Email reminders (maintenance due, insurance expiry)

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local and fill in your Supabase URL and anon key
```

### Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase project anon/public key |

### Run

```bash
# Development server
npm run dev

# Type-check and build for production
npm run build

# Preview the production build locally
npm run preview
```
