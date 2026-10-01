import { MobileWalletProvider } from "@wallet-ui/react-native-kit";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { appCluster, appIdentity } from "@/constants/app-config";
import { colors, fonts } from "@/theme";
import { secureStoreAuthorizationCache } from "@/wallet/secure-store-cache";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: require("@/assets/fonts/InterDisplay-Regular.ttf"),
    [fonts.medium]: require("@/assets/fonts/InterDisplay-Medium.ttf"),
    [fonts.semiBold]: require("@/assets/fonts/InterDisplay-SemiBold.ttf"),
    [fonts.bold]: require("@/assets/fonts/InterDisplay-Bold.ttf"),
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <MobileWalletProvider
      cache={secureStoreAuthorizationCache}
      cluster={appCluster}
      identity={appIdentity}
    >
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </MobileWalletProvider>
  );
}
