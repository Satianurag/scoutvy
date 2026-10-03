import { router } from "expo-router";
import { useSession } from "@/auth/session-context";
import { Introduction } from "@/onboarding/Introduction";
import { rememberIntroduction } from "@/onboarding/intro-preference";

export default function ReplayIntroduction() {
  const { session, onboarded } = useSession();
  return <Introduction returning={!!session} onContinue={() => {
    void rememberIntroduction().catch(() => {});
    router.replace(session ? onboarded ? "/(tabs)/explore" : "/username" : "/connect");
  }} />;
}
