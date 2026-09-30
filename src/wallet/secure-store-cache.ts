import * as SecureStore from "expo-secure-store";
import type { WalletAuthorizationCache } from "@wallet-ui/react-native-kit";

const STORAGE_KEY = "mwa-authorization";

export const secureStoreAuthorizationCache: WalletAuthorizationCache = {
  async get() {
    const result = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!result) return undefined;
    try {
      return JSON.parse(result);
    } catch {
      return undefined;
    }
  },
  async set(value) {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(value));
  },
  async clear() {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  },
};
