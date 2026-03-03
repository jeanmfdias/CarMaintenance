# Car Maintenance — Project Definition

> **Version:** 1.2
> **Date:** 2026-03-03
> **Status:** Final

---

## 1. Overview

**Car Maintenance** is a public web application that allows individual car owners to track all expenses, maintenance records, and operational data for one or more vehicles throughout their entire ownership lifecycle. The app is designed to work seamlessly on both desktop computers and smartphones.

---

## 2. Target Audience

| Attribute        | Value                                      |
|------------------|--------------------------------------------|
| Primary user     | Individual car owners                      |
| Cars per account | Multiple (no hard limit defined yet)       |
| Access model     | Public SaaS — anyone can create an account |
| Languages        | English and Portuguese (PT-BR)             |

---

## 3. Authentication

- **Method:** Magic link (passwordless) — user enters their email, receives a login link, no password required.
- Handled via **Supabase Auth**.
- Sessions persist on trusted devices; user must re-authenticate via email on new devices.

---

## 4. Vehicle Management

Each user account can hold multiple vehicles. A vehicle record contains:

| Field               | Description                                      |
|---------------------|--------------------------------------------------|
| Make                | Brand (e.g., Toyota, Ford)                       |
| Model               | Model name (e.g., Corolla, Fiesta)               |
| Manufacture year    | Year the vehicle was manufactured                |
| Model year          | Commercial model year (may differ from manuf.)   |
| Purchase date       | Date the owner acquired the car                  |
| Sell date           | Date the owner sold the car (optional)           |
| Fuel type           | Gas, Diesel, Ethanol, Flex, Electric, Hybrid     |
| Photo               | Single representative photo of the vehicle       |
| Current odometer    | Latest known mileage (updated manually)          |

### Vehicle lifecycle
- **Active:** sell date is empty — the car is currently owned.
- **Archived:** sell date is filled — the car was sold; full history remains accessible for reference.

---

## 5. Odometer / Mileage Log

- Users can manually log odometer readings at any point in time.
- Each entry records: **date** + **kilometers reading**.
- History is stored to track mileage progression over time.
- Mileage is used for maintenance interval triggers and fuel efficiency calculations.

---

## 6. Maintenance & Cost Records

### 6.1 Record categories

Every financial or maintenance event is logged as a **record** tied to a vehicle. Supported categories:

| Category           | Examples                                               |
|--------------------|--------------------------------------------------------|
| Oil change         | Engine oil + filter replacement                        |
| Tire service       | Rotation, change, alignment, balancing                 |
| Brake service      | Pads, rotors, brake fluid                              |
| General repair     | Any unplanned mechanical repair                        |
| Scheduled service  | Manufacturer-defined service intervals                 |
| Taxes & fees       | Vehicle tax, registration fees, inspections            |
| Insurance          | Policy cost, renewal tracking                          |
| Labor cost         | Workshop or mechanic labor charges                     |
| Accessories        | Parts or accessories added to the vehicle              |
| Fuel fill-up       | Fuel purchases (see Section 7)                         |
| Other              | Any expense that does not fit above categories         |

### 6.2 Record fields

Each maintenance/cost record stores:

| Field          | Description                                           |
|----------------|-------------------------------------------------------|
| Category       | One of the categories above                           |
| Date           | Date the service/expense occurred                     |
| Odometer       | Mileage at the time of the record                     |
| Total cost     | Total amount paid                                     |
| Labor cost     | Labor portion of the total cost (optional breakdown)  |
| Parts cost     | Parts/materials cost (optional breakdown)             |
| Service center | Name of the shop/mechanic (links to providers — §9)  |
| Notes          | Free-text notes about the service                     |
| Next service   | Expected date and/or mileage for the next occurrence  |

### 6.3 Maintenance intervals & reminders

- Each maintenance record can define the **next service trigger** as:
  - A future **date** (e.g., in 6 months)
  - A future **mileage** (e.g., at +10,000 km)
  - **Both** — whichever comes first triggers the reminder
- When a due date or mileage threshold is approaching, the system sends an **email reminder** to the account owner.
- Reminder lead time (e.g., "remind me 2 weeks before") is configurable per record or globally in user settings.

---

## 7. Fuel Log

Fuel fill-ups are tracked as a dedicated log (separate from generic costs but linked to the vehicle):

| Field            | Description                                     |
|------------------|-------------------------------------------------|
| Date             | Date of the fill-up                             |
| Odometer         | Mileage at fill-up                              |
| Liters            | Volume of fuel added                            |
| Total cost       | Amount paid                                     |
| Price per unit   | Auto-calculated from cost / volume              |
| Fuel type        | May differ from vehicle default (e.g., trips)  |
| Full tank?       | Whether the tank was filled to 100%             |
| Notes            | Optional notes                                  |

**Fuel efficiency calculation:**
- Computed from consecutive full-tank fill-ups: `distance ÷ volume`.
- Displayed as **L/100km** and **km/L**.
- Chart showing efficiency trend over time on the vehicle dashboard.

---

## 8. Dashboard & Reports

### 8.1 Per-vehicle dashboard
- **Cost breakdown** by category (pie/bar chart) — monthly, yearly, or all-time.
- **Cost over time** line chart — monthly total expenditure.
- **Cost per km** metric — total spend (R$) divided by distance traveled in km.
- **Upcoming maintenance** list — items due soon sorted by urgency.
- **Fuel efficiency** trend chart.
- **Odometer progress** timeline.

### 8.2 Global dashboard (all vehicles)
- Summary of total spend across all owned (and archived) vehicles.
- Side-by-side vehicle cost comparison.

### 8.3 Data export
- **PDF:** formatted maintenance history / cost report per vehicle or all vehicles.
- **CSV:** raw data export for use in spreadsheets.
- Export available from both the per-vehicle view and the global dashboard.

---

## 9. Service Providers Directory

- Users can create and maintain a personal directory of **service centers and mechanics**.
- Each provider entry includes: name, address, phone, email, website, and notes.
- When creating a maintenance record, the user can link it to a saved provider.
- Providers are private to the account (not shared publicly).

---

## 10. Insurance Policy Tracker

- Users can attach insurance policies to a vehicle.
- Each policy record stores: insurer name, policy number, start date, expiry date, annual/monthly cost, and notes.
- Policies nearing expiry generate an **email reminder** (configurable lead time).
- Insurance costs feed into the global cost dashboard.

---

## 11. Internationalization (i18n)

- The app supports **English (EN)** and **Portuguese — Brazil (PT-BR)**.
- Language is selectable per user in account settings.
- All dates and number formats adapt to the selected locale.
- **Currency:** Brazilian Real (BRL / R$) — all monetary values are stored and displayed in BRL.
- **Unit system:** Metric — distances in kilometers (km), volume in liters (L).

---

## 12. Offline / PWA Support

- The app is a **Progressive Web App (PWA)** — installable on mobile home screen.
- **Offline capability:** read-only access to cached vehicle and maintenance data.
- When connectivity is restored, the app syncs any changes from the server.
- Write operations (new records, edits) require an active internet connection.

---

## 13. Tech Stack

| Layer        | Technology                                          |
|--------------|-----------------------------------------------------|
| Frontend     | **Vue 3** (Composition API) + Vite                  |
| UI / Styling | TBD (e.g., Tailwind CSS + a component library)      |
| Backend      | **Supabase** (PostgreSQL, Auth, Storage, Edge Fns)  |
| Auth         | Supabase Auth — Magic Link (email)                  |
| Charts       | TBD (e.g., Chart.js or ApexCharts via Vue wrapper)  |
| i18n         | Vue i18n                                            |
| PWA          | Vite PWA plugin                                     |
| PDF export   | TBD (e.g., pdfmake or jsPDF)                        |
| Hosting      | TBD                                                 |

---

## 14. Monetization

- **Free forever** — no paid tiers, no subscription.
- No in-app purchases or advertising planned at launch.

---

## 15. Out of Scope (v1)

The following features were explicitly excluded from the initial version:

- File / photo attachments to maintenance records
- Sharing a car's maintenance history with external users
- Multi-user collaboration on a single vehicle
- Native mobile app (iOS / Android) — web PWA only
- OBD-II / telematics integration
- Marketplace or service booking

---

## 16. Open Questions

All initial open questions have been resolved during the design and development phase:

1. ~~Unit system preference: kilometers vs. miles (per user or per vehicle)?~~ **Resolved: metric (km, L)**
2. ~~Currency — single currency per account or per record?~~ **Resolved: BRL (R$) only**
3. ~~Exact email reminder lead times (default values).~~ **Resolved: 30 days default (configurable per record and globally in user settings)**
4. ~~Which Vue UI component library to adopt.~~ **Resolved: Vuetify 3**
5. ~~PDF/CSV export library selection.~~ **Resolved: jsPDF + jspdf-autotable (PDF); native Blob download (CSV)**
6. ~~Email reminders (maintenance + insurance expiry).~~ **Deferred to v2 — requires external email service and scheduled job; excluded from v1 scope**
7. ~~Maximum number of vehicles per free account (if any limit).~~ **Resolved: no limit**
8. ~~Hosting platform.~~ **Resolved: Vercel (frontend) + Supabase (database, auth, storage)**

---

*Document generated from product owner interview on 2026-03-03.*