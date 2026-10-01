import { StyleSheet } from "react-native";

import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";

export default function Wallet() {
  return (
    <Screen style={styles.screen}>
      <Title>Wallet</Title>
      <Subtitle style={styles.subtitle}>Your SKR balance will show here.</Subtitle>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  subtitle: { marginTop: 13 },
});
