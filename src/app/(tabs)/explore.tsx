import { StyleSheet } from "react-native";

import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";

export default function Explore() {
  return (
    <Screen style={styles.screen}>
      <Title>Explore</Title>
      <Subtitle style={styles.subtitle}>Nearby bounties will show here.</Subtitle>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  subtitle: { marginTop: 13 },
});
