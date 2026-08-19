import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH_API_VERSION = "v21.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

/** Sends a plain-text WhatsApp message via the Meta Cloud API. */
export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const token = requireEnv("WHATSAPP_TOKEN");

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${res.status}): ${errText}`);
  }
}

export interface InboundMessage {
  from: string;
  text: string;
  profileName?: string;
}

/** Extracts plain-text inbound messages from a Cloud API webhook payload.
 * Non-text messages (images, statuses, reactions, etc.) are ignored for
 * this milestone — ASR/media handling is still an open question per the PRD. */
export function parseInboundWebhook(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: any })?.value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;

      const profileByWaId = new Map<string, string>();
      for (const contact of value?.contacts ?? []) {
        if (contact?.wa_id && contact?.profile?.name) {
          profileByWaId.set(contact.wa_id, contact.profile.name);
        }
      }

      for (const message of messages) {
        if (message?.type === "text" && message?.text?.body) {
          out.push({
            from: message.from,
            text: message.text.body,
            profileName: profileByWaId.get(message.from),
          });
        }
      }
    }
  }

  return out;
}

/** Verifies the X-Hub-Signature-256 header Meta signs webhook bodies with,
 * using the app secret. If WHATSAPP_APP_SECRET isn't set, verification is
 * skipped — fine for local ngrok testing, but set it before any real
 * deployment so forged webhook calls are rejected. */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
