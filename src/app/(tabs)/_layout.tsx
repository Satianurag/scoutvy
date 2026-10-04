import { Tabs } from "expo-router";

import { TabBar } from "@/components/ui/TabBar";
import { useReducedMotion } from "react-native-reanimated";
import { colors } from "@/theme";

export default function TabsLayout() {
  const reduced = useReducedMotion();
  return (
    <Tabs
      initialRouteName="explore"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: reduced ? "none" : "fade",
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
