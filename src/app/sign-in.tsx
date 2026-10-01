import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import {
  fetchSignInPayload,
  fetchTier,
  loadSession,
  signOut,
  verifySignIn,
  type Session,
  type Tier,
} from "@/auth/api";
import { colors } from "@/theme";

function describeTier(tier: Tier): string {
  if (tier.tier === "verified_seeker") return `Tier: Verified Seeker (SGT ${tier.sgtMint})`;
  return tier.reason === "sgt_claimed_by_another_wallet"
    ? "Tier: Unverified (this SGT is already linked to another wallet)"
    : "Tier: Unverified";
}

export default function Index() {
  const { signIn, disconnect } = useMobileWallet();
  const [session, setSession] = useState<Session | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
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
      .then(async (restored) => {
        setSession(restored);
        if (restored) setTier(await fetchTier(restored));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, []);

  const handleSignIn = () =>
    run(async () => {
      const payload = await fetchSignInPayload();
      const output = await signIn(payload);
      const signedIn = await verifySignIn(payload.nonce, output);
      setSession(signedIn);
      setTier(await fetchTier(signedIn));
    });

  const handleSignOut = () =>
    run(async () => {
      await signOut();
      await disconnect();
      setSession(null);
      setTier(null);
    });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{session ? `Signed in: ${session.walletAddress}` : "Not signed in"}</Text>
      {session && tier ? <Text style={styles.text}>{describeTier(tier)}</Text> : null}
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
  text: {
    color: colors.text,
  },
  error: {
    color: "red",
  },
});
