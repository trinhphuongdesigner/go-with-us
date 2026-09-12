"use client";

import { AlertCircle, ArrowUpRight } from "lucide-react";
import { type RefObject } from "react";

import { getScrollBehavior, type ValidationError } from "../types";

interface ErrorSummaryProps {
  errors: ValidationError[];
  summaryRef: RefObject<HTMLDivElement | null>;
}

export function ErrorSummary({ errors, summaryRef }: ErrorSummaryProps) {
  if (errors.length === 0) return null;

  const handleLinkClick = (fieldId: string) => (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    let el = document.getElementById(fieldId);
    if (fieldId.endsWith("-questions")) {
      const groupId = fieldId.replace(/^group-/, "").replace(/-questions$/, "");
      const actionableBtn =
        document.getElementById(`group-${groupId}-add-first-question-btn`) ||
        document.getElementById(`group-${groupId}-add-question-btn`);
      if (actionableBtn) {
        el = actionableBtn;
      }
    }
    if (el) {
      const behavior = getScrollBehavior();
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior, block: "center" });
      }
      el.focus();
      requestAnimationFrame(() => el?.focus());
    }
  };

  return (
    <div
      ref={summaryRef}
      role="alert"
      aria-labelledby="error-summary-heading"
      tabIndex={-1}
      className="mb-6 min-w-0 rounded-2xl border border-danger/30 bg-danger-soft p-5 shadow-sm focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-danger shadow-xs"
          aria-hidden="true"
        >
          <AlertCircle size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="error-summary-heading"
            className="min-w-0 text-base font-bold text-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
          >
            Có {errors.length} vấn đề cần hoàn thiện trước khi xem trước đầy đủ
          </h2>
          <p className="mt-1 min-w-0 text-xs leading-5 text-muted break-words [overflow-wrap:anywhere] [word-break:break-word]">
            Vui lòng kiểm tra các trường thông tin bên dưới để đảm bảo cấu trúc mẫu đánh giá hợp lệ.
          </p>
          <ul className="mt-3 min-w-0 space-y-2 text-sm">
            {errors.map((error) => (
              <li key={error.id} className="flex min-w-0 items-start gap-1.5">
                <a
                  href={`#${error.fieldId}`}
                  onClick={handleLinkClick(error.fieldId)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      handleLinkClick(error.fieldId)(e);
                    }
                  }}
                  className="inline-flex min-w-0 items-center gap-1 font-semibold text-danger underline decoration-danger/40 underline-offset-4 transition-colors hover:decoration-danger focus:rounded-md focus:outline-none focus:ring-2 focus:ring-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
                >
                  <span className="min-w-0 break-words [overflow-wrap:anywhere] [word-break:break-word]">
                    {error.message}
                  </span>
                  <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

