import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const merchants = sqliteTable("merchants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessName: text("business_name").notNull(),
  phoneNumber: text("phone_number").notNull().unique(),
  taxpayerTier: text("taxpayer_tier").notNull().default("emerging"),
  preferredLanguage: text("preferred_language").notNull().default("pidgin"),
});

export const counterparties = sqliteTable("counterparties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  runningBalance: real("running_balance").notNull().default(0),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  type: text("type", { enum: ["sale", "expense"] }).notNull(),
  amount: real("amount").notNull(),
  amountPaid: real("amount_paid").notNull(),
  paymentStatus: text("payment_status", {
    enum: ["paid", "credit", "partial"],
  }).notNull(),
  items: text("items", { mode: "json" }).$type<
    { name: string; quantity: number; unitPrice?: number }[]
  >().notNull(),
  counterpartyId: integer("counterparty_id").references(() => counterparties.id),
  rawTranscript: text("raw_transcript").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
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
