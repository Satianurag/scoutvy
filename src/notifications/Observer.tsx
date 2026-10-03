import { useEffect } from "react";
import { router } from "expo-router";
import { AppState } from "react-native";
import type { NotificationResponse } from "expo-notifications";
import { useSession } from "@/auth/session-context";
import { notificationSdk, pushProjectId } from "./service";
export function NotificationObserver() {
  const { session, onboarded } = useSession();
  useEffect(() => {
    if (!session || !onboarded || !pushProjectId()) return;
    let active = true;
    let remove: (() => void) | undefined;
    void notificationSdk()
      .then(async (sdk) => {
        if (!active) return;
        sdk.setNotificationHandler({
          handleNotification: async (notification) => ({
            shouldPlaySound: notification.request.content.data?.wallet === session.walletAddress,
            shouldSetBadge: false,
            shouldShowBanner: notification.request.content.data?.wallet === session.walletAddress,
            shouldShowList: notification.request.content.data?.wallet === session.walletAddress,
          }),
        });
        let pending: { id: string; review: boolean } | null = null;
        const seen = new Set<string>();
        const navigate = () => {
          if (!active || !pending || AppState.currentState !== "active") return;
          const target = pending;
          pending = null;
          router.push({
            pathname: target.review ? "/review/[id]" : "/bounty/[id]",
            params: { id: target.id },
          });
          void sdk.clearLastNotificationResponseAsync();
        };
        const open = (response: NotificationResponse | null) => {
          if (!active || !response) return;
          const key = response.notification.request.identifier;
          if (seen.has(key)) return;
          seen.add(key);
          const data = response.notification.request.content.data;
          if (
            !data ||
            data.wallet !== session.walletAddress ||
            typeof data.bountyId !== "string" ||
            !/^[0-9a-f-]{36}$/i.test(data.bountyId)
          )
            return;
          pending = { id: data.bountyId, review: data.review === true };
          navigate();
        };
        const subscription = sdk.addNotificationResponseReceivedListener(open);
        const state = AppState.addEventListener("change", navigate);
        remove = () => {
          subscription.remove();
          state.remove();
        };
        open(await sdk.getLastNotificationResponseAsync());
      })
      .catch(() => {});
    return () => {
      active = false;
      remove?.();
    };
  }, [session, onboarded]);
  return null;
}
