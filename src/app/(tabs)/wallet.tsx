import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "@/auth/session-context";
import { ActionTile } from "@/components/ui/ActionTile";
import { Avatar } from "@/components/ui/Avatar";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { TokenRow, trendColor } from "@/components/ui/TokenRow";
import { explorerAddressUrl } from "@/constants/app-config";
import { useWalletTokens } from "@/hooks/use-wallet-tokens";
import { colors, fonts, layout } from "@/theme";
import {
  formatSignedPercent,
  formatSignedUsd,
  formatUnits,
  formatUsd,
  portfolioValue,
  tokenValue,
  trend,
} from "@/wallet/format";

const TOKEN_META = {
  SKR: { name: "Seeker", icon: require("@/assets/images/tokens/skr.png") },
  USDC: { name: "USDC", icon: require("@/assets/images/tokens/usdc.png") },
};

const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

export default function Wallet() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useSession();
  const { state, refreshing, refresh, retry } = useWalletTokens(session);

  if (!session) return null;

  const address = session.walletAddress;
  const name = profile?.username ? `@${profile.username}` : shortAddress(address);
  const tokens = state.status === "ready" ? state.tokens : [];
  const total = portfolioValue(tokens);
  const totalTrend = trend(total.change);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Avatar name={profile?.username ?? address} size={40} />
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.muted}
            colors={[colors.onPrimary]}
            progressBackgroundColor={colors.primary}
          />
        }
      >
        <View style={styles.balance}>
          {state.status === "loading" ? (
            <ActivityIndicator color={colors.muted} />
          ) : state.status === "error" ? (
            <RetryMessage title="Couldn’t load balances" onRetry={retry} />
          ) : (
            <>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.total}>
                {formatUsd(total.value)}
              </Text>
              <View style={styles.changeRow}>
                <Text style={[styles.change, trendColor[totalTrend]]}>{formatSignedUsd(total.change)}</Text>
                <View style={[styles.pill, pillColor[totalTrend]]}>
                  <Text style={[styles.change, trendColor[totalTrend]]}>{formatSignedPercent(total.percent)}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.actions}>
          <ActionTile icon="receive" label="Receive" onPress={() => router.push("/receive")} />
          <ActionTile
            icon="explorer"
            label="Explorer"
            onPress={() => void WebBrowser.openBrowserAsync(explorerAddressUrl(address, "mainnet"))}
          />
        </View>
        {state.status === "ready" && state.stale ? (
          <Text style={styles.stale}>Couldn’t refresh. Showing your last loaded balances.</Text>
        ) : null}

        <View style={styles.tokens}>
          {tokens.map((token) => {
            const meta = TOKEN_META[token.symbol];
            const value = tokenValue(token);
            return (
              <TokenRow
                key={token.mint}
                icon={meta.icon}
                name={meta.name}
                amount={`${formatUnits(token.amount, token.decimals)} ${token.symbol}`}
                value={value ? formatUsd(value.value) : null}
                change={value ? formatSignedUsd(value.change) : null}
                trend={value ? trend(value.change) : "flat"}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const pillColor = StyleSheet.create({
  up: { backgroundColor: "rgba(0, 192, 136, 0.16)" },
  down: { backgroundColor: "rgba(237, 63, 29, 0.16)" },
  flat: { backgroundColor: colors.surface },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    marginTop: layout.navTop,
    height: layout.navHeight,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: { flexShrink: 1, fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text },
  content: { paddingBottom: 24 },
  balance: { height: 116, marginHorizontal: 16, alignItems: "center", justifyContent: "center" },
  total: { fontFamily: fonts.bold, fontSize: 52, lineHeight: 62, color: colors.text, letterSpacing: -1 },
  changeRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 8 },
  change: { fontFamily: fonts.semiBold, fontSize: 18, lineHeight: 24 },
  pill: { paddingHorizontal: 5, borderRadius: 6 },
  actions: { marginTop: 18, marginHorizontal: 16, flexDirection: "row", gap: 9.33 },
  tokens: { marginTop: 22, gap: 8.67 },
  stale: {
    marginTop: 14,
    marginHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
  },
});
