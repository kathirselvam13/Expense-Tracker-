import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryTotals,
  isValidDate,
  parseExpenses,
  validateForm,
} from "../lib/expenses.ts";

test("form validation converts decimal rupees to integer paise", () => {
  assert.equal(
    validateForm({ amount: "78.50", category: "Food", date: "2026-10-07" })
      .amountPaise,
    7850,
  );
  assert.ok(
    validateForm({ amount: "12.345", category: "Food", date: "2026-10-07" })
      .errors.amount,
  );
});

test("calendar date validation rejects impossible dates", () => {
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2028-02-29"), true);
});

test("saved records reject invalid or duplicate entries", () => {
  const expense = {
    id: "one",
    amountPaise: 500,
    category: "Food",
    date: "2026-10-07",
  };
  assert.deepEqual(parseExpenses(JSON.stringify([expense])), [expense]);
  assert.throws(() => parseExpenses(JSON.stringify([expense, expense])));
  assert.throws(() => parseExpenses("not-json"));
});

test("category totals use every expense", () => {
  const rows = [
    { id: "1", amountPaise: 100, category: "Food", date: "2026-10-07" },
    { id: "2", amountPaise: 250, category: "Food", date: "2026-10-07" },
    { id: "3", amountPaise: 200, category: "Transport", date: "2026-10-07" },
  ];
  assert.deepEqual(categoryTotals(rows).map(({ category, amountPaise }) => [category, amountPaise]), [
    ["Food", 350],
    ["Transport", 200],
  ]);
});
