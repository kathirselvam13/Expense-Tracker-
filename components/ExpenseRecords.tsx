import { Fragment } from "react";
import { UiIcon } from "@/components/UiIcon";
import { CATEGORY_META, formatDate, formatMoney } from "@/lib/expenses";
import type { Expense } from "@/lib/expenses";

export type ExpenseView = "cards" | "table";

type ExpenseRecordsProps = {
  expenses: Expense[];
  view: ExpenseView;
  pendingDeleteId: string | null;
  onEdit: (expense: Expense) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
};

function ExpenseActions({ expense, onEdit, onRequestDelete }: Pick<ExpenseRecordsProps, "onEdit" | "onRequestDelete"> & { expense: Expense }) {
  const amount = formatMoney(expense.amountPaise);

  return (
    <div className="item-actions">
      <button type="button" onClick={() => onEdit(expense)} aria-label={`Edit ${expense.category} expense of ${amount}`}>
        <UiIcon name="pencil" />Edit
      </button>
      <button type="button" className="delete-text" onClick={() => onRequestDelete(expense.id)} aria-label={`Delete ${expense.category} expense of ${amount}`}>
        <UiIcon name="trash" />Delete
      </button>
    </div>
  );
}

function DeleteConfirmation({ expense, onConfirmDelete, onCancelDelete, table = false }: Pick<ExpenseRecordsProps, "onConfirmDelete" | "onCancelDelete"> & { expense: Expense; table?: boolean }) {
  const amount = formatMoney(expense.amountPaise);

  return (
    <div className={`delete-confirm ${table ? "table-delete-confirm" : ""}`} role="group" aria-label={`Confirm deletion of ${expense.category} expense of ${amount}`}>
      <strong>Delete {expense.category} expense?</strong>
      <span>{amount} · This action cannot be undone.</span>
      <div>
        <button type="button" className="danger-button" onClick={() => onConfirmDelete(expense.id)}>Yes, delete</button>
        <button type="button" className="subtle-button" onClick={onCancelDelete}>Cancel</button>
      </div>
    </div>
  );
}

export function ExpenseRecords({ expenses, view, pendingDeleteId, onEdit, onRequestDelete, onConfirmDelete, onCancelDelete }: ExpenseRecordsProps) {
  if (view === "table") {
    return (
      <>
        <p className="table-scroll-hint">Swipe left to see amount and actions <UiIcon name="arrow-right" /></p>
        <div className="table-scroll" role="region" aria-label="Expense table" tabIndex={0}>
          <table className="expense-table">
            <caption className="sr-only">Recorded expenses</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Date</th>
                <th scope="col">Amount</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const meta = CATEGORY_META[expense.category];
                const isConfirming = pendingDeleteId === expense.id;

                return (
                  <Fragment key={expense.id}>
                    <tr>
                      <td>
                        <span className="table-category">
                          <span className="expense-symbol" style={{ backgroundColor: meta.soft }}><UiIcon name={meta.icon} /></span>
                          {expense.category}
                        </span>
                      </td>
                      <td className="table-date">{formatDate(expense.date)}</td>
                      <td className="table-amount">{formatMoney(expense.amountPaise)}</td>
                      <td><ExpenseActions expense={expense} onEdit={onEdit} onRequestDelete={onRequestDelete} /></td>
                    </tr>
                    {isConfirming && (
                      <tr className="table-confirm-row">
                        <td colSpan={4}>
                          <DeleteConfirmation expense={expense} onConfirmDelete={onConfirmDelete} onCancelDelete={onCancelDelete} table />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <ul className="expense-grid">
      {expenses.map((expense) => {
        const meta = CATEGORY_META[expense.category];
        const isConfirming = pendingDeleteId === expense.id;

        return (
          <li className={`expense-item ${isConfirming ? "expense-item-confirming" : ""}`} key={expense.id}>
            <div className="expense-item-top">
              <span className="expense-symbol" style={{ backgroundColor: meta.soft }}><UiIcon name={meta.icon} /></span>
              <span className="expense-category">{expense.category}</span>
              <span className="expense-menu-dots"><UiIcon name="menu-dots" /></span>
            </div>
            <div className="expense-item-bottom">
              <div><strong>{formatMoney(expense.amountPaise)}</strong><span>{formatDate(expense.date)}</span></div>
              <ExpenseActions expense={expense} onEdit={onEdit} onRequestDelete={onRequestDelete} />
            </div>
            {isConfirming && (
              <DeleteConfirmation expense={expense} onConfirmDelete={onConfirmDelete} onCancelDelete={onCancelDelete} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
