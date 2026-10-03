import {
  address, appendTransactionMessageInstructions, compileTransaction, createTransactionMessage,
  getBase58Decoder, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from "@solana/kit";
import { transact, useAuthorization, useMobileWallet } from "@wallet-ui/react-native-kit";
import { useCallback } from "react";
import { runWalletOperation } from "@/wallet/operation";

export type WalletTransactionLifetime = {
  blockhash: string;
  lastValidBlockHeight: bigint;
  minContextSlot: bigint;
};
export class WalletTransactionError extends Error {
  constructor(message: string, readonly definitelyNotSubmitted = false) { super(message); }
}

type TransactionStage = "opening" | "authorizing" | "checking_account" | "fetching_blockhash"
  | "compiling" | "saving_recovery" | "requesting_signature" | "received_signature" | "closed";

const RPC_DIAGNOSTIC_WORDS = new Set(("a an the to of for from in on at with without and or is are was were be been has have " +
  "not no cannot could failed failure error exception unexpected invalid missing unsupported unavailable undefined null " +
  "request requests response network connection connect disconnected closed aborted abort timeout timed out cancelled " +
  "fetch fetching xmlhttprequest getlatestblockhash rpc http https status server client transport socket websocket " +
  "body header headers read reading already used consumed locked stream streaming buffer array arraybuffer byte bytes " +
  "json parse parsing serialize deserializing encoding decoding base58 base64 string number bigint integer overflow " +
  "function method call invoke hostfunction native module object property value argument parameter type constructor " +
  "runtime javascript hermes react activity background foreground paused suspended timer task promise resolve reject " +
  "permission denied access forbidden rate limit too many secure certificate ssl tls handshake dns address url " +
  "operation completed supported implemented allocated memory detached disposed destroyed cancelled protocol empty " +
  "must valid responsebody content length expected found received returned synchronous sending opened send load").split(" "));

function safeRpcErrorSummary(error: unknown) {
  if (!(error instanceof Error)) return "Unknown";
  const message = error.message.slice(0, 2000)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, " [redacted] ")
    .replace(/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g, " [redacted] ")
    .replace(/\b\S+\s*[=:]\s*\S+/g, " [redacted] ");
  // Only fixed technical words leave the device. Addresses, payloads, URLs and unknown values do not.
  return (message.match(/[A-Za-z0-9_+./=-]+/g) ?? [])
    .map((word) => RPC_DIAGNOSTIC_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : "[redacted]")
    .join(" ").replace(/(?:\[redacted\] ){2,}/g, "[redacted] ").slice(0, 200);
}

function safeErrorMetadata(error: unknown) {
  const name = error instanceof Error ? error.name : "Unknown";
  const fields = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" ? value as Record<string, unknown> : {};
  const outer = fields(error);
  const cause = fields(outer.cause);
  const context = fields(outer.context);
  const causeContext = fields(cause.context);
  const code = outer.code ?? context.__code;
  // The native SDK uses these fixed sentences as codes for its two timeout paths.
  const safeCode = code === "Timed out waiting for local association to be ready" ? "ASSOCIATION_TIMEOUT"
    : code === "Timed out waiting for response" ? "RESPONSE_TIMEOUT"
    : code === "Failed to end session" ? "END_SESSION_FAILED"
    : code === "Session not established: Local association cancelled by user" ? "ASSOCIATION_CANCELLED"
    : typeof code === "number" || (typeof code === "string" && /^[A-Z_]{1,80}$/.test(code)) ? code : undefined;
  const httpStatus = [context.statusCode, outer.statusCode, outer.status, causeContext.statusCode, cause.statusCode, cause.status]
    .find((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599);
  // Classify messages locally into fixed labels; never log the messages themselves.
  const messages = [outer.message, cause.message].filter((value): value is string => typeof value === "string").join(" ");
  const category = httpStatus === 429 || /rate.?limit|too many requests|\b429\b/i.test(messages) ? "RATE_LIMIT"
    : name === "AbortError" || cause.name === "AbortError" || /\babort(?:ed)?\b/i.test(messages) ? "ABORTED"
    : /timed?\s*out|timeout/i.test(messages) ? "TIMEOUT"
    : /network request failed|failed to fetch|networkerror|internet connection|ECONNRESET|ENETUNREACH|(?:unable|failed) to resolve (?:host|address)|unknownhost/i.test(messages) ? "NETWORK"
    : httpStatus ? "HTTP" : "UNKNOWN";
  return {
    name: /^[A-Za-z]{1,80}$/.test(name) ? name : "Unknown",
    code: safeCode,
    httpStatus,
    category,
  };
}

export type ReviewDiagnosticStage = "prepare" | "simulate" | "wallet" | "record" | "refresh";
export function logReviewFailure(stage: ReviewDiagnosticStage, started: number, error: unknown) {
  console.warn("review_decision_failed", {
    stage, elapsedMs: Date.now() - started, ...safeErrorMetadata(error), summary: safeRpcErrorSummary(error),
  });
}

/** Fetch while Scoutvy is foreground, and reject slow wallet setup before requesting a signature. */
export function useWalletTransaction(expectedWallet: string) {
  const wallet = useMobileWallet();
  const { authorizeSession } = useAuthorization(wallet);
  return useCallback(async (instructions: Instruction[], beforeSign?: (lifetime: WalletTransactionLifetime) => Promise<void>) => {
    const started = Date.now();
    let stage: TransactionStage = "opening";
    const getStage = (): TransactionStage => stage;
    let submittedSignature: string | undefined;
    let unsentSetupError: WalletTransactionError | undefined;
    const trace = (next: TransactionStage) => {
      stage = next;
      if (__DEV__) console.info("wallet_transaction_stage", { stage, elapsedMs: Date.now() - started });
    };
    trace("opening");
    try {
      const signature = await runWalletOperation(async () => {
        trace("fetching_blockhash");
        const { context, value: lifetime } = await wallet.client.rpc
          .getLatestBlockhash({ commitment: "confirmed" }).send();
        const fetchedAt = performance.now();
        trace("opening");
        return transact(async (adapter) => {
          try {
            trace("authorizing");
            const account = await authorizeSession(adapter);
            trace("checking_account");
            if (account.address !== expectedWallet)
              throw new WalletTransactionError("Choose the wallet you used to sign in, then try again.");
            trace("compiling");
            const transaction = compileTransaction(pipe(
              createTransactionMessage({ version: 0 }),
              (tx) => setTransactionMessageFeePayer(address(expectedWallet), tx),
              (tx) => setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
              (tx) => appendTransactionMessageInstructions(instructions, tx),
            ));
            const checkWalletSetupAge = () => {
              if (performance.now() - fetchedAt > 20_000)
                throw new WalletTransactionError("Wallet setup took too long. Try again when your wallet is ready.", true);
            };
            // A durable recovery write must finish before any signature is requested.
            checkWalletSetupAge();
            trace("saving_recovery");
            await beforeSign?.({ ...lifetime, minContextSlot: context.slot });
            checkWalletSetupAge();
            trace("requesting_signature");
            const [signature] = await adapter.signAndSendTransactions({
              transactions: [transaction], minContextSlot: Number(context.slot), commitment: "confirmed",
            });
            if (!signature) throw new WalletTransactionError("The wallet didn’t return a transaction. Check confirmation before retrying.");
            trace("received_signature");
            submittedSignature = getBase58Decoder().decode(signature);
            return submittedSignature;
          } catch (error) {
            if (error instanceof WalletTransactionError && error.definitelyNotSubmitted) unsentSetupError = error;
            // transact's native finally may throw while closing and replace this original failure.
            console.warn("wallet_transaction_callback_failed", { stage, elapsedMs: Date.now() - started, ...safeErrorMetadata(error) });
            throw error;
          }
        });
      });
      trace("closed");
      return signature;
    } catch (error) {
      // Release failures need diagnosis too; never include the error message, payload, wallet, or token.
      const metadata = safeErrorMetadata(error);
      console.warn("wallet_transaction_failed", { stage, elapsedMs: Date.now() - started, ...metadata });
      if (getStage() === "fetching_blockhash") console.warn("wallet_blockhash_error_summary", safeRpcErrorSummary(error));
      // Native session cleanup can fail after submission. Preserve the observed signature so the
      // caller can persist it and verify the chain; a returned signature does not confirm success.
      if (submittedSignature) return submittedSignature;
      if (unsentSetupError) throw unsentSetupError;
      if (getStage() === "fetching_blockhash" && metadata.category === "NETWORK")
        throw new WalletTransactionError("Couldn’t connect to Solana. Check your connection and try again.");
      if (metadata.code === "ASSOCIATION_TIMEOUT")
        throw new WalletTransactionError("Your wallet took too long to connect. Open it, finish any prompts, then try again.");
      if (metadata.code === "RESPONSE_TIMEOUT")
        throw new WalletTransactionError("Your wallet didn’t respond in time. Check the transaction status before trying again.");
      throw error;
    }
  }, [authorizeSession, expectedWallet, wallet.client.rpc]);
}
