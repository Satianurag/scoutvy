export const APP_DOMAIN = process.env.APP_DOMAIN ?? "scoutvy.satimon.com";
export const APP_URI = `https://${APP_DOMAIN}`;
export const SIWS_STATEMENT = "Sign in to Scoutvy";
export const NONCE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
