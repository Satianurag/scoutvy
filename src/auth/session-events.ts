type Listener = (token: string) => void;
const listeners = new Set<Listener>();

export function subscribeUnauthorized(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Token stays in memory so a late response cannot invalidate a newly connected session. */
export function reportUnauthorized(token: string | null | undefined) {
  if (token) for (const listener of listeners) listener(token);
}
