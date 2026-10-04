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
import { PendingPostNotice } from "@/post/PendingPostNotice";
import { ModeSwitch } from "@/components/ui/ModeSwitch";
import { OptionRow } from "@/components/ui/OptionRow";
import { PostFooter, PostHeader, PostHeading, usePostStep } from "@/post/ui";
import { colors, fonts } from "@/theme";

export default function PostDetails() {
  const { draft, update, reset } = useDraft();
  const { editing, advance } = usePostStep(draft.taskMode === "remote" ? "/post/token" : "/post/location");
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
      message: "Your saved details will be removed. Any pending payment can still be recovered.",
      tone: "destructive",
      cancelLabel: "Keep editing",
      confirmLabel: "Discard bounty",
      onConfirm: () => {
        void reset().then(() => router.back()).catch(() => showDialog({
          title: "Couldn’t discard draft", message: "Please try again.", confirmLabel: "Got it",
        }));
      },
    });
  }, [editing, draft.title, draft.instructions, showDialog, reset]);
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.content}
        >
          <PendingPostNotice />
          <PostHeading title="What do you need?" description="Set the task and what counts as complete." />
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
              placeholder="Give your bounty a clear title"
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.primary}
              onFocus={() => setFocused("title")}
              onBlur={() => setFocused(null)}
              returnKeyType="next"
              onSubmitEditing={() => proof.current?.focus()}
            />
            {title.length > 0 && title.length < TITLE_LENGTH.min ? (
              <Text style={s.helper}>Add at least {TITLE_LENGTH.min} characters.</Text>
            ) : null}
          </View>
          <View style={s.field}>
            <View style={s.labelRow}>
              <Text style={s.label}>Requirements</Text>
              <Text style={s.count}>{draft.instructions.length} / 500</Text>
            </View>
            <TextInput
              ref={proof}
              accessibilityLabel="Bounty requirements"
              style={[s.input, s.multiline, focused === "proof" && s.focused]}
              value={draft.instructions}
              onChangeText={(text) => update({ instructions: text })}
              maxLength={500}
              multiline
              textAlignVertical="top"
              placeholder="Describe what needs to be done and how you’ll review it."
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.primary}
              onFocus={() => setFocused("proof")}
              onBlur={() => setFocused(null)}
            />
            {instructions.length > 0 && instructions.length < 10 ? <Text style={s.helper}>Add at least 10 characters.</Text> : null}
          </View>
          <View style={s.field}>
            <Text style={[s.label, { marginBottom: 12 }]}>Where can it be done?</Text>
            <ModeSwitch value={draft.taskMode} options={[{ value: "remote", label: "Online" }, { value: "on_site", label: "At a location" }]}
              onChange={(taskMode) => update(taskMode === "remote" ? { taskMode, proofType: "written" } : { taskMode })} />
          </View>
          <View style={s.field}>
            <Text style={[s.label, { marginBottom: 12 }]}>What should be submitted?</Text>
            <View style={{ borderRadius: 16, overflow: "hidden" }}>
              <OptionRow label="Written response or work link" selected={draft.proofType === "written"} onPress={() => update({ proofType: "written" })} />
              {draft.taskMode === "on_site" ? <OptionRow label="Photo at the location" detail="In-app camera with location check" selected={draft.proofType === "photo"} onPress={() => update({ proofType: "photo" })} /> : null}
            </View>
          </View>
        </ScrollView>
        <PostFooter
          label={editing ? "Save details" : draft.taskMode === "remote" ? "Choose reward" : "Choose location"}
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
    borderRadius: 12,
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
