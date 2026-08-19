import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic();

export const ParsedTransactionSchema = z.object({
  type: z.enum(["sale", "expense"]),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unitPrice: z.number().optional(),
    }),
  ),
  amount: z.number().describe("Total transaction amount in Naira"),
  amountPaid: z.number().describe("Amount actually paid so far, in Naira"),
  paymentStatus: z.enum(["paid", "credit", "partial"]),
  counterpartyName: z
    .string()
    .nullable()
    .describe("Customer or supplier name, if one was mentioned"),
  replyPidgin: z
    .string()
    .describe(
      "One-sentence confirmation to send back to the merchant, in the same Pidgin/English register as the input",
    ),
});

export type ParsedTransaction = z.infer<typeof ParsedTransactionSchema>;

const RECORD_TRANSACTION_TOOL: Anthropic.Tool = {
  name: "record_transaction",
  description:
    "Record a structured sale or expense transaction extracted from a Nigerian merchant's spoken (transcribed) description.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["sale", "expense"] },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unitPrice: { type: "number" },
          },
          required: ["name", "quantity"],
        },
      },
      amount: { type: "number", description: "Total transaction amount in Naira" },
      amountPaid: { type: "number", description: "Amount actually paid so far, in Naira" },
      paymentStatus: { type: "string", enum: ["paid", "credit", "partial"] },
      counterpartyName: { type: ["string", "null"] },
      replyPidgin: {
        type: "string",
        description:
          "One-sentence confirmation to send back to the merchant, e.g. 'Recorded: 3 bags rice, N45,000 - N22,500 paid, N22,500 on credit to Mama Ngozi.'",
      },
    },
    required: [
      "type",
      "items",
      "amount",
      "amountPaid",
      "paymentStatus",
      "counterpartyName",
      "replyPidgin",
    ],
  },
};

async function callRecordTransactionTool(userPrompt: string): Promise<ParsedTransaction> {
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    tools: [RECORD_TRANSACTION_TOOL],
    tool_choice: { type: "tool", name: "record_transaction" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude did not return a record_transaction tool call");
  }

  return ParsedTransactionSchema.parse(toolUse.input);
}

/** Parses a transcribed voice-note (already text at this stage - ASR is a
 * separate open question per the PRD) into a structured transaction. */
export function parseTranscript(transcript: string): Promise<ParsedTransaction> {
  return callRecordTransactionTool(
    `Transcribed voice note from a Nigerian informal merchant (may be Pidgin, Yoruba, Hausa, Igbo, or mixed English):\n\n"${transcript}"\n\nExtract it as a transaction.`,
  );
}

/** Re-derives a transaction after the merchant says the last recording was
 * wrong. `previous` is what's currently stored; `correctionText` is what the
 * merchant said in their follow-up ("fix") message. */
export function parseCorrection(
  original: { transcript: string; previous: ParsedTransaction },
  correctionText: string,
): Promise<ParsedTransaction> {
  return callRecordTransactionTool(
    `A Nigerian informal merchant's voice note was recorded as a transaction, but they say it's wrong.\n\n` +
      `Original voice note: "${original.transcript}"\n` +
      `Recorded as: ${JSON.stringify(original.previous)}\n\n` +
      `Merchant's correction: "${correctionText}"\n\n` +
      `Produce the corrected transaction. Set replyPidgin to a one-sentence confirmation ` +
      `starting with "Updated:" that summarizes the corrected transaction.`,
  );
}
