import { useLocalSearchParams } from "expo-router";

import { useSession } from "@/auth/session-context";
import { ProofFlow } from "@/proof/ProofFlow";

export default function ProofScreen() {
  const { session } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!session || typeof id !== "string") return null;
  return <ProofFlow session={session} id={id} />;
}
