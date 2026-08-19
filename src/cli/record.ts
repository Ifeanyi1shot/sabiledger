import "dotenv/config";
import { resolveMerchant } from "../db/merchant.js";
import { recordTransaction } from "../flows/record.js";

async function main() {
  const transcript = process.argv.slice(2).join(" ").trim();
  if (!transcript) {
    console.error(
      'Usage: npm run record -- "I don sell three bag rice, forty-five thousand, Mama Ngozi go pay balance next week"',
    );
    process.exit(1);
  }

  const merchant = await resolveMerchant();
  console.log(await recordTransaction(merchant, transcript));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
