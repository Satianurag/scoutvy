import { StyleSheet } from "react-native";

import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Illustration } from "@/components/ui/Illustration";
import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";

export default function Home() {
  const { profile, signOut } = useSession();

  return (
    <Screen>
      <NavBar back={false} />
      <Illustration source={require("@/assets/images/onboarding-location.png")} width={175} height={153} top={23.8} />
      <Title style={styles.title}>@{profile?.username}</Title>
      <Subtitle style={styles.subtitle}>The bounty board is coming next.</Subtitle>
      <BottomActions>
        <Button label="Sign Out" variant="secondary" onPress={signOut} />
      </BottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 24 },
  subtitle: { marginTop: 13 },
});
