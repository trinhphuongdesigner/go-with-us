import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "success" | "ai" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-background text-muted",
  success: "bg-[#EFF6F0] text-sage-strong",
  ai: "bg-[#F1EEFF] text-violet-strong",
  warning: "bg-[#FFF7E8] text-[#8A5A12]",
  danger: "bg-[#FEEBEB] text-[#B42318]",
};

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}
