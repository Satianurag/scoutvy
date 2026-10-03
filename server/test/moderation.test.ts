import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Db } from "../lib/db.js";
import { getBounty, listNearby } from "../lib/bounties.js";
import { getScoutState } from "../lib/proofs.js";
import { moderateReport, pendingReports } from "../lib/moderation.js";
import { BOUNTY_TOKENS } from "../lib/escrow.js";

test("moderation hides discovery, preserves participants and escrow, and audits restore", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    const db: Db = { async query<T>(sql: string, params: unknown[] = []) { return (await pg.query<T>(sql, params)).rows; } };
    await db.query("INSERT INTO users(wallet_address) VALUES ('poster'),('scout'),('visitor')");
    const id = randomUUID(), report = randomUUID();
    await db.query(`INSERT INTO bounties(id,poster_wallet,title,instructions,latitude,longitude,location_label,radius_m,mint,amount,expires_at,status,bounty_address)
      VALUES ($1,'poster','Photo request','Photo of the entrance',28.63,77.22,'New Delhi',100,$2,1000000,now()+interval '1 day','open','escrow-address')`, [id, BOUNTY_TOKENS[0].mint]);
    await db.query(`INSERT INTO bounty_reports(id,reporter_wallet,bounty_id,reason,details) VALUES($1,'visitor',$2,'unsafe','Reported unsafe location')`, [report,id]);
    assert.equal((await pendingReports(db)).length, 1);
    await assert.rejects(() => moderateReport(db, report, "delete", "Invalid moderation action"));
    await moderateReport(db, report, "hide", "Operator reviewed the unsafe-location report");
    const point = { latitude: 28.63, longitude: 77.22 };
    assert.deepEqual(await listNearby(db, "visitor", point), []);
    assert.equal(await getBounty(db,"visitor",id,null), null);
    assert.equal((await getBounty(db,"poster",id,null))?.hidden, true);
    assert.equal((await getScoutState(db,"visitor",id)).status, "unavailable");
    await db.query(`INSERT INTO scout_claims(bounty_id,scout_wallet,expires_at,confirmed_at) VALUES($1,'scout',now()+interval '1 hour',now())`,[id]);
    assert.equal((await getBounty(db,"scout",id,null))?.hidden, true);
    assert.equal((await getScoutState(db,"scout",id)).status, "accepted");
    assert.equal((await pendingReports(db)).length, 0);
    await moderateReport(db, report, "restore", "Operator confirmed the location is available again");
    assert.equal((await listNearby(db,"visitor",point)).length, 1);
    const [row] = await db.query<{status:string;amount:string}>("SELECT status,amount::text FROM bounties WHERE id=$1",[id]);
    assert.deepEqual(row, {status:"open",amount:"1000000"});
    const [{count}] = await db.query<{count:number}>("SELECT count(*)::int AS count FROM moderation_decisions WHERE report_id=$1",[report]);
    assert.equal(count,2);
  } finally { await pg.close(); }
});
