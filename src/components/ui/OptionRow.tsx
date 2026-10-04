import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, layout } from "@/theme";

type Props = { label: string; detail?: string; selected: boolean; onPress: () => void };

export function OptionRow({ label, detail, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [styles.row, detail ? styles.tall : null, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <Text style={styles.label}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? (
          <Svg width={11} height={9} viewBox="0 0 11 9" fill="none">
            <Path d="M1 4.6L3.9 7.5L10 1.5" stroke={colors.onPrimary} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowHeight,
    paddingLeft: 16,
    paddingRight: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  tall: { minHeight: 66 },
  pressed: { backgroundColor: colors.surfaceRaised },
  body: { flex: 1, paddingRight: 12, paddingVertical: 12 },
  label: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 23, color: colors.text },
  detail: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14, lineHeight: 18, color: colors.muted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderWidth: 0, backgroundColor: colors.primary },
});
