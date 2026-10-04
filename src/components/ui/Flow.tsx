import { Image } from "expo-image";
import { router } from "expo-router";
import type { ComponentProps, PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TOKEN_META } from "@/post/options";
import { FocusFrame } from "@/components/ui/Focus";
import { colors, fonts, layout } from "@/theme";

export function FlowHeader({
  title,
  onBack,
  busy = false,
  onHelp,
}: {
  title: string;
  onBack?: () => void;
  busy?: boolean;
  onHelp?: () => void;
}) {
  return (
    <View style={s.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        disabled={busy}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/explore")))}
        style={[s.back, busy && { opacity: 0.3 }]}
      >
        <Icon
          name={{ ios: "chevron.left", android: "arrow_back_ios_new", web: "arrow_back_ios_new" }}
          size={20}
        />
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      {onHelp ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How this works"
          onPress={onHelp}
          style={s.help}
        >
          <Icon
            name={{ ios: "questionmark.circle", android: "help", web: "help" }}
            size={23}
            color={colors.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
export function FlowFooter({
  secondary,
  note,
  children,
  ...button
}: ComponentProps<typeof Button> &
  PropsWithChildren<{
    note?: string;
    secondary?: { label: string; onPress: () => void; disabled?: boolean };
  }>) {
  return (
    <View style={s.footer}>
      {children}
      {note ? (
        <Text accessibilityLiveRegion="polite" style={s.footnote}>
          {note}
        </Text>
      ) : null}
      <Button {...button} style={s.button} />
      {secondary ? <Button {...secondary} variant="secondary" style={s.secondary} /> : null}
    </View>
  );
}
export function FlowPill({
  label,
  tone = "purple",
}: {
  label: string;
  tone?: "purple" | "green" | "orange" | "neutral";
}) {
  const color =
    tone === "green"
      ? colors.green
      : tone === "orange"
        ? colors.orange
        : tone === "neutral"
          ? colors.textSecondary
          : colors.primary;
  return (
    <View style={[s.pill, { backgroundColor: `${color}16` }]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={[s.pillText, { color }]}>{label}</Text>
    </View>
  );
}
export function RewardHero({
  amount,
  symbol,
  caption,
}: {
  amount: string;
  symbol: "SKR" | "USDC";
  caption: string;
}) {
  return (
    <FocusFrame style={s.hero}>
      <Image source={TOKEN_META[symbol].icon} style={s.coin} />
      <Text style={s.reward} numberOfLines={1} adjustsFontSizeToFit>
        {amount} <Text style={s.symbol}>{symbol}</Text>
      </Text>
      <Text style={s.caption}>{caption}</Text>
    </FocusFrame>
  );
}
export function FlowCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={s.card}>
      {title ? <Text style={s.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}
export function FlowDetail({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.detail, !last && s.divider]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}
export function FlowNotice({
  title,
  message,
  error = false,
  action,
}: {
  title: string;
  message: string;
  error?: boolean;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View accessibilityLiveRegion="polite" style={[s.notice, error && s.noticeError]}>
      <View style={s.noticeHeading}>
        <Icon
          name={{ ios: "info.circle", android: "info", web: "info" }}
          size={19}
          color={error ? colors.orange : colors.textSecondary}
        />
        <Text style={s.noticeTitle}>{title}</Text>
      </View>
      <Text style={s.noticeBody}>{message}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} style={s.noticeAction}>
          <Text style={s.link}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
export function FlowSteps({
  active,
  labels = ["Go to spot", "Take photo", "Submit"],
}: {
  active: number;
  labels?: string[];
}) {
  return (
    <View style={s.steps}>
      {labels.map((label, index) => (
        <View key={label} style={s.step}>
          <View style={[s.stepLine, index <= active && s.stepActive]} />
          <Text style={[s.stepLabel, index <= active && { color: colors.primary }]}>
            {index + 1}. {label}
          </Text>
        </View>
      ))}
    </View>
  );
}
export const flowStyles = StyleSheet.create({
  content: { paddingBottom: 24, gap: 16 },
  title: {
    marginHorizontal: 20,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 35,
    letterSpacing: -0.6,
    color: colors.text,
  },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  section: {
    marginHorizontal: 20,
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
});
const s = StyleSheet.create({
  header: { minHeight: 64, paddingHorizontal: layout.gutter, flexDirection: "row", alignItems: "center" },
  back: { width: 44, height: 44, marginRight: 12, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  help: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 17, color: colors.text },
  footer: { paddingTop: 14, paddingBottom: 18, gap: 10, backgroundColor: colors.background },
  footnote: {
    marginHorizontal: 24,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: colors.textSecondary,
  },
  button: { marginHorizontal: layout.gutter, minHeight: layout.buttonHeight, borderRadius: layout.buttonRadius },
  secondary: { marginHorizontal: layout.gutter, minHeight: layout.buttonHeight, borderRadius: layout.buttonRadius },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12 },
  hero: { marginHorizontal: 20, marginVertical: 16, alignItems: "flex-start", padding: 20, gap: 8 },
  coin: { width: 28, height: 28, borderRadius: 14, marginBottom: 4 },
  reward: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 64,
    color: colors.text,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  symbol: { fontFamily: fonts.medium, fontSize: 22, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  card: { marginHorizontal: 20, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cardTitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  detail: { paddingVertical: 13, gap: 5 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  detailValue: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text },
  notice: { marginHorizontal: 20, padding: 16, borderRadius: 16, backgroundColor: colors.surfaceRaised },
  noticeError: { backgroundColor: colors.warningSurface },
  noticeHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  noticeTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  noticeBody: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  noticeAction: { paddingTop: 12, minHeight: 44, justifyContent: "center" },
  link: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.primary },
  steps: { marginHorizontal: 20, marginTop: 4, marginBottom: 16, flexDirection: "row", gap: 8 },
  step: { flex: 1, gap: 8 },
  stepLine: { height: 3, borderRadius: 2, backgroundColor: colors.surfaceRaised },
  stepActive: { backgroundColor: colors.primary },
  stepLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
});
