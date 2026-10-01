import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { KeypadKey } from "@/post/amount";
import { colors, fonts } from "@/theme";

const ROWS: KeypadKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
];

type Props = { onKey: (key: KeypadKey) => void; onClear: () => void };

export function Keypad({ onKey, onClear }: Props) {
  return (
    <View style={styles.pad}>
      {ROWS.map((row) => (
        <View key={row.join("")} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === "back" ? "Delete" : key === "." ? "Decimal point" : key}
              onPress={() => {
                void Haptics.selectionAsync();
                onKey(key);
              }}
              onLongPress={key === "back" ? onClear : undefined}
              style={({ pressed }) => [styles.key, pressed && styles.pressed]}
            >
              {key === "back" ? (
                <Svg width={26} height={20} viewBox="0 0 26 20" fill="none">
                  <Path
                    d="M8.4 1.5H23a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H8.4L1.5 10l6.9-8.5Z"
                    stroke={colors.text}
                    strokeWidth={1.7}
                    strokeLinejoin="round"
                  />
                  <Path d="M12 6.5L19 13.5M19 6.5L12 13.5" stroke={colors.text} strokeWidth={1.7} strokeLinecap="round" />
                </Svg>
              ) : (
                <Text style={styles.label}>{key === "." ? "." : key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const KEY_HEIGHT = 58;
const KEY_MIN_HEIGHT = 40;

const styles = StyleSheet.create({
  pad: { flexShrink: 1, height: 4 * KEY_HEIGHT + 3 * 4, minHeight: 4 * KEY_MIN_HEIGHT + 3 * 4, paddingHorizontal: 8, gap: 4 },
  row: { flex: 1, flexDirection: "row", gap: 4 },
  key: { flex: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: colors.surface },
  label: { fontFamily: fonts.medium, fontSize: 28, color: colors.text },
});
