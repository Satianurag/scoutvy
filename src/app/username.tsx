import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ApiError, checkUsername, type UsernameStatus } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { Button } from "@/components/ui/Button";
import { KeyboardForm } from "@/components/ui/KeyboardForm";
import { UsernameFeedback } from "@/components/ui/UsernameFeedback";
import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";
import { UsernameField } from "@/components/ui/UsernameField";
import { USERNAME_PATTERN, suggestUsername } from "@/onboarding/username-suggestion";
import { layout } from "@/theme";

type Check = UsernameStatus | "checking" | "error";

export default function UsernameStep() {
  const { session, claimUsername } = useSession();
  const [username, setUsername] = useState(suggestUsername);
  const [result, setResult] = useState<{ username: string; check: Check } | null>(null);
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const valid = USERNAME_PATTERN.test(username);
  const check: Check = !valid ? "invalid" : result?.username === username ? result.check : "checking";
  const setCheck = (next: Check) => setResult({ username, check: next });

  useEffect(() => {
    if (!session || !valid) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkUsername(session, username, controller.signal)
        .then((next) => setResult({ username, check: next }))
        .catch(() => {
          if (!controller.signal.aborted) setResult({ username, check: "error" });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [session, username, valid, attempt]);

  const save = async () => {
    if (lock.current || (check !== "available" && !(check === "error" && saveError))) return;
    lock.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      await claimUsername(username);
      // The authenticated profile guard takes the user straight into Explore.
    } catch (error) {
      setSaveError(!(error instanceof ApiError && error.status === 409));
      setCheck(error instanceof ApiError && error.status === 409 ? "taken" : "error");
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardForm header={<NavBar back={false} />} footer={
        <View style={styles.actions}><Button label="Continue" onPress={save} loading={saving} disabled={check !== "available"} /></View>
      }>
        <Title style={styles.title}>Choose your username</Title>
        <Subtitle style={styles.subtitle}>How you appear on Scoutvy.</Subtitle>
        <View pointerEvents={saving ? "none" : "auto"}>
          <UsernameField
            value={username}
            onChangeText={(value) => { setSaveError(false); setUsername(value); }}
            onSubmit={check === "available" ? save : undefined}
          />
        </View>
        <View style={styles.feedback}><UsernameFeedback status={check} saveError={saveError} onRetry={() => {
          if (saveError) void save();
          else { setResult(null); setAttempt(value => value + 1); }
        }} /></View>
      </KeyboardForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 22 },
  subtitle: { marginTop: 8, marginBottom: 24 },
  feedback: { marginTop: 12 },
  actions: { paddingBottom: layout.bottomGap },
});
