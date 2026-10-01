import { generateKeyPairSync, sign } from "node:crypto";
import { getAddressDecoder } from "@solana/kit";
import { createSignInMessage } from "@solana/wallet-standard-util";

// Run against `vercel dev` with SOLANA_MAINNET_RPC_URL pointing at `surfpool start --network mainnet`.
// Use a throwaway database: this binds the real SGT fixture mint to a generated test wallet.
const API = process.env.API_URL ?? "http://127.0.0.1:3000";
const SURF = process.env.SURFPOOL_RPC_URL ?? "http://127.0.0.1:8899";
const SGT = "Hg2s2QV98Bmec7ff4c1tHMUxWi21PvKc7eC7P6bG8dcR";
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

function wallet() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pk = new Uint8Array(Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url"));
  return { privateKey, pk, address: getAddressDecoder().decode(pk) };
}
async function signIn(w: ReturnType<typeof wallet>) {
  const payload = await (await fetch(`${API}/api/auth/siws/payload`, { method: "POST" })).json();
  const message = createSignInMessage({ ...payload, address: w.address });
  const res = await fetch(`${API}/api/auth/siws/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nonce: payload.nonce,
      signInResult: {
        address: Buffer.from(w.pk).toString("base64"),
        signature: sign(null, message, w.privateKey).toString("base64"),
        signed_message: Buffer.from(message).toString("base64"),
      },
    }),
  });
  if (res.status !== 200) throw new Error(`verify ${res.status}`);
  return (await res.json()).token as string;
}
async function setSgt(owner: string, amount: number) {
  const r = await fetch(SURF, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "surfnet_setTokenAccount", params: [owner, SGT, { amount, state: "initialized" }, T22] }),
  });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
}
async function tier(token?: string) {
  const r = await fetch(`${API}/api/auth/tier`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return `${r.status} ${await r.text()}`;
}

const a = wallet(), b = wallet();
const ta = await signIn(a), tb = await signIn(b);
console.log("wallet A", a.address, "\nwallet B", b.address);
console.log("1. A, no SGT:                ", await tier(ta));
await setSgt(a.address, 1);
console.log("2. A holds real SGT (fork):  ", await tier(ta));
console.log("3. A re-check:               ", await tier(ta));
await setSgt(b.address, 1);
console.log("4. B holds same SGT mint:    ", await tier(tb));
await setSgt(a.address, 0);
console.log("5. A balance set to 0:       ", await tier(ta));
console.log("6. no bearer token:          ", await tier());
console.log("7. bogus bearer token:       ", await tier("not-a-session"));
const par = await Promise.all(Array.from({ length: 10 }, () => tier(tb)));
console.log("8. 10 parallel B checks:     ", [...new Set(par)]);
