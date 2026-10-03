import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);
const schema = await readFile(new URL("../db/ui-flows.sql", import.meta.url), "utf8");
await sql.transaction(
  schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((statement) => sql.query(statement)),
);
console.log("Account and notification schema ready");
