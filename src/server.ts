import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolveMerchantByPhone } from "./db/merchant.js";
import type { Merchant } from "./db/schema.js";
import { recordTransaction } from "./flows/record.js";
import { fixLastTransaction } from "./flows/fix.js";
import { weeklySummary } from "./flows/summary.js";
import { sendWhatsAppMessage, parseInboundWebhook, verifyWebhookSignature } from "./channels/whatsapp.js";

const PORT = Number(process.env.PORT) || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Routes one inbound WhatsApp text to the right flow (fix / summary /
 * record) and returns the reply to send back. */
async function handleInboundMessage(from: string, text: string, profileName?: string): Promise<string> {
  const merchant: Merchant = await resolveMerchantByPhone(from, profileName || `Merchant ${from}`);
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "summary") {
    return weeklySummary(merchant);
  }
  if (lower.startsWith("fix")) {
    const correctionText = trimmed.slice("fix".length).replace(/^[\s:,-]+/, "");
    if (!correctionText) {
      return "Reply 'fix' followed by what's wrong, e.g. \"fix na two bag rice, not three\".";
    }
    return fixLastTransaction(merchant, correctionText);
  }
  return recordTransaction(merchant, trimmed);
}

function handleVerification(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(challenge);
  } else {
    res.writeHead(403);
    res.end();
  }
}

async function handleInboundWebhook(req: IncomingMessage, res: ServerResponse) {
  const rawBody = await readBody(req);
  const signatureHeader = req.headers["x-hub-signature-256"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!verifyWebhookSignature(rawBody, signature)) {
    res.writeHead(401);
    res.end();
    return;
  }

  // Meta expects a fast 200 and retries (duplicate-delivering) on timeout —
  // ack immediately, then parse Claude + send the reply asynchronously.
  res.writeHead(200);
  res.end();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    console.error("Webhook: invalid JSON body");
    return;
  }

  for (const message of parseInboundWebhook(payload)) {
    handleInboundMessage(message.from, message.text, message.profileName)
      .then((reply) => sendWhatsAppMessage(message.from, reply))
      .catch((err) => console.error(`Webhook: failed to handle message from ${message.from}:`, err));
  }
}

const server = createServer((req, res) => {
  Promise.resolve()
    .then(async () => {
      if (req.method === "GET" && req.url?.startsWith("/webhook")) {
        return handleVerification(req, res);
      }
      if (req.method === "POST" && req.url?.startsWith("/webhook")) {
        return handleInboundWebhook(req, res);
      }
      res.writeHead(404);
      res.end();
    })
    .catch((err) => {
      console.error("Webhook: unhandled error", err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end();
      }
    });
});

server.listen(PORT, () => {
  console.log(`SabiLedger webhook server listening on port ${PORT}`);
});
