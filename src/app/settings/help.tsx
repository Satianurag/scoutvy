import { useState } from "react";
import { Text } from "react-native";
import { SettingsScreen, SettingsGroup, settingsStyle as s } from "@/settings/ui";
import { ListRow } from "@/components/ui/ListRow";
import { BrowseSheet } from "@/components/ui/Browse";
const answers = [
  [
    "How bounties work",
    "Set the requirements, reward and submission method. Choose an online or local task. A scout completes it and submits work for your review.",
  ],
  [
    "Where are my rewards?",
    "Open Activity for confirmed payouts and refunds. Wallet shows your available balance; escrowed rewards are separate.",
  ],
  [
    "Why does my wallet open?",
    "Your wallet approves sign-in and on-chain transactions. Approve the request there, then return to Scoutvy.",
  ],
  [
    "A transaction was blocked",
    "Follow the warning shown by your wallet. A blocked or rejected transaction does not confirm a bounty. Check Activity before trying again.",
  ],
  [
    "Location or camera not working",
    "Check Permissions in your profile. Location is used for local tasks, and camera access is needed only when the bounty requires a photo.",
  ],
  [
    "Which network is used?",
    "Scoutvy bounties currently use Solana Devnet test tokens. They have no real-money value.",
  ],
];
export default function Help() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <SettingsScreen title="Help">
      <SettingsGroup>
        {answers.map(([q], i) => (
          <ListRow key={q} label={q} onPress={() => setSelected(i)} />
        ))}
      </SettingsGroup>
      {selected !== null && (
        <BrowseSheet visible title={answers[selected][0]} onClose={() => setSelected(null)}>
          <Text style={[s.body, { marginHorizontal: 0 }]}>{answers[selected][1]}</Text>
        </BrowseSheet>
      )}
    </SettingsScreen>
  );
}
