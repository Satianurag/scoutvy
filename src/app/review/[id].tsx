import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchReview, proofImageSource, type Review, type Session } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { NavBar } from "@/components/ui/NavBar";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Reveal } from "@/components/ui/Reveal";
import { Screen } from "@/components/ui/Screen";
import { StatusView } from "@/components/ui/StatusView";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { TextField } from "@/components/ui/TextField";
import { reviewError, useReviewDecision } from "@/proof/use-review-decision";
import { colors, fonts } from "@/theme";
import { formatUnits } from "@/wallet/format";

const labels = { pending_review: "Awaiting review", disputed: "Disputed", paid: "Reward paid", refunded: "Reward refunded", cancelled: "Bounty cancelled", expired: "Bounty expired" };
export default function ProofReview() {
  const { session } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  return session && typeof id === "string" ? <ReviewScreen session={session} id={id} /> : null;
}

function ReviewScreen({ session, id }: { session: Session; id: string }) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const [review, setReview] = useState<Review | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [form, setForm] = useState<"dispute" | "resolve" | null>(null);
  const [reason, setReason] = useState("");
  const [payScout, setPayScout] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const decision = useReviewDecision(session, id, (value) => { setReview(value); if (value.status !== "pending_review" && form !== "resolve") setForm(null); });
  const load = useCallback(async () => {
    setLoadError(null);
    try { setReview(await fetchReview(session, id)); } catch (cause) { setLoadError(reviewError(cause)); }
  }, [session, id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const refreshImage = () => { setImageFailed(false); setImageLoaded(false); setImageAttempt((n) => n + 1); };
  if (decision.busy) return <Screen>
    <StatusView state="pending" title={decision.phase === "signing" ? "Confirm in your wallet" : decision.phase === "checking" ? "Checking escrow…" : "Confirming decision…"}
      message={decision.phase === "signing" ? "Review the Solana Devnet transaction before you approve." : "Your decision is complete only after Solana confirms it."} />
  </Screen>;
  if (!review) return <Screen><NavBar title="Proof review" /><View style={styles.center}>
    {loadError ? <RetryMessage title={loadError} onRetry={() => void load()} /> : <ActivityIndicator color={colors.primary} />}
  </View></Screen>;
  const reward = `${formatUnits(review.amount, review.decimals)} ${review.symbol}`;
  const closed = review.status === "cancelled" || review.status === "expired";
  const terminal = review.status === "paid" || review.status === "refunded" || closed;
  const deadlinePassed = review.deadline !== null && Date.parse(review.deadline) <= now;
  const confirmApproval = () => Alert.alert("Approve this proof?", `${reward} will be sent from escrow to the accepted scout on Solana Devnet. This cannot be undone.`, [
    { text: "Keep Reviewing", style: "cancel" }, { text: "Approve & Pay", onPress: () => void decision.run("approve") },
  ]);
  const message = closed ? "Solana confirmed the reward was returned to the poster before this photo was protected. This submission cannot be paid."
    : !review.protected ? "Your photo is saved. Protect the escrow before review can continue."
    : review.status === "paid" ? "Solana confirmed this reward was paid to the accepted scout."
    : review.status === "refunded" ? "The dispute was resolved and Solana confirmed the refund to the poster."
    : review.status === "disputed" ? "The reward stays locked until the designated resolver reviews the evidence and settles the dispute."
    : deadlinePassed ? "The review window ended. The submitted reward can now be released to the accepted scout."
    : review.role === "poster" ? "Check the photo against your instructions. Approve to pay the scout, or explain what is missing."
    : "The poster has 48 hours from escrow protection to review. After that, you can release an undisputed reward.";

  const actions = <BottomActions>
    {form ? <>
      <Button label={form === "dispute" ? "Confirm Dispute" : payScout ? "Resolve & Pay Scout" : "Resolve & Refund"}
        disabled={reason.trim().length < 10 || !imageLoaded} onPress={() => {
          Alert.alert(form === "dispute" ? "Submit this dispute?" : "Confirm resolution?", form === "dispute" ? "The reward will stay locked for resolution." : `${reward} will be ${payScout ? "paid to the scout" : "refunded to the poster"}. This cannot be undone.`,
            [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: () => void decision.run(form, reason.trim(), payScout) }]);
        }} />
      <Button label="Keep Reviewing" variant="secondary" onPress={() => setForm(null)} />
    </> : terminal ? <Button label="Done" onPress={() => router.back()} />
      : !review.protected ? <Button label="Protect Escrow" onPress={() => void decision.run()} />
      : review.status === "disputed" ? review.role === "resolver"
        ? <Button label="Resolve Dispute" onPress={() => { setReason(review.preparedReason ?? ""); setPayScout(review.preparedPayScout ?? true); setForm("resolve"); }} />
        : <Button label="Check Status" variant="secondary" onPress={() => void decision.run()} />
      : deadlinePassed ? <Button label="Release Reward" onPress={() => void decision.run(undefined, undefined, undefined, true)} />
      : review.role === "poster" ? <>
        <Button label="Approve & Pay" disabled={!imageLoaded} onPress={confirmApproval} />
        <Button label="Dispute Proof" variant="secondary" disabled={!imageLoaded} onPress={() => { setReason(review.preparedReason ?? ""); setForm("dispute"); }} />
      </> : <Button label="Check Status" variant="secondary" onPress={() => void decision.run()} />}
  </BottomActions>;

  const scrollHeader = form !== null && viewportHeight < 280;
  const header = <NavBar title={form === "dispute" ? "Dispute proof" : form === "resolve" ? "Resolve dispute" : "Proof review"}
    onBack={form ? () => setForm(null) : undefined} />;

  return <KeyboardAvoidingView style={styles.flex} behavior="padding">
    <Screen onLayout={({ nativeEvent }) => setViewportHeight(nativeEvent.layout.height)}>
      {!scrollHeader ? header : null}
      <ScrollView contentContainerStyle={[styles.content, form && styles.formContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}>
        {scrollHeader ? header : null}
        <Reveal><AmountDisplay amount={formatUnits(review.amount, review.decimals)} symbol={review.symbol} caption={labels[review.status]} /></Reveal>
        <Reveal order={1} style={styles.photo}>
          <Image key={`${review.proofId}:${imageAttempt}`} source={proofImageSource(session, id)} cachePolicy="none" contentFit="contain"
            accessibilityLabel="Submitted proof photo" style={[styles.image, { aspectRatio: review.width / review.height }]}
            onLoad={() => setImageLoaded(true)} onError={() => setImageFailed(true)} />
          {!imageLoaded && !imageFailed ? <ActivityIndicator color={colors.primary} style={styles.imageSpinner} /> : null}
          {imageFailed ? <View style={styles.photoError}><RetryMessage title="Couldn’t load proof photo" onRetry={refreshImage} /></View> : null}
        </Reveal>
        <Text style={styles.message}>{message}</Text>
        <Reveal order={2} style={styles.card}><SummaryCard items={[
          { label: "Bounty", value: review.title, stacked: true },
          { label: "Proof needed", value: review.instructions, stacked: true },
          { label: "Submitted", value: new Date(review.receivedAt).toLocaleString(), stacked: true },
          ...(review.deadline && !terminal ? [{ label: "Review deadline", value: new Date(review.deadline).toLocaleString(), stacked: true }] : []),
          { label: "Network", value: "Solana Devnet" },
          ...(review.disputeReason ? [{ label: "Dispute reason", value: review.disputeReason, stacked: true }] : []),
          ...(review.resolutionReason ? [{ label: "Resolution", value: review.resolutionReason, stacked: true }] : []),
        ]} /></Reveal>
        {form ? <View style={styles.form}>
          {form === "resolve" ? <View style={styles.choices}>
            <Chip label="Pay scout" selected={payScout} onPress={() => setPayScout(true)} />
            <Chip label="Refund poster" selected={!payScout} onPress={() => setPayScout(false)} />
          </View> : null}
          <TextField label={form === "resolve" ? "Resolution reason" : "What needs to be corrected?"} value={reason} onChangeText={setReason}
            accessibilityLabel="Decision reason" placeholder="Explain your decision clearly…" multiline maxLength={500} showCount />
        </View> : null}
        {loadError || decision.error ? <Text style={styles.error} accessibilityLiveRegion="polite">{loadError ?? decision.error}</Text> : null}
        {form ? <View style={styles.formActions}>{actions}</View> : null}
      </ScrollView>
      {!form ? actions : null}
    </Screen>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, center: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  content: { paddingTop: 22, paddingBottom: 24 }, formContent: { paddingBottom: 0 }, card: { marginTop: 22 },
  photo: { marginHorizontal: 16.67, marginTop: 22, borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface, minHeight: 120 },
  image: { width: "100%", maxHeight: 360 }, imageSpinner: { position: "absolute", alignSelf: "center", top: "45%" },
  photoError: { position: "absolute", inset: 0, justifyContent: "center", backgroundColor: colors.surface, padding: 16 },
  message: { marginHorizontal: 24, marginTop: 18, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlign: "center" },
  form: { marginTop: 24 }, formActions: { marginTop: 24 }, choices: { flexDirection: "row", gap: 8, marginHorizontal: 16.67, marginBottom: 20 },
  error: { marginHorizontal: 24, marginTop: 16, color: colors.danger, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlign: "center" },
});
