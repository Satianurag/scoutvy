import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { NavBar } from "@/components/ui/NavBar";
import { Reveal } from "@/components/ui/Reveal";
import { Screen } from "@/components/ui/Screen";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useDraft } from "@/post/draft";
import { normalizeAmount } from "@/post/amount";
import { DURATION_OPTIONS, formatEnds, formatRadius } from "@/post/options";
import { colors, fonts } from "@/theme";

export default function PostReview() {
  const { draft } = useDraft();
  const { token, place } = draft;
  const [now] = useState(() => Date.now());
  if (!token || !place) return null;

  const duration = DURATION_OPTIONS.find((option) => option.hours === draft.durationHours);
  const ends = formatEnds(new Date(now + draft.durationHours * 3_600_000));

  return (
    <Screen>
      <NavBar title="Summary" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal>
          <AmountDisplay amount={normalizeAmount(draft.amount)} symbol={token.symbol} caption="Reward" />
        </Reveal>
        <Reveal order={1} style={styles.card}>
          <SummaryCard
            items={[
              { label: "Bounty", value: draft.title.trim() },
              { label: "Location", value: place.label },
              { label: "Radius", value: formatRadius(draft.radiusM) },
              { label: "Open for", value: duration?.label ?? `${draft.durationHours} hours` },
              { label: "Ends", value: ends },
              { label: "Network", value: "Solana Devnet" },
            ]}
          />
        </Reveal>
        <Reveal order={2} style={styles.card}>
          <SummaryCard items={[{ label: "Proof needed", value: draft.instructions.trim(), stacked: true }]} />
        </Reveal>
      </ScrollView>
      <BottomActions>
        <Text style={styles.note}>Posting locks the reward on-chain in Scoutvy escrow.</Text>
        <Button label="Post Bounty" onPress={() => router.push("/post/status")} />
      </BottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 28, paddingBottom: 24 },
  card: { marginTop: 24 },
  note: {
    marginHorizontal: 24,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
