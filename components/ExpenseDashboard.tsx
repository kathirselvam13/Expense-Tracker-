"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpenseRecords } from "@/components/ExpenseRecords";
import type { ExpenseView } from "@/components/ExpenseRecords";
import { UiIcon } from "@/components/UiIcon";
import {
  CATEGORIES,
  CATEGORY_META,
  STORAGE_KEY,
  categoryTotals,
  formatDate,
  formatMoney,
  parseExpenses,
  todayLocal,
  validateForm,
} from "@/lib/expenses";
import type { Category, Expense, ExpenseFormValues, FormErrors } from "@/lib/expenses";

type StorageStatus = "loading" | "ready" | "unavailable" | "corrupt";
type SortOrder = "newest" | "oldest" | "highest" | "lowest";

const blankForm = (date = ""): ExpenseFormValues => ({
  amount: "",
  category: "Food",
  date,
});

function readStoredExpenses():
  | { status: "ready"; expenses: Expense[] }
  | { status: "unavailable" | "corrupt" } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { status: "unavailable" };
  }

  if (raw === null) return { status: "ready", expenses: [] };
  try {
    return { status: "ready", expenses: parseExpenses(raw) };
  } catch {
    return { status: "corrupt" };
  }
}

export function ExpenseDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("loading");
  const [storageError, setStorageError] = useState("");
  const [formValues, setFormValues] = useState<ExpenseFormValues>(blankForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | "All">("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [expenseView, setExpenseView] = useState<ExpenseView>("cards");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmRecovery, setConfirmRecovery] = useState(false);
  const submitLocked = useRef(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const formCardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setFormValues((current) => ({ ...current, date: todayLocal() }));
    const result = readStoredExpenses();
    if (result.status === "ready") setExpenses(result.expenses);
    setStorageStatus(result.status);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const updated = readStoredExpenses();
      if (updated.status === "ready") {
        setExpenses(updated.expenses);
        setStorageError("");
        toast.info("Expenses updated from another tab.");
        setPendingDeleteId(null);
      } else {
        setStorageError("");
      }
      setStorageStatus(updated.status);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const totalPaise = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amountPaise, 0),
    [expenses],
  );
  const breakdown = useMemo(() => categoryTotals(expenses), [expenses]);
  const topCategory = breakdown[0];

  const visibleExpenses = useMemo(() => {
    const filtered = expenses.filter(
      (expense) => filterCategory === "All" || expense.category === filterCategory,
    );
    return filtered.sort((a, b) => {
      if (sortOrder === "oldest") return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      if (sortOrder === "highest")
        return b.amountPaise - a.amountPaise || b.date.localeCompare(a.date);
      if (sortOrder === "lowest")
        return a.amountPaise - b.amountPaise || b.date.localeCompare(a.date);
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });
  }, [expenses, filterCategory, sortOrder]);

  function retryStorage() {
    const result = readStoredExpenses();
    if (result.status === "ready") {
      setExpenses(result.expenses);
      setStorageError("");
      setConfirmRecovery(false);
    }
    setStorageStatus(result.status);
  }

  function readBeforeChange(): Expense[] | null {
    const result = readStoredExpenses();
    if (result.status !== "ready") {
      setStorageStatus(result.status);
      return null;
    }
    setExpenses(result.expenses);
    return result.expenses;
  }

  function persistExpenses(next: Expense[], message: string): boolean {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setExpenses(next);
      setStorageError("");
      toast.success(message);
      return true;
    } catch {
      setStorageError(
        "Your change could not be saved to this browser. Your previously saved expenses are still shown; please check available storage and try again.",
      );
      return false;
    }
  }

  function changeField(field: keyof ExpenseFormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function resetForm() {
    setFormValues(blankForm(todayLocal()));
    setFormErrors({});
    setEditingId(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLocked.current || storageStatus !== "ready") return;
    submitLocked.current = true;

    try {
      const { errors, amountPaise } = validateForm(formValues);
      setFormErrors(errors);
      if (Object.keys(errors).length || amountPaise === undefined) {
        if (errors.amount) amountRef.current?.focus();
        else if (errors.category) categoryRef.current?.focus();
        else if (errors.date) dateRef.current?.focus();
        return;
      }

      const latest = readBeforeChange();
      if (!latest) return;

      if (editingId) {
        if (!latest.some((expense) => expense.id === editingId)) {
          setEditingId(null);
          setStorageError("That expense was removed in another tab. No changes were saved.");
          return;
        }
        const next = latest.map((expense) =>
          expense.id === editingId
            ? {
                ...expense,
                amountPaise,
                category: formValues.category,
                date: formValues.date,
              }
            : expense,
        );
        if (persistExpenses(next, "Expense updated successfully.")) resetForm();
      } else {
        const id =
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `expense-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const next: Expense[] = [
          { id, amountPaise, category: formValues.category, date: formValues.date },
          ...latest,
        ];
        if (persistExpenses(next, "Expense added successfully.")) resetForm();
      }
    } finally {
      submitLocked.current = false;
    }
  }

  function beginEdit(expense: Expense) {
    setPendingDeleteId(null);
    setEditingId(expense.id);
    setFormValues({
      amount: (expense.amountPaise / 100).toFixed(2),
      category: expense.category,
      date: expense.date,
    });
    setFormErrors({});
    window.requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      amountRef.current?.focus({ preventScroll: true });
    });
  }

  function confirmDelete(id: string) {
    const latest = readBeforeChange();
    if (!latest) return;
    if (!latest.some((expense) => expense.id === id)) {
      setPendingDeleteId(null);
      toast.info("That expense was already removed in another tab.");
      return;
    }
    if (persistExpenses(latest.filter((expense) => expense.id !== id), "Expense deleted.")) {
      setPendingDeleteId(null);
      if (editingId === id) resetForm();
    }
  }

  function clearDamagedData() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setExpenses([]);
      resetForm();
      setStorageStatus("ready");
      setStorageError("");
      setConfirmRecovery(false);
      toast.success("Damaged local data was cleared. You can start again.");
    } catch {
      setStorageError("The damaged data could not be cleared. Please check browser storage settings.");
    }
  }

  return (
    <main className="page-wrap">
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-group">
            <span className="brand-mark" aria-hidden="true">e<span>.</span></span>
            <span className="brand-divider" aria-hidden="true" />
            <span className="brand-name">expense studio</span>
          </div>
          <div className="topbar-right">
            <span className={`local-pill ${storageStatus === "corrupt" || storageStatus === "unavailable" ? "local-pill-warning" : ""}`}>
              <span className="local-dot" />
              {storageStatus === "loading"
                ? "Checking browser storage"
                : storageStatus === "ready"
                  ? "Saved on this device"
                  : "Storage needs attention"}
            </span>
            <span className="avatar" aria-hidden="true">₹</span>
          </div>
        </header>

        <div className="page-heading">
          <div>
            <p className="eyebrow"><UiIcon name="sparkles" /> YOUR MONEY, MADE CLEAR</p>
            <h1>Expense Tracker<span className="title-period">.</span></h1>
            <p className="heading-description">A little more clarity for every rupee you spend.</p>
          </div>
          <div className="heading-badge" aria-hidden="true">
            <span className="badge-orbit badge-orbit-one" />
            <span className="badge-orbit badge-orbit-two" />
            <span className="badge-center">₹</span>
          </div>
        </div>

        {storageError && <div className="error-banner" role="alert">{storageError}</div>}

        {storageStatus === "loading" ? (
          <div className="dashboard-grid" aria-label="Loading saved expenses" aria-busy="true">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        ) : storageStatus !== "ready" ? (
          <section className="recovery-panel" role="alert">
            <span className="recovery-icon"><UiIcon name="triangle-warning" /></span>
            <p className="eyebrow">LOCAL STORAGE NEEDS ATTENTION</p>
            <h2>{storageStatus === "corrupt" ? "Saved expenses cannot be read" : "Browser storage is unavailable"}</h2>
            <p>
              {storageStatus === "corrupt"
                ? "The saved data appears damaged. Nothing has been overwritten. Try again, or explicitly clear the damaged data to start fresh."
                : "We can’t safely load or save expenses in this browser right now. Check your browser settings and try again."}
            </p>
            <div className="recovery-actions">
              <button className="dark-button" type="button" onClick={retryStorage}>Try again</button>
              {storageStatus === "corrupt" && !confirmRecovery && (
                <button className="subtle-button" type="button" onClick={() => setConfirmRecovery(true)}>Clear damaged data</button>
              )}
            </div>
            {storageStatus === "corrupt" && confirmRecovery && (
              <div className="recovery-confirm">
                <strong>Clear the damaged local data?</strong>
                <p>This cannot be undone. No existing expenses will be recovered.</p>
                <div className="recovery-actions">
                  <button className="danger-button" type="button" onClick={clearDamagedData}>Yes, clear data</button>
                  <button className="subtle-button" type="button" onClick={() => setConfirmRecovery(false)}>Cancel</button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="dashboard-grid">
              <section className="card total-card" aria-labelledby="total-title">
                <div className="card-art total-art-one" aria-hidden="true" />
                <div className="card-art total-art-two" aria-hidden="true" />
                <div className="card-kicker"><span className="small-icon"><UiIcon name="wallet" /></span> OVERVIEW</div>
                <div className="total-main">
                  <h2 id="total-title">Running total</h2>
                  <p className="total-amount">{formatMoney(totalPaise)}</p>
                  <p className="total-caption">Across all your recorded expenses</p>
                </div>
                <div className="spend-composition">
                  <div className="composition-heading"><span>Spending mix</span><span>{expenses.length ? "100%" : "0%"}</span></div>
                  <div
                    className="composition-track"
                    role="img"
                    aria-label={
                      breakdown.length
                        ? `Spending by category: ${breakdown.map((item) => `${item.category} ${formatMoney(item.amountPaise)}`).join(", ")}`
                        : "No category spending yet"
                    }
                  >
                    {breakdown.map((item) => (
                      <span
                        key={item.category}
                        className="composition-segment"
                        style={{
                          width: `${(item.amountPaise / totalPaise) * 100}%`,
                          backgroundColor: CATEGORY_META[item.category].color,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="total-footer">
                  <div><span>EXPENSES</span><strong>{expenses.length.toString().padStart(2, "0")}</strong></div>
                  <div><span>TOP CATEGORY</span><strong>{topCategory?.category ?? "—"}</strong></div>
                </div>
              </section>

              <section className="card form-card" ref={formCardRef} aria-labelledby="form-title">
                <div className="form-abstract form-abstract-one" aria-hidden="true" />
                <div className="form-abstract form-abstract-two" aria-hidden="true" />
                <div className="card-kicker"><span className="small-icon"><UiIcon name={editingId ? "pencil" : "add"} /></span> {editingId ? "EDIT ENTRY" : "NEW ENTRY"}</div>
                <h2 id="form-title">{editingId ? "Edit this expense" : "Add an expense"}</h2>
                <p className="card-description">{editingId ? "Make your changes, then save when you’re ready." : "Keep your spending in focus, one entry at a time."}</p>
                <form className="expense-form" onSubmit={handleSubmit} noValidate>
                  <div className="field-group">
                    <label htmlFor="amount">Amount</label>
                    <div className={`input-shell amount-shell ${formErrors.amount ? "field-invalid" : ""}`}>
                      <span className="currency-prefix" aria-hidden="true">₹</span>
                      <input
                        ref={amountRef}
                        id="amount"
                        name="amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        autoComplete="off"
                        value={formValues.amount}
                        onChange={(event) => changeField("amount", event.target.value)}
                        aria-invalid={Boolean(formErrors.amount)}
                        aria-describedby={formErrors.amount ? "amount-error" : undefined}
                        aria-required="true"
                      />
                    </div>
                    {formErrors.amount && <p className="field-error" id="amount-error">{formErrors.amount}</p>}
                  </div>
                  <div className="field-row">
                    <div className="field-group">
                      <label htmlFor="category">Category</label>
                      <Select
                        name="category"
                        value={formValues.category}
                        onValueChange={(value) => changeField("category", value)}
                      >
                        <SelectTrigger
                          ref={categoryRef}
                          id="category"
                          aria-invalid={Boolean(formErrors.category)}
                          aria-describedby={formErrors.category ? "category-error" : undefined}
                        >
                          <SelectValue placeholder="Choose a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((category) => <SelectItem value={category} key={category}>{category}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {formErrors.category && <p className="field-error" id="category-error">{formErrors.category}</p>}
                    </div>
                    <div className="field-group">
                      <label htmlFor="date">Date</label>
                      <input
                        ref={dateRef}
                        id="date"
                        name="date"
                        type="date"
                        value={formValues.date}
                        onChange={(event) => changeField("date", event.target.value)}
                        aria-invalid={Boolean(formErrors.date)}
                        aria-describedby={formErrors.date ? "date-error" : undefined}
                        aria-required="true"
                      />
                      {formErrors.date && <p className="field-error" id="date-error">{formErrors.date}</p>}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="dark-button submit-button" type="submit"><UiIcon name="arrow-up-right" /><span>{editingId ? "Save changes" : "Add expense"}</span></button>
                    {editingId && <button className="subtle-button" type="button" onClick={resetForm}>Cancel</button>}
                  </div>
                </form>
              </section>

              <section className="card breakdown-card" aria-labelledby="breakdown-title">
                <div className="breakdown-glow" aria-hidden="true" />
                <div className="card-kicker"><span className="small-icon"><UiIcon name="chart-pie" /></span> BREAKDOWN</div>
                <h2 id="breakdown-title">By category<span className="heading-dot">.</span></h2>
                <p className="card-description">See where your money goes at a glance.</p>
                {breakdown.length === 0 ? (
                  <div className="breakdown-empty">
                    <span className="empty-graphic" aria-hidden="true"><span /><span /><span /></span>
                    <strong>Your breakdown starts here</strong>
                    <p>Add your first expense to see the categories take shape.</p>
                  </div>
                ) : (
                  <div className="breakdown-list">
                    {breakdown.map(({ category, amountPaise }) => {
                      const share = (amountPaise / totalPaise) * 100;
                      return (
                        <div className="breakdown-item" key={category}>
                          <div className="breakdown-line">
                            <span className="category-label"><span className="category-dot" style={{ backgroundColor: CATEGORY_META[category].color }} />{category}</span>
                            <strong>{formatMoney(amountPaise)}</strong>
                          </div>
                          <div className="progress-track" aria-label={`${category}: ${Math.round(share)}% of total spending`} role="img">
                            <span style={{ width: `${share}%`, backgroundColor: CATEGORY_META[category].color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <section className="records-panel" aria-labelledby="records-title">
              <div className="records-topline">
                <div>
                  <p className="card-kicker"><span className="small-icon"><UiIcon name="list" /></span> ALL RECORDS</p>
                  <h2 id="records-title">Expenses<span className="heading-dot">.</span></h2>
                  <p className="records-count">
                    {expenses.length === 0
                      ? "Your recorded expenses will appear here."
                      : filterCategory === "All"
                        ? `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} recorded`
                        : `${visibleExpenses.length} of ${expenses.length} expenses shown`}
                  </p>
                </div>
                <div className="list-controls">
                  <div className="control-field">
                    <label htmlFor="filter-category">Filter</label>
                    <Select value={filterCategory} onValueChange={(value) => setFilterCategory(value as Category | "All")}>
                      <SelectTrigger id="filter-category"><SelectValue placeholder="All categories" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All categories</SelectItem>
                        {CATEGORIES.map((category) => <SelectItem value={category} key={category}>{category}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="control-field">
                    <label htmlFor="sort-order">Sort by</label>
                    <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                      <SelectTrigger id="sort-order"><SelectValue placeholder="Newest first" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="highest">Highest amount</SelectItem>
                        <SelectItem value="lowest">Lowest amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="view-control">
                    <span className="view-label">View</span>
                    <div className="view-switch" role="group" aria-label="Expense view">
                      <button type="button" aria-pressed={expenseView === "cards"} onClick={() => { setExpenseView("cards"); setPendingDeleteId(null); }}>
                        <UiIcon name="grid" />Cards
                      </button>
                      <button type="button" aria-pressed={expenseView === "table"} onClick={() => { setExpenseView("table"); setPendingDeleteId(null); }}>
                        <UiIcon name="table-list" />Table
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {expenses.length === 0 ? (
                <div className="records-empty">
                  <div className="records-empty-icon"><UiIcon name="receipt" /></div>
                  <h3>Nothing here yet</h3>
                  <p>Add your first expense using the form above. Your total and category breakdown will update instantly.</p>
                </div>
              ) : visibleExpenses.length === 0 ? (
                <div className="records-empty">
                  <div className="records-empty-icon"><UiIcon name="search" /></div>
                  <h3>No matching expenses</h3>
                  <p>There are no recorded expenses in {filterCategory}.</p>
                  <button className="subtle-button" type="button" onClick={() => setFilterCategory("All")}>Clear filter</button>
                </div>
              ) : (
                <ExpenseRecords
                  expenses={visibleExpenses}
                  view={expenseView}
                  pendingDeleteId={pendingDeleteId}
                  onEdit={beginEdit}
                  onRequestDelete={setPendingDeleteId}
                  onConfirmDelete={confirmDelete}
                  onCancelDelete={() => setPendingDeleteId(null)}
                />
              )}
            </section>
          </>
        )}

        <footer className="page-footer"><span>Made for a clearer picture of your spending.</span><span>Private to this browser · No account required · Uicons by <a href="https://www.flaticon.com/uicons" target="_blank" rel="noopener noreferrer">Flaticon</a></span></footer>
      </div>
    </main>
  );
}
