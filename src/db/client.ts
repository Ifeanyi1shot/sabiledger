import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing required env var DATABASE_URL (Neon Postgres connection string)");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
