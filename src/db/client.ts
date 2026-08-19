import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import * as schema from "./schema.js";

mkdirSync("./data", { recursive: true });

const client = createClient({ url: "file:./data/sabiledger.db" });

export const db = drizzle(client, { schema });
