import { useState, useRef, useCallback } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { fetchBounty, reportBounty } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { SettingsScreen, settingsStyle as s } from "@/settings/ui";
import { useResource } from "@/hooks/use-resource";
import { BrowseEmpty, Choice } from "@/components/ui/Browse";
import { FlowFooter } from "@/components/ui/Flow";
import { Toggle } from "@/components/ui/Toggle";
import { StatusView } from "@/components/ui/StatusView";
import { useAppDialog } from "@/components/ui/AppDialog";
import { colors } from "@/theme";
const reasons = [
  ["unsafe", "Unsafe or illegal"],
  ["privacy", "Targets a person or private place"],
  ["misleading", "Misleading request"],
  ["spam", "Spam"],
  ["other", "Something else"],
];
export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const fetcher = useCallback(() => fetchBounty(session!, id, null), [session, id]);
  const resource = useResource(id, fetcher);
  if (!resource.data)
    return (
      <SettingsScreen title="Report bounty">
        {resource.loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <BrowseEmpty
            title="Bounty unavailable"
            message="This link may no longer be available."
            action={{ label: "Try again", onPress: () => void resource.refresh() }}
          />
        )}
      </SettingsScreen>
    );
  if (resource.data.mine)
    return (
      <SettingsScreen title="Report bounty">
        <BrowseEmpty
          title="This is your bounty"
          message="You can manage it from My bounties."
          action={{ label: "My bounties", onPress: () => router.replace("/my-bounties") }}
        />
      </SettingsScreen>
    );
  return <ReportForm key={id} id={id} />;
}
function ReportForm({ id }: { id: string }) {
  const { session } = useSession();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const dialog = useAppDialog();
  const nav = useNavigation();
  usePreventRemove(busy || ((!!reason || !!details || block) && !done), ({ data }) => {
    if (busy) return;
    dialog({
      title: "Discard report?",
      message: "Your report hasn’t been sent.",
      tone: "destructive",
      cancelLabel: "Keep editing",
      confirmLabel: "Discard",
      onConfirm: () => nav.dispatch(data.action),
    });
  });
  const send = async () => {
    if (!session || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await reportBounty(session, id, { reason, details, block });
      setDone(true);
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <SettingsScreen
      title="Report bounty"
      footer={
        <FlowFooter
          label={done ? "Done" : "Submit report"}
          loading={busy}
          disabled={!done && (!reason || (reason === "other" && details.trim().length < 10))}
          onPress={done ? () => router.back() : () => void send()}
        />
      }
    >
      {done ? (
        <StatusView
          state="success"
          title="Report received"
          message={
            block ? "This poster’s bounties are hidden from Explore." : "Your report has been recorded."
          }
        />
      ) : (
        <>
          <Text style={s.body}>What’s wrong with this bounty?</Text>
          <View style={{ marginHorizontal: 20, gap: 10 }}>
            {reasons.map(([id, label]) => (
              <Choice
                key={id}
                label={label}
                selected={reason === id}
                onPress={() => {
                  if (!busy) setReason(id);
                }}
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel="Report details"
            value={details}
            editable={!busy}
            onChangeText={setDetails}
            placeholder={reason === "other" ? "Tell us what happened (required)" : "Add details (optional)"}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            style={[s.input, { minHeight: 130 }]}
          />
          <View
            style={[s.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
          >
            <Text style={s.value}>Block this poster</Text>
            <Toggle
              value={block}
              onChange={(next) => {
                if (!busy) setBlock(next);
              }}
              label="Block this poster"
            />
          </View>
          {error && <Text style={s.error}>Couldn’t send your report. Try again.</Text>}
        </>
      )}
    </SettingsScreen>
  );
}
