import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BountyView } from "@/auth/api";
import { FlowCard, FlowDetail, FlowNotice, FlowPill, RewardHero, flowStyles } from "@/components/ui/Flow";
import { Icon } from "@/components/ui/Icon";
import { formatDistance, formatTimeLeft } from "@/explore/format";
import { formatEnds, formatRadius } from "@/post/options";
import { colors, fonts } from "@/theme";
import { formatUnits } from "@/wallet/format";

export function BountyOverview({
  bounty,
  now,
  onExplorer,
}: {
  bounty: BountyView;
  now: number;
  onExplorer: () => void;
}) {
  const expired = Date.parse(bounty.expiresAt) <= now;
  const open = bounty.status === "open" && !expired;
  const status =
    bounty.status === "paid"
      ? "Reward paid"
      : bounty.status === "refunded"
        ? "Reward refunded"
        : bounty.status === "cancelled"
          ? "Cancelled"
          : !open
            ? "Ended"
            : "Open bounty";
  return (
    <>
      <RewardHero
        amount={formatUnits(bounty.amount, bounty.decimals)}
        symbol={bounty.symbol}
        caption={open ? "Reward in escrow · Solana Devnet" : "Solana Devnet · Test tokens"}
      />
      <View style={s.status}>
        <FlowPill label={status} tone={open ? "green" : "neutral"} />
        <Text style={flowStyles.muted}>{open ? formatTimeLeft(bounty.expiresAt, now) : ""}</Text>
      </View>
      <Text style={flowStyles.title}>{bounty.title}</Text>
      <FlowCard title="PROOF NEEDED">
        <Text style={flowStyles.body}>{bounty.instructions}</Text>
      </FlowCard>
      <FlowCard>
        <FlowDetail label={bounty.mine ? "Location" : "Approximate area"} value={bounty.locationLabel} />
        {bounty.distanceM !== null ? (
          <FlowDetail label="Distance from you" value={formatDistance(bounty.distanceM)} />
        ) : null}
        <FlowDetail label="Capture radius" value={`${formatRadius(bounty.radiusM)} from the exact target`} />
        <FlowDetail
          label={open ? "Bounty deadline" : "Closed"}
          value={formatEnds(new Date(bounty.closedAt ?? bounty.expiresAt))}
          last
        />
      </FlowCard>
      {open && !bounty.mine ? (
        <>
          <Text style={flowStyles.section}>YOUR NEXT STEPS</Text>
          <FlowCard>
            {[
              ["Accept & reveal the spot", "Your wallet confirms the acceptance on devnet."],
              ["Go there & take a fresh photo", "Submit within your acceptance window—up to 1 hour."],
              ["Get your proof reviewed", "Payment follows the review and escrow process."],
            ].map(([title, description], index) => (
              <View key={title} style={s.step}>
                <View style={s.number}>
                  <Text style={s.numberText}>{index + 1}</Text>
                </View>
                <View style={s.flex}>
                  <Text style={s.stepTitle}>{title}</Text>
                  <Text style={flowStyles.muted}>{description}</Text>
                </View>
              </View>
            ))}
          </FlowCard>
          <FlowNotice
            title="Exact target stays private"
            message="Accepting reveals the precise location. You’ll need camera access, precise location and devnet SOL for network costs."
          />
        </>
      ) : null}
      {bounty.bountyAddress ? (
        <Pressable accessibilityRole="link" onPress={onExplorer} style={s.explorer}>
          <Icon
            name={{ ios: "arrow.up.right", android: "north_east", web: "north_east" }}
            size={17}
            color={colors.primary}
          />
          <Text style={s.link}>View escrow on Explorer</Text>
        </Pressable>
      ) : null}
    </>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  status: {
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
  },
  step: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#332D44",
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primary },
  stepTitle: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: 4 },
  explorer: {
    marginHorizontal: 20,
    minHeight: 44,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
});
