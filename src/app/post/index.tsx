import { router } from "expo-router";
import { KeyboardAvoidingView, ScrollView, StyleSheet } from "react-native";

import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { NavBar } from "@/components/ui/NavBar";
import { Reveal } from "@/components/ui/Reveal";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Subtitle, Title } from "@/components/ui/Typography";
import { useDraft } from "@/post/draft";
import { INSTRUCTIONS_LENGTH, TITLE_LENGTH } from "@/post/options";

export default function PostDetails() {
  const { draft, update } = useDraft();
  const title = draft.title.trim();
  const instructions = draft.instructions.trim();
  const valid = title.length >= TITLE_LENGTH.min && instructions.length >= INSTRUCTIONS_LENGTH.min;

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <NavBar title="New Bounty" />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Reveal>
            <Title>What needs proof?</Title>
            <Subtitle style={styles.subtitle}>Describe exactly what a scout should capture at the location.</Subtitle>
          </Reveal>
          <Reveal order={1} style={styles.field}>
            <TextField
              label="Title"
              value={draft.title}
              onChangeText={(value) => update({ title: value.replace(/\n/g, " ") })}
              placeholder="Is the bakery on 5th open?"
              accessibilityLabel="Title"
              maxLength={TITLE_LENGTH.max}
              showCount
              autoFocus
              returnKeyType="next"
            />
          </Reveal>
          <Reveal order={2} style={styles.field}>
            <TextField
              label="Proof needed"
              value={draft.instructions}
              onChangeText={(value) => update({ instructions: value })}
              placeholder="A clear photo of the storefront showing today's opening hours."
              accessibilityLabel="Proof needed"
              maxLength={INSTRUCTIONS_LENGTH.max}
              showCount
              multiline
              submitBehavior="newline"
              returnKeyType="default"
            />
          </Reveal>
        </ScrollView>
        <BottomActions>
          <Button label="Next" disabled={!valid} onPress={() => router.push("/post/location")} />
        </BottomActions>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: 20, paddingBottom: 24 },
  subtitle: { marginTop: 10 },
  field: { marginTop: 28 },
});
