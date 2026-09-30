import { getUtf8Decoder } from "@solana/kit";

export type SignInOutputBytes = {
  account: { addressBase64: string };
  signature: Uint8Array;
  signedMessage: Uint8Array;
};

export type MwaSignInResult = { address: string; signature: string; signed_message: string };

// @wallet-ui/react-native-kit 4.3.0 `signIn()` returns `signature` and `signedMessage` as the
// UTF-8 bytes of MWA's base64 strings (`stringToUint8Array`), so they decode back to base64 text.
export function toMwaSignInResult(output: SignInOutputBytes): MwaSignInResult {
  const utf8 = getUtf8Decoder();
  return {
    address: output.account.addressBase64,
    signature: utf8.decode(output.signature),
    signed_message: utf8.decode(output.signedMessage),
  };
}
