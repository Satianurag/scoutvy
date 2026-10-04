import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { useDraft } from "@/post/draft";
import { DURATION_OPTIONS } from "@/post/options";
import { PostFooter, PostHeader, PostHeading, PostNote, usePostStep } from "@/post/ui";
import { colors, fonts } from "@/theme";
export default function PostDuration() {
  const { draft, update } = useDraft();
  const { editing, advance } = usePostStep("/post/review");
  return (
    <Screen>
      <PostHeader step={5} title="Duration" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <PostHeading title="Set a time limit" description="Starts when your bounty is posted." />
        <View style={s.options}>
          {DURATION_OPTIONS.map((option) => {
            const selected = draft.durationHours === option.hours;
            return (
              <Pressable
                key={option.hours}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => update({ durationHours: option.hours })}
                style={[s.option, selected && s.selected]}
              >
                <View style={s.flex}>
                  <View style={s.line}>
                    <Text style={s.label}>{option.label}</Text>
                  </View>
                </View>
                <View style={[s.radio, selected && s.radioOn]}>
                  {selected ? (
                    <Icon
                      name={{ ios: "checkmark", android: "check", web: "check" }}
                      size={14}
                      color={colors.onPrimary}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <PostNote title="After expiry">
          If no work is submitted, you can claim a refund from the bounty details.
        </PostNote>
      </ScrollView>
      <PostFooter label={editing ? "Save duration" : "Review bounty"} onPress={advance} />
    </Screen>
  );
}
const s = StyleSheet.create({
  content: { paddingBottom: 24 },
  flex: { flex: 1 },
  options: { marginHorizontal: 20, marginBottom: 24, gap: 12 },
  option: {
    minHeight: 68,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceRaised },
  line: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  label: { fontFamily: fonts.semiBold, fontSize: 18, color: colors.text },
  tag: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.primary,
    backgroundColor: "#322B45",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detail: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  radio: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
});
