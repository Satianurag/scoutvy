import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSession } from "@/auth/session-context";
import { ActionIcon } from "@/components/ui/ActionIcon";
import { useAppDialog } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { Screen } from "@/components/ui/Screen";
import { colors, fonts, layout } from "@/theme";
export default function Receive() {
  const { session } = useSession();
  const label = "Solana Devnet";
  const [copied, setCopied] = useState(false);
  const { width } = useWindowDimensions();
  const dialog = useAppDialog();
  const qrSize = Math.min(260, width - 96);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  if (!session) return null;
  const address = session.walletAddress;
  const copy = async () => {
    try {
      const success = await Clipboard.setStringAsync(address);
      if (!success) throw new Error();
      setCopied(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      dialog({
        title: "Couldn’t copy address",
        message: "You can select the full address below or try again.",
        tone: "info",
      });
    }
  };
  const share = async () => {
    try {
      await Share.share({ message: `${label} address (test tokens only):\n${address}` });
    } catch {
      dialog({
        title: "Couldn’t open sharing",
        message: "Copy your address instead, or try again.",
        tone: "info",
      });
    }
  };
  return (
    <Screen>
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.title}>
          Receive
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={s.close}
        >
          <ActionIcon name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.chip}>
          <View style={s.dot} />
          <Text style={s.chipLabel}>
            Solana · Test mode
          </Text>
        </View>
        <View accessible accessibilityLabel={`${label} receiving QR code for ${address}`} style={s.qr}>
          <QrCode value={address} size={qrSize - 36} />
        </View>
        <View style={s.addressCard}>
          <Text style={s.addressLabel}>WALLET ADDRESS</Text>
          <Text selectable style={s.address}>
            {address}
          </Text>
        </View>
        <Text style={s.note}>
          Receive only Solana Devnet test tokens.
        </Text>
      </ScrollView>
      <View style={s.actions}>
        <Button
          label={copied ? "Copied" : "Copy address"}
          onPress={() => void copy()}
          containerStyle={s.action}
          style={{ marginHorizontal: 0 }}
        />
        <Button
          label="Share"
          variant="secondary"
          onPress={() => void share()}
          containerStyle={s.action}
          style={{ marginHorizontal: 0 }}
        />
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  header: {
    marginTop: layout.navTop,
    minHeight: layout.navHeight,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  title: { flex: 1, fontFamily: fonts.semiBold, fontSize: 21, color: colors.text },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { alignItems: "center", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, gap: 24 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary },
  chipLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  qr: { padding: 18, borderRadius: 24, backgroundColor: "#FFF", marginVertical: 4 },
  addressCard: {
    alignSelf: "stretch",
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  addressLabel: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1, color: colors.textSecondary },
  address: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    textAlign: "center",
    marginTop: 9,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: "center",
  },
  actions: {
    paddingTop: 12,
    marginBottom: layout.bottomGap,
    marginHorizontal: 20,
    flexDirection: "row",
    gap: 10,
  },
  action: { flex: 1 },
});
