import type { SignInPayload } from "@wallet-ui/react-native-kit";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { toMwaSignInResult, type SignInOutputBytes } from "@/auth/mwa-sign-in-result";
import { API_URL } from "@/constants/app-config";

const SESSION_KEY = "scoutvy-session";

export type Session = { token: string; walletAddress: string; expiresAt: string };

export type Tier =
  | { tier: "verified_seeker"; sgtMint: string }
  | { tier: "unverified"; reason: "no_sgt" | "sgt_claimed_by_another_wallet" };

export type Profile = { walletAddress: string; username: string | null };

export type WalletToken = {
  mint: string;
  symbol: "SKR" | "USDC";
  decimals: number;
  amount: string;
  usdPrice: number | null;
  priceChange24h: number | null;
};

export type UsernameStatus = "available" | "taken" | "invalid";

export type BountyToken = { mint: string; symbol: "SKR" | "USDC"; decimals: number; amount: string };

export type NewBounty = {
  title: string;
  instructions: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  radiusM: number;
  mint: string;
  amount: string;
  durationHours: number;
};

export type Bounty = Omit<NewBounty, "durationHours"> & {
  id: string;
  expiresAt: string;
  status: "pending" | "open" | "cancelled" | "expired";
  bountyAddress: string;
  signature: string | null;
  programId: string;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    path: string,
  ) {
    super(`${path} failed with ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error, path);
  }
  return (await response.json()) as T;
}

const authorized = (session: Session) => ({ Authorization: `Bearer ${session.token}` });

export function fetchSignInPayload(): Promise<SignInPayload & { nonce: string }> {
  return request("/api/auth/siws/payload", { method: "POST" });
}

// Android 15+ fails network requests made while the app is not in the foreground,
// and the wallet's result can arrive before Scoutvy is resumed.
export function waitUntilActive(): Promise<void> {
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
  const session = await request<Session>("/api/auth/siws/verify", {
    method: "POST",
    body: JSON.stringify({
      nonce,
      signInResult: toMwaSignInResult(output),
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

export function fetchTier(session: Session): Promise<Tier> {
  return request("/api/auth/tier", { headers: authorized(session) });
}

export function fetchProfile(session: Session): Promise<Profile> {
  return request("/api/profile", { headers: authorized(session) });
}

export function saveUsername(session: Session, username: string): Promise<Profile> {
  return request("/api/profile", {
    method: "PUT",
    headers: authorized(session),
    body: JSON.stringify({ username }),
  });
}

export async function checkUsername(
  session: Session,
  username: string,
  signal?: AbortSignal,
): Promise<UsernameStatus> {
  const { status } = await request<{ status: UsernameStatus }>(
    `/api/username/availability?username=${encodeURIComponent(username)}`,
    { headers: authorized(session), signal },
  );
  return status;
}

export async function fetchWalletTokens(session: Session): Promise<WalletToken[]> {
  const { tokens } = await request<{ tokens: WalletToken[] }>("/api/wallet", { headers: authorized(session) });
  return tokens;
}

export async function fetchBountyTokens(session: Session): Promise<BountyToken[]> {
  const { tokens } = await request<{ tokens: BountyToken[] }>("/api/bounties/tokens", { headers: authorized(session) });
  return tokens;
}

export async function createBounty(session: Session, bounty: NewBounty): Promise<Bounty> {
  const { bounty: created } = await request<{ bounty: Bounty }>("/api/bounties", {
    method: "POST",
    headers: authorized(session),
    body: JSON.stringify(bounty),
  });
  return created;
}

export async function confirmBounty(session: Session, id: string, signature: string): Promise<Bounty> {
  const { bounty } = await request<{ bounty: Bounty }>("/api/bounties/confirm", {
    method: "POST",
    headers: authorized(session),
    body: JSON.stringify({ id, signature }),
  });
  return bounty;
}

export type BountyView = {
  id: string;
  title: string;
  instructions: string;
  locationLabel: string;
  radiusM: number;
  mint: string;
  symbol: "SKR" | "USDC";
  decimals: number;
  amount: string;
  expiresAt: string;
  status: "open" | "cancelled" | "expired";
  mine: boolean;
  distanceM: number | null;
  bountyAddress: string | null;
  signature: string | null;
  closeSignature: string | null;
  closedAt: string | null;
};

export type Coordinates = { latitude: number; longitude: number };

const pointQuery = (from: Coordinates | null) =>
  from ? `lat=${from.latitude.toFixed(5)}&lng=${from.longitude.toFixed(5)}` : "";

export async function fetchNearbyBounties(session: Session, from: Coordinates): Promise<BountyView[]> {
  const { bounties } = await request<{ bounties: BountyView[] }>(`/api/bounties/nearby?${pointQuery(from)}`, {
    headers: authorized(session),
  });
  return bounties;
}

export async function fetchBounty(session: Session, id: string, from: Coordinates | null): Promise<BountyView> {
  const { bounty } = await request<{ bounty: BountyView }>(
    `/api/bounties/detail?id=${encodeURIComponent(id)}&${pointQuery(from)}`,
    { headers: authorized(session) },
  );
  return bounty;
}

export async function closeBounty(session: Session, id: string): Promise<BountyView> {
  const { bounty } = await request<{ bounty: BountyView }>("/api/bounties/close", {
    method: "POST",
    headers: authorized(session),
    body: JSON.stringify({ id }),
  });
  return bounty;
}
