import { CameraView, useCameraPermissions } from "expo-camera";
import type { File } from "expo-file-system";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  fetchBounty,
  fetchScoutState,
  prepareCapture,
  submitProof,
  submitWrittenProof,
  type BountyView,
  type CaptureTicket,
  type ProofMetadata,
  type ScoutState,
  type Session,
} from "@/auth/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAppDialog } from "@/components/ui/AppDialog";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Screen } from "@/components/ui/Screen";
import { StatusView } from "@/components/ui/StatusView";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { CaptureError, proofMessage } from "@/proof/errors";
import { discardPhoto, preparePhoto } from "@/proof/photo";
import {
  FlowHeader,
  FlowFooter,
  FlowSteps,
  FlowNotice,
  FlowCard,
  FlowDetail,
  flowStyles,
} from "@/components/ui/Flow";
import { ProofTarget } from "@/proof/ProofTarget";
import { PhotoReview } from "@/proof/PhotoReview";
import { formatEnds } from "@/post/options";
import { ProofCamera } from "@/proof/ProofCamera";
import { useScoutClaim } from "@/proof/use-scout-claim";
import { useWrittenDraft } from "@/proof/use-written-draft";
import { PushOptIn } from "@/notifications/PushOptIn";
import { colors } from "@/theme";

type Photo = { file: File; metadata: ProofMetadata; ticket: CaptureTicket };

async function freshPosition() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new CaptureError("Couldn’t get a precise location. Move outdoors and try again.")),
          30_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function ProofFlow({ session, id }: { session: Session; id: string }) {
  const showDialog = useAppDialog();
  const claim = useScoutClaim(session, id);
  const camera = useRef<CameraView>(null);
  const scroll = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const operation = useRef(false);
  const [permission, requestCamera, refreshCamera] = useCameraPermissions();
  const location = useLocationPermission();
  const [scout, setScout] = useState<ScoutState | null>(null);
  const [bounty, setBounty] = useState<BountyView | null>(null);
  const [stage, setStage] = useState<"target" | "camera" | "review">("target");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const writtenDraft = useWrittenDraft(session.walletAddress, id);
  const writtenText = writtenDraft.text;
  const clearWrittenDraft = writtenDraft.clear;
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await fetchScoutState(session, id);
      if (state.status === "accepted") setBounty(await fetchBounty(session, id, null));
      if (state.status === "submitted") await clearWrittenDraft().catch(() => undefined);
      setScout(state);
    } catch (cause) {
      setError(proofMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [session, id, clearWrittenDraft]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
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
  useEffect(
    () => () => {
      if (photo) discardPhoto(photo.file);
    },
    [photo],
  );

  useEffect(() => {
    if (error) scroll.current?.scrollToEnd({ animated: true });
  }, [error]);

  const goBack = useCallback(() => {
    if (operation.current) return;
    if (bounty?.proofType === "written" && writtenText.trim() && scout?.status !== "submitted") {
      void writtenDraft.flush().then(() => router.back()).catch(() => undefined);
      return;
    }
    if (stage === "review" && photo) {
      showDialog({
        title: "Discard this photo?",
        message: "Your accepted bounty will remain available to you.",
        tone: "destructive",
        cancelLabel: "Keep photo",
        confirmLabel: "Discard photo",
        onConfirm: () => {
          setPhoto(null);
          setStage("target");
          setError(null);
        },
      });
    } else if (stage === "camera") {
      setStage(photo ? "review" : "target");
      setError(null);
    } else {
      router.back();
    }
  }, [photo, stage, showDialog, bounty?.proofType, writtenText, scout?.status, writtenDraft]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [goBack]),
  );

  const openCamera = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setBusyLabel("Checking permissions…");
    setError(null);
    try {
      const locationPermission = location.granted ? location.permission : await location.request();
      if (!locationPermission?.granted)
        throw new CaptureError("Allow precise location access to capture proof.");
      const cameraPermission = permission?.granted
        ? permission
        : permission?.canAskAgain === false
          ? (await Linking.openSettings(), null)
          : await requestCamera();
      if (!cameraPermission?.granted) throw new CaptureError("Allow camera access to capture proof.");
      setBusyLabel("Checking your location…");
      assertPosition(await freshPosition(), scout);
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
      setBusyLabel("Checking location…");
      const position = await freshPosition();
      assertPosition(position, scout);
      setBusyLabel("Capturing proof…");
      const ticket = await prepareCapture(session, id);
      setPhoto(null);
      const accuracy = position.coords.accuracy;
      if (position.mocked) throw new CaptureError("Mock locations cannot be used for proof.");
      if (accuracy === null || accuracy <= 0 || accuracy > 50)
        throw new CaptureError("A precise location is required. Move outdoors and try again.");
      if (Math.abs(Date.now() - position.timestamp) > 30_000)
        throw new CaptureError("Your location is out of date. Try again.");
      if (AppState.currentState !== "active" || !camera.current)
        throw new CaptureError("Return to the camera and try again.");
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
        file,
        ticket,
        metadata: {
          token: ticket.token,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: accuracy,
          locationAt: new Date(position.timestamp).toISOString(),
          capturedAt,
          mocked: false,
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
    if (
      Date.now() >=
      Math.min(Date.parse(photo.ticket.expiresAt), Date.parse(photo.metadata.capturedAt) + 5 * 60_000)
    ) {
      setError("This photo has expired. Take a fresh photo before submitting.");
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      setBusyLabel("Uploading your photo…");
      const proof = await submitProof(session, id, photo.metadata, photo.file);
      setScout({ status: "submitted", proof });
      setPhoto(null);
    } catch (cause) {
      setBusyLabel("Checking whether your photo arrived…");
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

  const release = () =>
    showDialog({
      title: "Release this bounty?",
      message: "Someone else will be able to accept it. No work will be submitted.",
      tone: "destructive",
      icon: "refund",
      cancelLabel: "Keep bounty",
      confirmLabel: "Release bounty",
      onConfirm: async () => {
        if (operation.current) return;
        operation.current = true;
        setBusy(true);
        try {
          await claim.run(true);
          router.back();
        } catch (cause) {
          setError(proofMessage(cause));
        } finally {
          operation.current = false;
          setBusy(false);
        }
      },
    });

  if (scout?.status === "submitted")
    return (
      <Screen>
        <FlowHeader title="Submission saved" />
        <StatusView
          state="success"
          title="Your submission is saved."
          message="Open your submission to check reward protection and review status."
        />
        <FlowCard>
          <FlowDetail label="Received by Scoutvy" value={formatEnds(new Date(scout.proof.receivedAt))} last />
        </FlowCard>
        {writtenDraft.error ? <FlowNotice error title="Local draft" message={writtenDraft.error}
          action={{ label: "Retry cleanup", onPress: () => void writtenDraft.clear().catch(() => undefined) }} /> : null}
        <FlowFooter
          label="View submission"
          note="Payment is complete only after escrow settlement."
          onPress={() => router.replace({ pathname: "/review/[id]", params: { id } })}
        />
      </Screen>
    );
  const submitWritten = async () => {
    if (operation.current || writtenText.trim().length < 10) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const proof = await submitWrittenProof(session, id, writtenText);
      await writtenDraft.clear().catch(() => undefined);
      setScout({ status: "submitted", proof });
    } catch (cause) {
      const state = await fetchScoutState(session, id).catch(() => null);
      if (state?.status === "submitted") {
        await writtenDraft.clear().catch(() => undefined);
        setScout(state);
      } else setError(proofMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  if (loading || !scout)
    return (
      <Screen>
        <FlowHeader title="Your accepted bounty" />
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <RetryMessage title={error ?? "Couldn’t load acceptance"} onRetry={() => void load()} />
          )}
        </View>
      </Screen>
    );
  if (scout.status !== "accepted" || (now >= Date.parse(scout.expiresAt) && !busy))
    return (
      <Screen>
        <FlowHeader title="Acceptance ended" />
        <StatusView
          state="failure"
          title="This window has ended"
          message="Your acceptance is no longer active. Check the bounty to see whether it can be accepted again."
        />
        <FlowFooter label="Back to bounty" onPress={() => router.back()} />
      </Screen>
    );
  if (!bounty)
    return (
      <Screen>
        <FlowHeader title="Your accepted bounty" />
        <View style={styles.center}>
          <RetryMessage title={error ?? "Couldn’t load the bounty"} onRetry={() => void load()} />
        </View>
      </Screen>
    );
  if (bounty.proofType === "written") return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlowHeader title="Your submission" onBack={goBack} busy={busy} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={flowStyles.content}>
        <Text style={flowStyles.title}>{bounty.title}</Text>
        <FlowCard title="REQUIREMENTS">
          <Text style={flowStyles.body}>{bounty.instructions}</Text>
          <FlowDetail label="Submit by" value={formatEnds(new Date(scout.expiresAt))} last />
        </FlowCard>
        {bounty.taskMode === "on_site" ? (
          <FlowCard>
            <FlowDetail label="Location" value={bounty.locationLabel ?? "On-site"} last />
            {scout.target ? <>
              <Text selectable style={flowStyles.muted}>{scout.target.latitude.toFixed(6)}, {scout.target.longitude.toFixed(6)}</Text>
              <Button label="Get directions" variant="text" onPress={() => {
                void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${scout.target?.latitude},${scout.target?.longitude}`)}`)
                  .catch(() => setError("Couldn’t open directions. Use the coordinates shown above."));
              }} />
            </> : null}
            <Text style={flowStyles.muted}>Written submissions don’t verify your location.</Text>
          </FlowCard>
        ) : null}
        <TextField
          label="Your work"
          accessibilityLabel="Written submission"
          value={writtenText}
          onChangeText={writtenDraft.update}
          placeholder="Explain how you met the requirements. Include links to your work if needed."
          multiline maxLength={5000} showCount
          editable={!busy && writtenDraft.ready}
        />
        {writtenDraft.error ? <FlowNotice error title="Draft needs attention" message={writtenDraft.error}
          action={{ label: "Retry", onPress: () => void writtenDraft.retry().catch(() => undefined) }} /> : null}
        {error ? <FlowNotice error title="Couldn’t submit" message={error} /> : null}
        <PushOptIn key={session.walletAddress} session={session} />
      </ScrollView>
      <FlowFooter
        label="Submit for review"
        disabled={!writtenDraft.ready || writtenText.trim().length < 10}
        loading={busy}
        note="Your submission is final. The poster reviews it before payment."
        onPress={() => showDialog({
          title: "Submit your work?", message: "You won’t be able to edit it after submitting.",
          confirmLabel: "Submit", cancelLabel: "Keep editing", onConfirm: () => void submitWritten(),
        })}
        secondary={{ label: "Release bounty", onPress: release, disabled: busy }}
      />
      </KeyboardAvoidingView>
    </Screen>
  );
  if (stage === "camera")
    return (
      <Screen background="#000000">
        <FlowHeader title="Capture proof" onBack={goBack} busy={busy} />
        <FlowSteps active={1} />
        {foreground && permission?.granted ? (
          <ProofCamera
            ref={camera}
            ready={ready}
            busy={busy}
            instructions={bounty.instructions}
            busyLabel={busyLabel}
            onReady={() => setReady(true)}
            onCapture={() => void capture()}
            onError={() => {
              setStage(photo ? "review" : "target");
              setError("Couldn’t open the camera. Try again.");
            }}
          />
        ) : (
          <View style={styles.center}>
            <Button label="Enable camera" onPress={() => void openCamera()} />
          </View>
        )}
        {error ? (
          <View style={{ paddingBottom: 16 }}>
            <FlowNotice error title="Capture needs attention" message={error} />
          </View>
        ) : null}
      </Screen>
    );
  if (stage === "review" && photo) {
    const expiresAt = Math.min(
      Date.parse(photo.ticket.expiresAt),
      Date.parse(photo.metadata.capturedAt) + 5 * 60_000,
    );
    const stale = now >= expiresAt;
    return (
      <Screen>
        <FlowHeader title="Review your photo" onBack={goBack} busy={busy} />
        <FlowSteps active={2} />
        <ScrollView
          ref={scroll}
          onContentSizeChange={() => {
            if (error) scroll.current?.scrollToEnd({ animated: true });
          }}
          contentContainerStyle={flowStyles.content}
        >
          <PhotoReview
            uri={photo.file.uri}
            instructions={bounty.instructions}
            capturedAt={photo.metadata.capturedAt}
            stale={stale}
            error={error}
          />
        </ScrollView>
        <FlowFooter
          label={stale ? "Retake photo" : "Submit proof"}
          loading={busy}
          note={
            busy
              ? busyLabel
              : stale
                ? "Your bounty acceptance remains active until its deadline."
                : "Your reward stays in escrow during review."
          }
          onPress={() => void (stale ? openCamera() : submit())}
          secondary={
            stale ? undefined : { label: "Retake photo", onPress: () => void openCamera(), disabled: busy }
          }
        />
      </Screen>
    );
  }
  const directions = () =>
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${scout.target?.latitude},${scout.target?.longitude}`)}`,
    ).catch(() => setError("Couldn’t open directions. Use the target coordinates shown above."));
  return (
    <Screen>
      <FlowHeader title="Your accepted bounty" onBack={goBack} busy={busy} />
      <FlowSteps active={0} />
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => {
          if (error) scroll.current?.scrollToEnd({ animated: true });
        }}
        contentContainerStyle={flowStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProofTarget
          bounty={bounty}
          scout={scout}
          now={now}
          cameraGranted={permission?.granted ?? false}
          locationGranted={location.granted}
          onDirections={directions}
        />
        {error ? <FlowNotice error title="Before you continue" message={error} /> : null}
        <PushOptIn key={session.walletAddress} session={session} />
      </ScrollView>
      <FlowFooter
        label={
          permission?.canAskAgain === false || location.blocked
            ? "Open settings"
            : "Check location & open camera"
        }
        loading={busy}
        note={busy ? claim.phase || busyLabel : "Only fresh photos taken at the target can be submitted."}
        onPress={() => void openCamera()}
        secondary={{ label: "Release bounty", onPress: release, disabled: busy }}
      />
    </Screen>
  );
}

function assertPosition(position: Location.LocationObject, scout: ScoutState | null) {
  if (scout?.status !== "accepted" || !scout.target || scout.radiusM === null)
    throw new CaptureError("Your acceptance is no longer active. Return to the bounty.");
  if (Date.parse(scout.expiresAt) <= Date.now()) throw new CaptureError("Your acceptance window has ended.");
  if (position.mocked) throw new CaptureError("Mock locations cannot be used for proof.");
  const accuracy = position.coords.accuracy;
  if (accuracy === null || accuracy <= 0 || accuracy > 50)
    throw new CaptureError("GPS is not precise enough. Move outdoors, then try again.");
  if (Math.abs(Date.now() - position.timestamp) > 30_000)
    throw new CaptureError("Your location is out of date. Try again.");
  const rad = Math.PI / 180;
  const dLat = (position.coords.latitude - scout.target.latitude) * rad;
  const dLng = (position.coords.longitude - scout.target.longitude) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(position.coords.latitude * rad) *
      Math.cos(scout.target.latitude * rad) *
      Math.sin(dLng / 2) ** 2;
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  if (distance + accuracy > scout.radiusM)
    throw new CaptureError(
      `Move closer to the target. You’re about ${Math.round(distance)} m away, with GPS accuracy of ${Math.round(accuracy)} m. Proof must be within ${scout.radiusM} m.`,
    );
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
});
