import { Stack } from "expo-router";

import { DraftProvider } from "@/post/draft";
import { colors } from "@/theme";

export default function PostLayout() {
  return (
    <DraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "ios_from_right",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="status" options={{ animation: "fade", gestureEnabled: false }} />
      </Stack>
    </DraftProvider>
  );
}
