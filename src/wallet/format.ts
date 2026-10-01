import type { WalletToken } from "@/auth/api";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatUnits(amount: string, decimals: number): string {
  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export const formatUsd = (value: number) => usd.format(value);

export function formatSignedUsd(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return "+$0.00";
  return `${rounded > 0 ? "+" : "-"}${usd.format(Math.abs(rounded))}`;
}

export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded < 0 ? "-" : "+"}${Math.abs(rounded).toFixed(2)}%`;
}

export type TokenValue = { value: number; change: number } | null;

/** USD value and its 24h change, derived from the token's current price and 24h price change. */
export function tokenValue(token: WalletToken): TokenValue {
  if (token.usdPrice === null) return null;
  const value = (Number(token.amount) / 10 ** token.decimals) * token.usdPrice;
  const pct = token.priceChange24h ?? 0;
  const change = value - value / (1 + pct / 100);
  return { value, change };
}

export function portfolioValue(tokens: WalletToken[]) {
  let value = 0;
  let change = 0;
  for (const token of tokens) {
    const v = tokenValue(token);
    if (!v) continue;
    value += v.value;
    change += v.change;
  }
  const previous = value - change;
  return { value, change, percent: previous > 0 ? (change / previous) * 100 : 0 };
}

export type Trend = "up" | "down" | "flat";

export function trend(value: number): Trend {
  const rounded = Math.round(value * 100) / 100;
  return rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
}
