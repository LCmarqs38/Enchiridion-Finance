# Enchiridion — Personal Finance App

A personal finance dashboard built with React and TypeScript to help organize income, expenses, and monthly cash flow. The project focuses on simplicity, a clean dark interface, and easy access to financial information.

🔗 **Live App:** https://enchiridion-finance.vercel.app  
🔑 **Demo Credentials:** User: `Admin` | Password: `Lucas2026!`

---

## Preview

<p align="center">
  <img src="Painel Enchiridion.png" width="900">
</p>

---

### 📝 Notion-Style Notes Workspace (v1.1.0)

<p align="center">
  <img src="https://github.com/user-attachments/assets/e0242953-7aed-4675-9a52-687c298e94ec" width="900" alt="Enchiridion Notes Workspace">
</p>

- **Block-Based Rich-Text Editor:** Support for Headings (`H1`–`H3`), checklists, bulleted & numbered lists, quotes, and standard text.
- **Native Drag-and-Drop:** Seamless block reordering powered by the native HTML5 Drag and Drop API.
- **2-Column Layout:** Side-by-side editing blocks for parallel budgeting and structured notes.
- **Nested Subpages:** Deep hierarchical workspaces with breadcrumb navigation and a recursive sidebar tree.
- **Inline Floating Selection Menu:** Contextual toolbar for per-word inline styles (Bold, Italic, Underline) and distinct text/background color palettes.
- **Mobile-Ready:** Fully responsive layout with custom touch events and selection tracking.
- **Resilient Local Persistence:** Multi-tier storage fallback schema protecting notes across deployments.

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