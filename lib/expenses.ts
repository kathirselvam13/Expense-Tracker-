export const STORAGE_KEY = "expense-tracker:v1";

export const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Entertainment",
  "Health",
  "Education",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Expense = {
  id: string;
  amountPaise: number;
  category: Category;
  date: string;
};

export type ExpenseFormValues = {
  amount: string;
  category: Category;
  date: string;
};

export type FormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export const CATEGORY_META: Record<
  Category,
  { icon: string; color: string; soft: string }
> = {
  Food: { icon: "utensils", color: "#79dfaa", soft: "#e9f9ee" },
  Transport: { icon: "car", color: "#b9a3eb", soft: "#f0eafb" },
  Shopping: { icon: "shopping-bag", color: "#ffbe91", soft: "#fff0e3" },
  Utilities: { icon: "bolt", color: "#f3e877", soft: "#faf8df" },
  Entertainment: { icon: "gamepad", color: "#91c9eb", soft: "#e7f4fb" },
  Health: { icon: "heart", color: "#f3a8bd", soft: "#fff0f4" },
  Education: { icon: "graduation-cap", color: "#9bd4cc", soft: "#e7f7f3" },
  Other: { icon: "apps", color: "#c8c4dc", soft: "#f1eff8" },
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((item) => item === value);
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1000 || year > 9999) return false;
  const parsed = new Date(year, month - 1, day, 12);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function validateForm(values: ExpenseFormValues): {
  errors: FormErrors;
  amountPaise?: number;
} {
  const errors: FormErrors = {};
  const amountText = values.amount.trim();
  let amountPaise: number | undefined;

  if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) {
    errors.amount = "Enter an amount with no more than two decimal places.";
  } else {
    const [whole, fractional = ""] = amountText.split(".");
    const paise = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
    if (!Number.isSafeInteger(paise) || paise <= 0) {
      errors.amount = "Enter an amount greater than ₹0.00.";
    } else {
      amountPaise = paise;
    }
  }

  if (!isCategory(values.category)) {
    errors.category = "Choose a valid category.";
  }

  if (!isValidDate(values.date)) {
    errors.date = "Choose a valid date.";
  }

  return { errors, amountPaise };
}

export function parseExpenses(raw: string): Expense[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Saved data is not a list.");

  const ids = new Set<string>();
  const expenses: Expense[] = parsed.map((item: unknown) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Saved data contains an invalid expense.");
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      row.id.length === 0 ||
      ids.has(row.id) ||
      typeof row.amountPaise !== "number" ||
      !Number.isSafeInteger(row.amountPaise) ||
      row.amountPaise <= 0 ||
      !isCategory(row.category) ||
      !isValidDate(row.date)
    ) {
      throw new Error("Saved data contains an invalid expense.");
    }
    ids.add(row.id);
    return {
      id: row.id,
      amountPaise: row.amountPaise,
      category: row.category,
      date: row.date,
    };
  });
  return expenses;
}

export function formatMoney(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatDate(date: string): string {
  if (!isValidDate(date)) return "Invalid date";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

export function categoryTotals(expenses: Expense[]) {
  return CATEGORIES.map((category) => ({
    category,
    amountPaise: expenses.reduce(
      (sum, expense) =>
        sum + (expense.category === category ? expense.amountPaise : 0),
      0,
    ),
  }))
    .filter((item) => item.amountPaise > 0)
    .sort((a, b) => b.amountPaise - a.amountPaise);
}
