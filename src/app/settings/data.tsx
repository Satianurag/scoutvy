import { useCallback, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Text } from "react-native";
import { useSession } from "@/auth/session-context";
import { deleteAccount, fetchDeletionEligibility, signOutAll } from "@/auth/api";
import { deleteLocalAccountData } from "@/auth/delete-local-data";
import { useResource } from "@/hooks/use-resource";
import { SettingsScreen, SettingsGroup, settingsStyle as s } from "@/settings/ui";
import { ListRow } from "@/components/ui/ListRow";
import { FlowNotice } from "@/components/ui/Flow";
import { useAppDialog } from "@/components/ui/AppDialog";
import { colors } from "@/theme";

export default function Data() {
  const { session, signOut } = useSession();
  const dialog = useAppDialog();
  const deleting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const fetcher = useCallback(() => fetchDeletionEligibility(session!), [session]);
  const r = useResource(session?.walletAddress ?? "", fetcher);
  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(true);
    try {
      const current = await fetchDeletionEligibility(session!);
      await deleteLocalAccountData(session!.walletAddress, current.bountyIds);
      await deleteAccount(session!);
      setDeleted(true);
      await leave();
    } catch {
      setBusy(false);
      dialog({ title: "Couldn’t finish deletion", message: "Check your connection and try again.", tone: "info" });
    } finally { deleting.current = false; }
  };
  return (
    <SettingsScreen title="Your data">
      {deleted ? (
        <FlowNotice title="Account deleted" message="Your wallet and its funds are unchanged."
          action={{ label: "Continue", onPress: () => void leave() }} />
      ) : <>
        <SettingsGroup>
          <ListRow label="Sign out all devices" onPress={busy ? undefined : () => dialog({
            title: "Sign out all devices?",
            message: "You’ll need to reconnect your wallet on each device.",
            tone: "destructive", confirmLabel: "Sign out all", cancelLabel: "Cancel",
            onConfirm: () => {
              setBusy(true);
              void signOutAll(session!).then(() => signOut()).catch(() => {
                setBusy(false);
                dialog({ title: "Couldn’t sign out", message: "Try again.", tone: "info" });
              });
            },
          })} />
        </SettingsGroup>
        {r.loading && !r.data ? <ActivityIndicator color={colors.primary} /> : r.error && !r.data ? (
          <FlowNotice title="Couldn’t load account details" message="Check your connection."
            action={{ label: "Retry", onPress: () => void r.refresh() }} />
        ) : r.data ? <>
          {r.data.activeBounties ? <FlowNotice title="You have unfinished bounties"
            message="Deleting your account won’t cancel bounties or return escrow. Reconnect the same wallet to manage them."
            action={{ label: "Manage bounties", onPress: () => router.push("/my-bounties") }} /> : null}
          <SettingsGroup title="Account deletion">
            <ListRow label={busy ? "Deleting…" : "Delete account"} tone="destructive"
              onPress={busy ? undefined : () => dialog({
                title: "Delete your account?",
                message: "Your profile, saved drafts and sign-ins will be removed. Shared bounty records and public blockchain transactions remain. Your wallet and funds stay with you.",
                tone: "destructive", confirmLabel: "Delete account", cancelLabel: "Keep account",
                onConfirm: () => void remove(),
              })} />
          </SettingsGroup>
          <Text style={s.body}>Requirements, submissions and payment receipts remain shared with bounty participants. Reconnecting creates a new profile with the same wallet history.</Text>
        </> : null}
      </>}
    </SettingsScreen>
  );
}
