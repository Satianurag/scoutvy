import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useFocusEffect } from "expo-router";
import { Keyboard } from "react-native";

import { ConfirmationSheet, type ConfirmationSheetProps } from "@/components/ui/ConfirmationSheet";

type DialogOptions = Pick<ConfirmationSheetProps, "title" | "message" | "tone" | "icon"> & {
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};
type Request = DialogOptions & { owner: string };
type DialogContext = { show: (request: Request) => void; dismiss: (owner?: string) => void };
const Context = createContext<DialogContext | null>(null);

/** One app-owned dialog host. Dismissal never runs the confirmed action. */
export function AppDialogProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<Request | null>(null);
  const active = useRef<Request | null>(null);
  const show = useCallback((next: Request) => {
    if (active.current) return;
    Keyboard.dismiss();
    active.current = next;
    setRequest(next);
  }, []);
  const dismiss = useCallback((owner?: string) => {
    if (owner && active.current?.owner !== owner) return;
    active.current = null;
    setRequest(null);
  }, []);
  const confirm = () => {
    const current = active.current;
    if (!current) return;
    dismiss();
    current.onConfirm?.();
  };

  return (
    <Context.Provider value={{ show, dismiss }}>
      {children}
      <ConfirmationSheet
        visible={request !== null}
        title={request?.title ?? ""}
        message={request?.message ?? ""}
        tone={request?.tone ?? "confirm"}
        icon={request?.icon}
        confirmLabel={request?.confirmLabel ?? "Got it"}
        cancelLabel={request?.cancelLabel ?? "Cancel"}
        onConfirm={confirm}
        onCancel={() => dismiss()}
      />
    </Context.Provider>
  );
}

/** Dialogs close when the originating screen loses focus, preventing stale actions. */
export function useAppDialog() {
  const context = useContext(Context);
  if (!context) throw new Error("useAppDialog must be used within AppDialogProvider");
  const { show, dismiss } = context;
  const owner = useId();
  useFocusEffect(useCallback(() => () => dismiss(owner), [dismiss, owner]));
  return useCallback((options: DialogOptions) => show({ ...options, owner }), [show, owner]);
}
