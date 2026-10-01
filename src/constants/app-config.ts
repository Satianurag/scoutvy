import { AppIdentity, createSolanaDevnet } from "@wallet-ui/react-native-kit";

export const APP_DOMAIN = "scoutvy.vercel.app";

export const appIdentity: AppIdentity = {
  name: "Scoutvy",
  uri: `https://${APP_DOMAIN}`,
};

export const appCluster = createSolanaDevnet({ url: "https://api.devnet.solana.com" });

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `https://${APP_DOMAIN}`;

export const WALLET_INSTALL_URL = "https://play.google.com/store/apps/details?id=com.solflare.mobile";
