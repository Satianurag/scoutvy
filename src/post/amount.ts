export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back";

const MAX_WHOLE_DIGITS = 6;

/** Applies a keypad press to a decimal amount string, keeping it well-formed. */
export function applyKey(current: string, key: KeypadKey, decimals: number): string {
  if (key === "back") return current.slice(0, -1);
  if (key === ".") {
    if (decimals === 0 || current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  const [whole, fraction] = current.split(".");
  if (fraction !== undefined) return fraction.length >= decimals ? current : current + key;
  if (whole === "0") return key;
  if (whole.length >= MAX_WHOLE_DIGITS) return current;
  return current + key;
}

/** Converts a decimal amount string to integer base units. */
export function toBaseUnits(value: string, decimals: number): bigint {
  if (!/^\d*\.?\d*$/.test(value) || value === "" || value === ".") return 0n;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0").slice(0, decimals) || "0");
}

/** Trims a trailing "." or zeros so the amount reads cleanly in summaries. */
export function normalizeAmount(value: string): string {
  if (!value.includes(".")) return value || "0";
  const trimmed = value.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}
