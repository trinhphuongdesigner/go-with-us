import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LoadingState({ label = "Đang tải dữ liệu" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-2xl border border-border bg-white p-5">
          <div className="h-3 w-24 rounded-full bg-border" />
          <div className="mt-6 h-8 w-16 rounded-lg bg-border" />
          <div className="mt-4 h-3 w-36 rounded-full bg-background" />
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-background text-primary" aria-hidden="true">
        <Inbox size={24} />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
    </Card>
  );
}

export function ErrorState({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return (
    <Card role="alert" className="flex min-h-72 flex-col items-center justify-center border-[#F6D5D2] bg-danger-soft p-8 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-white text-danger" aria-hidden="true">
        <AlertTriangle size={24} />
      </span>
      <h2 className="text-lg font-semibold text-danger">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#7A271A]">{description}</p>
      {onRetry ? (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden="true" /> Thử lại
        </Button>
      ) : null}
    </Card>
  );
}
