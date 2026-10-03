import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState, Text } from "react-native";
import { useSession } from "@/auth/session-context";
import { BrowseSheet } from "@/components/ui/Browse";
import { FlowFooter } from "@/components/ui/Flow";
import { colors, fonts } from "@/theme";
import { subscribeWalletOperation, walletOperationBusy } from "@/wallet/operation";

/** Reconnect over the current screen; protected navigation and drafts remain mounted. */
export function SessionRecovery() {
  const { session, recoveryVisible, reauthenticating, recoveryError, reconnect, dismissRecovery,
    pushRecoveryVisible, renewingPush, retryPush, dismissPushRecovery } = useSession();
  const walletBusy = useSyncExternalStore(subscribeWalletOperation, walletOperationBusy, walletOperationBusy);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  if (!session) return null;
  if (!recoveryVisible && pushRecoveryVisible) return <BrowseSheet visible={foreground && !walletBusy}
    title="Restore bounty alerts" onClose={dismissPushRecovery}
    footer={<FlowFooter label="Retry" loading={renewingPush} onPress={() => void retryPush()}
      secondary={{ label: "Not now", onPress: dismissPushRecovery, disabled: renewingPush }} />}>
    <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary }}>
      You’re signed in. We couldn’t reconnect your saved alerts. Your updates are still in Activity.
    </Text>
  </BrowseSheet>;
  return <BrowseSheet visible={recoveryVisible && foreground && (!walletBusy || reauthenticating)}
    title="Reconnect your wallet" onClose={dismissRecovery}
    footer={<FlowFooter label={reauthenticating ? "Waiting for wallet…" : "Reconnect"}
      loading={reauthenticating} disabled={walletBusy} onPress={() => void reconnect()}
      secondary={{ label: "Not now", onPress: dismissRecovery, disabled: reauthenticating }} />}>
    <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary }}>
      Your session ended. Sign in with the same wallet to continue. Your progress stays here.
    </Text>
    {recoveryError ? <Text accessibilityLiveRegion="polite" style={{ color: colors.orange, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 }}>{recoveryError}</Text> : null}
  </BrowseSheet>;
}
