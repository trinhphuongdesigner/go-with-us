"use client";

import { AlertCircle, ArrowDown, ArrowUp, FolderKanban, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AssessmentGroup, AssessmentQuestion, ValidationError } from "../types";
import { QuestionEditor } from "./question-editor";

interface GroupEditorProps {
  group: AssessmentGroup;
  index: number;
  totalGroups: number;
  errors: ValidationError[];
  onUpdateGroup: (patch: Partial<AssessmentGroup>) => void;
  onMoveGroupUp: () => void;
  onMoveGroupDown: () => void;
  onRequestDeleteGroup: (triggerEl?: HTMLElement) => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (questionIndex: number, patch: Partial<AssessmentQuestion>) => void;
  onMoveQuestion: (questionIndex: number, direction: -1 | 1) => void;
  onRequestDeleteQuestion: (questionId: string, questionTitle: string, triggerEl?: HTMLElement) => void;
}

export function GroupEditor({
  group,
  index,
  totalGroups,
  errors,
  onUpdateGroup,
  onMoveGroupUp,
  onMoveGroupDown,
  onRequestDeleteGroup,
  onAddQuestion,
  onUpdateQuestion,
  onMoveQuestion,
  onRequestDeleteQuestion,
}: GroupEditorProps) {
  const nameError = errors.find((e) => e.fieldId === `group-${group.id}-name`);
  const weightError = errors.find((e) => e.fieldId === `group-${group.id}-weight`);
  const questionsError = errors.find((e) => e.fieldId === `group-${group.id}-questions`);

  const groupQuestionsTotalWeight = group.questions.reduce((sum, q) => sum + (Number(q.weight) || 0), 0);
  const displayGroupName = group.name.trim() || `Nhóm ${index + 1}`;

  return (
    <Card
      data-testid={`group-card-${group.id}`}
      className="min-w-0 w-full border-border shadow-xs transition-shadow hover:shadow-sm"
    >
      <CardHeader className="min-w-0 border-b border-border bg-background/40 pb-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 flex-1">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-subtle text-xs font-bold text-primary-strong tabular-nums"
              aria-hidden="true"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex min-w-0 items-center gap-1.5 flex-1">
              <FolderKanban size={17} className="shrink-0 text-primary" aria-hidden="true" />
              <h3 className="min-w-0 flex-1 text-sm font-bold text-ink sm:text-base break-words [overflow-wrap:anywhere] [word-break:break-word]">
                {displayGroupName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
            <Button
              id={`move-up-group-${group.id}`}
              variant="ghost"
              size="icon"
              type="button"
              onClick={onMoveGroupUp}
              disabled={index === 0}
              aria-label={`Di chuyển ${displayGroupName} lên`}
            >
              <ArrowUp size={16} />
            </Button>
            <Button
              id={`move-down-group-${group.id}`}
              variant="ghost"
              size="icon"
              type="button"
              onClick={onMoveGroupDown}
              disabled={index === totalGroups - 1}
              aria-label={`Di chuyển ${displayGroupName} xuống`}
            >
              <ArrowDown size={16} />
            </Button>
            <Button
              id={`delete-group-${group.id}`}
              variant="ghost"
              size="icon"
              type="button"
              onClick={(e) => onRequestDeleteGroup(e.currentTarget)}
              aria-label={`Xóa ${displayGroupName}`}
              className="text-danger hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4 pt-4">
        <label className="grid gap-2 text-xs font-bold text-ink">Nhóm điểm tổng hợp
          <select className="min-h-11 rounded-xl border border-border bg-white px-3" value={group.scoreDimension ?? "CONTRIBUTION"} onChange={(event) => onUpdateGroup({ scoreDimension: event.target.value as "CONTRIBUTION" | "ATTITUDE" })}>
            <option value="CONTRIBUTION">Đóng góp</option><option value="ATTITUDE">Thái độ</option>
          </select>
        </label>
        <label className="grid gap-2 text-xs font-bold text-ink">Chiều năng lực trên Hộ chiếu
          <select
            className="min-h-11 rounded-xl border border-border bg-white px-3"
            value={group.passportDimension ?? ""}
            onChange={(event) => onUpdateGroup({
              passportDimension: (event.target.value || null) as AssessmentGroup["passportDimension"],
            })}
          >
            <option value="">Không đưa vào điểm Hộ chiếu</option>
            <option value="ATTENDANCE">Chuyên cần & đúng hạn</option>
            <option value="PROACTIVENESS">Chủ động & tiên phong</option>
            <option value="KNOWLEDGE">Kiến thức chuyên môn</option>
            <option value="SKILL">Kỹ năng & thực thi</option>
            <option value="ACTIVITY_PARTICIPATION">Đóng góp & hoạt động</option>
          </select>
          <span className="font-normal leading-5 text-muted">Chỉ nhóm được gắn rõ mới tạo điểm xác thực; AI không tự suy ra trường này.</span>
        </label>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="min-w-0 sm:col-span-9">
            <label htmlFor={`group-${group.id}-name`} className="block text-xs font-bold text-ink">
              Tên nhóm năng lực / tiêu chí <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <Input
              id={`group-${group.id}-name`}
              value={group.name}
              onChange={(e) => onUpdateGroup({ name: e.target.value })}
              placeholder="Ví dụ: Năng lực chuyên môn & Kỹ thuật..."
              aria-required="true"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? `error-group-${group.id}-name` : undefined}
              className={`mt-1 min-w-0 h-11 text-sm font-semibold ${nameError ? "border-danger focus:border-danger" : ""}`}
            />
            {nameError ? (
              <p
                id={`error-group-${group.id}-name`}
                className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
              >
                <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                <span>{nameError.message}</span>
              </p>
            ) : null}
          </div>

          <div className="min-w-0 sm:col-span-3">
            <label htmlFor={`group-${group.id}-weight`} className="block text-xs font-bold text-ink">
              Trọng số nhóm (tham khảo) <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <Input
              id={`group-${group.id}-weight`}
              type="number"
              min={0.1}
              step="any"
              value={Number.isFinite(group.weight) ? group.weight : ""}
              onChange={(e) => {
                onUpdateGroup({
                  weight: e.target.valueAsNumber,
                });
              }}
              aria-required="true"
              aria-invalid={Boolean(weightError)}
              aria-describedby={weightError ? `error-group-${group.id}-weight` : undefined}
              className={`mt-1 min-w-0 h-11 text-sm font-semibold tabular-nums ${
                weightError ? "border-danger focus:border-danger" : ""
              }`}
            />
            {weightError ? (
              <p
                id={`error-group-${group.id}-weight`}
                className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
              >
                <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                <span>{weightError.message}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor={`group-${group.id}-description`} className="block text-xs font-bold text-ink">
            Mô tả nhóm tiêu chí
          </label>
          <textarea
            id={`group-${group.id}-description`}
            rows={2}
            value={group.description}
            onChange={(e) => onUpdateGroup({ description: e.target.value })}
            placeholder="Mô tả phạm vi các tiêu chí nằm trong nhóm này..."
            className="mt-1 min-w-0 w-full rounded-xl border border-border bg-white px-3 py-2 text-xs text-ink shadow-[0_1px_2px_rgb(22_32_51_/_4%)] transition-colors placeholder:text-muted/70 hover:border-muted/50 focus:border-primary focus:outline-none"
          />
        </div>

        {/* Question List Section */}
        <div id={`group-${group.id}-questions`} tabIndex={-1} className="min-w-0 mt-5 border-t border-border pt-4 focus:outline-none">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                Danh sách tiêu chí đánh giá ({group.questions.length})
              </h4>
              <p className="mt-0.5 text-xs text-muted">
                Tổng trọng số nội bộ nhóm:{" "}
                <span className="font-semibold text-ink tabular-nums">{groupQuestionsTotalWeight}</span>{" "}
                <span className="text-[11px]">(tham khảo)</span>
              </p>
            </div>
            <Button
              id={`group-${group.id}-add-question-btn`}
              variant="secondary"
              size="sm"
              type="button"
              onClick={onAddQuestion}
              className="gap-1.5 self-start sm:self-auto"
            >
              <Plus size={15} aria-hidden="true" />
              <span>Thêm tiêu chí</span>
            </Button>
          </div>

          {questionsError ? (
            <p
              id={`error-group-${group.id}-questions`}
              className="mt-2 flex items-center gap-1 rounded-lg bg-danger-soft p-2 text-xs font-semibold text-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
            >
              <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
              <span>{questionsError.message}</span>
            </p>
          ) : null}

          <div className="min-w-0 mt-3 space-y-3">
            {group.questions.length === 0 ? (
              <div className="min-w-0 rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-xs text-muted">Nhóm này chưa có tiêu chí đánh giá nào.</p>
                <Button
                  id={`group-${group.id}-add-first-question-btn`}
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={onAddQuestion}
                  className="mt-2 text-xs text-primary hover:bg-primary-subtle"
                >
                  + Thêm tiêu chí đầu tiên
                </Button>
              </div>
            ) : (
              group.questions.map((question, qIdx) => (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  index={qIdx}
                  totalQuestions={group.questions.length}
                  errors={errors}
                  onUpdate={(patch) => onUpdateQuestion(qIdx, patch)}
                  onMoveUp={() => onMoveQuestion(qIdx, -1)}
                  onMoveDown={() => onMoveQuestion(qIdx, 1)}
                  onRequestDelete={(triggerEl) =>
                    onRequestDeleteQuestion(
                      question.id,
                      question.title.trim() || `Tiêu chí ${qIdx + 1}`,
                      triggerEl,
                    )
                  }
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
