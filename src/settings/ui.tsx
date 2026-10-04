import { type ComponentProps, type PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardForm } from "@/components/ui/KeyboardForm";
import { Screen } from "@/components/ui/Screen";
import { FlowHeader } from "@/components/ui/Flow";
import { Icon } from "@/components/ui/Icon";
import { ListGroup } from "@/components/ui/ListGroup";
import { Toggle } from "@/components/ui/Toggle";
import { colors, fonts } from "@/theme";
export function SettingsScreen({
  title,
  children,
  footer,
  onBack,
}: { title: string; footer?: React.ReactNode; onBack?: () => void } & PropsWithChildren) {
  return (
    <Screen>
      <KeyboardForm header={<FlowHeader title={title} onBack={onBack} />}
        contentStyle={settingsStyle.content} footer={footer}>
        {children}
      </KeyboardForm>
    </Screen>
  );
}
export function SettingsGroup({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={{ gap: 10 }}>
      {title && <Text style={settingsStyle.label}>{title}</Text>}
      <ListGroup style={{ marginTop: 0 }}>{children}</ListGroup>
    </View>
  );
}
export function SettingIcon({ name }: { name: ComponentProps<typeof Icon>["name"] }) {
  return <Icon name={name} size={20} color={colors.textSecondary} />;
}
export function SettingsToggleRow({ label, description, value, disabled, onChange }: {
  label: string; description?: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void;
}) {
  return (
    <View style={[settingsStyle.toggleRow, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={settingsStyle.toggleLabel}>{label}</Text>
        {description ? <Text style={settingsStyle.toggleDescription}>{description}</Text> : null}
      </View>
      <Toggle label={label} value={value} disabled={disabled} onChange={onChange} />
    </View>
  );
}
export const settingsStyle = StyleSheet.create({
  toggleRow: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: colors.surface },
  toggleLabel: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 23, color: colors.text },
  toggleDescription: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  content: { flexGrow: 1, paddingVertical: 16, paddingBottom: 32, gap: 24 },
  label: { marginHorizontal: 20, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  body: {
    marginHorizontal: 20,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  title: {
    marginHorizontal: 20,
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 33,
    color: colors.text,
  },
  input: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    minHeight: 54,
  },
  error: {
    marginHorizontal: 20,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
  },
  card: { marginHorizontal: 20, padding: 18, borderRadius: 20, backgroundColor: colors.surface, gap: 10 },
  value: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, color: colors.text },
});
