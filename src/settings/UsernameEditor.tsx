import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { usePreventRemove } from "expo-router/react-navigation";
import { useNavigation } from "expo-router";
import { ApiError, checkUsername, type UsernameStatus } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { useAppDialog } from "@/components/ui/AppDialog";
import { FlowFooter } from "@/components/ui/Flow";
import { UsernameField } from "@/components/ui/UsernameField";
import { USERNAME_PATTERN } from "@/onboarding/username-suggestion";
import { colors } from "@/theme";
import { SettingsScreen, settingsStyle as s } from "./ui";
export function UsernameEditor({
  initial,
  onSaved,
  title = "Edit username",
}: {
  initial: string;
  onSaved: () => void;
  title?: string;
}) {
  const { session, claimUsername } = useSession();
  const nav = useNavigation();
  const dialog = useAppDialog();
  const [name, setName] = useState(initial);
  const [result, setResult] = useState<{ name: string; status: UsernameStatus | "error" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const running = useRef(false);
  const dirty = name !== initial && !saved;
  const valid = USERNAME_PATTERN.test(name);
  const status = !valid
    ? "invalid"
    : name === initial
      ? "unchanged"
      : result?.name === name
        ? result.status
        : "checking";
  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) return;
    dialog({
      title: "Discard changes?",
      message: "Your username hasn’t been saved.",
      tone: "destructive",
      cancelLabel: "Keep editing",
      confirmLabel: "Discard",
      onConfirm: () => nav.dispatch(data.action),
    });
  });
  useEffect(() => {
    if (!session || !valid || name === initial) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkUsername(session, name, controller.signal)
        .then((status) => setResult({ name, status }))
        .catch(() => {
          if (!controller.signal.aborted) setResult({ name, status: "error" });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [name, initial, valid, session]);
  useEffect(() => {
    if (saved) onSaved();
  }, [saved, onSaved]);
  const save = async () => {
    if (running.current || !valid || status === "taken" || status === "checking") return;
    running.current = true;
    setSaving(true);
    try {
      await claimUsername(name);
      setSaved(true);
    } catch (e) {
      setResult({ name, status: e instanceof ApiError && e.status === 409 ? "taken" : "error" });
    } finally {
      running.current = false;
      setSaving(false);
    }
  };
  const message =
    status === "checking"
      ? "Checking…"
      : status === "available"
        ? "Available"
        : status === "taken"
          ? "Already taken"
          : status === "invalid"
            ? "3–20 letters, numbers or underscores"
            : status === "error"
              ? "Couldn’t save. Try again."
              : "3–20 letters, numbers or underscores";
  return (
    <SettingsScreen
      title={title}
      footer={
        <FlowFooter
          label="Save"
          loading={saving}
          disabled={!dirty || !valid || status === "taken" || status === "checking"}
          onPress={() => void save()}
        />
      }
    >
      <Text style={s.body}>How you appear on Scoutvy.</Text>
      <View pointerEvents={saving ? "none" : "auto"}>
        <UsernameField value={name} onChangeText={setName} onSubmit={() => void save()} />
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[
          s.body,
          {
            color:
              status === "available"
                ? colors.green
                : status === "taken" || status === "error"
                  ? colors.danger
                  : colors.textSecondary,
          },
        ]}
      >
        {message}
      </Text>
    </SettingsScreen>
  );
}
