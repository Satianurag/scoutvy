import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { colors, fonts } from "@/theme";

type Props = { value: string; onChangeText: (value: string) => void; onSubmit?: () => void };

export function UsernameField({ value, onChangeText, onSubmit }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.at}>@</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        style={styles.input}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        maxLength={20}
        returnKeyType="done"
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        placeholder="username"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Username"
      />
      {value ? (
        <Pressable style={styles.clear} hitSlop={10} onPress={() => onChangeText("")} accessibilityLabel="Clear username">
          <Icon name={{ ios: "xmark", android: "close", web: "close" }} size={12} color={colors.surface} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginHorizontal: 16,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
    paddingRight: 14.6,
  },
  at: { width: 22.7, fontFamily: fonts.regular, fontSize: 16.5, color: colors.textSecondary },
  input: {
    flex: 1,
    padding: 0,
    fontFamily: fonts.regular,
    fontSize: 16.5,
    color: colors.text,
  },
  clear: {
    width: 18.7,
    height: 18.7,
    borderRadius: 9.35,
    backgroundColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
});
