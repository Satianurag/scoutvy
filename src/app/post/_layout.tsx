import { useReducedMotion } from "@/components/ui/Motion";
import { Stack } from "expo-router";

import { DraftProvider } from "@/post/draft";
import { colors } from "@/theme";

export default function PostLayout() {
  const reduced = useReducedMotion();
  return (
    <DraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduced ? "none" : "slide_from_right",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="status"
          options={{ animation: reduced ? "none" : "fade", gestureEnabled: false }}
        />
      </Stack>
    </DraftProvider>
  );
}
