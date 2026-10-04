import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isTabIconName, TabIcon } from "@/components/ui/TabIcon";
import { colors, fonts, layout } from "@/theme";

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  return <View style={[styles.safe, { paddingBottom: Math.max(insets.bottom, 8), paddingLeft: Math.max(insets.left, layout.gutter), paddingRight: Math.max(insets.right, layout.gutter) }]}>
    <View style={styles.bar}>{state.routes.map((route, index) => {
      if (!isTabIconName(route.name)) return null;
      const focused = state.index === index;
      const label = route.name.charAt(0).toUpperCase() + route.name.slice(1);
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        style={({ pressed }) => [styles.slot, focused && styles.selected, pressed && { opacity: 0.7 }]}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}>
        <TabIcon name={route.name} focused={focused} color={focused ? colors.primary : colors.tabInactive} />
        <Text style={[styles.label, focused && { color: colors.primary }]}>{label}</Text>
      </Pressable>;
    })}</View>
  </View>;
}
const styles = StyleSheet.create({
  safe: { paddingTop: 8, backgroundColor: colors.background },
  bar: { flexDirection: "row", padding: 5, gap: 4, borderRadius: 28, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  slot: { flex: 1, minHeight: 54, paddingVertical: 6, gap: 3, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  selected: { backgroundColor: "#37333F" },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, color: colors.tabInactive },
});
