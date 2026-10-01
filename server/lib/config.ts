export const APP_DOMAIN = process.env.APP_DOMAIN ?? "scoutvy.vercel.app";
export const APP_URI = `https://${APP_DOMAIN}`;
export const SIWS_STATEMENT = "Sign in to Scoutvy";
export const NONCE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SOLANA_MAINNET_RPC_URL = process.env.SOLANA_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";
export const JUPITER_API_KEY = process.env.JUPITER_API_KEY;
export const SOLANA_DEVNET_RPC_URL = process.env.SOLANA_DEVNET_RPC_URL ?? "https://api.devnet.solana.com";
