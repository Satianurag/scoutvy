import * as SecureStore from "expo-secure-store";

export type PendingPost = { id: string; signature: string | null; lastValidBlockHeight?: string; durationHours?: number };
const key = (wallet: string) => `scoutvy-pending-post-${wallet}`;

export async function readPendingPost(wallet: string): Promise<PendingPost | null> {
  const raw = await SecureStore.getItemAsync(key(wallet));
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string"
    || !/^[0-9a-f-]{36}$/i.test(value.id) || !("signature" in value)
    || (value.signature !== null && typeof value.signature !== "string")) {
    throw new Error("Pending post could not be read");
  }
  return value as PendingPost;
}

export const savePendingPost = (wallet: string, value: PendingPost) =>
  SecureStore.setItemAsync(key(wallet), JSON.stringify(value));
export const clearPendingPost = (wallet: string) => SecureStore.deleteItemAsync(key(wallet));

/** Keep wallet diagnostics useful without logging payloads, secrets, or arbitrary error messages. */
export function logWalletFailure(error: unknown, action: "post" | "close" = "post") {
  if (!__DEV__) return;
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  console.warn(`${action}_wallet_failed`, {
    name: error instanceof Error ? error.name : "Unknown",
    code: typeof code === "number" || (typeof code === "string" && /^[A-Z_]+$/.test(code)) ? code : undefined,
  });
}
