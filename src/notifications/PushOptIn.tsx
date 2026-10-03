import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import type { Session } from "@/auth/api";
import { Button } from "@/components/ui/Button";
import { FlowCard, flowStyles } from "@/components/ui/Flow";
import { enablePush, notificationSdk, pushProjectId, pushState } from "@/notifications/service";

/** Optional, once-per-wallet invitation after a user has a bounty to follow. */
export function PushOptIn({ session }: { session: Session }) {
  const key = `scoutvy-push-invitation-${session.walletAddress}`;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acting = useRef(false);
  useEffect(() => {
    let active = true;
    if (!pushProjectId()) return;
    void (async () => {
      if (await SecureStore.getItemAsync(key)) return;
      const saved = await pushState(session);
      const permission = await (await notificationSdk()).getPermissionsAsync();
      if (active) {
        setBlocked(!permission.granted && !permission.canAskAgain);
        setVisible(!saved.enabled || !permission.granted);
      }
    })().catch(() => undefined);
    return () => { active = false; };
  }, [key, session]);
  const dismiss = async () => {
    setVisible(false);
    await SecureStore.setItemAsync(key, "dismissed").catch(() => undefined);
  };
  const enable = async () => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(null);
    try {
      if (blocked) {
        await Linking.openSettings();
        // The registration still needs enabling after the permission changes.
        setBlocked(false);
        return;
      }
      const saved = await pushState(session);
      await enablePush(session, { reviews: saved.reviews, rewards: saved.rewards });
      await dismiss();
    } catch {
      const permission = await (await notificationSdk()).getPermissionsAsync().catch(() => null);
      setBlocked(!!permission && !permission.granted && !permission.canAskAgain);
      setError("Couldn’t enable alerts. You can try again or continue.");
    } finally { acting.current = false; setBusy(false); }
  };
  if (!visible) return null;
  return <FlowCard title="BOUNTY UPDATES">
    <Text style={flowStyles.body}>Get notified about reviews and payments.</Text>
    {error ? <Text accessibilityRole="alert" style={flowStyles.muted}>{error}</Text> : null}
    <View style={styles.actions}>
      <Button label={blocked ? "Open settings" : "Enable alerts"} variant="secondary" size="medium"
        loading={busy} onPress={() => void enable()} containerStyle={styles.action} />
      <Button label="Not now" variant="text" size="medium" disabled={busy}
        onPress={() => void dismiss()} containerStyle={styles.action} />
    </View>
  </FlowCard>;
}
const styles = StyleSheet.create({ actions: { flexDirection: "row", gap: 8, marginTop: 12 }, action: { flex: 1 } });
