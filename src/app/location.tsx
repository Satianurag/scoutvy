import { Redirect } from "expo-router";

// Preserve old links without adding another onboarding step.
export default function LegacyLocation() {
  return <Redirect href="/settings/permissions" />;
}
