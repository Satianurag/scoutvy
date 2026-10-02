import { AppIdentity, createSolanaDevnet } from "@wallet-ui/react-native-kit";

export const APP_DOMAIN = "scoutvy.vercel.app";

export const appIdentity: AppIdentity = {
  name: "Scoutvy",
  uri: `https://${APP_DOMAIN}`,
};

export const SOLANA_RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const appCluster = createSolanaDevnet({ url: SOLANA_RPC_URL });

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `https://${APP_DOMAIN}`;

export const WALLET_INSTALL_URL = "https://play.google.com/store/apps/details?id=com.solflare.mobile";

export const explorerAddressUrl = (address: string, cluster: "devnet" | "mainnet" = "devnet") =>
  cluster === "mainnet"
    ? `https://explorer.solana.com/address/${address}`
    : `https://explorer.solana.com/address/${address}?cluster=devnet`;

export const explorerTransactionUrl = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
