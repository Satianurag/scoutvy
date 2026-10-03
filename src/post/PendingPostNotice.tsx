import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useSession } from "@/auth/session-context";
import { FlowNotice } from "@/components/ui/Flow";
import { readPendingPost } from "@/post/pending-post";

export function PendingPostNotice() {
  const { session } = useSession();
  const [pending, setPending] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (session) void readPendingPost(session.walletAddress).then((value) => {
      if (active) setPending(value !== null);
    }).catch(() => { if (active) setPending(true); });
    return () => { active = false; };
  }, [session]));
  if (!pending) return null;
  return <FlowNotice title="Finish your previous bounty" message="Check its payment before posting another."
    action={{ label: "Continue", onPress: () => router.push("/post/recover") }} />;
}
