import { getBase64Decoder } from "@solana/kit";
import type { SignInPayload } from "@wallet-ui/react-native-kit";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { API_URL } from "@/constants/app-config";

const SESSION_KEY = "scoutvy-session";

export type SignInOutputBytes = {
  account: { addressBase64: string };
  signature: Uint8Array;
  signedMessage: Uint8Array;
};

export type Session = { token: string; walletAddress: string; expiresAt: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return (await response.json()) as T;
}

export function fetchSignInPayload(): Promise<SignInPayload & { nonce: string }> {
  return request("/api/auth/siws/payload", { method: "POST" });
}

// Android 15+ fails network requests made while the app is not in the foreground,
// and the wallet's result can arrive before Scoutvy is resumed.
function waitUntilActive(): Promise<void> {
  if (AppState.currentState === "active") return Promise.resolve();
  return new Promise((resolve) => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      subscription.remove();
      resolve();
    });
  });
}

export async function verifySignIn(nonce: string, output: SignInOutputBytes): Promise<Session> {
  await waitUntilActive();
  const base64 = getBase64Decoder();
  const session = await request<Session>("/api/auth/siws/verify", {
    method: "POST",
    body: JSON.stringify({
      nonce,
      signInResult: {
        address: output.account.addressBase64,
        signature: base64.decode(output.signature),
        signed_message: base64.decode(output.signedMessage),
      },
    }),
  });
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function loadSession(): Promise<Session | null> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  if (!stored) return null;
  let session: Session;
  try {
    session = JSON.parse(stored) as Session;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
  const response = await fetch(`${API_URL}/api/auth/session`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (response.status === 401) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
  return session;
}

export async function signOut(): Promise<void> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(SESSION_KEY);
  if (!stored) return;
  const { token } = JSON.parse(stored) as Session;
  await fetch(`${API_URL}/api/auth/session`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}
