import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ApiError, fetchReview, proofImageSource, type Review, type Session } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { useAppDialog } from "@/components/ui/AppDialog";
import { FlowFooter, FlowHeader, FlowNotice, flowStyles } from "@/components/ui/Flow";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Screen } from "@/components/ui/Screen";
import { StatusView } from "@/components/ui/StatusView";
import { DecisionForm } from "@/proof/DecisionForm";
import { ReviewOverview, reviewIsClosed } from "@/proof/ReviewOverview";
import { reviewError, useReviewDecision } from "@/proof/use-review-decision";
import { colors } from "@/theme";
import { formatUnits } from "@/wallet/format";

const leaveReview = () => router.canGoBack() ? router.back() : router.replace("/(tabs)/activity");

export default function ProofReview() {
  const { session } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  return session && typeof id === "string" ? <ReviewScreen key={id} session={session} id={id} /> : null;
}

function ReviewScreen({ session, id }: { session: Session; id: string }) {
  const showDialog = useAppDialog();
  const scroll = useRef<ScrollView>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedProofId, setLoadedProofId] = useState<string | null>(null);
  const imageLoaded = review !== null && (review.proofType === "written"
    ? typeof review.writtenText === "string" && review.writtenText.length >= 10
    : loadedProofId === review.proofId);
  const [form, setForm] = useState<"dispute" | "resolve" | null>(null);
  const [reason, setReason] = useState("");
  const [payScout, setPayScout] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const updateReview = useCallback((value: Review) => {
    setReview(value);
    setForm((current) =>
      (current === "dispute" && value.status === "pending_review") ||
      (current === "resolve" && value.status === "disputed")
        ? current
        : null,
    );
  }, []);
  const decision = useReviewDecision(session, id, updateReview);
  const load = useCallback(async () => {
    setLoadError(null);
    setUnavailable(false);
    try {
      updateReview(await fetchReview(session, id));
    } catch (cause) {
      setLoadError(reviewError(cause));
      setUnavailable(cause instanceof ApiError && (cause.status === 403 || cause.status === 404));
    }
  }, [session, id, updateReview]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const goBack = useCallback(() => {
    if (decision.busy) return;
    if (!form) {
      leaveReview();
      return;
    }
    if (reason.trim() && reason !== (review?.preparedReason ?? "")) {
      showDialog({
        title: "Leave this decision?",
        message: "Your unsaved reason will be discarded. The submission and reward stay unchanged.",
        tone: "destructive",
        cancelLabel: "Keep editing",
        confirmLabel: "Discard reason",
        onConfirm: () => {
          setForm(null);
          setReason("");
        },
      });
    } else setForm(null);
  }, [decision.busy, form, reason, review?.preparedReason, showDialog]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack]),
  );
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [form]);
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  if (decision.busy)
    return (
      <Screen>
        <FlowHeader title="Confirming your decision" busy />
        <StatusView
          state="pending"
          title={
            decision.phase === "signing"
              ? "Confirm in your wallet"
              : decision.phase === "checking"
                ? "Checking escrow…"
                : "Confirming on Solana…"
          }
          message={
            decision.phase === "signing"
              ? "Review the test-token transaction in your wallet. You can cancel before signing."
              : "Your decision is complete only after Solana confirms it. Keep this screen open."
          }
        />
      </Screen>
    );
  if (!review && unavailable)
    return (
      <Screen>
        <FlowHeader title="Review submission" onBack={leaveReview} />
        <StatusView state="failure" title="Submission unavailable" message={loadError} />
        <FlowFooter label="Back to Activity" onPress={() => router.replace("/(tabs)/activity")} />
      </Screen>
    );
  if (!review)
    return (
      <Screen>
        <FlowHeader title="Review submission" onBack={leaveReview} />
        <View style={styles.center}>
          {loadError ? (
            <RetryMessage title={loadError} onRetry={() => void load()} />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </Screen>
    );
  const terminal = reviewIsClosed(review);
  const deadlinePassed = review.deadline !== null && Date.parse(review.deadline) <= now;
  const reward = `${formatUnits(review.amount, review.decimals)} ${review.symbol}`;
  const error = loadError ?? (terminal ? null : decision.error);
  const startForm = (value: "dispute" | "resolve") => {
    setReason(review.preparedReason ?? "");
    setPayScout(review.preparedPayScout ?? true);
    setForm(value);
  };
  const confirmApproval = () =>
    showDialog({
      title: "Approve this submission?",
      message: `${reward} in test tokens will be paid to the scout. This cannot be undone.`,
      tone: "confirm",
      icon: "approve",
      cancelLabel: "Keep reviewing",
      confirmLabel: "Approve & pay",
      onConfirm: () => void decision.run("approve"),
    });
  const confirmDecision = () => {
    if (!form || reason.trim().length < 10 || !imageLoaded || (form === "dispute" && deadlinePassed)) return;
    showDialog({
      title: form === "dispute" ? "Submit this dispute?" : "Confirm resolution?",
      message:
        form === "dispute"
          ? "Your reason will be shared with the resolver. The reward stays locked until resolution."
          : `${reward} in test tokens will be ${payScout ? "paid to the scout" : "refunded to the poster"}. This cannot be undone.`,
      tone: "confirm",
      icon: form === "dispute" ? "dispute" : payScout ? "approve" : "refund",
      cancelLabel: "Keep reviewing",
      confirmLabel: form === "dispute" ? "Submit dispute" : payScout ? "Pay scout" : "Refund poster",
      onConfirm: () => void decision.run(form, reason.trim(), payScout),
    });
  };
  const actions = form ? (
    <FlowFooter
      label={form === "dispute" ? "Submit dispute" : payScout ? "Resolve & pay scout" : "Resolve & refund"}
      disabled={reason.trim().length < 10 || !imageLoaded || (form === "dispute" && deadlinePassed)}
      note="You’ll confirm the decision in your wallet."
      onPress={confirmDecision}
      secondary={{ label: "Back to submission", onPress: goBack }}
    />
  ) : terminal ? (
    <FlowFooter label="Done" onPress={leaveReview} />
  ) : !review.protected ? (
    <FlowFooter
      label="Retry confirmation"
      note="The submission is saved. Review starts after confirmation."
      onPress={() => void decision.run()}
    />
  ) : review.status === "disputed" ? (
    review.role === "resolver" ? (
      <FlowFooter
        label="Resolve dispute"
        disabled={!imageLoaded}
        note={
          !imageLoaded
            ? "Load and review the submission before deciding."
            : "Review both the original request and the dispute."
        }
        onPress={() => startForm("resolve")}
      />
    ) : (
      <FlowFooter label="Check status" onPress={() => void decision.run()} />
    )
  ) : deadlinePassed ? (
    <FlowFooter
      label="Release reward"
      note="The undisputed reward will go to the accepted scout."
      onPress={() => void decision.run(undefined, undefined, undefined, true)}
    />
  ) : review.role === "poster" ? (
    <FlowFooter
      label="Approve & pay"
      disabled={!imageLoaded}
      note={
        !imageLoaded
          ? "Load and review the submission before deciding."
          : `${reward} will be released to the scout.`
      }
      onPress={confirmApproval}
      secondary={{ label: "Dispute submission", disabled: !imageLoaded, onPress: () => startForm("dispute") }}
    />
  ) : (
    <FlowFooter
      label="Check status"
      note="You can also return to this submission from Activity."
      onPress={() => void decision.run()}
    />
  );
  const openExplorer = () =>
    void Linking.openURL(`https://explorer.solana.com/tx/${review.signature}?cluster=devnet`).catch(() =>
      setLoadError("Couldn’t open Explorer. Try again."),
    );
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Screen>
        <FlowHeader
          title={
            form === "dispute"
              ? "Dispute submission"
              : form === "resolve"
                ? "Resolve dispute"
                : terminal
                  ? "Submission outcome"
                  : "Review submission"
          }
          onBack={goBack}
        />
        <ScrollView
          ref={scroll}
          contentContainerStyle={flowStyles.content}
          onContentSizeChange={() => {
            if (error) scroll.current?.scrollToEnd({ animated: true });
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            form ? undefined : (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void refresh()}
                tintColor={colors.primary}
              />
            )
          }
        >
          {form ? (
            <DecisionForm
              review={review}
              form={form}
              reason={reason}
              onReason={setReason}
              payScout={payScout}
              onPayScout={setPayScout}
            />
          ) : (
            <ReviewOverview
              review={review}
              now={now}
              source={proofImageSource(session, id)}
              onImageReady={(ready) => setLoadedProofId(ready ? review.proofId : null)}
              onExplorer={openExplorer}
            />
          )}
          {form === "dispute" && deadlinePassed ? (
            <FlowNotice
              error
              title="The review window ended"
              message="A new dispute can no longer be submitted. Return to the submission to check the reward."
            />
          ) : null}
          {error ? (
            <FlowNotice
              error
              title="This needs another look"
              message={error}
              action={{ label: "Refresh status", onPress: () => void load() }}
            />
          ) : null}
          {form ? actions : null}
        </ScrollView>
        {!form ? actions : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
});
