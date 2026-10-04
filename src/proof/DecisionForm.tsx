import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Review } from "@/auth/api";
import { FlowCard, FlowNotice, flowStyles } from "@/components/ui/Flow";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { colors, fonts } from "@/theme";
import { formatUnits } from "@/wallet/format";

export function DecisionForm({
  review,
  form,
  reason,
  onReason,
  payScout,
  onPayScout,
}: {
  review: Review;
  form: "dispute" | "resolve";
  reason: string;
  onReason: (value: string) => void;
  payScout: boolean;
  onPayScout: (value: boolean) => void;
}) {
  const saved = review.preparedReason !== null;
  return (
    <>
      <Text style={flowStyles.title}>
        {form === "dispute" ? "What’s missing?" : "Choose a fair outcome."}
      </Text>
      <Text style={s.intro}>
        {form === "dispute"
          ? "Explain which requirements weren’t met. The resolver will see your reason and the submission."
          : "Compare the requirements, submission and dispute before deciding where the reward goes."}
      </Text>
      <FlowCard title="Bounty">
        <Text style={s.title}>{review.title}</Text>
        <Text style={s.reward}>
          {formatUnits(review.amount, review.decimals)} {review.symbol} in escrow · Test mode
        </Text>
      </FlowCard>
      {form === "resolve" ? (
        <View style={s.choices}>
          {[true, false].map((pay) => (
            <Pressable
              key={String(pay)}
              accessibilityRole="radio"
              accessibilityState={{ checked: payScout === pay, disabled: saved }}
              disabled={saved}
              onPress={() => onPayScout(pay)}
              style={[s.choice, payScout === pay && s.selected]}
            >
              <Icon
                name={{
                  ios: payScout === pay ? "largecircle.fill.circle" : "circle",
                  android: payScout === pay ? "radio_button_checked" : "radio_button_unchecked",
                  web: payScout === pay ? "radio_button_checked" : "radio_button_unchecked",
                }}
                size={22}
                color={payScout === pay ? colors.primary : colors.textSecondary}
              />
              <View style={s.flex}>
                <Text style={s.title}>{pay ? "Pay the scout" : "Refund the poster"}</Text>
                <Text style={flowStyles.muted}>
                  {pay ? "The submission meets the requirements." : "The submission does not meet the requirements."}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {saved ? (
        <FlowCard title="Your saved reason">
          <Text style={flowStyles.body}>{reason}</Text>
          <Text style={[flowStyles.muted, { marginTop: 12 }]}>
            This reason is already attached to your pending decision. Retry to finish confirming it.
          </Text>
        </FlowCard>
      ) : (
        <View>
          <TextField
            label={form === "dispute" ? "Reason for dispute" : "Reason for resolution"}
            value={reason}
            onChangeText={onReason}
            accessibilityLabel="Decision reason"
            placeholder={
              form === "dispute"
                ? "Which requirement hasn’t been met?"
                : "Explain how the evidence supports this outcome…"
            }
            multiline
            maxLength={500}
            showCount
          />
          <Text style={s.hint}>
            {reason.trim().length < 10
              ? `Add at least ${10 - reason.trim().length} more characters.`
              : "Be specific about the evidence. Your reason will be shared."}
          </Text>
        </View>
      )}
      <FlowNotice
        title={form === "dispute" ? "Funds stay protected" : "This decision is final"}
        message={
          form === "dispute"
            ? "A dispute locks the reward until the designated resolver settles it. No refund happens automatically."
            : `${payScout ? "The scout" : "The poster"} receives the escrowed reward once Solana confirms. You’ll review the transaction in your wallet.`
        }
      />
    </>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  intro: { ...flowStyles.body, color: colors.textSecondary, marginHorizontal: 20 },
  title: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, color: colors.text },
  reward: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.primary, marginTop: 6 },
  hint: {
    marginHorizontal: 20,
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  choices: { marginHorizontal: 20, gap: 10 },
  choice: {
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceRaised },
});
