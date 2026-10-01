import { useEffect, useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, View } from "react-native";

import { ApiError, checkUsername, type UsernameStatus } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";
import { UsernameField } from "@/components/ui/UsernameField";
import { ONBOARDING_STEPS } from "@/onboarding/steps";
import { USERNAME_PATTERN, suggestUsername } from "@/onboarding/username-suggestion";
import { colors, fonts, layout } from "@/theme";

type Check = UsernameStatus | "checking" | "error";

const feedback: Record<Exclude<Check, "checking">, { text: string; color: string }> = {
  available: { text: "Username available", color: colors.success },
  taken: { text: "Username taken", color: colors.danger },
  invalid: { text: "3–20 letters, numbers or _", color: colors.danger },
  error: { text: "Couldn't check right now", color: colors.danger },
};

export default function UsernameStep() {
  const { session, claimUsername } = useSession();
  const [username, setUsername] = useState(suggestUsername);
  const [result, setResult] = useState<{ username: string; check: Check } | null>(null);
  const [saving, setSaving] = useState(false);
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
  }, [session, username, valid]);

  const save = async () => {
    setSaving(true);
    try {
      await claimUsername(username);
    } catch (error) {
      setCheck(error instanceof ApiError && error.status === 409 ? "taken" : "error");
      setSaving(false);
    }
  };

  const status = username && check !== "checking" ? feedback[check] : null;

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <NavBar step={{ index: 2, count: ONBOARDING_STEPS }} />
        <Title style={styles.title}>Create Username</Title>
        <Subtitle style={styles.subtitle}>Your username is how posters and other scouts see you on Scoutvy.</Subtitle>
        <UsernameField value={username} onChangeText={setUsername} onSubmit={check === "available" ? save : undefined} />
        <View style={styles.status}>
          {status ? (
            <>
              <Icon
                name={
                  check === "available"
                    ? { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }
                    : { ios: "exclamationmark.circle.fill", android: "error", web: "error" }
                }
                size={14.3}
                color={status.color}
              />
              <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
            </>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Button label="Continue" onPress={save} loading={saving} disabled={check !== "available"} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  title: { marginTop: 22 },
  subtitle: { marginTop: 8, marginBottom: 33 },
  status: { marginTop: 10, marginLeft: 20, height: 20, flexDirection: "row", alignItems: "center", gap: 4.4 },
  statusText: { fontFamily: fonts.semiBold, fontSize: 14.2 },
  actions: { marginTop: "auto", paddingBottom: layout.bottomGap },
});
