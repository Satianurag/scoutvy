import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, StyleSheet, View } from "react-native";

import { PostButton } from "@/components/ui/PostButton";
import { isTabIconName, TabIcon } from "@/components/ui/TabIcon";
import { colors, layout } from "@/theme";

type Props = BottomTabBarProps & { onPost: () => void };

const POST_SLOT = 2;

export function TabBar({ state, navigation, insets, onPost }: Props) {
  const tabs = state.routes.map((route, index) => {
    const focused = state.index === index;
    if (!isTabIconName(route.name)) return null;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={route.name}
        style={styles.slot}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <TabIcon
          name={route.name}
          focused={focused}
          color={focused ? colors.primary : colors.tabInactive}
        />
      </Pressable>
    );
  });
  tabs.splice(
    POST_SLOT,
    0,
    <View key="post" style={styles.slot}>
      <PostButton onPress={onPost} />
    </View>,
  );
  return <View style={[styles.bar, { paddingBottom: insets.bottom }]}>{tabs}</View>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingHorizontal: layout.tabBarInset,
    backgroundColor: colors.background,
  },
  slot: { flex: 1, height: layout.tabBarHeight, alignItems: "center", justifyContent: "center" },
});
