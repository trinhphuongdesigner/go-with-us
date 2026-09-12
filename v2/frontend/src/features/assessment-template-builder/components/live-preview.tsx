"use client";

import { Layers, ShieldAlert, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AssessmentTemplate } from "../types";

interface LivePreviewProps {
  template: AssessmentTemplate;
}

const PREVIEW_SCALE_STEPS = [
  { level: 1, label: "Cần cải thiện" },
  { level: 2, label: "Đạt cơ bản" },
  { level: 3, label: "Thành thạo" },
  { level: 4, label: "Xuất sắc" },
  { level: 5, label: "Dẫn dắt" },
];

export function LivePreview({ template }: LivePreviewProps) {
  const totalGroupWeight = template.groups.reduce((sum, g) => sum + (Number(g.weight) || 0), 0);
  const totalQuestions = template.groups.reduce((sum, g) => sum + g.questions.length, 0);

  return (
    <div className="min-w-0 w-full space-y-4" data-testid="live-preview-container">
      {/* Live Preview Header Card */}
      <Card className="min-w-0 w-full border-border bg-surface shadow-xs">
        <CardHeader className="min-w-0 pb-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="ai">
                <Sparkles size={13} aria-hidden="true" />
                <span>Xem trước trực tiếp</span>
              </Badge>
              <span className="text-xs text-muted">Chỉ đọc (Read-only)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>{template.groups.length} nhóm</span>
              <span>·</span>
              <span>{totalQuestions} tiêu chí</span>
            </div>
          </div>

          <h2 className="mt-3 min-w-0 text-lg font-bold text-ink sm:text-xl break-words [overflow-wrap:anywhere] [word-break:break-word]">
            {template.name.trim() || (
              <span className="italic text-muted font-normal">(Chưa đặt tên mẫu tiêu chí)</span>
            )}
          </h2>

          <p className="mt-1.5 min-w-0 text-xs sm:text-sm leading-6 text-muted break-words [overflow-wrap:anywhere] [word-break:break-word]">
            {template.description.trim() || (
              <span className="italic text-muted/70">(Chưa có mô tả mục đích đánh giá)</span>
            )}
          </p>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 pt-2 border-t border-border text-xs text-muted">
            <span className="font-semibold text-ink">Tổng trọng số các nhóm:</span>
            <span className="rounded-md bg-background px-2 py-0.5 font-bold tabular-nums text-primary border border-border">
              {totalGroupWeight}
            </span>
            <span className="text-[11px] text-muted">
              (Giả định xem trước: Trọng số tham khảo, quy tắc tính điểm chính thức đang chờ phê duyệt theo hợp đồng W3)
            </span>
          </div>
        </CardHeader>
      </Card>

      {/* Assumptions Banner */}
      <div className="min-w-0 rounded-xl border border-border bg-background/80 p-3.5 text-xs text-muted leading-5">
        <div className="flex min-w-0 items-start gap-2">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-bold text-ink">Giả định xem trước (Preview Assumptions):</span> Thang điểm và phân bổ trọng số là giả định trực quan phục vụ trải nghiệm người dùng trong bản nháp này. Điểm số thực tế và quy tắc đánh giá chính thức đang chờ phê duyệt theo hợp đồng W3.
          </div>
        </div>
      </div>

      {/* Groups & Questions Preview */}
      {template.groups.length === 0 ? (
        <Card className="min-w-0 border-dashed border-border p-8 text-center bg-white">
          <Layers size={28} className="mx-auto text-muted/60" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-bold text-ink">Chưa có nhóm tiêu chí nào</h3>
          <p className="mt-1 text-xs text-muted">
            Hãy thêm nhóm tiêu chí bên phần soạn thảo để xem trước cấu trúc tại đây.
          </p>
        </Card>
      ) : (
        <div className="min-w-0 space-y-4">
          {template.groups.map((group, gIdx) => {
            const groupQuestionsWeight = group.questions.reduce(
              (sum, q) => sum + (Number(q.weight) || 0),
              0,
            );

            return (
              <Card
                key={group.id}
                data-testid={`preview-group-${group.id}`}
                className="min-w-0 w-full overflow-hidden border-border bg-surface shadow-xs"
              >
                <div className="min-w-0 border-b border-border bg-background/50 px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 flex-1">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary-subtle text-xs font-bold text-primary-strong tabular-nums">
                        {String(gIdx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="min-w-0 flex-1 text-sm font-bold text-ink break-words [overflow-wrap:anywhere] [word-break:break-word]">
                        {group.name.trim() || `Nhóm ${gIdx + 1}`}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-md border border-border bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-ink">
                        Trọng số: {Number.isFinite(group.weight) ? group.weight : "—"}
                      </span>
                    </div>
                  </div>

                  {group.description.trim() ? (
                    <p className="mt-1.5 min-w-0 text-xs leading-5 text-muted break-words [overflow-wrap:anywhere] [word-break:break-word]">
                      {group.description}
                    </p>
                  ) : null}
                </div>

                <CardContent className="min-w-0 p-4 sm:p-5 space-y-3">
                  {group.questions.length === 0 ? (
                    <p className="py-2 text-center text-xs italic text-muted">
                      Nhóm này chưa có tiêu chí nào.
                    </p>
                  ) : (
                    group.questions.map((question, qIdx) => (
                      <div
                        key={question.id}
                        data-testid={`preview-question-${question.id}`}
                        className="min-w-0 rounded-xl border border-border bg-white p-3.5 transition-colors hover:border-muted/40"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2 flex-1">
                            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-background text-[11px] font-bold text-muted tabular-nums">
                              {qIdx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h4 className="min-w-0 text-xs sm:text-sm font-bold text-ink break-words [overflow-wrap:anywhere] [word-break:break-word]">
                                {question.title.trim() || `Tiêu chí ${qIdx + 1}`}
                              </h4>
                              {question.helpText.trim() ? (
                                <p className="mt-1 min-w-0 text-xs text-muted leading-5 break-words [overflow-wrap:anywhere] [word-break:break-word]">
                                  {question.helpText}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted border border-border">
                            {Number.isFinite(question.weight) ? question.weight : "—"}
                          </span>
                        </div>

                        {/* Preview scale chips */}
                        <div className="mt-3 pt-2.5 border-t border-border/70">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                              Thang điểm đánh giá (Giả định):
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {PREVIEW_SCALE_STEPS.map((step) => (
                              <div
                                key={step.level}
                                className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-border/80 bg-background/50 py-1.5 px-1 text-center transition-colors"
                              >
                                <span className="text-xs font-bold text-ink tabular-nums">
                                  {step.level}
                                </span>
                                <span className="text-[9px] font-medium text-muted leading-tight line-clamp-1 truncate w-full">
                                  {step.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="flex justify-end pt-1 text-[11px] text-muted">
                    <span>
                      Tổng trọng số tiêu chí trong nhóm:{" "}
                      <strong className="text-ink tabular-nums">{groupQuestionsWeight}</strong> (tham khảo)
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

}
