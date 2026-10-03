import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BountyView, ScoutState } from "@/auth/api";
import { FlowCard, FlowDetail, FlowNotice, FlowPill, flowStyles } from "@/components/ui/Flow";
import { Icon } from "@/components/ui/Icon";
import { formatReward, formatTimeLeft } from "@/explore/format";
import { colors, fonts } from "@/theme";

type Props = {
  bounty: BountyView;
  scout: Extract<ScoutState, { status: "accepted" }>;
  now: number;
  cameraGranted: boolean;
  locationGranted: boolean;
  onDirections: () => void;
};
export function ProofTarget({ bounty, scout, now, cameraGranted, locationGranted, onDirections }: Props) {
  return (
    <>
      <View style={s.status}>
        <FlowPill label="Accepted by you" tone="green" />
        <Text style={s.timer}>{formatTimeLeft(scout.expiresAt, now)}</Text>
      </View>
      <Text style={flowStyles.title}>Your next stop.</Text>
      <Text style={s.subtitle}>Go to the target, then capture what’s needed.</Text>
      <FlowCard>
        <View style={s.locationIcon}>
          <Icon
            name={{ ios: "mappin.and.ellipse", android: "location_on", web: "location_on" }}
            size={28}
            color={colors.primary}
          />
        </View>
        <Text style={s.place}>{bounty.locationLabel}</Text>
        <Text selectable style={s.coordinates}>
          {scout.target.latitude.toFixed(6)}, {scout.target.longitude.toFixed(6)}
        </Text>
        <Text style={s.radius}>Capture within {scout.radiusM} m of this target</Text>
        <Pressable accessibilityRole="button" onPress={onDirections} style={s.directions}>
          <Icon
            name={{ ios: "arrow.up.right", android: "near_me", web: "near_me" }}
            size={18}
            color={colors.primary}
          />
          <Text style={s.directionsText}>Get directions</Text>
        </Pressable>
      </FlowCard>
      <FlowCard title="WHAT TO CAPTURE">
        <Text style={s.request}>{bounty.title}</Text>
        <Text style={flowStyles.body}>{bounty.instructions}</Text>
        <FlowDetail label="Your reward after review" value={`${formatReward(bounty)} · Devnet`} last />
      </FlowCard>
      <FlowCard title="BEFORE YOU CAPTURE">
        <PermissionRow title="Camera" detail="A fresh photo, taken inside Scoutvy" granted={cameraGranted} />
        <PermissionRow
          title="Precise location"
          detail="Confirms you’re inside the proof radius"
          granted={locationGranted}
        />
      </FlowCard>
      <FlowNotice
        title="We’ll check your location first"
        message="Move close to the target with a clear GPS signal. Camera access opens only after the location check passes."
      />
    </>
  );
}
function PermissionRow({ title, detail, granted }: { title: string; detail: string; granted: boolean }) {
  return (
    <View style={s.permission}>
      <View style={s.flex}>
        <Text style={s.permissionTitle}>{title}</Text>
        <Text style={flowStyles.muted}>{detail}</Text>
      </View>
      <Icon
        name={
          granted
            ? { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }
            : { ios: "circle", android: "radio_button_unchecked", web: "radio_button_unchecked" }
        }
        color={granted ? colors.green : colors.textSecondary}
        size={22}
      />
    </View>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  status: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timer: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  subtitle: {
    marginHorizontal: 20,
    marginTop: -8,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  locationIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#302A40",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  place: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 27, color: colors.text },
  coordinates: { marginTop: 10, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  radius: { marginTop: 6, fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  directions: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#302A40",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  directionsText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.primary },
  request: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 23, color: colors.text, marginBottom: 9 },
  permission: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 10 },
  permissionTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text, marginBottom: 4 },
});
