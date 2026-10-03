import * as SecureStore from "expo-secure-store";

// Two encrypted slots keep the previous complete draft readable if a write is interrupted.
const generations = new Map<string, number>();
export const draftGeneration = (wallet: string) => generations.get(wallet) ?? 0;
export function deleteAccountDraft(wallet: string) {
  generations.set(wallet, draftGeneration(wallet) + 1);
  return deleteSavedDraft(wallet);
}
const queues = new Map<string, Promise<unknown>>();
const prefix = (wallet: string) => `scoutvy-draft-${wallet}`;
type Head = { slot: number; count: number };
function headFrom(raw: string | null): Head | null {
  if (!raw) return null;
  const head = JSON.parse(raw) as Head;
  if (![0, 1].includes(head.slot) || !Number.isInteger(head.count) || head.count < 1 || head.count > 32)
    throw new Error("Draft storage could not be read");
  return head;
}
function serial<T>(wallet: string, work: () => Promise<T>): Promise<T> {
  const result = (queues.get(wallet) ?? Promise.resolve()).catch(() => undefined).then(work);
  queues.set(wallet, result.catch(() => undefined));
  return result;
}
export function readSavedDraft(wallet: string): Promise<unknown | null> {
  return serial(wallet, async () => {
    const key = prefix(wallet);
    const head = headFrom(await SecureStore.getItemAsync(`${key}-head`));
    if (!head) return null;
    const parts = await Promise.all(Array.from({ length: head.count }, (_, i) =>
      SecureStore.getItemAsync(`${key}-${head.slot}-${i}`)));
    if (parts.some((part) => part === null)) throw new Error("Draft storage is incomplete");
    return JSON.parse(parts.join(""));
  });
}
export function writeSavedDraft(wallet: string, value: unknown, generation: number): Promise<void> {
  // ASCII chunks avoid native 2 KB value limits and splitting a Unicode surrogate pair.
  const raw = JSON.stringify(value).replace(/[\u007f-\uffff]/g, (char) =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return serial(wallet, async () => {
    const key = prefix(wallet);
    if (generation !== draftGeneration(wallet)) throw new Error("Draft was cleared");
    const previous = headFrom(await SecureStore.getItemAsync(`${key}-head`));
    const slot = previous?.slot === 0 ? 1 : 0;
    const parts = raw.match(/.{1,1500}/gs) ?? [];
    if (!parts.length || parts.length > 32) throw new Error("Draft is too large to save");
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(`${key}-${slot}-${i}`, parts[i]);
    await SecureStore.setItemAsync(`${key}-head`, JSON.stringify({ slot, count: parts.length }));
  });
}
export function deleteSavedDraft(wallet: string): Promise<void> {
  return serial(wallet, async () => {
    const key = prefix(wallet);
    // Remove the pointer first so interrupted cleanup can never restore a discarded form.
    await SecureStore.deleteItemAsync(`${key}-head`);
    for (const slot of [0, 1]) for (let i = 0; i < 32; i++)
      await SecureStore.deleteItemAsync(`${key}-${slot}-${i}`);
  });
}
