import * as React from "react";

import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-border bg-white px-4 text-sm text-ink shadow-[0_1px_2px_rgb(22_32_51_/_4%)] transition-colors placeholder:text-muted/70 hover:border-muted/50 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-background",
        className,
      )}
      {...props}
    />
  );
}
