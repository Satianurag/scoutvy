import { useCallback, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { useSession } from "@/auth/session-context";
import { changeDataRequest, fetchDataRequest, signOutAll } from "@/auth/api";
import { useResource } from "@/hooks/use-resource";
import { SettingsScreen, SettingsGroup, settingsStyle as s } from "@/settings/ui";
import { ListRow } from "@/components/ui/ListRow";
import { FlowNotice } from "@/components/ui/Flow";
import { useAppDialog } from "@/components/ui/AppDialog";
import { colors } from "@/theme";
export default function Data() {
  const { session, signOut } = useSession();
  const dialog = useAppDialog();
  const [busy, setBusy] = useState(false);
  const fetcher = useCallback(() => fetchDataRequest(session!), [session]);
  const r = useResource(session?.walletAddress ?? "", fetcher);
  const pending = r.data?.request?.status === "pending";
  const act = async (cancel = false) => {
    setBusy(true);
    try {
      await changeDataRequest(session!, cancel);
      await r.refresh();
    } catch {
      dialog({ title: "Couldn’t save request", message: "Try again.", tone: "info" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <SettingsScreen title="Your data">
      <Text style={s.body}>
        Your profile is linked to your wallet. Proof photos and location are part of your bounty records.
      </Text>
      <SettingsGroup>
        <ListRow
          label="Sign out all devices"
          onPress={
            busy
              ? undefined
              : () =>
                  dialog({
                    title: "Sign out all devices?",
                    message: "You’ll need to reconnect your wallet on each device.",
                    tone: "destructive",
                    confirmLabel: "Sign out all",
                    cancelLabel: "Cancel",
                    onConfirm: () => {
                      setBusy(true);
                      void signOutAll(session!)
                        .then(() => signOut())
                        .catch(() => {
                          setBusy(false);
                          dialog({ title: "Couldn’t sign out", message: "Try again.", tone: "info" });
                        });
                    },
                  })
          }
        />
      </SettingsGroup>
      {r.loading && !r.data ? (
        <ActivityIndicator color={colors.primary} />
      ) : r.error && !r.data ? (
        <FlowNotice
          title="Couldn’t load requests"
          message="Check your connection."
          action={{ label: "Retry", onPress: () => void r.refresh() }}
        />
      ) : (
        <>
          <SettingsGroup title="Account deletion">
            <ListRow
              label={busy ? "Saving…" : pending ? "Cancel deletion request" : "Request account deletion"}
              tone="destructive"
              onPress={
                busy
                  ? undefined
                  : () =>
                      pending
                        ? void act(true)
                        : dialog({
                            title: "Request account deletion?",
                            message:
                              "This submits a deletion request. Your account remains active until the request is processed. On-chain transactions cannot be erased.",
                            tone: "destructive",
                            confirmLabel: "Submit request",
                            cancelLabel: "Keep account",
                            onConfirm: () => void act(),
                          })
              }
            />
          </SettingsGroup>
          {pending && (
            <FlowNotice
              title="Request recorded"
              message="Your account has not been deleted. You can cancel while the request is pending."
            />
          )}
        </>
      )}
    </SettingsScreen>
  );
}
