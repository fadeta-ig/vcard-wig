"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ModalDialog({
  children,
  titleId,
  onClose,
  pending = false,
  className = "modal",
}: {
  children: ReactNode;
  titleId: string;
  onClose: () => void;
  pending?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
