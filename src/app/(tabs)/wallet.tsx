import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/auth/session-context";
import { ActionTile } from "@/components/ui/ActionTile";
import { Avatar } from "@/components/ui/Avatar";
import { BrowseSheet } from "@/components/ui/Browse";
import { useAppDialog } from "@/components/ui/AppDialog";
import { FlowDetail, FlowFooter, FlowNotice } from "@/components/ui/Flow";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { TokenRow } from "@/components/ui/TokenRow";
import { explorerAddressUrl } from "@/constants/app-config";
import { useWalletTokens } from "@/hooks/use-wallet-tokens";
import { TOKEN_META } from "@/post/options";
import { colors, fonts, layout } from "@/theme";
import { formatUnits } from "@/wallet/format";
import type { WalletToken } from "@/auth/api";
const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
export default function Wallet() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useSession();
  const [selected, setSelected] = useState<WalletToken | null>(null);
  const { state, refreshing, refresh, retry } = useWalletTokens(session, "devnet");
  const dialog = useAppDialog();
  if (!session) return null;
  const address = session.walletAddress;
  const tokens = state.status === "ready" ? state.tokens : [];
  const usdc = tokens.find((t) => t.symbol === "USDC");
  const open = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      dialog({ title: "Couldn’t open the link", message: "Try again in a moment.", tone: "info" });
    }
  };
  const receive = () => router.push("/receive");
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Avatar name={profile?.username ?? address} size={40} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.name}>
            {profile?.username ? `@${profile.username}` : shortAddress(address)}
          </Text>
          <Text style={styles.caption}>{shortAddress(address)}</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.balance}>
          <View style={styles.balanceHeading}>
            <Text style={styles.caption}>Available balance</Text>
            <Text style={styles.testMode}>Test mode</Text>
          </View>
          {state.status === "loading" ? (
            <ActivityIndicator style={{ margin: 28 }} color={colors.primary} />
          ) : state.status === "error" ? (
            <RetryMessage title="Couldn’t load balances" onRetry={retry} />
          ) : (
            <>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.total}>
                {usdc ? formatUnits(usdc.amount, usdc.decimals) : "—"}
              </Text>
              <Text style={styles.unit}>USDC</Text>
            </>
          )}
        </View>
        <View style={styles.actions}>
          <ActionTile icon="receive" label="Receive" onPress={receive} />
          <ActionTile
            icon="explorer"
            label="Explorer"
            onPress={() => void open(explorerAddressUrl(address))}
          />
        </View>
        {state.status === "ready" && state.stale ? (
          <FlowNotice
            error
            title="Couldn’t refresh balances"
            message="Showing your last loaded balances. Pull down to try again."
          />
        ) : null}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tokens</Text>
        </View>
        <View style={styles.tokens}>
          {tokens.map((token) => (
            <TokenRow
              key={token.mint}
              grouped
              icon={TOKEN_META[token.symbol].icon}
              name={token.symbol === "SKR" ? "Seeker" : "USD Coin"}
              amount={token.symbol}
              value={formatUnits(token.amount, token.decimals)}
              change={null}
              trend="flat"
              onPress={() => setSelected(token)}
            />
          ))}
        </View>
        {state.status === "ready" ? (
          <View style={styles.gas}>
            <View style={styles.gasTop}>
              <Text style={styles.gasLabel}>SOL for fees</Text>
              <Text style={styles.gasAmount}>{state.sol === null ? "—" : formatUnits(state.sol, 9)} SOL</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      {selected ? (
        <BrowseSheet
          visible
          title={selected.symbol === "SKR" ? "Seeker" : "USDC"}
          onClose={() => setSelected(null)}
          footer={
            <FlowFooter
              label="Receive"
              onPress={() => {
                setSelected(null);
                receive();
              }}
              secondary={{
                label: "View token on explorer",
                onPress: () => void open(explorerAddressUrl(selected.mint)),
              }}
            />
          }
        >
          <Text style={styles.detailAmount}>
            {formatUnits(selected.amount, selected.decimals)} {selected.symbol}
          </Text>
          <View style={styles.detailCard}>
            <FlowDetail label="Network" value="Solana Devnet" />
            <Text style={styles.caption}>Token address</Text>
            <Text selectable style={styles.mint}>
              {selected.mint}
            </Text>
          </View>
          <Text style={styles.note}>
            Available balance. Rewards held in escrow are not included.
          </Text>
        </BrowseSheet>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    marginTop: layout.navTop,
    minHeight: layout.navHeight,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  name: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 23, color: colors.text },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: colors.textSecondary },
  balanceHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  testMode: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  content: { paddingTop: 20, paddingBottom: 28, gap: 20 },
  balance: {
    minHeight: 112,
    marginHorizontal: 20,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 8,
  },
  total: {
    fontFamily: fonts.semiBold,
    fontSize: 44,
    lineHeight: 54,
    color: colors.text,
    letterSpacing: -1,
    marginTop: 2,
  },
  unit: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  actions: { marginHorizontal: 20, flexDirection: "row", gap: 10 },
  section: { marginHorizontal: 20, gap: 4, marginTop: 8, marginBottom: -8 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 18, color: colors.text },
  tokens: { marginHorizontal: 20, borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface },
  gas: { marginHorizontal: 20, padding: 16, borderRadius: 18, backgroundColor: colors.surface },
  gasLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  gasTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  gasAmount: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    marginHorizontal: 20,
  },
  detailAmount: { fontFamily: fonts.semiBold, fontSize: 32, color: colors.text },
  detailCard: { padding: 18, borderRadius: 18, backgroundColor: colors.surface },
  mint: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.text, marginTop: 8 },
});
