import { getDb } from "../lib/db.js";
import { moderateReport, pendingReports } from "../lib/moderation.js";
import { ProofError } from "../lib/proof-error.js";

const [command = "list", id, action, note, ...extra] = process.argv.slice(2);
if ((command === "list" && id) || (command === "review" && (!id || !action || !note || extra.length))
  || !["list", "review"].includes(command)) {
  console.error('Usage: npm run moderate -- list | review <report-id> <dismiss|hide|restore> "reason (10–1000 characters)"');
  process.exit(1);
}
try {
  const db = getDb();
  console.log(JSON.stringify(command === "list" ? await pendingReports(db) : await moderateReport(db, id, action, note), null, 2));
} catch (error) {
  // Database connection strings and driver diagnostics must not reach the terminal.
  console.error(error instanceof ProofError ? error.code : "Moderation unavailable. Check DATABASE_URL and migrations.");
  process.exitCode = 1;
}
