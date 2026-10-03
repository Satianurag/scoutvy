import type { SignInPayload } from "@wallet-ui/react-native-kit";
import { fetch as expoFetch } from "expo/fetch";
import type { File } from "expo-file-system";
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
  const { tokens } = await request<{ tokens: WalletToken[] }>("/api/wallet", {
    headers: authorized(session),
  });
  return tokens;
}

export async function fetchBountyTokens(session: Session): Promise<BountyToken[]> {
  const { tokens } = await request<{ tokens: BountyToken[] }>("/api/bounties/tokens", {
    headers: authorized(session),
  });
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
  area?: Coordinates;
  radiusM: number;
  mint: string;
  symbol: "SKR" | "USDC";
  decimals: number;
  amount: string;
  expiresAt: string;
  status: "open" | "cancelled" | "expired" | "paid" | "refunded";
  mine: boolean;
  distanceM: number | null;
  bountyAddress: string | null;
  signature: string | null;
  closeSignature: string | null;
  closedAt: string | null;
};

export type Review = {
  id: string;
  proofId: string;
  title: string;
  instructions: string;
  role: "poster" | "scout" | "resolver";
  status: "pending_review" | "disputed" | "paid" | "refunded" | "cancelled" | "expired";
  mint: string;
  symbol: "SKR" | "USDC";
  amount: string;
  decimals: number;
  width: number;
  height: number;
  receivedAt: string;
  deadline: string | null;
  protected: boolean;
  disputeReason: string | null;
  resolutionReason: string | null;
  signature: string | null;
  settledAt: string | null;
  retryable: boolean;
  preparedReason: string | null;
  preparedPayScout: boolean | null;
};

export type ReviewAction = "approve" | "dispute" | "resolve";

export async function recordReviewDecision(
  session: Session,
  id: string,
  action: ReviewAction,
  signature: string,
) {
  return (
    await request<{ review: Review }>(`/api/bounties?action=record-decision&id=${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { ...authorized(session), "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature }),
    })
  ).review;
}
export type Decision = {
  review: Review;
  transaction: {
    action: ReviewAction;
    bounty: string;
    poster: string;
    mint: string;
    recipient: string;
    digest: string | null;
    payScout: boolean;
  } | null;
};

export async function fetchReview(session: Session, id: string) {
  return (
    await request<{ review: Review }>(`/api/bounties?action=review&id=${encodeURIComponent(id)}`, {
      headers: authorized(session),
    })
  ).review;
}
export function proofImageSource(session: Session, id: string) {
  return {
    uri: `${API_URL}/api/bounties?action=image&id=${encodeURIComponent(id)}`,
    headers: authorized(session),
  };
}
export function prepareReviewDecision(
  session: Session,
  id: string,
  action: ReviewAction,
  reason?: string,
  payScout?: boolean,
) {
  return request<Decision>(`/api/bounties?action=${action}&id=${encodeURIComponent(id)}`, {
    method: "POST",
    headers: authorized(session),
    body: JSON.stringify({ reason, payScout }),
  });
}
export async function refreshReview(session: Session, id: string, release = false) {
  return (
    await request<{ review: Review }>(
      `/api/bounties?action=${release ? "release-reward" : "retry-settlement"}&id=${encodeURIComponent(id)}`,
      { method: "POST", headers: authorized(session) },
    )
  ).review;
}
export type ActivityEvent = {
  symbol: "SKR" | "USDC";
  decimals: number;
  id: string;
  bountyId: string;
  kind: string;
  title: string;
  at: string;
  mint: string;
  amount: string;
  mine: boolean;
};
export function fetchActivity(session: Session, before?: string) {
  return request<{ events: ActivityEvent[]; next: string | null }>(
    `/api/bounties?action=activity${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    { headers: authorized(session) },
  );
}

export type Coordinates = { latitude: number; longitude: number };

const pointQuery = (from: Coordinates | null) =>
  from ? `lat=${from.latitude.toFixed(5)}&lng=${from.longitude.toFixed(5)}` : "";

export async function fetchNearbyBounties(session: Session, from: Coordinates): Promise<BountyView[]> {
  const { bounties } = await request<{ bounties: BountyView[] }>(`/api/bounties/nearby?${pointQuery(from)}`, {
    headers: authorized(session),
  });
  return bounties;
}

export async function fetchBounty(
  session: Session,
  id: string,
  from: Coordinates | null,
): Promise<BountyView> {
  const { bounty } = await request<{ bounty: BountyView }>(
    `/api/bounties?id=${encodeURIComponent(id)}&${pointQuery(from)}`,
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

export type ProofReceipt = { id: string; status: "pending_review"; receivedAt: string };
export type ScoutState =
  | { status: "available" | "taken" | "unavailable" }
  | { status: "reserved"; bountyAddress: string; expiresAt: string }
  | { status: "accepted"; expiresAt: string; target: Coordinates; radiusM: number }
  | { status: "submitted"; proof: ProofReceipt };
export type CaptureTicket = { token: string; startedAt: string; expiresAt: string };
export type ProofMetadata = {
  token: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  locationAt: string;
  capturedAt: string;
  mocked: boolean;
};

const scoutPath = (id: string, action: string) =>
  `/api/bounties?action=${action}&id=${encodeURIComponent(id)}`;

export async function fetchScoutState(session: Session, id: string): Promise<ScoutState> {
  const { scout } = await request<{ scout: ScoutState }>(scoutPath(id, "scout"), {
    headers: authorized(session),
  });
  return scout;
}

export async function acceptBounty(session: Session, id: string): Promise<ScoutState> {
  const { scout } = await request<{ scout: ScoutState }>(scoutPath(id, "accept"), {
    method: "POST",
    headers: authorized(session),
  });
  return scout;
}

export async function prepareCapture(session: Session, id: string): Promise<CaptureTicket> {
  const { capture } = await request<{ capture: CaptureTicket }>(scoutPath(id, "capture"), {
    method: "POST",
    headers: authorized(session),
  });
  return capture;
}

export async function confirmClaim(session: Session, id: string): Promise<ScoutState> {
  return (
    await request<{ scout: ScoutState }>(scoutPath(id, "confirm-claim"), {
      method: "POST",
      headers: authorized(session),
    })
  ).scout;
}

export async function releaseClaim(session: Session, id: string) {
  return request<{ released: boolean; bountyAddress: string | null }>(scoutPath(id, "release"), {
    method: "POST",
    headers: authorized(session),
  });
}

export async function submitProof(
  session: Session,
  id: string,
  metadata: ProofMetadata,
  file: File,
): Promise<ProofReceipt> {
  const path = scoutPath(id, "proof");
  const response = await expoFetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      ...authorized(session),
      "Content-Type": "image/jpeg",
      "x-proof-metadata": JSON.stringify(metadata),
    },
    body: file,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error, path);
  }
  const { proof } = (await response.json()) as { proof: ProofReceipt };
  return proof;
}

export type MyBounty = BountyView & {
  proofStatus: "pending_review" | "disputed" | "paid" | "refunded" | null;
  scoutExpiresAt: string | null;
};
export function fetchMyBounties(session: Session, before?: string) {
  return request<{ bounties: MyBounty[]; next: string | null }>(
    `/api/bounties?action=mine${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    { headers: authorized(session) },
  );
}
export type DataRequest = { id: string; status: "pending" | "cancelled" | "completed"; createdAt: string };
export function fetchDataRequest(session: Session) {
  return request<{ request: DataRequest | null }>("/api/profile?action=data-request", {
    headers: authorized(session),
  });
}
export function changeDataRequest(session: Session, cancel = false) {
  return request<{ request?: DataRequest }>("/api/profile?action=data-request", {
    method: cancel ? "DELETE" : "POST",
    headers: authorized(session),
    body: "{}",
  });
}
export type BlockedUser = { id: string; name: string };
export function fetchBlockedUsers(session: Session) {
  return request<{ users: BlockedUser[] }>("/api/profile?action=blocked", { headers: authorized(session) });
}
export function unblockUser(session: Session, id: string) {
  return request("/api/profile?action=blocked", {
    method: "DELETE",
    headers: authorized(session),
    body: JSON.stringify({ id }),
  });
}
export function reportBounty(
  session: Session,
  id: string,
  input: { reason: string; details: string; block: boolean },
) {
  return request<{ report: { id: string } }>(`/api/bounties?action=report&id=${encodeURIComponent(id)}`, {
    method: "POST",
    headers: authorized(session),
    body: JSON.stringify(input),
  });
}
export function signOutAll(session: Session) {
  return request("/api/profile?action=sign-out-all", {
    method: "POST",
    headers: authorized(session),
    body: "{}",
  });
}
