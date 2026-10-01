const ADJECTIVES = ["Swift", "Keen", "Bold", "Quiet", "Sharp", "Lucky", "Brave", "Clever", "Bright", "Nimble"];
const NOUNS = ["Scout", "Falcon", "Fox", "Owl", "Ranger", "Hawk", "Otter", "Lynx", "Heron", "Wolf"];

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

export function suggestUsername(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${digits}`;
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
