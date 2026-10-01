import { StyleSheet } from "react-native";

import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";

export default function Post() {
  return (
    <Screen>
      <NavBar />
      <Title style={styles.title}>Post a Bounty</Title>
      <Subtitle style={styles.subtitle}>Creating bounties is coming next.</Subtitle>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 24 },
  subtitle: { marginTop: 13 },
});
