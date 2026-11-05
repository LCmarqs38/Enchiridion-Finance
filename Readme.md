# Enchiridion — Personal Finance App

A personal finance dashboard built with React and TypeScript to help organize income, expenses, and monthly cash flow. The project focuses on simplicity, a clean dark interface, and easy access to financial information.

🔗 **Live App:** https://enchiridion-finance.vercel.app  
🔑 **Demo Credentials:** User: `Admin` | Password: `Lucas2026!`

---

## Preview

<p align="center">
  <img src="dashboard.png" width="900">
</p>

---

## Features

- **Dashboard:** Overview of total balance, monthly income, operating expenses, and net profit.
- **Charts:** Visual breakdown of monthly cash flow and expense categories using Recharts.
- **Date Filters:** Monthly and annual views with timezone-safe date handling.
- **Access Control:** Simple password-protected entry screen.
- **Data Persistence:** Uses `localStorage` with custom events to keep UI in sync.

---

## Tech Stack

- **React + TypeScript**
- **Vite**
- **Tailwind CSS**
- **Recharts** (data visualization)
- **Lucide React** (icons)

---

## Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/LCmarqs38/Enchiridion-Finance.git
   ```
2. Navigate to the folder:

```bash
cd Enchiridion-Finance
```
3. Install dependencies:

```bash
npm install
```
4. Run locally:

```bash
npm run dev
```

## Next Steps

- Implement individual user accounts and authentication.

- Add a PostgreSQL backend (Supabase) for cross-device sync.

- Add CSV and PDF export options for financial summaries.

---

Built by [Lucas Marques](https://www.linkedin.com/in/lucas-gabriel-marques-251125275/)