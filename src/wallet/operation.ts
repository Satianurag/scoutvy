let busy = false;
const listeners = new Set<() => void>();
export const walletOperationBusy = () => busy;
export function subscribeWalletOperation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function runWalletOperation<T>(operation: () => Promise<T>): Promise<T> {
  if (busy) throw new Error("Finish the current wallet request before continuing.");
  busy = true;
  for (const listener of listeners) listener();
  try { return await operation(); }
  finally {
    busy = false;
    for (const listener of listeners) listener();
  }
}
