import { pgTable, serial, integer, text, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const merchants = pgTable("merchants", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull(),
  phoneNumber: text("phone_number").notNull().unique(),
  taxpayerTier: text("taxpayer_tier").notNull().default("emerging"),
  preferredLanguage: text("preferred_language").notNull().default("pidgin"),
});

export const counterparties = pgTable("counterparties", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  runningBalance: numeric("running_balance", { precision: 14, scale: 2, mode: "number" })
    .notNull()
    .default(0),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  type: text("type", { enum: ["sale", "expense"] }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 14, scale: 2, mode: "number" }).notNull(),
  paymentStatus: text("payment_status", {
    enum: ["paid", "credit", "partial"],
  }).notNull(),
  items: jsonb("items").$type<
    { name: string; quantity: number; unitPrice?: number }[]
  >().notNull(),
  counterpartyId: integer("counterparty_id").references(() => counterparties.id),
  rawTranscript: text("raw_transcript").notNull(),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  counterparty: one(counterparties, {
    fields: [transactions.counterpartyId],
    references: [counterparties.id],
  }),
}));

export type Merchant = typeof merchants.$inferSelect;
export type Counterparty = typeof counterparties.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
