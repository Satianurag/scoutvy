/** Dedicated Devnet integration wallet only. No private values are logged. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createKeyPairSignerFromBytes, getAddressEncoder, signBytes } from "@solana/kit";
import { createSignInMessage } from "@solana/wallet-standard-util";
import type { SolanaSignInInput } from "@solana/wallet-standard-features";
const API = "https://scoutvy.vercel.app";
const expectedWallet = "3Tmb8gW1G6oAmvCf6ZFFD57DsbRvwFhCbA5x8j7hK7hW";
const wallet = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(await readFile(
  new URL("../../credentials/devnet-written-check-scout.json", import.meta.url), "utf8")) as number[]));
assert.equal(wallet.address, expectedWallet);
async function raw(path: string, token?: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  return fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000) });
}
async function request<T>(path: string, token?: string, body?: unknown, method?: string): Promise<T> {
  const response = await raw(path, token, body, method);
  if (!response.ok) throw new Error(`request_failed_${response.status}`);
  return response.json() as Promise<T>;
}
async function signIn() {
  const payload = await request<SolanaSignInInput & {nonce:string;domain:string}>("/api/auth/siws/payload",undefined,{});
  assert.equal(payload.domain,"scoutvy.vercel.app");
  assert.equal(payload.uri,API);
  const message = createSignInMessage({...payload,address:wallet.address});
  const signature = await signBytes(wallet.keyPair.privateKey,message);
  return request<{token:string}>("/api/auth/siws/verify",undefined,{nonce:payload.nonce,signInResult:{
    address:Buffer.from(getAddressEncoder().encode(wallet.address)).toString("base64"),
    signature:Buffer.from(signature).toString("base64"),signed_message:Buffer.from(message).toString("base64")}});
}
async function receipts(token: string) {
  const result = [];
  for (const id of ["a9fa06ae-0dab-40a4-b338-f3a9d4333d68","9bea3ab5-1ac8-4480-98db-1c853bb65917"]) {
    const {review} = await request<{review:{status:string;signature:string;protected:boolean;writtenText:string}}>(`/api/bounties?action=review&id=${id}`,token);
    assert.equal(review.status,"paid"); assert.equal(review.protected,true); assert.ok(review.signature);
    result.push({id,status:review.status,signature:review.signature,protected:review.protected,
      evidenceSha256:createHash("sha256").update(review.writtenText).digest("hex")});
  }
  return result;
}
try {
  const first = await signIn(), second = await signIn();
  const before = await receipts(first.token);
  const eligibility = await request<{eligible:boolean;retainedRecords:boolean;activeBounties:boolean}>("/api/profile?action=delete-account",first.token);
  assert.equal(eligibility.eligible,true); assert.equal(eligibility.retainedRecords,true);
  // These are operator test-wallet records. Never delete the user's Android profile.
  assert.equal(eligibility.activeBounties,false);
  await request("/api/profile",first.token,{username:"DeletionCheck3Tmb"},"PUT");
  const removed = await request<{deleted:boolean}>("/api/profile?action=delete-account",first.token,{});
  assert.equal(removed.deleted,true);
  assert.equal((await raw("/api/profile",first.token)).status,401);
  assert.equal((await raw("/api/profile",second.token)).status,401);
  const fresh = await signIn();
  const profile = await request<{username:string|null}>("/api/profile",fresh.token);
  assert.equal(profile.username,null);
  const after = await receipts(fresh.token);
  assert.deepEqual(after,before);
  await raw("/api/auth/session",fresh.token,undefined,"DELETE");
  const evidence = {verifiedAt:new Date().toISOString(),wallet:wallet.address,network:"devnet",deleted:true,
    priorSessionsRevoked:2,freshProfileHasNoUsername:true,sharedReceiptsUnchanged:true,receipts:after,
    scope:"Real public SIWS/API deletion using dedicated integration wallet; original Android account untouched; no financial transaction sent."};
  await writeFile(new URL("../../../scoutvy-ui-audit/refinement/account-deletion.json",import.meta.url),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.error(error instanceof Error && /^request_failed_\d+$/.test(error.message) ? error.message : "account_deletion_validation_failed");
  process.exitCode=1;
}
