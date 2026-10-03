import { Redirect } from "expo-router";

// Preserve old links without adding another onboarding step.
export default function LegacyReady() {
  return <Redirect href="/(tabs)/explore" />;
}
