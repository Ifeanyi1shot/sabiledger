import { and, eq, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import { transactions } from "../db/schema.js";
import type { Merchant } from "../db/schema.js";

/** Flow C: weekly check-in totals for a merchant. Shared by the CLI and the
 * WhatsApp webhook. */
export async function weeklySummary(merchant: Merchant): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recent = await db.query.transactions.findMany({
    where: and(eq(transactions.merchantId, merchant.id), gte(transactions.createdAt, weekAgo)),
  });

  const sales = recent.filter((t) => t.type === "sale");
  const expenses = recent.filter((t) => t.type === "expense");
  const totalSales = sales.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const outstandingCredit = sales.reduce((sum, t) => sum + (t.amount - t.amountPaid), 0);

  const lines = [
    `This week: ${sales.length} sale(s), ${expenses.length} expense(s).`,
    `You don sell N${totalSales.toLocaleString()} total.`,
  ];
  if (outstandingCredit > 0) {
    lines.push(`N${outstandingCredit.toLocaleString()} still dey owe you for credit.`);
  }
  lines.push(`You don spend N${totalExpenses.toLocaleString()} for expenses.`);
  lines.push(`Net: N${(totalSales - totalExpenses).toLocaleString()}.`);
  return lines.join("\n");
}
