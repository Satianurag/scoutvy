# Scoutvy escrow

Anchor program that locks a bounty reward in a PDA-owned vault. Program id
`BJQ94FbDBxpVEbqao6caVvK89rouxWh3cmN2xJHrswWn`.

Instructions: `create_bounty`, `cancel_bounty` (poster only), `refund_expired` (anyone, after expiry).

## Build

```bash
cargo-build-sbf --manifest-path programs/escrow/Cargo.toml --sbf-out-dir target/deploy --arch v0
```

## Local end-to-end (Surfpool)

```bash
surfpool start --offline
solana program deploy -u http://127.0.0.1:8899 target/deploy/escrow.so --program-id <program keypair>
# create the test SKR mint (CyM9goaWp8XqCF1hCbuE2X8nJXcTwFY36b9aWaZZbbhq) from its keypair, then:
cd ../server && node --import tsx scripts/escrow-surfpool-e2e.ts
```

## Devnet

```bash
solana program deploy -u devnet target/deploy/escrow.so --program-id <program keypair> -k <upgrade authority>
spl-token create-token -u devnet --decimals 6 <skr mint keypair> --fee-payer <authority> --mint-authority <authority>
```

Keypairs are never committed.
