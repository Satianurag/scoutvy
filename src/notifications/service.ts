import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Session } from "@/auth/api";
import { reportUnauthorized } from "@/auth/session-events";
import { API_URL } from "@/constants/app-config";
const TOKEN_KEY = "scoutvy-push-token";
export type PushPreferences = { reviews: boolean; rewards: boolean };
export const defaultPushPreferences: PushPreferences = { reviews: true, rewards: true };
export const notificationSdk = () => import("expo-notifications");
export const pushProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
export async function pushRequest<T>(session: Session, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}/api/profile?action=notifications`, {
    method,
    headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    if (response.status === 401) reportUnauthorized(session.token);
    throw new Error("Couldn’t update notifications");
  }
  return response.json();
}
export async function enablePush(session: Session, preferences: PushPreferences) {
  const projectId = pushProjectId();
  if (!projectId) throw new Error("Push notifications aren’t available in this build.");
  const sdk = await notificationSdk();
  if (Platform.OS === "android")
    await sdk.setNotificationChannelAsync("bounty-updates", {
      name: "Bounty updates",
      importance: sdk.AndroidImportance.HIGH,
      lightColor: "#AB9FF3",
    });
  let permission = await sdk.getPermissionsAsync();
  if (!permission.granted) permission = await sdk.requestPermissionsAsync();
  if (!permission.granted) throw new Error("Allow notifications in phone settings to continue.");
  const token = (await sdk.getExpoPushTokenAsync({ projectId })).data;
  await pushRequest(session, "POST", { token, ...preferences });
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return token;
}
export async function disablePush(session: Session) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) await pushRequest(session, "DELETE", { token });
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
/** Keep an existing opt-in attached to the current sign-in without requesting permission. */
export async function renewPush(session: Session) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return { enabled: false };
  return pushRequest<{ enabled: boolean }>(session, "POST", { token, renew: true });
}
export async function pushState(session: Session) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return { enabled: false, ...defaultPushPreferences };
  return pushRequest<{ enabled: boolean; reviews: boolean; rewards: boolean }>(session, "POST", {
    token,
    read: true,
  });
}
export async function updatePush(session: Session, preferences: PushPreferences) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new Error("Notifications are not enabled");
  await pushRequest(session, "POST", { token, ...preferences });
}
