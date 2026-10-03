import { router, useLocalSearchParams } from "expo-router";
import type { ComponentProps, PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { colors, fonts, layout } from "@/theme";
import { useDraft } from "@/post/draft";

export function usePostStep(next: "/post/location" | "/post/token" | "/post/duration" | "/post/review") {
  const { edit, returnToReview } = useLocalSearchParams<{ edit?: string; returnToReview?: string }>();
  return { editing: edit === "1", advance: () => returnToReview === "1" ? router.replace("/post/review") : edit === "1" ? router.back() : router.push(next) };
}
export function PostHeader({ step, title, onBack }: { step: number; title: string; onBack?: () => void }) {
  const { draft } = useDraft();
  const total = draft.taskMode === "remote" ? 5 : 6;
  const current = draft.taskMode === "remote" && step > 2 ? step - 1 : step;
  return (
    <View style={s.header}>
      <View style={s.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack ?? (() => router.back())}
          style={s.back}
        >
          <Icon
            name={{ ios: "chevron.left", android: "arrow_back_ios_new", web: "arrow_back_ios_new" }}
            size={20}
          />
        </Pressable>
        <Text style={s.navTitle}>{title}</Text>
        <Text style={s.step}>{current} of {total}</Text>
      </View>
      <View accessibilityLabel={`Step ${current} of ${total}`} style={s.progress}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[s.segment, i < current && s.complete]} />
        ))}
      </View>
    </View>
  );
}
export function PostHeading({ title, description }: { title: string; description: string }) {
  return (
    <View style={s.heading}>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      <Text style={s.description}>{description}</Text>
    </View>
  );
}
export function PostFooter({ note, ...props }: ComponentProps<typeof Button> & { note?: string }) {
  return (
    <View style={s.footer}>
      {note ? <Text style={s.footnote}>{note}</Text> : null}
      <Button {...props} style={s.button} />
    </View>
  );
}
export function NetworkBadge() {
  return (
    <View style={s.badge}>
      <View style={s.dot} />
      <Text style={s.badgeText}>Test mode · Test tokens</Text>
    </View>
  );
}
export function PostNote({
  title,
  children,
  warning = false,
}: PropsWithChildren<{ title: string; warning?: boolean }>) {
  return (
    <View style={[s.note, warning && s.warning]}>
      <Icon
        name={{ ios: "info.circle", android: "info", web: "info" }}
        size={19}
        color={warning ? colors.orange : colors.textSecondary}
      />
      <View style={s.flex}>
        <Text style={s.noteTitle}>{title}</Text>
        <Text style={s.noteBody}>{children}</Text>
      </View>
    </View>
  );
}
export const postStyles = StyleSheet.create({
  body: { paddingBottom: 24 },
  group: { marginHorizontal: 20, borderRadius: 20, backgroundColor: colors.surface, overflow: "hidden" },
  label: {
    marginHorizontal: 20,
    marginBottom: 12,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
});
const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingBottom: 12 },
  nav: { height: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  back: { width: 44, height: 44, justifyContent: "center" },
  navTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 17, color: colors.text },
  step: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  progress: { flexDirection: "row", gap: 5, marginHorizontal: 20 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceRaised },
  complete: { backgroundColor: colors.primary },
  heading: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28 },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.text,
  },
  description: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  footer: { paddingTop: 14, paddingBottom: 18, gap: 12, backgroundColor: colors.background },
  footnote: {
    marginHorizontal: 28,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: "center",
  },
  button: { minHeight: layout.buttonHeight, marginHorizontal: layout.gutter, borderRadius: layout.buttonRadius },
  badge: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textSecondary },
  badgeText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  note: {
    marginHorizontal: 20,
    padding: 16,
    gap: 12,
    flexDirection: "row",
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
  },
  warning: { backgroundColor: colors.warningSurface },
  noteTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  noteBody: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});
