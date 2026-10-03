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

Verified with Agave 4.3.0, platform-tools v1.57 and the committed Cargo.lock
(Anchor 1.2.0). Pass `-- --locked` to preserve the dependency lock during builds.

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

For an **upgrade** of the existing Devnet program, `--program-id` accepts its public
address; a new program keypair is unnecessary. Keep an explicit private buffer key
so interrupted uploads can be resumed, and preserve the previous deployed binary:

```bash
solana program dump -u devnet -k <authority-file> BJQ94FbDBxpVEbqao6caVvK89rouxWh3cmN2xJHrswWn <backup.so>
solana program deploy -u devnet -k <authority-file> target/deploy/escrow.so \
  --program-id BJQ94FbDBxpVEbqao6caVvK89rouxWh3cmN2xJHrswWn \
  --upgrade-authority <authority-file> --buffer <buffer-file> --no-auto-extend
```

Run the local settlement checks before upgrading, then compare the downloaded
deployed binary with the build. Do not reinitialize review configuration or change
authority. Claims must expire in the future and no later than the bounty deadline;
existing active claims keep their original expiry. The API's
`SCOUTVY_LONG_CLAIMS_ENABLED=true` gate enables full-deadline written-bounty
acceptance only after the compatible contract has been deployed and verified.
