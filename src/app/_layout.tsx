import { MobileWalletProvider } from "@wallet-ui/react-native-kit";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { SessionProvider, useSession } from "@/auth/session-context";
import { SplashTransition } from "@/components/ui/SplashTransition";
import { appCluster, appIdentity } from "@/constants/app-config";
import { colors, fonts } from "@/theme";
import { secureStoreAuthorizationCache } from "@/wallet/secure-store-cache";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, session, onboarded } = useSession();

  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);

  if (isLoading) return null;

  const signedIn = session !== null;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "ios_from_right",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="index" options={{ animation: "fade" }} />
          <Stack.Screen name="connect" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="location" options={{ animation: "fade" }} />
          <Stack.Screen name="tier" />
          <Stack.Screen name="username" />
          <Stack.Screen name="ready" options={{ animation: "fade", gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="post" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="receive" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="bounty/[id]" />
        </Stack.Protected>
      </Stack>
      <SplashTransition />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: require("@/assets/fonts/InterDisplay-Regular.ttf"),
    [fonts.medium]: require("@/assets/fonts/InterDisplay-Medium.ttf"),
    [fonts.semiBold]: require("@/assets/fonts/InterDisplay-SemiBold.ttf"),
    [fonts.bold]: require("@/assets/fonts/InterDisplay-Bold.ttf"),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <MobileWalletProvider cache={secureStoreAuthorizationCache} cluster={appCluster} identity={appIdentity}>
      <SessionProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SessionProvider>
    </MobileWalletProvider>
  );
}
