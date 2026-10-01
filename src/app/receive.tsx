import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { useSession } from "@/auth/session-context";
import { ActionIcon } from "@/components/ui/ActionIcon";
import { Button } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { Screen } from "@/components/ui/Screen";
import { colors, fonts, layout } from "@/theme";

const COPIED_MS = 1500;
const QR_CARD_MAX = 294;
const QR_CARD_INSET = 49.5;
const QR_PADDING = 18;
const QR_CARD_MIN = 160;
// Chip (36) + QR gap (20) + address row (38) + vertical padding (40).
const BODY_CHROME = 134;

const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

export default function Receive() {
  const { session } = useSession();
  const [copied, setCopied] = useState(false);
  const { width } = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState(0);
  const qrCard = Math.max(
    QR_CARD_MIN,
    Math.min(QR_CARD_MAX, width - QR_CARD_INSET * 2, bodyHeight ? bodyHeight - BODY_CHROME : QR_CARD_MAX),
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!session) return null;
  const address = session.walletAddress;

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Receive
        </Text>
        <Pressable accessibilityLabel="Close" hitSlop={12} onPress={() => router.back()} style={styles.close}>
          <ActionIcon name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onLayout={(event) => setBodyHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Solana</Text>
        </View>
        <View style={[styles.qr, { width: qrCard, height: qrCard }]}>
          <QrCode value={address} size={qrCard - QR_PADDING * 2} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy address"
          hitSlop={8}
          onPress={() => void copy()}
          style={styles.address}
        >
          <Text style={styles.addressText}>{copied ? "Copied" : shortAddress(address)}</Text>
          {copied ? null : <ActionIcon name="copy" size={15} color={colors.muted} />}
        </Pressable>
      </ScrollView>

      <Text style={styles.note}>Use to receive SKR and USDC on the Solana network only.</Text>
      <View style={styles.actions}>
        <Button
          label={copied ? "Copied" : "Copy address"}
          variant="secondary"
          size="medium"
          onPress={() => void copy()}
          containerStyle={styles.action}
        />
        <Button
          label="Share"
          variant="secondary"
          size="medium"
          onPress={() => void Share.share({ message: address })}
          containerStyle={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: layout.navTop,
    height: layout.navHeight,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 21, lineHeight: 28, color: colors.text },
  close: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  body: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  chipLabel: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 18, color: colors.text },
  qr: {
    marginTop: 20,
    padding: QR_PADDING,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  address: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 6 },
  addressText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
  note: {
    marginHorizontal: 32,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
  },
  actions: {
    marginTop: 14,
    marginBottom: layout.bottomGap,
    marginHorizontal: 16,
    flexDirection: "row",
    gap: 10.33,
  },
  action: { flex: 1 },
});
