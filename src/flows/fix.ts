import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { transactions } from "../db/schema.js";
import type { Merchant } from "../db/schema.js";
import {
  findOrCreateCounterparty,
  outstandingAmount,
  adjustCounterpartyBalance,
} from "../db/counterparties.js";
import { parseCorrection, type ParsedTransaction } from "../parsing/parseTranscript.js";

/** Flow A's "reply 'fix'": corrects the merchant's most recently recorded
 * transaction and returns the merchant-facing confirmation reply. Shared by
 * the CLI and the WhatsApp webhook. */
export async function fixLastTransaction(merchant: Merchant, correctionText: string): Promise<string> {
  const last = await db.query.transactions.findFirst({
    where: eq(transactions.merchantId, merchant.id),
    orderBy: [desc(transactions.id)],
    with: { counterparty: true },
  });
  if (!last) {
    return "No transaction recorded yet — nothing to fix.";
  }

  const previous: ParsedTransaction = {
    type: last.type,
    items: last.items,
    amount: last.amount,
    amountPaid: last.amountPaid,
    paymentStatus: last.paymentStatus,
    counterpartyName: last.counterparty?.name ?? null,
    replyPidgin: "",
  };

  const corrected = await parseCorrection(
    { transcript: last.rawTranscript, previous },
    correctionText,
  );

  // Undo the old outstanding-balance effect before applying the new one.
  if (last.counterpartyId) {
    await adjustCounterpartyBalance(last.counterpartyId, -outstandingAmount(last));
  }

  let counterpartyId: number | null = null;
  if (corrected.counterpartyName) {
    const counterparty = await findOrCreateCounterparty(merchant.id, corrected.counterpartyName);
    counterpartyId = counterparty.id;
    await adjustCounterpartyBalance(counterparty.id, outstandingAmount(corrected));
  }

  await db
    .update(transactions)
    .set({
      type: corrected.type,
      amount: corrected.amount,
      amountPaid: corrected.amountPaid,
      paymentStatus: corrected.paymentStatus,
      items: corrected.items,
      counterpartyId,
      rawTranscript: `${last.rawTranscript}\n[correction: ${correctionText}]`,
    })
    .where(eq(transactions.id, last.id));

  return corrected.replyPidgin;
}
