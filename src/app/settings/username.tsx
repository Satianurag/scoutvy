import { router } from "expo-router";
import { useSession } from "@/auth/session-context";
import { UsernameEditor } from "@/settings/UsernameEditor";
export default function EditUsername() {
  const { profile } = useSession();
  return <UsernameEditor initial={profile?.username ?? ""} onSaved={() => router.back()} />;
}
