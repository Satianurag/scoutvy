import type { ImageSource } from "expo-image";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
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
    return "The reward was returned to the poster before this submission was protected. This submission cannot be paid.";
  if (!review.protected) return "The submission is saved. Solana confirmation is needed before the 48-hour review window starts.";
  if (review.status === "disputed")
    return "The reward stays locked while the resolver reviews the submission and dispute.";
  if (review.deadline && Date.parse(review.deadline) <= now)
    return "The review window has ended. The undisputed reward can now be released to the accepted scout.";
  return review.role === "poster"
    ? "Check the submission against your requirements. Approve to pay the scout, or explain what is missing."
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
          label={!terminal && !review.protected ? "Confirmation pending" : labels[review.status]}
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
              ? "Paid to the scout · Test mode"
              : "Returned to the poster · Test mode"
          }
        />
      ) : null}
      <Text style={flowStyles.title}>{review.title}</Text>
      <FlowCard title="REQUIREMENTS">
        <Text style={flowStyles.body}>{review.instructions}</Text>
      </FlowCard>
      {review.proofType === "written" ? (
        <WrittenSubmission text={review.writtenText ?? ""} />
      ) : <ProofImage key={review.proofId} source={source} onReady={onImageReady} />}
      <FlowNotice
        title={
          terminal
            ? "Confirmed on Solana"
            : !review.protected
              ? "Confirmation pending"
              : review.status === "disputed"
                ? "Waiting for resolution"
                : "What happens next"
        }
        message={reviewMessage(review, now)}
      />
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
        <FlowDetail label="Payment mode" value="Test tokens" last />
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
function WrittenSubmission({ text }: { text: string }) {
  const [linkError, setLinkError] = useState(false);
  return <>
    <FlowCard title="SUBMITTED WORK">
      <Text selectable style={flowStyles.body}>
        {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => /^https?:\/\//.test(part)
          ? <Text key={index} accessibilityRole="link" style={{ color: colors.primary }} onPress={() => {
            setLinkError(false);
            void Linking.openURL(part).catch(() => setLinkError(true));
          }}>{part}</Text>
          : part)}
      </Text>
    </FlowCard>
    {linkError ? <FlowNotice error title="Couldn’t open link" message="Copy the link from the submission and open it in your browser." /> : null}
  </>;
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
