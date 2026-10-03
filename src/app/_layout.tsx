import { SessionRecovery } from "@/auth/SessionRecovery";
import { NotificationObserver } from "@/notifications/Observer";
import { useReducedMotion } from "@/components/ui/Motion";
import { MobileWalletProvider } from "@wallet-ui/react-native-kit";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { SessionProvider, useSession } from "@/auth/session-context";
import { SplashTransition } from "@/components/ui/SplashTransition";
import { AppDialogProvider } from "@/components/ui/AppDialog";
import { appCluster, appIdentity } from "@/constants/app-config";
import { colors, fonts } from "@/theme";
import { secureStoreAuthorizationCache } from "@/wallet/secure-store-cache";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, session, onboarded } = useSession();
  const reduced = useReducedMotion();

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
          animation: reduced ? "none" : "slide_from_right",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="index" options={{ animation: reduced ? "none" : "fade" }} />
          <Stack.Screen name="connect" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="username" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" options={{ animation: reduced ? "none" : "slide_from_bottom" }} />
          <Stack.Screen name="post" options={{ animation: reduced ? "none" : "slide_from_bottom" }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="ready" />
          <Stack.Screen name="location" />
          <Stack.Screen name="tier" />
          <Stack.Screen name="my-bounties" />
          <Stack.Screen name="report/[id]" />
          <Stack.Screen name="receive" options={{ animation: reduced ? "none" : "slide_from_bottom" }} />
          <Stack.Screen name="bounty/[id]" />
          <Stack.Screen name="proof/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="review/[id]" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Screen name="help" />
        <Stack.Screen name="introduction" />
      </Stack>
      <NotificationObserver />
      <SessionRecovery />
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
        <AppDialogProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AppDialogProvider>
      </SessionProvider>
    </MobileWalletProvider>
  );
}
