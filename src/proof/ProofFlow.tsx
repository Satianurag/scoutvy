import { CameraView, useCameraPermissions } from "expo-camera";
import type { File } from "expo-file-system";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  fetchBounty,
  fetchScoutState,
  prepareCapture,
  submitProof,
  type BountyView,
  type CaptureTicket,
  type ProofMetadata,
  type ScoutState,
  type Session,
} from "@/auth/api";
import { Button } from "@/components/ui/Button";
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
      setScout(state);
    } catch (cause) {
      setError(proofMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [session, id]);

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
  }, [photo, stage, showDialog]);

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
      message: "Another scout will be able to accept it. Any unsubmitted photo will be discarded.",
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
          title="Your proof is saved."
          message="One last step: check escrow protection and follow the review from your submission."
        />
        <FlowCard>
          <FlowDetail label="Received by Scoutvy" value={formatEnds(new Date(scout.proof.receivedAt))} last />
        </FlowCard>
        <FlowFooter
          label="View submission"
          note="Payment is complete only after escrow settlement."
          onPress={() => router.replace({ pathname: "/review/[id]", params: { id } })}
        />
      </Screen>
    );
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
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${scout.target.latitude},${scout.target.longitude}`)}`,
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
  if (scout?.status !== "accepted")
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
