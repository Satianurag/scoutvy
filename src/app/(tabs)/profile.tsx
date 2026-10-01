import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "@/auth/session-context";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { RowIcon } from "@/components/ui/RowIcon";
import { Stat } from "@/components/ui/Stat";
import { Heading } from "@/components/ui/Typography";
import { explorerAddressUrl } from "@/constants/app-config";
import { colors, layout } from "@/theme";

const COPIED_MS = 1500;
const TIER_STAT_WIDTH = 91;

const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session, profile, tier, refreshTier, signOut } = useSession();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!session) return null;

  const address = session.walletAddress;
  const name = profile?.username ? `@${profile.username}` : shortAddress(address);
  const tierValue =
    tier.status === "loading"
      ? null
      : tier.status === "error"
        ? "Tap to retry"
        : tier.tier.tier === "verified_seeker"
          ? "Verified"
          : "Unverified";

  const copyAddress = async () => {
    await Clipboard.setStringAsync(address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You can sign back in with the same wallet anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => void signOut(),
      },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Heading>{name}</Heading>
        </View>

        <View style={styles.identity}>
          <Avatar name={profile?.username ?? address} size={64} />
          <View style={styles.stats}>
            <Stat
              label="Seeker Tier"
              minWidth={TIER_STAT_WIDTH}
              value={tierValue}
              onPress={tier.status === "error" ? () => void refreshTier() : undefined}
            />
            <Stat label="Wallet" value={shortAddress(address)} />
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label={copied ? "Copied" : "Copy Address"}
            size="medium"
            onPress={() => void copyAddress()}
            containerStyle={styles.action}
          />
          <Button
            label="View on Explorer"
            variant="secondary"
            size="medium"
            onPress={() => void WebBrowser.openBrowserAsync(explorerAddressUrl(address))}
            containerStyle={styles.action}
          />
        </View>

        <Heading style={styles.section}>Settings</Heading>

        <ListGroup style={styles.firstGroup}>
          <ListRow icon={<RowIcon name="info" />} label="Version" value={Constants.expoConfig?.version} />
        </ListGroup>

        <ListGroup style={styles.group}>
          <ListRow label="Sign Out" tone="destructive" onPress={confirmSignOut} />
        </ListGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 24 },
  header: {
    marginTop: layout.navTop,
    height: layout.navHeight,
    justifyContent: "center",
  },
  identity: {
    marginTop: 6.17,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  stats: { marginLeft: 25, flexDirection: "row", gap: 24.67 },
  actions: {
    marginTop: 16.33,
    marginHorizontal: 16,
    flexDirection: "row",
    gap: 10.33,
  },
  action: { flex: 1 },
  section: { marginTop: 27 },
  firstGroup: { marginTop: 6 },
  group: { marginTop: layout.groupGap },
});
