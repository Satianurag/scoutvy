import { useEffect, useRef } from "react";
import { router, useRootNavigationState } from "expo-router";
import { AppState } from "react-native";
import type { NotificationResponse } from "expo-notifications";
import { useSession } from "@/auth/session-context";
import { notificationSdk, pushProjectId } from "./service";
export function NotificationObserver() {
  const { session, onboarded } = useSession();
  const navigation = useRootNavigationState();
  const wallet = session?.walletAddress;
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!pushProjectId()) return;
    let active = true;
    let remove: (() => void) | undefined;
    void notificationSdk()
      .then(async (sdk) => {
        if (!active) return;
        sdk.setNotificationHandler({
          handleNotification: async (notification) => {
            const show = active && !!wallet && onboarded && notification.request.content.data?.wallet === wallet;
            return { shouldPlaySound: show, shouldSetBadge: false, shouldShowBanner: show, shouldShowList: show };
          },
        });
        if (!wallet || !onboarded || !navigation?.key) return;
        let pending: { id: string; review: boolean } | null = null;
        const clear = () => void sdk.clearLastNotificationResponseAsync().catch(() => undefined);
        const navigate = () => {
          if (!active || !pending || AppState.currentState !== "active") return;
          const target = pending;
          pending = null;
          router.push({
            pathname: target.review ? "/review/[id]" : "/bounty/[id]",
            params: { id: target.id },
          });
          clear();
        };
        const open = (response: NotificationResponse | null) => {
          if (!active || !response || response.actionIdentifier !== sdk.DEFAULT_ACTION_IDENTIFIER) return;
          const key = response.notification.request.identifier;
          if (seen.current.has(key)) return;
          if (seen.current.size >= 100) seen.current.delete(seen.current.values().next().value!);
          seen.current.add(key);
          const data = response.notification.request.content.data;
          if (
            !data ||
            data.wallet !== wallet ||
            typeof data.bountyId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.bountyId)
          )
            { clear(); return; }
          pending = { id: data.bountyId, review: data.review === true };
          navigate();
        };
        let receivedLiveResponse = false;
        const subscription = sdk.addNotificationResponseReceivedListener((response) => {
          receivedLiveResponse = true;
          open(response);
        });
        const state = AppState.addEventListener("change", navigate);
        remove = () => {
          subscription.remove();
          state.remove();
        };
        const initial = await sdk.getLastNotificationResponseAsync();
        if (!receivedLiveResponse) open(initial);
      })
      .catch(() => {});
    return () => {
      active = false;
      remove?.();
    };
  }, [wallet, onboarded, navigation?.key]);
  return null;
}
