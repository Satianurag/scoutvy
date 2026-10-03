import { useReducedMotion } from "@/components/ui/Motion";
import { Stack } from "expo-router";
export default function SettingsLayout() {
  const reduced = useReducedMotion();
  return <Stack screenOptions={{ headerShown: false, animation: reduced ? "none" : "slide_from_right" }} />;
}
