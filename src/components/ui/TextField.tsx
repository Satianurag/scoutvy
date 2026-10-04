import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { colors, fonts } from "@/theme";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  label?: string;
  prefix?: ReactNode;
  clearable?: boolean;
  multiline?: boolean;
  maxLength?: number;
  showCount?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
} & Pick<TextInputProps, "autoCapitalize" | "autoCorrect" | "returnKeyType" | "submitBehavior" | "editable">;

export function TextField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  label,
  prefix,
  clearable,
  multiline,
  maxLength,
  showCount,
  autoFocus,
  onSubmit,
  autoCapitalize = "sentences",
  autoCorrect = true,
  returnKeyType = "done",
  submitBehavior,
  editable = true,
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      {label || showCount ? (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {showCount && maxLength ? (
            <Text style={styles.count}>
              {value.length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.field, multiline && styles.multiline, focused && styles.focused]}>
        {prefix}
        <TextInput
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          style={[styles.input, multiline && styles.multilineInput]}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete="off"
          multiline={multiline}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          submitBehavior={submitBehavior}
          textAlignVertical={multiline ? "top" : "center"}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={accessibilityLabel}
        />
        {clearable && value && editable ? (
          <Pressable
            style={styles.clear}
            accessibilityRole="button"
            onPress={() => onChangeText("")}
            accessibilityLabel={`Clear ${accessibilityLabel.toLowerCase()}`}
          >
            <Icon
              name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
              size={20}
              color={colors.textSecondary}
              weight="bold"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    marginHorizontal: 20,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "baseline",
  },
  label: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  count: {
    marginLeft: "auto",
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.tabInactive,
  },
  field: {
    marginHorizontal: 20,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
    paddingRight: 4,
  },
  multiline: { height: 132, alignItems: "flex-start", paddingTop: 13, paddingBottom: 13 },
  focused: { borderColor: colors.primary },
  input: {
    flex: 1,
    padding: 0,
    paddingRight: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  multilineInput: { alignSelf: "stretch", lineHeight: 22 },
  clear: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
