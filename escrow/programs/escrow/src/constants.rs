use anchor_lang::prelude::*;

pub const BOUNTY_SEED: &[u8] = b"bounty";

pub const MIN_DURATION: i64 = 60 * 60;
pub const MAX_DURATION: i64 = 30 * 24 * 60 * 60;

pub const ALLOWED_MINTS: [Pubkey; 4] = [
    // SKR (mainnet)
    pubkey!("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3"),
    // USDC (mainnet)
    pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    // SKR (devnet test mint)
    pubkey!("CyM9goaWp8XqCF1hCbuE2X8nJXcTwFY36b9aWaZZbbhq"),
    // USDC (devnet, Circle)
    pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
];
