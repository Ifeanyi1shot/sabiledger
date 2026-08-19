import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { merchants } from "./schema.js";
import type { Merchant } from "./schema.js";

const DEFAULT_PHONE = "2340000000000";
const DEFAULT_BUSINESS_NAME = "Mama Ngozi Provisions";

/** Finds the merchant for a phone number, creating one on first contact.
 * `fallbackBusinessName` is used only the first time that phone is seen. */
export async function resolveMerchantByPhone(
  phoneNumber: string,
  fallbackBusinessName: string,
): Promise<Merchant> {
  const existing = await db.query.merchants.findFirst({
    where: eq(merchants.phoneNumber, phoneNumber),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(merchants)
    .values({
      businessName: fallbackBusinessName,
      phoneNumber,
      taxpayerTier: "emerging",
      preferredLanguage: "pidgin",
    })
    .returning();
  return created;
}

/** Stands in for "who is this WhatsApp message from" for the CLI, which has
 * no inbound sender to key off of. Defaults to a demo merchant; override with
 * SABI_MERCHANT_PHONE (and SABI_MERCHANT_NAME, used only the first time that
 * phone is seen) to simulate a different merchant, e.g.:
 *   SABI_MERCHANT_PHONE=2348012345678 SABI_MERCHANT_NAME="Baba Tunde Electronics" npm run record -- "..."
 *
 * The real WhatsApp webhook doesn't need this stub — it calls
 * resolveMerchantByPhone directly with the sender's actual number.
 */
export async function resolveMerchant(): Promise<Merchant> {
  const phoneNumber = process.env.SABI_MERCHANT_PHONE?.trim() || DEFAULT_PHONE;
  const businessName =
    process.env.SABI_MERCHANT_NAME?.trim() ||
    (phoneNumber === DEFAULT_PHONE ? DEFAULT_BUSINESS_NAME : `Merchant ${phoneNumber}`);
  return resolveMerchantByPhone(phoneNumber, businessName);
}
