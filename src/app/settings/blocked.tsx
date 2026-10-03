import { useCallback, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { useSession } from "@/auth/session-context";
import { fetchBlockedUsers, unblockUser } from "@/auth/api";
import { useResource } from "@/hooks/use-resource";
import { SettingsScreen, SettingsGroup, settingsStyle as s } from "@/settings/ui";
import { ListRow } from "@/components/ui/ListRow";
import { BrowseEmpty } from "@/components/ui/Browse";
import { useAppDialog } from "@/components/ui/AppDialog";
import { colors } from "@/theme";
export default function Blocked() {
  const { session } = useSession();
  const dialog = useAppDialog();
  const [busy, setBusy] = useState(false);
  const fetcher = useCallback(() => fetchBlockedUsers(session!), [session]);
  const r = useResource(session?.walletAddress ?? "", fetcher);
  return (
    <SettingsScreen title="Blocked users">
      <Text style={s.body}>Bounties from these posters are hidden from Explore.</Text>
      {!r.data ? (
        r.loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <BrowseEmpty
            title="Couldn’t load blocked users"
            message="Try again."
            action={{ label: "Retry", onPress: () => void r.refresh() }}
          />
        )
      ) : r.data.users.length ? (
        <SettingsGroup>
          {r.data.users.map((user) => (
            <ListRow
              key={user.id}
              label={user.name}
              value={busy ? "" : "Unblock"}
              onPress={
                busy
                  ? undefined
                  : () =>
                      dialog({
                        title: `Unblock ${user.name}?`,
                        message: "Their bounties can appear in Explore again.",
                        confirmLabel: "Unblock",
                        cancelLabel: "Keep blocked",
                        onConfirm: () => {
                          setBusy(true);
                          void unblockUser(session!, user.id)
                            .then(() => r.refresh())
                            .catch(() =>
                              dialog({ title: "Couldn’t unblock", message: "Try again.", tone: "info" }),
                            )
                            .finally(() => setBusy(false));
                        },
                      })
              }
            />
          ))}
        </SettingsGroup>
      ) : (
        <BrowseEmpty
          kind="block"
          title="No blocked users"
          message="You can block a poster when reporting a bounty."
        />
      )}
    </SettingsScreen>
  );
}
