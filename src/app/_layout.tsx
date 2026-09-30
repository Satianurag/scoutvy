import { MobileWalletProvider } from "@wallet-ui/react-native-kit";
import { Stack } from "expo-router";

import { appCluster, appIdentity } from "@/constants/app-config";
import { secureStoreAuthorizationCache } from "@/wallet/secure-store-cache";

export default function RootLayout() {
  return (
    <MobileWalletProvider
      cache={secureStoreAuthorizationCache}
      cluster={appCluster}
      identity={appIdentity}
    >
      <Stack />
    </MobileWalletProvider>
  );
}
