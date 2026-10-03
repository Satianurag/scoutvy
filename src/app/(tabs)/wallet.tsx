import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/auth/session-context";
import { ActionTile } from "@/components/ui/ActionTile";
import { Avatar } from "@/components/ui/Avatar";
import { BrowseSheet, Choice } from "@/components/ui/Browse";
import { useAppDialog } from "@/components/ui/AppDialog";
import { FlowDetail, FlowFooter, FlowNotice } from "@/components/ui/Flow";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { TokenRow, trendColor } from "@/components/ui/TokenRow";
import { explorerAddressUrl } from "@/constants/app-config";
import { useWalletTokens, type WalletNetwork } from "@/hooks/use-wallet-tokens";
import { TOKEN_META } from "@/post/options";
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
import type { WalletToken } from "@/auth/api";
const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
export default function Wallet() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useSession();
  const [network, setNetwork] = useState<WalletNetwork>("devnet");
  const [selected, setSelected] = useState<WalletToken | null>(null);
  const { state, refreshing, refresh, retry } = useWalletTokens(session, network);
  const dialog = useAppDialog();
  if (!session) return null;
  const address = session.walletAddress;
  const tokens = state.status === "ready" ? state.tokens : [];
  const total = portfolioValue(tokens);
  const priced = tokens.every((t) => t.amount === "0" || t.usdPrice !== null);
  const changeKnown = tokens.every((t) => t.amount === "0" || t.priceChange24h !== null);
  const usdc = tokens.find((t) => t.symbol === "USDC");
  const devnet = network === "devnet";
  const open = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      dialog({ title: "Couldn’t open the link", message: "Try again in a moment.", tone: "info" });
    }
  };
  const receive = () => router.push({ pathname: "/receive", params: { network } });
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
      <View style={styles.networks}>
        {(
          [
            ["devnet", "Devnet"],
            ["mainnet", "Mainnet"],
          ] as const
        ).map(([key, label]) => (
          <Choice
            key={key}
            label={label}
            selected={network === key}
            onPress={() => {
              setSelected(null);
              setNetwork(key);
            }}
          />
        ))}
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
          <Text style={styles.caption}>{devnet ? "AVAILABLE FOR BOUNTIES" : "TRACKED TOKEN VALUE"}</Text>
          {state.status === "loading" ? (
            <ActivityIndicator style={{ margin: 28 }} color={colors.primary} />
          ) : state.status === "error" ? (
            <RetryMessage title="Couldn’t load balances" onRetry={retry} />
          ) : (
            <>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.total}>
                {devnet
                  ? usdc
                    ? formatUnits(usdc.amount, usdc.decimals)
                    : "—"
                  : priced
                    ? formatUsd(total.value)
                    : "—"}
              </Text>
              {devnet ? (
                <Text style={styles.unit}>USDC · Test tokens</Text>
              ) : priced && changeKnown ? (
                <Text style={[styles.change, trendColor[trend(total.change)]]}>
                  {formatSignedUsd(total.change)} ({formatSignedPercent(total.percent)}) · 24h
                </Text>
              ) : (
                <Text style={styles.caption}>
                  {priced ? "24h change unavailable" : "Some market prices are unavailable"}
                </Text>
              )}
            </>
          )}
        </View>
        <View style={styles.actions}>
          <ActionTile icon="receive" label="Receive" onPress={receive} />
          <ActionTile
            icon="explorer"
            label="Explorer"
            onPress={() => void open(explorerAddressUrl(address, network))}
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
          <Text style={styles.sectionTitle}>{devnet ? "Bounty tokens" : "Tracked tokens"}</Text>
          <Text style={styles.caption}>{devnet ? "Solana Devnet" : "SKR & USDC · Solana Mainnet"}</Text>
        </View>
        <View style={styles.tokens}>
          {tokens.map((token) => {
            const value = tokenValue(token);
            return (
              <TokenRow
                key={token.mint}
                icon={TOKEN_META[token.symbol].icon}
                name={token.symbol === "SKR" ? "Seeker" : "USDC"}
                amount={`${formatUnits(token.amount, token.decimals)} ${token.symbol}`}
                value={devnet ? "Test token" : value ? formatUsd(value.value) : "Price unavailable"}
                change={
                  !devnet && value && token.priceChange24h !== null ? formatSignedUsd(value.change) : null
                }
                trend={value ? trend(value.change) : "flat"}
                onPress={() => setSelected(token)}
              />
            );
          })}
        </View>
        {devnet && state.status === "ready" ? (
          <View style={styles.gas}>
            <View style={styles.gasTop}>
              <Text style={styles.name}>SOL balance</Text>
              <Text style={styles.gasAmount}>{state.sol === null ? "—" : formatUnits(state.sol, 9)} SOL</Text>
            </View>
            <Text style={styles.caption}>Available for transaction fees.</Text>
          </View>
        ) : null}
        {devnet ? (
          <FlowNotice
            title="Bounties run on Devnet"
            message="Test tokens only. Mainnet funds can’t fund these bounties."
            action={{ label: "Receive test tokens", onPress: receive }}
          />
        ) : (
          <Text style={styles.note}>
            This view tracks SKR and USDC only. Mainnet balances cannot fund Devnet bounties.
          </Text>
        )}
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
                onPress: () => void open(explorerAddressUrl(selected.mint, network)),
              }}
            />
          }
        >
          <Text style={styles.detailAmount}>
            {formatUnits(selected.amount, selected.decimals)} {selected.symbol}
          </Text>
          <View style={styles.detailCard}>
            <FlowDetail label="Network" value={`Solana ${devnet ? "Devnet · Test tokens" : "Mainnet"}`} />
            <Text style={styles.caption}>Token address</Text>
            <Text selectable style={styles.mint}>
              {selected.mint}
            </Text>
          </View>
          <Text style={styles.note}>
            {devnet
              ? "Available balance in your wallet. Rewards already locked in escrow are not included."
              : "Your available wallet balance for this token."}
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
  networks: { flexDirection: "row", gap: 8, marginHorizontal: 20, marginTop: 16, marginBottom: 10 },
  content: { paddingBottom: 28, gap: 20 },
  balance: {
    minHeight: 148,
    marginHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
  },
  total: {
    fontFamily: fonts.bold,
    fontSize: 52,
    lineHeight: 64,
    color: colors.text,
    letterSpacing: -1,
    marginTop: 8,
  },
  unit: { fontFamily: fonts.medium, fontSize: 16, color: colors.textSecondary, marginTop: 2 },
  change: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 21 },
  actions: { marginHorizontal: 20, flexDirection: "row", gap: 10 },
  section: { marginHorizontal: 20, gap: 4 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 18, color: colors.text },
  tokens: { gap: 10 },
  gas: { marginHorizontal: 20, padding: 16, borderRadius: 18, backgroundColor: colors.surface, gap: 10 },
  gasTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  gasAmount: { fontFamily: fonts.medium, fontSize: 15, color: colors.primary },
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
