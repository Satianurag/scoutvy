import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const { account, connect, disconnect } = useMobileWallet();
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text>{account ? account.address : "No wallet connected"}</Text>
      {account ? (
        <Button title="Disconnect" onPress={() => run(disconnect)} />
      ) : (
        <Button title="Connect wallet" onPress={() => run(connect)} />
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
