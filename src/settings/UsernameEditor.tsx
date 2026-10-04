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
import { UsernameFeedback } from "@/components/ui/UsernameFeedback";
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
  const [saveError, setSaveError] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
  }, [name, initial, valid, session, attempt]);
  useEffect(() => {
    if (saved) onSaved();
  }, [saved, onSaved]);
  const save = async () => {
    if (running.current || !dirty || !valid || (status !== "available" && !(status === "error" && saveError))) return;
    running.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      await claimUsername(name);
      setSaved(true);
    } catch (e) {
      setSaveError(!(e instanceof ApiError && e.status === 409));
      setResult({ name, status: e instanceof ApiError && e.status === 409 ? "taken" : "error" });
    } finally {
      running.current = false;
      setSaving(false);
    }
  };
  return (
    <SettingsScreen
      title={title}
      footer={
        <FlowFooter
          label="Save"
          loading={saving}
          disabled={!dirty || !valid || status !== "available"}
          onPress={() => void save()}
        />
      }
    >
      <Text style={s.body}>How you appear on Scoutvy.</Text>
      <View pointerEvents={saving ? "none" : "auto"}>
        <UsernameField value={name} onChangeText={(value) => { setSaveError(false); setName(value); }} onSubmit={() => void save()} />
      </View>
      <UsernameFeedback status={status} saveError={saveError} onRetry={() => {
        if (saveError) void save();
        else { setResult(null); setAttempt(value => value + 1); }
      }} />
    </SettingsScreen>
  );
}
