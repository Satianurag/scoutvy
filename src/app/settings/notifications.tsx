import { useCallback, useState } from "react";
import { ActivityIndicator, AppState, Linking, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSession } from "@/auth/session-context";
import { SettingsScreen, settingsStyle as s } from "@/settings/ui";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { FlowNotice } from "@/components/ui/Flow";
import {
  defaultPushPreferences,
  disablePush,
  enablePush,
  notificationSdk,
  pushProjectId,
  pushState,
  updatePush,
  type PushPreferences,
} from "@/notifications/service";
import { colors } from "@/theme";
export default function Notifications() {
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [preferences, setPreferences] = useState(defaultPushPreferences);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = !!pushProjectId();
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    if (!configured) {
      setLoading(false);
      return;
    }
    try {
      const sdk = await notificationSdk();
      setAllowed((await sdk.getPermissionsAsync()).granted);
      if (configured) {
        const saved = await pushState(session);
        setEnabled(saved.enabled);
        setPreferences({ reviews: saved.reviews, rewards: saved.rewards });
      }
    } catch {
      setError("Couldn’t load notification settings.");
    } finally {
      setLoading(false);
    }
  }, [session, configured]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
      });
      return () => listener.remove();
    }, [load]),
  );
  const save = async (next?: PushPreferences) => {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (next) {
        await updatePush(session, next);
        setPreferences(next);
      } else if (enabled) {
        await disablePush(session);
        setEnabled(false);
      } else {
        await enablePush(session, preferences);
        setEnabled(true);
        setAllowed(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SettingsScreen title="Notifications">
      <View style={s.card}>
        <Text style={s.value}>Bounty updates</Text>
        <Text style={[s.body, { marginHorizontal: 0 }]}>Proof reviews and confirmed rewards.</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Button
            label={
              !configured
                ? "Unavailable in this build"
                : enabled
                  ? "Turn off notifications"
                  : "Enable notifications"
            }
            disabled={!configured}
            loading={busy}
            onPress={() => void save()}
            style={{ marginHorizontal: 0 }}
          />
        )}
      </View>
      {enabled && (
        <View style={[s.card, { gap: 22 }]}>
          {(
            [
              ["reviews", "Proof & review"],
              ["rewards", "Payouts & refunds"],
            ] as const
          ).map(([key, label]) => (
            <View
              key={key}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <Text style={s.value}>{label}</Text>
              <Toggle
                label={label}
                value={preferences[key]}
                disabled={busy}
                onChange={(value) => void save({ ...preferences, [key]: value })}
              />
            </View>
          ))}
        </View>
      )}
      {enabled && !allowed && (
        <FlowNotice
          title="Blocked by phone settings"
          message="Allow Scoutvy notifications to receive updates."
          action={{
            label: "Open settings",
            onPress: () =>
              void Linking.openSettings().catch(() => setError("Open Scoutvy in your phone settings.")),
          }}
        />
      )}
      {!configured && <Text style={s.body}>Your updates are still available in Activity.</Text>}
      {error && (
        <FlowNotice
          error
          title="Couldn’t update notifications"
          message={error}
          action={{ label: "Retry", onPress: () => void load() }}
        />
      )}
    </SettingsScreen>
  );
}
