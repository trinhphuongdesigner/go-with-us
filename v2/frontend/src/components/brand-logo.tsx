import { Sparkles } from "lucide-react";

import { cn } from "@/lib/cn";

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-[0_8px_24px_rgb(49_94_129_/_22%)]">
        <Sparkles size={20} strokeWidth={2.2} aria-hidden="true" />
      </span>
      {compact ? null : (
        <span>
          <span className="block text-[17px] font-bold tracking-[-0.02em] text-ink">CareerMate</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#596579]">Grow with clarity</span>
        </span>
      )}
    </div>
  );
}
