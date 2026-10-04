import { StyleSheet, Text } from "react-native";

import { TextField } from "@/components/ui/TextField";
import { colors, fonts } from "@/theme";

type Props = { value: string; onChangeText: (value: string) => void; onSubmit?: () => void };

export function UsernameField({ value, onChangeText, onSubmit }: Props) {
  return (
    <TextField
      value={value}
      onChangeText={onChangeText}
      onSubmit={onSubmit}
      prefix={<Text style={styles.at}>@</Text>}
      clearable
      autoFocus
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={20}
      placeholder="username"
      accessibilityLabel="Username"
    />
  );
}

const styles = StyleSheet.create({
  at: { width: 24, fontFamily: fonts.regular, fontSize: 17, color: colors.textSecondary },
});
