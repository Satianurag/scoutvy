import { Text } from "react-native";
import { FlowCard, FlowDetail, FlowNotice, flowStyles } from "@/components/ui/Flow";
import { ProofImage } from "@/proof/ProofImage";
import { formatEnds } from "@/post/options";

export function PhotoReview({
  uri,
  instructions,
  capturedAt,
  stale,
  error,
}: {
  uri: string;
  instructions: string;
  capturedAt: string;
  stale: boolean;
  error: string | null;
}) {
  return (
    <>
      <Text style={flowStyles.title}>Clear enough to prove it?</Text>
      <ProofImage key={uri} source={{ uri }} />
      <FlowCard title="CHECK AGAINST THE REQUEST">
        <Text style={flowStyles.body}>{instructions}</Text>
        <FlowDetail label="Captured" value={formatEnds(new Date(capturedAt))} last />
      </FlowCard>
      {stale ? (
        <FlowNotice
          error
          title="This photo has expired"
          message="Take a fresh photo to keep the proof and location current."
        />
      ) : (
        <FlowNotice
          title="Ready when you are"
          message="Make sure the requested details are readable. You can retake before submitting."
        />
      )}
      {error ? <FlowNotice error title="Photo not submitted" message={error} /> : null}
    </>
  );
}
