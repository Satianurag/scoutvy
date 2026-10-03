import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSession } from "@/auth/session-context";
import { SettingsScreen, SettingsGroup, SettingsToggleRow, settingsStyle as s } from "@/settings/ui";
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
  const saving = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = !!pushProjectId();
  const load = useCallback(async () => {
    if (!session || saving.current) return;
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
        setLoaded(true);
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
    if (!session || saving.current) return;
    saving.current = true;
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
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <SettingsScreen title="Notifications">
      {loading && !loaded ? <ActivityIndicator color={colors.primary} /> : null}
      {loaded || !configured ? <>
        <SettingsGroup>
          <SettingsToggleRow label="Allow notifications" value={enabled}
            disabled={busy || loading || !configured} onChange={() => void save()} />
        </SettingsGroup>
        <SettingsGroup title="Bounty updates">
          <SettingsToggleRow label="Submissions" description="Acceptance, submission and review updates."
            value={preferences.reviews} disabled={!enabled || busy || loading}
            onChange={(value) => void save({ ...preferences, reviews: value })} />
          <SettingsToggleRow label="Payouts & refunds" description="Confirmed reward transfers."
            value={preferences.rewards} disabled={!enabled || busy || loading}
            onChange={(value) => void save({ ...preferences, rewards: value })} />
        </SettingsGroup>
      </> : null}
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
