import { MobileWalletProvider } from "@wallet-ui/react-native-kit";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { SessionProvider, useSession } from "@/auth/session-context";
import { appCluster, appIdentity } from "@/constants/app-config";
import { colors, fonts } from "@/theme";
import { secureStoreAuthorizationCache } from "@/wallet/secure-store-cache";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, session, profile, justOnboarded } = useSession();

  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);

  if (isLoading) return null;

  const signedIn = session !== null;
  const hasUsername = Boolean(profile?.username);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="connect" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasUsername}>
        <Stack.Screen name="location" />
        <Stack.Screen name="tier" />
        <Stack.Screen name="username" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasUsername && justOnboarded}>
        <Stack.Screen name="ready" options={{ animation: "fade" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasUsername && !justOnboarded}>
        <Stack.Screen name="home" options={{ animation: "fade" }} />
      </Stack.Protected>
    </Stack>
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
