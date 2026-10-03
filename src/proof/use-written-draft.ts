import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

const indexKey = (wallet: string) => `scoutvy-written-draft-index-${wallet}`;
const draftQueues = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();
function serialize<T>(wallet: string, work: () => Promise<T>) {
  const result = (draftQueues.get(wallet) ?? Promise.resolve()).catch(() => undefined).then(work);
  draftQueues.set(wallet, result.catch(() => undefined));
  return result;
}
const indexed = new Map<string, Set<string>>();
async function readIndex(wallet: string) {
  const raw = await SecureStore.getItemAsync(indexKey(wallet));
  const count = raw === null ? 0 : Number(raw);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid draft index");
  const ids = new Set<string>();
  for (let i = 0; i < count; i++) {
    const id = await SecureStore.getItemAsync(`${indexKey(wallet)}-${i}`);
    if (id === null) throw new Error("Incomplete draft index");
    ids.add(id);
  }
  return { ids, count };
}
async function registerDraft(wallet: string, id: string) {
  if (indexed.get(wallet)?.has(id)) return;
  {
    const { ids, count } = await readIndex(wallet);
    if (!ids.has(id)) {
      // One ID per encrypted entry avoids SecureStore value-size limits.
      await SecureStore.setItemAsync(`${indexKey(wallet)}-${count}`, id);
      await SecureStore.setItemAsync(indexKey(wallet), String(count + 1));
      ids.add(id);
    }
    indexed.set(wallet, ids);
  }
}
export async function deleteWrittenDrafts(wallet: string, knownIds: string[]) {
  generations.set(wallet, (generations.get(wallet) ?? 0) + 1);
  return serialize(wallet, async () => {
  const { ids, count } = await readIndex(wallet);
  for (const id of new Set([...knownIds, ...ids])) {
    const key = headKey(wallet, id);
    const head = await readHead(key);
    await removeChunks(key, head);
    await SecureStore.deleteItemAsync(key);
  }
  // Keeping the index until every draft is gone makes retries safe.
  await SecureStore.deleteItemAsync(indexKey(wallet));
  indexed.delete(wallet);
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${indexKey(wallet)}-${i}`);
  });
}

type Head = { version: string; count: number };
const headKey = (wallet: string, id: string) => `scoutvy-draft-${wallet}-${id}`;
const chunkKey = (key: string, head: Head, index: number) => `${key}-${head.version}-${index}`;
async function readHead(key: string): Promise<Head | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw === null) return null;
  const h = JSON.parse(raw) as Head;
  if (!h || !/^[a-z0-9]+$/.test(h.version) || !Number.isInteger(h.count) || h.count < 1 || h.count > 10)
    throw new Error("Invalid saved draft");
  return h;
}
async function removeChunks(key: string, head: Head | null) {
  if (head) await Promise.all(Array.from({ length: head.count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, head, i))));
}
async function readDraft(key: string) {
  const head = await readHead(key);
  if (!head) return "";
  const chunks = await Promise.all(Array.from({ length: head.count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, head, i))));
  if (chunks.some((chunk) => chunk === null)) throw new Error("Incomplete saved draft");
  return chunks.join("");
}
async function writeDraft(key: string, text: string) {
  const previous = await readHead(key);
  const characters = Array.from(text);
  const chunks = characters.length ? Array.from({ length: Math.ceil(characters.length / 500) },
    (_, i) => characters.slice(i * 500, (i + 1) * 500).join("")) : [""];
  const head: Head = { version: `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`, count: chunks.length };
  // Small encrypted chunks avoid platform value limits. Publish the pointer only after every chunk is saved.
  try {
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, head, i), chunk)));
    await SecureStore.setItemAsync(key, JSON.stringify(head));
  } catch (error) {
    await removeChunks(key, head).catch(() => undefined);
    throw error;
  }
  await removeChunks(key, previous).catch(() => undefined);
}

export function useWrittenDraft(wallet: string, id: string) {
  const key = headKey(wallet, id);
  const generation = useRef(generations.get(wallet) ?? 0);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const hydrated = useRef(false);
  const clearing = useRef(false);
  const current = useRef("");
  const saved = useRef("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const restore = useCallback(async () => {
    try {
      const value = await readDraft(key);
      if (!alive.current || generation.current !== (generations.get(wallet) ?? 0) || clearing.current || hydrated.current) return;
      current.current = saved.current = value;
      setText(value);
      hydrated.current = true;
      setReady(true);
      setError(null);
    } catch {
      if (alive.current) setError("Couldn’t restore your saved draft. Retry before editing.");
    }
  }, [key, wallet]);
  const flush = useCallback(async () => {
    if (!hydrated.current || clearing.current) return;
    const value = current.current;
    const saveGeneration = generation.current;
    queue.current = queue.current.catch(() => undefined).then(async () => {
      if (value === saved.current || clearing.current) return;
      await serialize(wallet, async () => {
        if (saveGeneration !== (generations.get(wallet) ?? 0)) throw new Error("Draft was cleared");
        await registerDraft(wallet, id);
        await writeDraft(key, value);
      });
      saved.current = value;
    });
    try {
      await queue.current;
      if (alive.current) setError(null);
    } catch {
      if (alive.current) setError(saveGeneration !== (generations.get(wallet) ?? 0)
        ? "This draft was cleared. Edit it to save a new copy."
        : "Couldn’t save this draft on your device. Keep this screen open and retry.");
      throw new Error("Draft not saved");
    }
  }, [key, wallet, id]);
  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(restore);
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flush().catch(() => undefined);
    });
    return () => {
      alive.current = false;
      sub.remove();
      void flush().catch(() => undefined);
    };
  }, [restore, flush]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void flush().catch(() => undefined), 500);
    return () => clearTimeout(timer);
  }, [text, ready, flush]);
  const update = (value: string) => {
    if (!hydrated.current || clearing.current) return;
    generation.current = generations.get(wallet) ?? 0;
    current.current = value.slice(0, 5000);
    setText(current.current);
  };
  const clear = useCallback(async () => {
    clearing.current = true;
    await queue.current.catch(() => undefined);
    try {
      const head = await readHead(key);
      await SecureStore.deleteItemAsync(key);
      await removeChunks(key, head).catch(() => undefined);
      current.current = saved.current = "";
      if (alive.current) {
        setText("");
        setError(null);
      }
    } catch {
      if (alive.current) setError("Your submission is saved, but its local draft couldn’t be removed.");
      throw new Error("Draft cleanup failed");
    }
  }, [key]);
  return { text, update, ready, error, retry: ready ? flush : restore, flush, clear };
}
