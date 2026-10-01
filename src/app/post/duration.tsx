import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { ListGroup } from "@/components/ui/ListGroup";
import { NavBar } from "@/components/ui/NavBar";
import { OptionRow } from "@/components/ui/OptionRow";
import { Reveal } from "@/components/ui/Reveal";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";
import { useDraft } from "@/post/draft";
import { DURATION_OPTIONS, formatEnds } from "@/post/options";

export default function PostDuration() {
  const { draft, update } = useDraft();
  const [now] = useState(() => Date.now());

  return (
    <Screen>
      <NavBar title="Duration" />
      <ScrollView contentContainerStyle={styles.content}>
        <Reveal>
          <Title>How long is it open?</Title>
          <Subtitle style={styles.subtitle}>If no scout submits proof in time, the bounty closes.</Subtitle>
        </Reveal>
        <Reveal order={1} style={styles.list}>
          <ListGroup>
            {DURATION_OPTIONS.map((option) => (
              <OptionRow
                key={option.hours}
                label={option.label}
                detail={`Ends ${formatEnds(new Date(now + option.hours * 3_600_000))}`}
                selected={draft.durationHours === option.hours}
                onPress={() => update({ durationHours: option.hours })}
              />
            ))}
          </ListGroup>
        </Reveal>
      </ScrollView>
      <BottomActions>
        <Button label="Next" onPress={() => router.push("/post/review")} />
      </BottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 20, paddingBottom: 24 },
  subtitle: { marginTop: 10 },
  list: { marginTop: 28 },
});
