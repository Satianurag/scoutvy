export const TITLE_LENGTH = { min: 4, max: 60 };
export const INSTRUCTIONS_LENGTH = { min: 10, max: 500 };
export const RADIUS_OPTIONS_M = [50, 100, 250, 500] as const;
export const DEFAULT_RADIUS_M = 100;
export const REWARD_LIMITS = { min: 1, max: 500 };

export const DURATION_OPTIONS = [
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
] as const;

export const TOKEN_META = {
  SKR: { name: "Seeker", icon: require("@/assets/images/tokens/skr.png") },
  USDC: { name: "USDC", icon: require("@/assets/images/tokens/usdc.png") },
} as const;

const endsFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export const formatEnds = (date: Date) => endsFormat.format(date);

export const formatRadius = (meters: number) => `${meters} m`;
