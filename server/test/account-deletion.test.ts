import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Db } from "../lib/db.js";
import { createSession, getSessionWallet } from "../lib/session.js";
import { deleteAccount, deletionEligibility } from "../lib/account-deletion.js";

test("account deletion removes profile data and preserves financial history across every bounty state", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    await pg.exec(await readFile(new URL("../db/account-deletion.sql", import.meta.url), "utf8"));
    const db: Db = { async query<T>(sql: string, params: unknown[] = []) { return (await pg.query<T>(sql, params)).rows; } };
    await db.query("INSERT INTO users(wallet_address,username) VALUES ('empty','empty_profile'),('poster','poster_profile'),('scout','scout_profile')");
    const id = randomUUID(), report = randomUUID();
    await db.query(`INSERT INTO bounties(id,poster_wallet,title,instructions,latitude,longitude,location_label,radius_m,mint,amount,expires_at,status,bounty_address)
      VALUES ($1,'poster','Task','Requirements',28.63,77.22,'New Delhi',100,'mint',1000000,now()+interval '1 day','pending','escrow')`, [id]);
    await db.query("INSERT INTO sessions(token_hash,wallet_address,expires_at) VALUES('session','empty',now()+interval '1 day')");
    await db.query("INSERT INTO sgt_claims(mint,wallet_address) VALUES ('sgt','empty')");
    await db.query("INSERT INTO push_devices(token,wallet_address,session_hash) VALUES('push','empty','session')");
    await db.query("INSERT INTO blocked_users(id,wallet_address,blocked_wallet) VALUES($1,'poster','empty')", [randomUUID()]);
    await db.query("INSERT INTO account_data_requests(id,wallet_address) VALUES($1,'empty')", [randomUUID()]);
    await db.query("INSERT INTO bounty_reports(id,reporter_wallet,bounty_id,reason,details) VALUES($1,'empty',$2,'unsafe','Personal report text')", [report,id]);
    await db.query("INSERT INTO moderation_decisions(id,report_id,bounty_id,action,note) VALUES($1,$2,$3,'hide','Operator safety decision')", [randomUUID(),report,id]);
    assert.equal((await deletionEligibility(db,'empty')).eligible,true);
    assert.deepEqual(await deleteAccount(db,'empty'),{deleted:true});
    for (const table of ['users','sessions','sgt_claims','push_devices','account_data_requests']) {
      assert.deepEqual(await db.query(`SELECT 1 FROM ${table} WHERE wallet_address='empty'`),[]);
    }
    assert.deepEqual(await db.query("SELECT 1 FROM blocked_users WHERE blocked_wallet='empty'"),[]);
    assert.deepEqual(await db.query("SELECT reporter_wallet,details FROM bounty_reports WHERE id=$1",[report]),[{reporter_wallet:null,details:''}]);
    assert.equal((await db.query("SELECT 1 FROM moderation_decisions WHERE report_id=$1",[report])).length,1);
    for (const status of ['pending','open','paid','refunded','cancelled','expired']) {
      const session = await createSession(db,'poster');
      await db.query("UPDATE users SET username='poster_profile' WHERE wallet_address='poster'");
      await db.query("UPDATE bounties SET status=$2 WHERE id=$1",[id,status]);
      const before = await db.query("SELECT * FROM bounties WHERE id=$1",[id]);
      const eligible = await deletionEligibility(db,'poster');
      assert.equal(eligible.eligible,true);
      assert.equal(eligible.retainedRecords,true);
      assert.equal(eligible.activeBounties,status==='open');
      assert.deepEqual(eligible.bountyIds,[id]);
      assert.deepEqual(await deleteAccount(db,'poster'),{deleted:true});
      assert.equal(await getSessionWallet(db,session.token),null);
      assert.deepEqual(await db.query("SELECT * FROM bounties WHERE id=$1",[id]),before);
      assert.deepEqual(await db.query("SELECT 1 FROM users WHERE wallet_address='poster'"),[]);
      // Deletion neither pays nor refunds escrow, and cannot prevent settlement.
      await db.query("UPDATE bounties SET status='paid' WHERE id=$1",[id]);
      const fresh = await createSession(db,'poster');
      assert.equal(await getSessionWallet(db,fresh.token),'poster');
      assert.equal(await getSessionWallet(db,session.token),null);
      assert.deepEqual(await db.query("SELECT username FROM users WHERE wallet_address='poster'"),[{username:null}]);
    }
    await db.query("INSERT INTO scout_claims(bounty_id,scout_wallet,expires_at) VALUES($1,'scout',now()+interval '1 hour')",[id]);
    await db.query(`INSERT INTO bounty_proofs(id,bounty_id,scout_wallet,status,proof_type,written_text,source_sha256,evidence_sha256)
      VALUES($1,$2,'scout','paid','written','Completed the requirements',$3,$3)`,[randomUUID(),id,'a'.repeat(64)]);
    const proof = await db.query("SELECT * FROM bounty_proofs WHERE bounty_id=$1",[id]);
    await deleteAccount(db,'scout');
    assert.deepEqual(await db.query("SELECT * FROM bounty_proofs WHERE bounty_id=$1",[id]),proof);
    assert.equal((await db.query("SELECT 1 FROM scout_claims WHERE bounty_id=$1",[id])).length,1);
    await assert.rejects(()=>db.query("UPDATE scout_claims SET expires_at=now()+interval '1 day' WHERE bounty_id=$1",[id]),{code:'23503'});
    // A subsequent deployment must work while shared rows outlive their account.
    await pg.exec(await readFile(new URL("../db/ui-flows.sql", import.meta.url), "utf8"));
    const migration = await readFile(new URL("../db/account-deletion.sql", import.meta.url), "utf8");
    const statements = migration.match(/(?:[^;'$]+|'(?:[^']|'')*'|\$\$[\s\S]*?\$\$)+;/g) ?? [];
    assert.equal(statements.length,11);
    for (const sql of statements) await db.query(sql);
    assert.deepEqual(await db.query("SELECT * FROM bounty_proofs WHERE bounty_id=$1",[id]),proof);
    // A new unforeseen FK must fail the entire statement, not partly erase an account.
    await db.query("INSERT INTO users(wallet_address,username) VALUES('retained','still_here')");
    await db.query("CREATE TABLE retained_records(wallet TEXT REFERENCES users(wallet_address))");
    await db.query("INSERT INTO retained_records VALUES('retained')");
    await db.query("INSERT INTO sessions(token_hash,wallet_address,expires_at) VALUES('retained-session','retained',now()+interval '1 day')");
    await assert.rejects(()=>deleteAccount(db,'retained'));
    assert.deepEqual(await db.query("SELECT username FROM users WHERE wallet_address='retained'"),[{username:'still_here'}]);
    assert.equal((await db.query("SELECT 1 FROM sessions WHERE wallet_address='retained'")).length,1);
  } finally { await pg.close(); }
});
