import { router, Tabs } from "expo-router";

import { TabBar } from "@/components/ui/TabBar";
import { colors } from "@/theme";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="explore"
      tabBar={(props) => <TabBar {...props} onPost={() => router.push("/post")} />}
      screenOptions={{ headerShown: false, animation: "none", sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
