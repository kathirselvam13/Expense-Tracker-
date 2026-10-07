# Expense Tracker

A standalone, browser-only Next.js expense tracker. It does not use a backend, account, or database. The dropdowns use shadcn-style Radix Select components, and short-lived notifications use Sonner. The expense list can be viewed as cards or a table; both use the same filter, sort, edit, and delete actions.

## Run locally

```bash
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3002
```

Open [http://127.0.0.1:3002](http://127.0.0.1:3002). Change the port if 3002 is already in use.

## Code structure

- `app/page.tsx` renders the main dashboard.
- `components/ExpenseDashboard.tsx` owns expense data, form, filter, sort, and view-selection state.
- `components/ExpenseRecords.tsx` renders the card or table view, sharing Edit and Delete controls.
- `lib/expenses.ts` holds expense types, validation, formatting, and category totals.
- `app/globals.css` styles the dashboard, view switch, and responsive table.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

Expenses are stored in this browser under the `expense-tracker:v1` local-storage key. The running total and category summary are calculated from saved records, not stored separately. If storage is unavailable or damaged, the app pauses editing and shows recovery guidance rather than overwriting existing data.
The view selection is temporary and defaults to Cards after a refresh; it does not change the saved expense data.
