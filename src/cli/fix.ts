import "dotenv/config";
import { resolveMerchant } from "../db/merchant.js";
import { fixLastTransaction } from "../flows/fix.js";

async function main() {
  const correctionText = process.argv.slice(2).join(" ").trim();
  if (!correctionText) {
    console.error('Usage: npm run fix -- "na two bag rice, not three"');
    process.exit(1);
  }

  const merchant = await resolveMerchant();
  console.log(await fixLastTransaction(merchant, correctionText));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
