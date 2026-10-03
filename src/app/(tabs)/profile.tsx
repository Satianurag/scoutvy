import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/auth/session-context";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAppDialog } from "@/components/ui/AppDialog";
import { BrowseHeading } from "@/components/ui/Browse";
import { ListRow } from "@/components/ui/ListRow";
import { SettingsGroup, SettingIcon } from "@/settings/ui";
import { ScreenReveal } from "@/components/ui/Motion";
import { colors, fonts } from "@/theme";
export default function Profile() {
  const { top } = useSafeAreaInsets();
  const { session, profile, tier, signOut } = useSession();
  const dialog = useAppDialog();
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const address = session.walletAddress;
  const leave = (switching = false) =>
    dialog({
      title: switching ? "Switch wallet?" : "Sign out?",
      message: switching
        ? "Sign in again with the wallet you want to use."
        : "You can reconnect with this wallet anytime.",
      tone: "destructive",
      icon: "signOut",
      cancelLabel: "Stay here",
      confirmLabel: switching ? "Switch wallet" : "Sign out",
      onConfirm: () => {
        setBusy(true);
        void signOut().catch(() => {
          setBusy(false);
          dialog({ title: "Couldn’t sign out", message: "Try again.", tone: "info" });
        });
      },
    });
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30, gap: 24 }}>
        <BrowseHeading title="Profile" subtitle="Your account and preferences." />
        <ScreenReveal style={s.identity}>
          <Avatar name={profile?.username ?? address} size={72} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text numberOfLines={1} style={s.name}>
              @{profile?.username ?? "Scout"}
            </Text>
            <Text style={s.meta}>
              {address.slice(0, 4)}…{address.slice(-4)}
            </Text>
            <Text style={s.tier}>
              {tier.status === "ready"
                ? tier.tier.tier === "verified_seeker"
                  ? "SGT verified"
                  : "Scout"
                : tier.status === "loading"
                  ? "Checking wallet…"
                  : "Verification unavailable"}
            </Text>
          </View>
        </ScreenReveal>
        <View style={s.actions}>
          <Button
            label="Edit profile"
            onPress={() => router.push("/settings/username")}
            containerStyle={{ flex: 1 }}
            size="medium"
          />
          <Button
            label="Wallet"
            variant="secondary"
            onPress={() => router.navigate("/(tabs)/wallet")}
            containerStyle={{ flex: 1 }}
            size="medium"
          />
        </View>
        <SettingsGroup>
          <ListRow
            icon={<SettingIcon name={{ ios: "checklist", android: "assignment", web: "assignment" }} />}
            label="My bounties"
            onPress={() => router.push("/my-bounties")}
          />
          <ListRow
            icon={
              <SettingIcon name={{ ios: "checkmark.seal", android: "verified_user", web: "verified_user" }} />
            }
            label="Wallet verification"
            onPress={() => router.push("/settings/verification")}
          />
        </SettingsGroup>
        <SettingsGroup title="Preferences">
          <ListRow
            icon={
              <SettingIcon name={{ ios: "bell", android: "notifications_none", web: "notifications_none" }} />
            }
            label="Notifications"
            onPress={() => router.push("/settings/notifications")}
          />
          <ListRow
            icon={<SettingIcon name={{ ios: "lock", android: "lock_outline", web: "lock_outline" }} />}
            label="Permissions"
            onPress={() => router.push("/settings/permissions")}
          />
          <ListRow
            icon={<SettingIcon name={{ ios: "person.slash", android: "block", web: "block" }} />}
            label="Blocked users"
            onPress={() => router.push("/settings/blocked")}
          />
        </SettingsGroup>
        <SettingsGroup title="Account">
          <ListRow label="Help" onPress={() => router.push("/settings/help")} />
          <ListRow label="Your data" onPress={() => router.push("/settings/data")} />
          <ListRow label="Switch wallet" onPress={busy ? undefined : () => leave(true)} />
          <ListRow label="Sign out" tone="destructive" onPress={busy ? undefined : () => leave()} />
        </SettingsGroup>
        <Text style={s.version}>Scoutvy {Constants.expoConfig?.version ?? ""} · Devnet</Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  identity: { marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 18 },
  name: { fontFamily: fonts.semiBold, fontSize: 21, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  tier: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary },
  actions: { marginHorizontal: 20, flexDirection: "row", gap: 10 },
  version: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: "center" },
});
