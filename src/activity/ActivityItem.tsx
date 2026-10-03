import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ActivityEvent } from "@/auth/api";
import { BrowseSheet } from "@/components/ui/Browse";
import { FlowFooter } from "@/components/ui/Flow";
import { Icon } from "@/components/ui/Icon";
import { colors, fonts } from "@/theme";
import { formatUnits } from "@/wallet/format";
export const eventLabels: Record<string, string> = {
  posted: "Bounty posted",
  accepted: "Bounty accepted",
  review: "Submission received",
  submitted: "Submission sent",
  protected: "Review started",
  disputed: "Submission disputed",
  decision_prepared: "Confirmation needed",
  retry: "Payment needs attention",
  paid: "Reward paid",
  refunded: "Reward refunded",
  cancelled: "Bounty cancelled",
  expired: "Bounty expired",
  expired_open: "Refund available",
};
export const reviewKinds = new Set([
  "review",
  "submitted",
  "protected",
  "disputed",
  "decision_prepared",
  "retry",
  "paid",
  "refunded",
]);
export const rewardKinds = new Set(["paid", "refunded", "cancelled", "expired", "expired_open"]);
const descriptions: Record<string, string> = {
  posted: "The bounty was published and its reward funded in escrow.",
  accepted:
    "Your acceptance was confirmed. Open the bounty to check your deadline and continue your submission.",
  review: "A submission is ready. Open it to review the work.",
  submitted:
    "Your submission was received. Open it to check review progress.",
  protected: "The submission was confirmed and the 48-hour review window began.",
  disputed: "A dispute was recorded. Open the submission to see the reason and current status.",
  decision_prepared:
    "A decision is ready for wallet approval. Open the submission to continue or check its status.",
  retry: "Payment needs attention. Open the submission to check its status and retry.",
  paid: "The reward payment was confirmed on Solana.",
  refunded: "The reward refund was confirmed on Solana.",
  cancelled: "The bounty was cancelled and its reward returned.",
  expired: "The expired bounty’s reward was returned.",
  expired_open: "This bounty expired without a submission. Open it to check refund availability.",
};
const amount = (event: ActivityEvent) => `${formatUnits(event.amount, event.decimals)} ${event.symbol}`;
export function ActivityItem({ event, onPress }: { event: ActivityEvent; onPress: () => void }) {
  const paid = event.kind === "paid";
  const attention = ["disputed", "retry", "expired_open", "decision_prepared"].includes(event.kind);
  const color = paid ? colors.green : attention ? colors.orange : colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${eventLabels[event.kind] ?? "Bounty update"}, ${event.title}, ${amount(event)}`}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { backgroundColor: colors.surfaceRaised }]}
    >
      <View style={s.top}>
        <View style={[s.badge, { backgroundColor: `${color}16` }]}>
          <Icon
            name={
              paid
                ? { ios: "checkmark", android: "check", web: "check" }
                : attention
                  ? { ios: "exclamationmark", android: "priority_high", web: "priority_high" }
                  : { ios: "clock", android: "history", web: "history" }
            }
            size={19}
            color={color}
          />
        </View>
        <View style={s.flex}>
          <Text style={[s.kind, { color }]}>{eventLabels[event.kind] ?? "Bounty update"}</Text>
          <Text numberOfLines={2} style={s.title}>{event.title}</Text>
          <Text style={s.time}>
            {new Date(event.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            {event.mine ? " · Posted by you" : ""}
          </Text>
        </View>
        <Text style={s.amount}>{amount(event)}</Text>
      </View>
    </Pressable>
  );
}
export function ActivityDetails({
  event,
  onClose,
  onOpen,
}: {
  event: ActivityEvent;
  onClose: () => void;
  onOpen: () => void;
}) {
  return (
    <BrowseSheet
      visible
      title={eventLabels[event.kind] ?? "Bounty update"}
      onClose={onClose}
      footer={
        <FlowFooter
          label={reviewKinds.has(event.kind) ? "View submission" : "View bounty"}
          onPress={onOpen}
        />
      }
    >
      <Text style={s.detailTitle}>{event.title}</Text>
      <Text style={s.description}>
        {descriptions[event.kind] ?? "Open this bounty to see its current status."}
      </Text>
      <View style={s.detailCard}>
        <Text style={s.context}>Reward</Text>
        <Text style={s.detailAmount}>{amount(event)}</Text>
        <Text style={[s.context, { marginTop: 20 }]}>Recorded</Text>
        <Text style={s.detailValue}>{new Date(event.at).toLocaleString()}</Text>
        <Text style={[s.context, { marginTop: 20 }]}>Network</Text>
        <Text style={s.detailValue}>Solana Devnet · Test tokens</Text>
      </View>
      <Text style={s.note}>This is a recorded event. The bounty may have progressed since this update.</Text>
    </BrowseSheet>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  badge: { height: 38, width: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  kind: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 },
  title: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text, marginTop: 4 },
  context: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  amount: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 20, color: colors.text },
  detailTitle: { fontFamily: fonts.semiBold, fontSize: 26, lineHeight: 33, color: colors.text },
  description: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary },
  detailCard: { borderRadius: 18, padding: 18, backgroundColor: colors.surface },
  detailAmount: { fontFamily: fonts.semiBold, fontSize: 30, color: colors.text, marginTop: 6 },
  detailValue: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23, color: colors.text, marginTop: 6 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
});
