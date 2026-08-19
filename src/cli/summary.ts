import "dotenv/config";
import { resolveMerchant } from "../db/merchant.js";
import { weeklySummary } from "../flows/summary.js";

async function main() {
  const merchant = await resolveMerchant();
  console.log(await weeklySummary(merchant));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
