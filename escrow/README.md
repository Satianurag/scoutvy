# Scoutvy escrow

Anchor program that locks a bounty reward in a PDA-owned vault. Program id
`BJQ94FbDBxpVEbqao6caVvK89rouxWh3cmN2xJHrswWn`.

Instructions: create/cancel/refund a bounty; accept/release a signed scout claim;
attest proof; approve/dispute a review; resolve a dispute or release an unreviewed reward.
The claim binds the payout wallet before attestation. Protected claims cannot be replaced.

## Build

```bash
NO_DNA=1 cargo-build-sbf --manifest-path programs/escrow/Cargo.toml --sbf-out-dir target/deploy --arch v0 --tools-version v1.57
```

## Local end-to-end (Surfpool)

```bash
NO_DNA=1 surfpool start --offline --no-deploy
# In another terminal, from server/:
NO_DNA=1 npm run e2e:settlement
```

The settlement suite loads the freshly built binary and creates isolated local
SKR/USDC fixtures. It verifies signed claims, payout/refund balance changes,
authorization, deadlines, retained reviews, and closed vaults. Platform tools v1.54
produced an entrypoint access violation on this dependency set; v1.57 passed this suite.

## Devnet

```bash
solana program deploy -u devnet target/deploy/escrow.so --program-id <program keypair> -k <upgrade authority>
spl-token create-token -u devnet --decimals 6 <skr mint keypair> --fee-payer <authority> --mint-authority <authority>
```

Keypairs are never committed.
