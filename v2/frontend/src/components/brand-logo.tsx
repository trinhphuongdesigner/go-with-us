import Image from "next/image";

import { cn } from "@/lib/cn";

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <div className={cn("inline-flex items-center", className)}>
        <Image
          src="/mark-black.svg"
          alt="CareerMate"
          width={36}
          height={36}
          className="size-9 object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Image
        src="/lockup-black.svg"
        alt="CareerMate"
        width={150}
        height={28}
        className="h-7 w-auto object-contain"
        priority
      />
    </div>
  );
}
