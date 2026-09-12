"use client";

import { AlertCircle, ArrowDown, ArrowUp, HelpCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssessmentQuestion, ValidationError } from "../types";

interface QuestionEditorProps {
  question: AssessmentQuestion;
  index: number;
  totalQuestions: number;
  errors: ValidationError[];
  onUpdate: (patch: Partial<AssessmentQuestion>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRequestDelete: (triggerEl?: HTMLElement) => void;
}

export function QuestionEditor({
  question,
  index,
  totalQuestions,
  errors,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRequestDelete,
}: QuestionEditorProps) {
  const titleError = errors.find((e) => e.fieldId === `question-${question.id}-title`);
  const weightError = errors.find((e) => e.fieldId === `question-${question.id}-weight`);
  const displayTitle = question.title.trim() || `Tiêu chí ${index + 1}`;

  return (
    <div
      data-testid={`question-card-${question.id}`}
      className="relative min-w-0 w-full rounded-xl border border-border bg-white p-4 transition-all hover:border-muted/50"
    >
      <label className="mb-3 grid max-w-40 gap-2 text-xs font-semibold text-ink">Điểm tối đa (1–100)
        <Input type="number" min={1} max={100} value={question.maxScore ?? 10} onChange={(event) => onUpdate({ maxScore: event.target.valueAsNumber })} />
      </label>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-background text-xs font-bold text-muted tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Tiêu chuẩn đánh giá
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
          <Button
            id={`move-up-q-${question.id}`}
            variant="ghost"
            size="icon"
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label={`Di chuyển ${displayTitle} lên`}
            className="size-8"
          >
            <ArrowUp size={15} />
          </Button>
          <Button
            id={`move-down-q-${question.id}`}
            variant="ghost"
            size="icon"
            type="button"
            onClick={onMoveDown}
            disabled={index === totalQuestions - 1}
            aria-label={`Di chuyển ${displayTitle} xuống`}
            className="size-8"
          >
            <ArrowDown size={15} />
          </Button>
          <Button
            id={`delete-q-${question.id}`}
            variant="ghost"
            size="icon"
            type="button"
            onClick={(e) => onRequestDelete(e.currentTarget)}
            aria-label={`Xóa ${displayTitle}`}
            className="size-8 text-danger hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="min-w-0 sm:col-span-9">
          <label
            htmlFor={`question-${question.id}-title`}
            className="block text-xs font-bold text-ink"
          >
            Tên tiêu chí / Câu hỏi <span className="text-danger" aria-hidden="true">*</span>
          </label>
          <Input
            id={`question-${question.id}-title`}
            value={question.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Ví dụ: Kỹ năng xử lý ngoại lệ và viết mã sạch..."
            aria-required="true"
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? `error-question-${question.id}-title` : undefined}
            className={`mt-1 min-w-0 h-10 text-sm ${titleError ? "border-danger focus:border-danger" : ""}`}
          />
          {titleError ? (
            <p
              id={`error-question-${question.id}-title`}
              className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
            >
              <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
              <span>{titleError.message}</span>
            </p>
          ) : null}
        </div>

        <div className="min-w-0 sm:col-span-3">
          <label
            htmlFor={`question-${question.id}-weight`}
            className="block text-xs font-bold text-ink"
          >
            Trọng số (tham khảo) <span className="text-danger" aria-hidden="true">*</span>
          </label>
          <Input
            id={`question-${question.id}-weight`}
            type="number"
            min={0.1}
            step="any"
            value={Number.isFinite(question.weight) ? question.weight : ""}
            onChange={(e) => {
              onUpdate({
                weight: e.target.valueAsNumber,
              });
            }}
            aria-required="true"
            aria-invalid={Boolean(weightError)}
            aria-describedby={weightError ? `error-question-${question.id}-weight` : undefined}
            className={`mt-1 min-w-0 h-10 text-sm tabular-nums ${weightError ? "border-danger focus:border-danger" : ""}`}
          />
          {weightError ? (
            <p
              id={`error-question-${question.id}-weight`}
              className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
            >
              <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
              <span>{weightError.message}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 mt-3">
        <label
          htmlFor={`question-${question.id}-helpText`}
          className="flex items-center gap-1 text-xs font-semibold text-muted"
        >
          <HelpCircle size={13} className="shrink-0" aria-hidden="true" />
          <span>Hướng dẫn đánh giá & tiêu chuẩn minh chứng</span>
        </label>
        <textarea
          id={`question-${question.id}-helpText`}
          rows={2}
          value={question.helpText}
          onChange={(e) => onUpdate({ helpText: e.target.value })}
          placeholder="Mô tả minh chứng cụ thể cần đạt để được chấm điểm..."
          className="mt-1 min-w-0 w-full rounded-xl border border-border bg-white px-3 py-2 text-xs text-ink shadow-[0_1px_2px_rgb(22_32_51_/_4%)] transition-colors placeholder:text-muted/70 hover:border-muted/50 focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}
