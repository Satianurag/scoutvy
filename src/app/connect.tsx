import { useState } from "react";
import { Linking, Text } from "react-native";
import { useSession } from "@/auth/session-context";
import { classifyWalletError, walletFailureMessage } from "@/auth/wallet-errors";
import { OnboardingScreen } from "@/components/ui/OnboardingScreen";
import { Button } from "@/components/ui/Button";
import { useAppDialog } from "@/components/ui/AppDialog";
import { SettingsGroup, settingsStyle as s } from "@/settings/ui";
import { ListRow } from "@/components/ui/ListRow";
import { WALLET_INSTALL_URL } from "@/constants/app-config";
export default function Connect() {
  const { signIn } = useSession();
  const dialog = useAppDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      setError(walletFailureMessage[classifyWalletError(e)]);
      setBusy(false);
    }
  };
  return (
    <OnboardingScreen
      title="Connect your wallet"
      subtitle="Sign a message to access Scoutvy."
      image={require("@/assets/images/onboarding-wallet.png")}
      onHelp={() =>
        dialog({
          title: "Signing in",
          message: "Signing in costs nothing and cannot move funds. Your keys stay in your wallet.",
          tone: "info",
        })
      }
      footer={
        <>
          <Button
            label={busy ? "Waiting for wallet…" : "Connect wallet"}
            loading={busy}
            onPress={() => void connect()}
          />
          <Button
            label="Get a wallet"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              void Linking.openURL(WALLET_INSTALL_URL).catch(() =>
                setError("Couldn’t open the store. Try again."),
              )
            }
          />
        </>
      }
    >
      <SettingsGroup>
        <ListRow label="Sign-in fee" value="Free" />
        <ListRow label="Private keys" value="Stay in your wallet" />
      </SettingsGroup>
      {error && (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {error}
        </Text>
      )}
      {busy && <Text style={s.body}>After dismissing any wallet reminder, wait for the sign-in prompt.</Text>}
    </OnboardingScreen>
  );
}
