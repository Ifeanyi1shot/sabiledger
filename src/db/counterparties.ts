import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { counterparties } from "./schema.js";

export async function findOrCreateCounterparty(merchantId: number, name: string) {
  const existing = await db.query.counterparties.findFirst({
    where: and(eq(counterparties.merchantId, merchantId), eq(counterparties.name, name)),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(counterparties)
    .values({ merchantId, name, runningBalance: 0 })
    .returning();
  return created;
}

/** How much of a transaction is still owed by the counterparty (0 for expenses
 * and fully-paid sales — presumptive-tax/expense-side credit isn't modeled yet). */
export function outstandingAmount(transaction: {
  type: string;
  paymentStatus: string;
  amount: number;
  amountPaid: number;
}): number {
  return transaction.type === "sale" && transaction.paymentStatus !== "paid"
    ? transaction.amount - transaction.amountPaid
    : 0;
}

export async function adjustCounterpartyBalance(counterpartyId: number, delta: number) {
  if (delta === 0) return;
  const counterparty = await db.query.counterparties.findFirst({
    where: eq(counterparties.id, counterpartyId),
  });
  if (!counterparty) return;
  await db
    .update(counterparties)
    .set({ runningBalance: counterparty.runningBalance + delta })
    .where(eq(counterparties.id, counterpartyId));
}
