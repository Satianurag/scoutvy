import { StyleSheet } from "react-native";

import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";

export default function Activity() {
  return (
    <Screen style={styles.screen}>
      <Title>Activity</Title>
      <Subtitle style={styles.subtitle}>Your bounties and proofs will show here.</Subtitle>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  subtitle: { marginTop: 13 },
});
