# SabiLedger — core loop (milestone 1)

Mocked end-to-end slice of Flow A/C from the PRD: a transcribed voice note in,
Claude parses it into a structured transaction, it's saved to a Postgres
ledger, and a plain-language reply comes back — see `sabiledger-prd.md` for
the full architecture.

## Setup

1. Create a free [Neon](https://neon.tech/) Postgres project and copy its
   connection string.
2. ```
   npm install
   cp .env.example .env   # then paste your ANTHROPIC_API_KEY and DATABASE_URL
   npx drizzle-kit push   # creates the tables in src/db/schema.ts on your Neon database
   ```

## Usage

Record a transaction (this is standing in for an already-transcribed voice note):

```
npm run record -- "I don sell three bag rice, forty-five thousand, Mama Ngozi go pay balance next week"
```

Correct the most recently recorded transaction (Flow A's "reply 'fix'"):

```
npm run fix -- "na two bag rice, not three"
```

Weekly check-in (Flow C):

```
npm run summary
```

By default all three commands act as one demo merchant. To simulate a
different merchant (standing in for "a different phone number messaged the
bot"), set `SABI_MERCHANT_PHONE` (and `SABI_MERCHANT_NAME`, used only the
first time that phone is seen):

```
SABI_MERCHANT_PHONE=2348012345678 SABI_MERCHANT_NAME="Baba Tunde Electronics" npm run record -- "..."
```

## WhatsApp webhook (real channel)

`npm run webhook` starts an HTTP server (`src/server.ts`) that speaks the
Meta WhatsApp Cloud API directly — this is the real channel adapter the CLI
commands above were standing in for. It reuses the exact same flow logic
(`src/flows/record.ts`, `fix.ts`, `summary.ts`), so recording, correcting,
and summarizing behave identically whether triggered from the CLI or a real
WhatsApp message. The merchant is resolved from the inbound sender's phone
number (`src/db/merchant.ts`'s `resolveMerchantByPhone`), with the WhatsApp
profile name used as the business name on first contact.

Routing on the inbound message text:
- starts with `fix` → Flow A correction (rest of the message is the correction text)
- exactly `summary` → Flow C weekly check-in
- anything else → Flow A new transaction

### Setup

1. In [Meta for Developers](https://developers.facebook.com/), create an app
   with the WhatsApp product added. The **API Setup** page gives you a
   temporary access token, a test phone number, and its **Phone number ID**.
2. Copy those into `.env`:
   ```
   WHATSAPP_TOKEN=<temporary or permanent access token>
   WHATSAPP_PHONE_NUMBER_ID=<phone number id>
   WHATSAPP_VERIFY_TOKEN=<any string you make up>
   ```
3. Start the server and expose it publicly for Meta to reach (e.g. via
   [ngrok](https://ngrok.com/)):
   ```
   npm run webhook
   ngrok http 3000
   ```
4. In the app's WhatsApp > Configuration page, set the **Callback URL** to
   `https://<your-ngrok-domain>/webhook` and **Verify token** to whatever you
   put in `WHATSAPP_VERIFY_TOKEN` above, then subscribe to the `messages`
   webhook field.
5. Message the test number from WhatsApp — it should reply with the parsed
   transaction.

Once the server is reachable from the internet, also set `WHATSAPP_APP_SECRET`
(from the app's Basic Settings page) so inbound webhook calls are
signature-verified (`src/channels/whatsapp.ts`'s `verifyWebhookSignature`);
without it, anyone who finds the URL could POST fake messages.

Meta's test numbers can only message phone numbers added as testers in the
app dashboard, and tokens from the API Setup page expire after 24 hours — a
permanent token and a verified sending number are needed beyond local testing.

## What's stubbed for this milestone

- **ASR**: input is typed text, not audio — whether Claude takes audio directly
  or needs a separate ASR step is still an open question in the PRD. The
  webhook only handles WhatsApp `text` messages; voice notes are ignored.
- **Compliance engine / e-invoicing**: not built — this slice only proves out
  transcript parsing and the ledger.
