import { useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";

import { classifyWalletError, walletFailureMessage, type WalletFailure } from "@/auth/wallet-errors";
import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { FeatureRow } from "@/components/ui/FeatureRow";
import { Icon } from "@/components/ui/Icon";
import { Illustration } from "@/components/ui/Illustration";
import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";
import { WALLET_INSTALL_URL } from "@/constants/app-config";
import { colors, fonts } from "@/theme";

const showHelp = () =>
  Alert.alert(
    "Signing in with a wallet",
    "Scoutvy asks your wallet to sign a one-time message. It proves you own the address. It isn't a transaction, costs nothing, and can't move your funds.",
  );

export default function Connect() {
  const { signIn } = useSession();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WalletFailure | null>(null);

  const connect = async () => {
    setFailure(null);
    setBusy(true);
    try {
      await signIn();
    } catch (error) {
      setFailure(classifyWalletError(error));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <NavBar onHelp={showHelp} />
      <Illustration source={require("@/assets/images/onboarding-wallet.png")} width={152} height={117} top={18.5} />
      <Title style={styles.title}>Connect a Wallet</Title>
      <Subtitle style={styles.subtitle}>Sign in with any Solana wallet on this phone</Subtitle>

      <View style={styles.features}>
        <FeatureRow
          icon={<Icon name={{ ios: "signature", android: "draw", web: "draw" }} size={24} color={colors.primary} />}
          title="Free to sign in"
          description="You sign a message, not a transaction. No fees, and nothing leaves your wallet"
        />
        <FeatureRow
          icon={<Icon name={{ ios: "lock.fill", android: "lock", web: "lock" }} size={24} color={colors.green} />}
          title="Your keys stay yours"
          description="Scoutvy never sees your recovery phrase or private keys"
        />
        <FeatureRow
          icon={<Icon name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }} size={24} color={colors.orange} />}
          title="Seeker owners get verified"
          description="Sign in with your Seeker's Seed Vault to unlock the Verified Seeker tier"
        />
      </View>

      <BottomActions>
        {failure ? <Text style={styles.error}>{walletFailureMessage[failure]}</Text> : null}
        <Button label="Connect Wallet" onPress={connect} loading={busy} />
        <Button
          label={failure === "no_wallet" ? "Install Solflare" : "Get a Wallet"}
          variant="secondary"
          onPress={() => Linking.openURL(WALLET_INSTALL_URL)}
        />
      </BottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 22 },
  subtitle: { marginTop: 8 },
  features: { marginTop: 33, gap: 24 },
  error: {
    marginHorizontal: 24,
    fontFamily: fonts.medium,
    fontSize: 14.9,
    lineHeight: 20,
    color: colors.danger,
    textAlign: "center",
  },
});
