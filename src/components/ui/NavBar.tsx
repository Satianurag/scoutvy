import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { StepDots } from "@/components/ui/StepDots";
import { colors, layout } from "@/theme";

type Props = {
  back?: boolean;
  step?: { index: number; count: number };
  onHelp?: () => void;
};

export function NavBar({ back = true, step, onHelp }: Props) {
  return (
    <View style={styles.bar}>
      {back && router.canGoBack() ? (
        <Pressable style={styles.back} hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
          <Icon name={{ ios: "chevron.left", android: "arrow_back_ios_new", web: "arrow_back_ios_new" }} size={19} />
        </Pressable>
      ) : null}
      {step ? <StepDots index={step.index} count={step.count} /> : null}
      {onHelp ? (
        <Pressable style={styles.help} hitSlop={12} onPress={onHelp} accessibilityLabel="Help">
          <Icon name={{ ios: "questionmark.circle", android: "help", web: "help" }} size={25} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginTop: layout.navTop,
    height: layout.navHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  back: { position: "absolute", left: 14.5 },
  help: { position: "absolute", right: 22.5 },
});
