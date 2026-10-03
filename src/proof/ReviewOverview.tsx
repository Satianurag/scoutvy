import type { ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Review } from "@/auth/api";
import { FlowCard, FlowDetail, FlowNotice, FlowPill, RewardHero, flowStyles } from "@/components/ui/Flow";
import { Icon } from "@/components/ui/Icon";
import { ProofImage } from "@/proof/ProofImage";
import { formatTimeLeft } from "@/explore/format";
import { formatEnds } from "@/post/options";
import { formatUnits } from "@/wallet/format";
import { colors, fonts } from "@/theme";

export function reviewIsClosed(review: Review) {
  return ["paid", "refunded", "cancelled", "expired"].includes(review.status);
}
export function reviewMessage(review: Review, now: number) {
  if (review.status === "paid") return "Solana confirmed the reward was paid to the accepted scout.";
  if (review.status === "refunded")
    return "The dispute is resolved. Solana confirmed the refund to the poster.";
  if (review.status === "cancelled" || review.status === "expired")
    return "The reward was returned to the poster before this photo was protected. This submission cannot be paid.";
  if (!review.protected) return "Your photo is saved. Protect the escrow to start the 48-hour review window.";
  if (review.status === "disputed")
    return "The reward stays locked while the designated resolver reviews the photo and dispute.";
  if (review.deadline && Date.parse(review.deadline) <= now)
    return "The review window has ended. The undisputed reward can now be released to the accepted scout.";
  return review.role === "poster"
    ? "Compare the photo with your request. Approve to pay the scout, or explain what is missing."
    : "The poster has 48 hours from escrow protection to review. After that, you can release an undisputed reward.";
}
const labels = {
  pending_review: "Awaiting review",
  disputed: "In dispute",
  paid: "Reward paid",
  refunded: "Reward refunded",
  cancelled: "Bounty cancelled",
  expired: "Bounty expired",
};
export function ReviewOverview({
  review,
  now,
  source,
  onImageReady,
  onExplorer,
}: {
  review: Review;
  now: number;
  source: ImageSource;
  onImageReady: (ready: boolean) => void;
  onExplorer: () => void;
}) {
  const terminal = reviewIsClosed(review);
  return (
    <>
      <View style={s.status}>
        <FlowPill
          label={labels[review.status]}
          tone={review.status === "paid" ? "green" : review.status === "disputed" ? "orange" : "purple"}
        />
        {review.deadline && !terminal && review.status !== "disputed" ? (
          <Text style={s.timer}>{formatTimeLeft(review.deadline, now)}</Text>
        ) : null}
      </View>
      {terminal ? (
        <RewardHero
          amount={formatUnits(review.amount, review.decimals)}
          symbol={review.symbol}
          caption={
            review.status === "paid"
              ? "Paid to the scout · Solana Devnet"
              : "Returned to the poster · Solana Devnet"
          }
        />
      ) : null}
      <Text style={flowStyles.title}>{review.title}</Text>
      <ProofImage key={review.proofId} source={source} onReady={onImageReady} />
      <FlowNotice
        title={
          terminal
            ? "Confirmed on Solana"
            : !review.protected
              ? "Escrow protection needed"
              : review.status === "disputed"
                ? "Waiting for resolution"
                : "What happens next"
        }
        message={reviewMessage(review, now)}
      />
      <FlowCard title="THE ORIGINAL REQUEST">
        <Text style={flowStyles.body}>{review.instructions}</Text>
      </FlowCard>
      {review.disputeReason ? (
        <FlowCard title="POSTER’S DISPUTE">
          <Text style={flowStyles.body}>{review.disputeReason}</Text>
        </FlowCard>
      ) : null}
      {review.resolutionReason ? (
        <FlowCard title="RESOLVER’S DECISION">
          <Text style={flowStyles.body}>{review.resolutionReason}</Text>
        </FlowCard>
      ) : null}
      <FlowCard>
        <FlowDetail
          label={terminal ? "Reward" : "Reward held in escrow"}
          value={`${formatUnits(review.amount, review.decimals)} ${review.symbol}`}
        />
        <FlowDetail label="Submitted" value={formatEnds(new Date(review.receivedAt))} />
        {review.deadline && !terminal ? (
          <FlowDetail label="Review deadline" value={formatEnds(new Date(review.deadline))} />
        ) : null}
        {review.settledAt ? (
          <FlowDetail label="Settled" value={formatEnds(new Date(review.settledAt))} />
        ) : null}
        <FlowDetail label="Network" value="Solana Devnet · Test tokens" last />
      </FlowCard>
      {review.signature ? (
        <Pressable accessibilityRole="link" onPress={onExplorer} style={s.explorer}>
          <Icon
            name={{ ios: "arrow.up.right", android: "north_east", web: "north_east" }}
            size={17}
            color={colors.primary}
          />
          <Text style={s.link}>View transaction on Explorer</Text>
        </Pressable>
      ) : null}
    </>
  );
}
const s = StyleSheet.create({
  status: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  timer: { color: colors.primary, fontFamily: fonts.medium, fontSize: 12 },
  explorer: {
    minHeight: 48,
    marginHorizontal: 20,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { fontFamily: fonts.medium, color: colors.primary, fontSize: 14 },
});
