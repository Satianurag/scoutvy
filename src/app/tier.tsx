import { Redirect } from "expo-router";

// Preserve old links without adding another onboarding step.
export default function LegacyTier() {
  return <Redirect href="/settings/verification" />;
}
