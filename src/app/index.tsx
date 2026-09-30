import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { fetchSignInPayload, loadSession, signOut, verifySignIn, type Session } from "@/auth/api";

export default function Index() {
  const { signIn, disconnect } = useMobileWallet();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadSession()
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, []);

  const handleSignIn = () =>
    run(async () => {
      const payload = await fetchSignInPayload();
      const output = await signIn(payload);
      setSession(await verifySignIn(payload.nonce, output));
    });

  const handleSignOut = () =>
    run(async () => {
      await signOut();
      await disconnect();
      setSession(null);
    });

  return (
    <View style={styles.container}>
      <Text>{session ? `Signed in: ${session.walletAddress}` : "Not signed in"}</Text>
      {session ? (
        <Button title="Sign out" disabled={busy} onPress={handleSignOut} />
      ) : (
        <Button title="Sign in with wallet" disabled={busy} onPress={handleSignIn} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  error: {
    color: "red",
  },
});
