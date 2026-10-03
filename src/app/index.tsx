import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui/Screen";
import { useSession } from "@/auth/session-context";
import { StatusView } from "@/components/ui/StatusView";
import { FlowFooter } from "@/components/ui/Flow";
import { Introduction } from "@/onboarding/Introduction";
import { hasSeenIntroduction, rememberIntroduction } from "@/onboarding/intro-preference";

export default function Welcome() {
  const { startupIssue, restoringSession, retryStartup } = useSession();
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => { let mounted = true;
    void hasSeenIntroduction().catch(() => false).then(value => { if (mounted) setSeen(value); });
    return () => { mounted = false; };
  }, []);
  if (startupIssue) return <Screen>
    <StatusView state={restoringSession ? "pending" : "failure"}
      title={restoringSession ? "Loading your account…" : startupIssue === "expired" ? "Reconnect your wallet" : "Couldn’t load your account"}
      message={startupIssue === "expired" ? "Your sign-in has expired. Reconnect to continue." : "Check your connection and try again. Your saved sign-in and drafts are still here."} />
    <FlowFooter label={startupIssue === "expired" ? "Reconnect wallet" : "Retry"} loading={restoringSession}
      onPress={() => startupIssue === "expired" ? router.push("/connect") : void retryStartup()} />
  </Screen>;
  if (seen === null) return <Screen />;
  if (seen) return <Redirect href="/connect" />;
  return <Introduction onContinue={() => {
    void rememberIntroduction().catch(() => {});
    router.replace("/connect");
  }} />;
}
