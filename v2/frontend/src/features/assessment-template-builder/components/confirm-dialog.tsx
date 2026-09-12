"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCloseAutoFocus?: (e: Event) => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận xóa",
  confirmVariant = "danger",
  onConfirm,
  onCloseAutoFocus,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-sm transition-opacity" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(92vw,500px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  confirmVariant === "primary"
                    ? "bg-primary-subtle text-primary"
                    : "bg-danger-soft text-danger"
                }`}
                aria-hidden="true"
              >
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-lg font-bold text-ink break-words [overflow-wrap:anywhere] [word-break:break-word]">{title}</Dialog.Title>
                <Dialog.Description className="mt-1.5 text-sm leading-6 text-muted break-words [overflow-wrap:anywhere] [word-break:break-word]">
                  {description}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Đóng hộp thoại">
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>

          {children ? <div className="mt-4">{children}</div> : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" type="button">
                Hủy bỏ
              </Button>
            </Dialog.Close>
            <Button
              variant={confirmVariant}
              type="button"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
