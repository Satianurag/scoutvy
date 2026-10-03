import * as SecureStore from "expo-secure-store";
import { deleteAccountDraft } from "@/post/draft-storage";
import { deleteWrittenDrafts } from "@/proof/use-written-draft";

export async function deleteLocalAccountData(wallet: string, bountyIds: string[]) {
  await deleteAccountDraft(wallet);
  await deleteWrittenDrafts(wallet, bountyIds);
  await SecureStore.deleteItemAsync(`scoutvy-push-invitation-${wallet}`);
  await SecureStore.deleteItemAsync("scoutvy-push-token");
  await SecureStore.deleteItemAsync("scoutvy-onboarded");
  // Pending transaction lifetimes are safety records. Keep them until chain
  // reconciliation, even if the user later creates a fresh profile.
}
