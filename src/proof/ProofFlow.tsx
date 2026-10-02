import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import type { File } from "expo-file-system";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, BackHandler, Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  fetchBounty, fetchScoutState, prepareCapture, releaseClaim, submitProof,
  type BountyView, type CaptureTicket, type ProofMetadata, type ScoutState, type Session,
} from "@/auth/api";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { NavBar } from "@/components/ui/NavBar";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Screen } from "@/components/ui/Screen";
import { StatusView } from "@/components/ui/StatusView";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { Subtitle, Title } from "@/components/ui/Typography";
import { formatReward, formatTimeLeft } from "@/explore/format";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { formatEnds, formatRadius } from "@/post/options";
import { CaptureError, proofMessage } from "@/proof/errors";
import { discardPhoto, preparePhoto } from "@/proof/photo";
import { ProofCamera } from "@/proof/ProofCamera";
import { colors, fonts } from "@/theme";

type Photo = { file: File; metadata: ProofMetadata; ticket: CaptureTicket };

async function freshPosition() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new CaptureError("Couldn’t get a precise location. Move outdoors and try again.")), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function ProofFlow({ session, id }: { session: Session; id: string }) {
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const operation = useRef(false);
  const [permission, requestCamera, refreshCamera] = useCameraPermissions();
  const location = useLocationPermission();
  const [scout, setScout] = useState<ScoutState | null>(null);
  const [bounty, setBounty] = useState<BountyView | null>(null);
  const [stage, setStage] = useState<"target" | "camera" | "review">("target");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await fetchScoutState(session, id);
      if (state.status === "accepted") setBounty(await fetchBounty(session, id, null));
      setScout(state);
    } catch (cause) {
      setError(proofMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [session, id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setReady(false);
      setNow(Date.now());
      if (state === "active") void refreshCamera().catch(() => undefined);
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshCamera]);
  useEffect(() => () => { if (photo) discardPhoto(photo.file); }, [photo]);

  const goBack = useCallback(() => {
    if (operation.current) return;
    if (stage === "review" && photo) {
      Alert.alert("Discard this photo?", "Your accepted bounty will remain available to you.", [
        { text: "Keep Photo", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => { setPhoto(null); setStage("target"); setError(null); } },
      ]);
    } else if (stage === "camera") {
      setStage("target");
      setError(null);
    } else {
      router.back();
    }
  }, [photo, stage]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { goBack(); return true; });
    return () => subscription.remove();
  }, [goBack]);

  const openCamera = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const locationPermission = location.granted ? location.permission : await location.request();
      if (!locationPermission?.granted) throw new CaptureError("Allow precise location access to capture proof.");
      const cameraPermission = permission?.granted ? permission : permission?.canAskAgain === false
        ? (await Linking.openSettings(), null)
        : await requestCamera();
      if (!cameraPermission?.granted) throw new CaptureError("Allow camera access to capture proof.");
      setPhoto(null);
      setReady(false);
      setStage("camera");
    } catch (cause) {
      setError(proofMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!ready || !camera.current || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const ticket = await prepareCapture(session, id);
      const position = await freshPosition();
      const accuracy = position.coords.accuracy;
      if (position.mocked) throw new CaptureError("Mock locations cannot be used for proof.");
      if (accuracy === null || accuracy <= 0 || accuracy > 50) throw new CaptureError("A precise location is required. Move outdoors and try again.");
      if (Math.abs(Date.now() - position.timestamp) > 30_000) throw new CaptureError("Your location is out of date. Try again.");
      if (AppState.currentState !== "active" || !camera.current) throw new CaptureError("Return to the camera and try again.");
      const capturedAt = new Date().toISOString();
      const captured = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!captured) throw new CaptureError("Couldn’t take the photo. Try again.");
      const file = await preparePhoto(captured);
      if (!mounted.current || AppState.currentState !== "active") {
        discardPhoto(file);
        throw new CaptureError("Capture was interrupted. Try again.");
      }
      if (Math.abs(Date.parse(capturedAt) - position.timestamp) > 30_000) {
        discardPhoto(file);
        throw new CaptureError("The photo and location must be captured together. Try again.");
      }
      setPhoto({
        file, ticket,
        metadata: {
          token: ticket.token, latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracyM: accuracy, locationAt: new Date(position.timestamp).toISOString(), capturedAt, mocked: false,
        },
      });
      setStage("review");
    } catch (cause) {
      setError(proofMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!photo || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const proof = await submitProof(session, id, photo.metadata, photo.file);
      setScout({ status: "submitted", proof });
      setPhoto(null);
    } catch (cause) {
      const state = await fetchScoutState(session, id).catch(() => null);
      if (state?.status === "submitted") {
        setScout(state);
        setPhoto(null);
      } else {
        setError(proofMessage(cause));
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const release = () => Alert.alert("Release this bounty?", "Another scout will be able to accept it. Any unsubmitted photo will be discarded.", [
    { text: "Keep Bounty", style: "cancel" },
    { text: "Release", style: "destructive", onPress: async () => {
      if (operation.current) return;
      operation.current = true;
      setBusy(true);
      try {
        await releaseClaim(session, id);
        router.back();
      } catch (cause) {
        setError(proofMessage(cause));
      } finally {
        operation.current = false;
        setBusy(false);
      }
    } },
  ]);

  if (scout?.status === "submitted") return (
    <Screen>
      <StatusView state="success" title="Proof saved" message="Open your submission to check escrow protection, review and payment status." />
      <SummaryCard items={[
        { label: "Status", value: "Pending review" },
        { label: "Submitted", value: formatEnds(new Date(scout.proof.receivedAt)) },
      ]} />
      <BottomActions><Button label="View Submission" onPress={() => router.replace({ pathname: "/review/[id]", params: { id } })} /></BottomActions>
    </Screen>
  );

  if (loading || !scout) return (
    <Screen>
      <NavBar title="Bounty Proof" />
      <View style={styles.center}>
        {loading ? <ActivityIndicator color={colors.primary} /> : <RetryMessage title={error ?? "Couldn’t load acceptance"} onRetry={() => void load()} />}
      </View>
    </Screen>
  );

  if (scout.status !== "accepted" || now >= Date.parse(scout.expiresAt)) return (
    <Screen>
      <StatusView state="failure" title="Bounty unavailable" message="Return to the bounty to check its current availability." />
      <BottomActions><Button label="Back to Bounty" onPress={() => router.back()} /></BottomActions>
    </Screen>
  );

  if (stage === "camera") return (
    <Screen background="#000000">
      <NavBar title="Capture Proof" onBack={goBack} />
      {foreground && permission?.granted ? (
        <ProofCamera ref={camera} ready={ready} busy={busy} onReady={() => setReady(true)} onCapture={() => void capture()}
          onError={() => { setStage("target"); setError("Couldn’t open the camera. Try again."); }} />
      ) : (
        <View style={styles.center}><Button label="Enable Camera" onPress={() => void openCamera()} /></View>
      )}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </Screen>
  );

  if (stage === "review" && photo) {
    const stale = now >= Date.parse(photo.ticket.expiresAt) || now - Date.parse(photo.metadata.capturedAt) >= 5 * 60_000;
    return (
      <Screen>
        <NavBar title="Review Proof" onBack={goBack} />
        <View style={styles.preview}><Image source={{ uri: photo.file.uri }} contentFit="contain" style={StyleSheet.absoluteFill} /></View>
        <Text style={styles.caption}>{stale ? "This photo has expired. Retake it to submit." : "Submitting saves this photo for review. Your reward remains in escrow."}</Text>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <BottomActions>
          <Button label="Submit Proof" loading={busy} disabled={stale} onPress={() => void submit()} />
          <Button label="Retake" variant="secondary" disabled={busy} onPress={() => void openCamera()} />
        </BottomActions>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar title="Accepted Bounty" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>Go to the spot</Title>
        <Subtitle style={styles.subtitle}>Take a fresh photo within {formatRadius(scout.radiusM)} of the target.</Subtitle>
        <View style={styles.card}><SummaryCard items={[
          { label: "Bounty", value: bounty?.title ?? "" },
          { label: "Reward", value: bounty ? formatReward(bounty) : "" },
          { label: "Area", value: bounty?.locationLabel ?? "" },
          { label: "Target", value: `${scout.target.latitude.toFixed(6)}, ${scout.target.longitude.toFixed(6)}` },
          { label: "Acceptance", value: formatTimeLeft(scout.expiresAt, now) },
        ]} /></View>
        <View style={styles.card}><SummaryCard items={[{ label: "Proof needed", value: bounty?.instructions ?? "", stacked: true }]} /></View>
        <Button label="Get Directions" variant="secondary" containerStyle={styles.card} disabled={busy}
          onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${scout.target.latitude},${scout.target.longitude}`)}`)
            .catch(() => setError("Couldn’t open directions. Use the target coordinates above."))} />
        <Text style={styles.caption}>Camera and precise location access are required. Capture the photo only when you’re at the target.</Text>
      </ScrollView>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <BottomActions>
        <Button label={permission?.canAskAgain === false || location.blocked ? "Open Settings" : "Open Camera"} loading={busy} onPress={() => void openCamera()} />
        <Button label="Release Bounty" variant="text" disabled={busy} onPress={release} />
      </BottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  content: { paddingTop: 28, paddingBottom: 20 },
  subtitle: { marginTop: 10 },
  card: { marginTop: 24 },
  preview: { flex: 1, marginTop: 16, marginHorizontal: 16.67, borderRadius: 16, overflow: "hidden", backgroundColor: "#000000" },
  caption: { marginHorizontal: 32, marginVertical: 18, fontFamily: fonts.regular, fontSize: 14.9, lineHeight: 20, color: colors.textSecondary, textAlign: "center" },
  error: { marginHorizontal: 24, marginBottom: 16, fontFamily: fonts.regular, fontSize: 14.9, lineHeight: 20, color: colors.danger, textAlign: "center" },
});
