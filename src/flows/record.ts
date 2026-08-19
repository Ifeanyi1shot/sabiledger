import { db } from "../db/client.js";
import { transactions } from "../db/schema.js";
import type { Merchant } from "../db/schema.js";
import {
  findOrCreateCounterparty,
  outstandingAmount,
  adjustCounterpartyBalance,
} from "../db/counterparties.js";
import { parseTranscript } from "../parsing/parseTranscript.js";

/** Flow A: parses a transcript into a transaction, saves it, and returns the
 * merchant-facing confirmation reply. Shared by the CLI and the WhatsApp
 * webhook so both drive the same recording logic. */
export async function recordTransaction(merchant: Merchant, transcript: string): Promise<string> {
  const parsed = await parseTranscript(transcript);

  let counterpartyId: number | null = null;
  if (parsed.counterpartyName) {
    const counterparty = await findOrCreateCounterparty(merchant.id, parsed.counterpartyName);
    counterpartyId = counterparty.id;
    await adjustCounterpartyBalance(counterparty.id, outstandingAmount(parsed));
  }

  await db.insert(transactions).values({
    merchantId: merchant.id,
    type: parsed.type,
    amount: parsed.amount,
    amountPaid: parsed.amountPaid,
    paymentStatus: parsed.paymentStatus,
    items: parsed.items,
    counterpartyId,
    rawTranscript: transcript,
  });

  return `${parsed.replyPidgin}\nReply 'fix' if this is wrong.`;
}
