import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "@/components/ui/Screen";
import { useAppDialog } from "@/components/ui/AppDialog";
import { useDraft } from "@/post/draft";
import { INSTRUCTIONS_LENGTH, TITLE_LENGTH } from "@/post/options";
import { PostFooter, PostHeader, PostHeading, usePostStep } from "@/post/ui";
import { colors, fonts } from "@/theme";

export default function PostDetails() {
  const { draft, update } = useDraft();
  const { editing, advance } = usePostStep("/post/location");
  const proof = useRef<TextInput>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const showDialog = useAppDialog();
  const title = draft.title.trim();
  const instructions = draft.instructions.trim();
  const valid = title.length >= TITLE_LENGTH.min && instructions.length >= INSTRUCTIONS_LENGTH.min;
  const leave = useCallback(() => {
    if (editing || (!draft.title && !draft.instructions)) return router.back();
    showDialog({
      title: "Discard this bounty?",
      message: "Your details will be lost. Nothing has been posted or charged.",
      tone: "destructive",
      cancelLabel: "Keep editing",
      confirmLabel: "Discard bounty",
      onConfirm: () => router.back(),
    });
  }, [editing, draft.title, draft.instructions, showDialog]);
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener("hardwareBackPress", () => {
        leave();
        return true;
      });
      return () => listener.remove();
    }, [leave]),
  );
  return (
    <Screen>
      <PostHeader step={1} title={editing ? "Edit details" : "Post a bounty"} onBack={leave} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.content}
        >
          <PostHeading title="What do you need?" description="Describe the photo you want." />
          <View style={s.field}>
            <View style={s.labelRow}>
              <Text style={s.label}>Title</Text>
              <Text style={s.count}>{draft.title.length} / 60</Text>
            </View>
            <TextInput
              accessibilityLabel="Bounty title"
              style={[s.input, focused === "title" && s.focused]}
              value={draft.title}
              onChangeText={(text) => update({ title: text.replace(/\n/g, " ") })}
              maxLength={60}
              placeholder="Is the bakery on 5th open?"
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.primary}
              onFocus={() => setFocused("title")}
              onBlur={() => setFocused(null)}
              returnKeyType="next"
              onSubmitEditing={() => proof.current?.focus()}
            />
            <Text style={s.helper}>
              {title.length > 0 && title.length < 4
                ? "Add a little more detail (at least 4 characters)."
                : "4–60 characters."}
            </Text>
          </View>
          <View style={s.field}>
            <View style={s.labelRow}>
              <Text style={s.label}>What should the proof show?</Text>
              <Text style={s.count}>{draft.instructions.length} / 500</Text>
            </View>
            <TextInput
              ref={proof}
              accessibilityLabel="Proof instructions"
              style={[s.input, s.multiline, focused === "proof" && s.focused]}
              value={draft.instructions}
              onChangeText={(text) => update({ instructions: text })}
              maxLength={500}
              multiline
              textAlignVertical="top"
              placeholder="A clear photo of the storefront and today’s opening hours."
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.primary}
              onFocus={() => setFocused("proof")}
              onBlur={() => setFocused(null)}
            />
            <Text style={s.helper}>
              {instructions.length > 0 && instructions.length < 10
                ? "Use at least 10 characters to explain the proof."
                : "Include any specific details or angles."}
            </Text>
          </View>
        </ScrollView>
        <PostFooter
          label={editing ? "Save details" : "Choose location"}
          disabled={!valid}
          onPress={advance}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 24 },
  field: { marginHorizontal: 20, marginBottom: 28 },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  label: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  count: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  input: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
  focused: { borderColor: colors.primary },
  multiline: { minHeight: 156 },
  helper: {
    marginTop: 9,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
