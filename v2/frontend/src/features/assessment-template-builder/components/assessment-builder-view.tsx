"use client";

import {
  CheckCircle2,
  Eye,
  FileCheck2,
  FolderPlus,
  PencilLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SAMPLE_ASSESSMENT_TEMPLATE,
  createEmptyTemplate,
  createNewGroup,
  createNewQuestion,
} from "../sample-data";
import {
  type ActiveTab,
  type AssessmentGroup,
  type AssessmentQuestion,
  type AssessmentTemplate,
  getScrollBehavior,
  type PendingDeleteTarget,
  syncErrorsWithTemplate,
  type ValidationError,
} from "../types";
import { ConfirmDialog } from "./confirm-dialog";
import { ErrorSummary } from "./error-summary";
import { GroupEditor } from "./group-editor";
import { LivePreview } from "./live-preview";
import { TemplateMetaEditor } from "./template-meta-editor";

export function AssessmentBuilderView({ initialTemplate, onSave }: { initialTemplate?: AssessmentTemplate; onSave?: (template: AssessmentTemplate, publish: boolean) => Promise<void> } = {}) {
  const [template, setTemplate] = useState<AssessmentTemplate>(() =>
    structuredClone(initialTemplate ?? SAMPLE_ASSESSMENT_TEMPLATE),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const persist = async (publish: boolean) => {
    if (!onSave) return;
    setSaving(true); setSaveError("");
    try { await onSave(template, publish); setAnnouncement(publish ? "Đã lưu và phát hành mẫu." : "Đã lưu mẫu trên máy chủ."); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Không lưu được mẫu."); }
    finally { setSaving(false); }
  };
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("editor");
  const [announcement, setAnnouncement] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteTarget>(null);
  const [cachedDeleteTarget, setCachedDeleteTarget] = useState<PendingDeleteTarget>(null);
  const [validatedSnapshot, setValidatedSnapshot] = useState<string | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const isConfirmedRef = useRef<boolean>(false);

  const openConfirmDialog = (target: PendingDeleteTarget, triggerEl?: HTMLElement | null) => {
    dialogTriggerRef.current = triggerEl || (document.activeElement as HTMLElement) || null;
    isConfirmedRef.current = false;
    setPendingDelete(target);
    if (target) {
      setCachedDeleteTarget(target);
    }
  };

  const activeDelete = pendingDelete ?? cachedDeleteTarget;

  // Group operations
  const handleAddGroup = () => {
    const newGroup = createNewGroup(template.groups.length);
    const newQ = createNewQuestion(template.groups.length, 0);
    newGroup.questions = [newQ];

    const nextTemplate = {
      ...template,
      groups: [...template.groups, newGroup],
    };
    setTemplate(nextTemplate);
    setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));
    setAnnouncement(`Đã thêm ${newGroup.name}.`);
  };

  const handleUpdateGroup = (groupIndex: number, patch: Partial<AssessmentGroup>) => {
    if (!template.groups[groupIndex]) return;
    const nextGroups = [...template.groups];
    nextGroups[groupIndex] = { ...nextGroups[groupIndex], ...patch };
    const nextTemplate = { ...template, groups: nextGroups };
    setTemplate(nextTemplate);
    setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));
  };

  const handleMoveGroup = (groupIndex: number, direction: -1 | 1) => {
    const targetIndex = groupIndex + direction;
    if (targetIndex < 0 || targetIndex >= template.groups.length) return;

    const movingGroupId = template.groups[groupIndex].id;
    const nextGroups = [...template.groups];
    const [moved] = nextGroups.splice(groupIndex, 1);
    nextGroups.splice(targetIndex, 0, moved);

    const nextTemplate = { ...template, groups: nextGroups };
    setTemplate(nextTemplate);
    setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));

    const movedName = template.groups[groupIndex].name.trim() || `Nhóm ${groupIndex + 1}`;
    const directionWord = direction === -1 ? "lên" : "xuống";
    setAnnouncement(`Đã di chuyển nhóm "${movedName}" ${directionWord} vị trí ${targetIndex + 1}.`);

    // Manage focus so disabled button doesn't lose focus to body
    setTimeout(() => {
      if (targetIndex === 0) {
        document.getElementById(`move-down-group-${movingGroupId}`)?.focus();
      } else if (targetIndex === template.groups.length - 1) {
        document.getElementById(`move-up-group-${movingGroupId}`)?.focus();
      } else {
        const btnId = direction === -1 ? `move-up-group-${movingGroupId}` : `move-down-group-${movingGroupId}`;
        document.getElementById(btnId)?.focus();
      }
    }, 50);
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    isConfirmedRef.current = true;

    if (pendingDelete.type === "group") {
      const deletedGroupId = pendingDelete.groupId;
      const groupIndex = template.groups.findIndex((g) => g.id === deletedGroupId);
      const remainingGroups = template.groups.filter((g) => g.id !== deletedGroupId);

      const nextTemplate = {
        ...template,
        groups: remainingGroups,
      };
      setTemplate(nextTemplate);
      setAnnouncement(`Đã xóa nhóm "${pendingDelete.groupName}".`);

      // The synchronizer drops orphaned fields itself. Preserve the prior
      // validation state so deleting its last error can reveal an empty structure.
      setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));

      // Logical focus restoration
      const restoreFocus = () => {
        if (remainingGroups.length > 0) {
          const nextIndex = Math.min(groupIndex, remainingGroups.length - 1);
          const nextInput = document.getElementById(`group-${remainingGroups[nextIndex].id}-name`);
          if (nextInput) {
            nextInput.focus();
            return;
          }
        }
        const addBtn =
          document.getElementById("add-first-group-button") ||
          document.getElementById("add-group-button");
        addBtn?.focus();
      };
      restoreFocus();
      requestAnimationFrame(restoreFocus);
      setTimeout(restoreFocus, 50);
    } else if (pendingDelete.type === "question") {
      const { groupId, questionId } = pendingDelete;
      const group = template.groups.find((g) => g.id === groupId);
      const qIndex = group?.questions.findIndex((q) => q.id === questionId) ?? -1;
      const remainingQ = group?.questions.filter((q) => q.id !== questionId) ?? [];

      const nextTemplate = {
        ...template,
        groups: template.groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            questions: g.questions.filter((q) => q.id !== questionId),
          };
        }),
      };
      setTemplate(nextTemplate);
      setAnnouncement(`Đã xóa tiêu chí "${pendingDelete.questionTitle}".`);

      setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));

      // Logical focus restoration for question delete
      const restoreFocus = () => {
        if (remainingQ.length > 0) {
          const nextQIndex = Math.min(qIndex, remainingQ.length - 1);
          const nextInput = document.getElementById(`question-${remainingQ[nextQIndex].id}-title`);
          if (nextInput) {
            nextInput.focus();
            return;
          }
        }
        const addBtn =
          document.getElementById(`group-${groupId}-add-first-question-btn`) ||
          document.getElementById(`group-${groupId}-add-question-btn`);
        addBtn?.focus();
      };
      restoreFocus();
      requestAnimationFrame(restoreFocus);
      setTimeout(restoreFocus, 50);
    } else if (pendingDelete.type === "reset") {
      setTemplate(createEmptyTemplate());
      setErrors([]);
      setValidatedSnapshot(null);
      setAnnouncement("Đã đặt lại mẫu tiêu chí về trạng thái trống.");
      const restoreFocus = () => {
        document.getElementById("load-sample-button")?.focus();
      };
      const restoreFocusIfUnclaimed = () => {
        const activeElement = document.activeElement;
        if (
          !activeElement ||
          activeElement === document.body ||
          !activeElement.isConnected
        ) {
          restoreFocus();
        }
      };
      restoreFocus();
      requestAnimationFrame(restoreFocusIfUnclaimed);
      setTimeout(restoreFocusIfUnclaimed, 50);
    } else if (pendingDelete.type === "load-sample") {
      setTemplate(structuredClone(SAMPLE_ASSESSMENT_TEMPLATE));
      setErrors([]);
      setValidatedSnapshot(null);
      setAnnouncement("Đã tải mẫu tiêu chuẩn thành công.");
      const restoreFocus = () => {
        document.getElementById("template-name")?.focus();
      };
      restoreFocus();
      requestAnimationFrame(restoreFocus);
      setTimeout(restoreFocus, 50);
    }

    setPendingDelete(null);
  };

  // Question operations
  const handleAddQuestion = (groupIndex: number) => {
    const group = template.groups[groupIndex];
    if (!group) return;

    const newQuestion = createNewQuestion(groupIndex, group.questions.length);
    const nextGroups = [...template.groups];
    nextGroups[groupIndex] = {
      ...group,
      questions: [...group.questions, newQuestion],
    };
    const nextTemplate = { ...template, groups: nextGroups };
    setTemplate(nextTemplate);
    setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));
    const groupName = group.name.trim() || `Nhóm ${groupIndex + 1}`;
    setAnnouncement(`Đã thêm tiêu chí mới vào "${groupName}".`);
  };

  const handleUpdateQuestion = (
    groupIndex: number,
    questionIndex: number,
    patch: Partial<AssessmentQuestion>,
  ) => {
    const group = template.groups[groupIndex];
    if (!group || !group.questions[questionIndex]) return;
    const nextQuestions = [...group.questions];
    nextQuestions[questionIndex] = { ...nextQuestions[questionIndex], ...patch };
    const nextGroups = [...template.groups];
    nextGroups[groupIndex] = { ...group, questions: nextQuestions };
    const nextTemplate = { ...template, groups: nextGroups };
    setTemplate(nextTemplate);
    setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));
  };

  const handleMoveQuestion = (groupIndex: number, questionIndex: number, direction: -1 | 1) => {
    const group = template.groups[groupIndex];
    if (!group) return;
    const targetIndex = questionIndex + direction;
    if (targetIndex < 0 || targetIndex >= group.questions.length) return;

    const movingQId = group.questions[questionIndex].id;
    const nextQuestions = [...group.questions];
    const [moved] = nextQuestions.splice(questionIndex, 1);
    nextQuestions.splice(targetIndex, 0, moved);
    const nextGroups = [...template.groups];
    nextGroups[groupIndex] = { ...group, questions: nextQuestions };
    const nextTemplate = { ...template, groups: nextGroups };
    setTemplate(nextTemplate);
    setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));

    const movedTitle =
      group.questions[questionIndex].title.trim() || `Tiêu chí ${questionIndex + 1}`;
    const directionWord = direction === -1 ? "lên" : "xuống";
    setAnnouncement(
      `Đã di chuyển tiêu chí "${movedTitle}" ${directionWord} vị trí ${targetIndex + 1}.`,
    );

    // Focus preservation for questions
    setTimeout(() => {
      if (targetIndex === 0) {
        document.getElementById(`move-down-q-${movingQId}`)?.focus();
      } else if (targetIndex === group.questions.length - 1) {
        document.getElementById(`move-up-q-${movingQId}`)?.focus();
      } else {
        const btnId = direction === -1 ? `move-up-q-${movingQId}` : `move-down-q-${movingQId}`;
        document.getElementById(btnId)?.focus();
      }
    }, 50);
  };

  // Validation
  const validateTemplate = useCallback(() => {
    const validationErrors: ValidationError[] = [];

    if (!template.name.trim()) {
      validationErrors.push({
        id: "err-template-name",
        fieldId: "template-name",
        message: "Tên mẫu tiêu chí đánh giá không được để trống.",
      });
    }

    if (template.groups.length === 0) {
      validationErrors.push({
        id: "err-no-groups",
        fieldId: "add-group-button",
        message: "Mẫu đánh giá cần có ít nhất một nhóm tiêu chí.",
      });
    }

    template.groups.forEach((group, gIdx) => {
      const groupDisplay = group.name.trim() || `Nhóm ${gIdx + 1}`;

      if (!group.name.trim()) {
        validationErrors.push({
          id: `err-group-${group.id}-name`,
          fieldId: `group-${group.id}-name`,
          message: `Tên nhóm ${gIdx + 1} không được để trống.`,
        });
      }

      if (!Number.isFinite(group.weight) || group.weight <= 0) {
        validationErrors.push({
          id: `err-group-${group.id}-weight`,
          fieldId: `group-${group.id}-weight`,
          message: `Trọng số nhóm "${groupDisplay}" phải là số lớn hơn 0.`,
        });
      }

      if (group.questions.length === 0) {
        validationErrors.push({
          id: `err-group-${group.id}-questions`,
          fieldId: `group-${group.id}-questions`,
          message: `Nhóm "${groupDisplay}" phải chứa ít nhất một tiêu chí đánh giá.`,
        });
      }

      group.questions.forEach((q, qIdx) => {
        const qDisplay = q.title.trim() || `Tiêu chí ${qIdx + 1}`;

        if (!q.title.trim()) {
          validationErrors.push({
            id: `err-q-${q.id}-title`,
            fieldId: `question-${q.id}-title`,
            message: `Tiêu đề ${qDisplay} (thuộc nhóm "${groupDisplay}") không được để trống.`,
          });
        }

        if (!Number.isFinite(q.weight) || q.weight <= 0) {
          validationErrors.push({
            id: `err-q-${q.id}-weight`,
            fieldId: `question-${q.id}-weight`,
            message: `Trọng số tiêu chí "${qDisplay}" phải là số lớn hơn 0.`,
          });
        }
      });
    });

    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      setValidatedSnapshot(null);
      setAnnouncement(`Biểu mẫu có ${validationErrors.length} lỗi cần khắc phục.`);
      // Reveal editor before focusing summary on mobile/tablet synchronously
      flushSync(() => {
        setActiveTab("editor");
      });
      const summaryEl =
        errorSummaryRef.current ||
        (document.getElementById("error-summary-heading")?.closest('[role="alert"]') as HTMLElement) ||
        (document.querySelector('[role="alert"][aria-labelledby="error-summary-heading"]') as HTMLElement);

      if (summaryEl) {
        const behavior = getScrollBehavior();
        if (typeof summaryEl.scrollIntoView === "function") {
          summaryEl.scrollIntoView({ behavior, block: "start" });
        }
        summaryEl.focus({ preventScroll: true });
      }
    } else {
      setValidatedSnapshot(JSON.stringify(template));
      setAnnouncement("Cấu trúc mẫu hợp lệ.");
    }
  }, [template]);

  const isValidationSuccess =
    validatedSnapshot !== null &&
    errors.length === 0 &&
    validatedSnapshot === JSON.stringify(template);

  const handleRequestLoadSample = (triggerEl?: HTMLElement | null) => {
    const isDirty =
      template.groups.length > 0 ||
      Boolean(template.name.trim()) ||
      Boolean(template.description.trim());
    if (isDirty) {
      openConfirmDialog({ type: "load-sample" }, triggerEl);
    } else {
      setTemplate(structuredClone(SAMPLE_ASSESSMENT_TEMPLATE));
      setValidatedSnapshot(null);
      setErrors([]);
      setAnnouncement("Đã tải mẫu tiêu chuẩn thành công.");
    }
  };

  // Keyboard navigation for mobile tabs (WAI-ARIA Tabs pattern)
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const nextTab: ActiveTab = activeTab === "editor" ? "preview" : "editor";
      flushSync(() => {
        setActiveTab(nextTab);
      });
      const targetId = nextTab === "editor" ? "tab-editor" : "tab-preview";
      document.getElementById(targetId)?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      flushSync(() => {
        setActiveTab("editor");
      });
      document.getElementById("tab-editor")?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      flushSync(() => {
        setActiveTab("preview");
      });
      document.getElementById("tab-preview")?.focus();
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl pb-16">
      {/* Screen reader live announcements */}
      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>

      {/* Header section */}
      <div className="flex min-w-0 flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">{onSave ? "Đang biên tập" : "Bản nháp cục bộ (In-Memory Draft)"}</Badge>
            <span className="text-xs text-muted">{onSave ? "Lưu bản nháp hoặc phát hành khi hoàn tất" : "Không lưu trữ vĩnh viễn trên máy chủ"}</span>
          </div>

          <h1 className="mt-3 min-w-0 text-2xl font-bold tracking-tight text-ink sm:text-3xl break-words [overflow-wrap:anywhere] [word-break:break-word]">
            Thiết lập mẫu tiêu chí đánh giá
          </h1>

          <p className="mt-2 min-w-0 max-w-3xl text-sm leading-6 text-muted break-words [overflow-wrap:anywhere] [word-break:break-word]">
            Xây dựng và xem trước cấu trúc nhóm năng lực, tiêu chuẩn đánh giá và phân bổ trọng số
            cho chu kỳ khảo sát. {onSave ? "Các phiên bản đã sử dụng được giữ nguyên để bảo toàn lịch sử đánh giá." : "Dữ liệu đang được biên tập trong phiên làm việc hiện tại phục vụ kiểm thử giao diện."}
          </p>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onSave && <><Button type="button" variant="secondary" disabled={saving} onClick={() => void persist(false)}>Lưu bản nháp</Button><Button type="button" disabled={saving} onClick={() => void persist(true)}>Lưu & phát hành</Button></>}
          <Button
            id="load-sample-button"
            variant="secondary"
            size="sm"
            type="button"
            onClick={(e) => handleRequestLoadSample(e.currentTarget)}
            className="gap-1.5"
          >
            <Sparkles size={15} aria-hidden="true" />
            <span>Tải mẫu tiêu chuẩn</span>
          </Button>

          <Button
            id="reset-template-button"
            variant="ghost"
            size="sm"
            type="button"
            onClick={(e) => openConfirmDialog({ type: "reset" }, e.currentTarget)}
            className="gap-1.5 text-danger hover:bg-danger-soft hover:text-danger"
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Đặt lại</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={validateTemplate}
            className="gap-1.5"
          >
            <FileCheck2 size={16} aria-hidden="true" />
            <span>Kiểm tra mẫu</span>
          </Button>
        </div>
      </div>

      {saveError && <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">{saveError}</p>}

      {/* Responsive View Switcher for Tablet/Mobile */}
      <div className="mt-6 flex min-w-0 items-center gap-2 lg:hidden">
        <div
          role="tablist"
          aria-label="Chế độ xem"
          className="grid min-w-0 w-full grid-cols-2 rounded-xl border border-border bg-background p-1"
        >
          <button
            id="tab-editor"
            type="button"
            role="tab"
            tabIndex={activeTab === "editor" ? 0 : -1}
            aria-controls="panel-editor"
            onClick={() => setActiveTab("editor")}
            onKeyDown={handleTabKeyDown}
            className={`min-w-0 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
              activeTab === "editor"
                ? "bg-white text-ink shadow-xs"
                : "text-muted hover:text-ink"
            }`}
            aria-selected={activeTab === "editor"}
          >
            <PencilLine size={15} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">Soạn thảo ({template.groups.length} nhóm)</span>
          </button>
          <button
            id="tab-preview"
            type="button"
            role="tab"
            tabIndex={activeTab === "preview" ? 0 : -1}
            aria-controls="panel-preview"
            onClick={() => setActiveTab("preview")}
            onKeyDown={handleTabKeyDown}
            className={`min-w-0 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
              activeTab === "preview"
                ? "bg-white text-ink shadow-xs"
                : "text-muted hover:text-ink"
            }`}
            aria-selected={activeTab === "preview"}
          >
            <Eye size={15} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">Xem trước trực tiếp</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Desktop Split View (7 / 5) & Responsive Single Column */}
      <div className="mt-6 grid min-w-0 w-full grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Form Editor */}
        <div
          id="panel-editor"
          role="tabpanel"
          aria-label="Khu vực soạn thảo tiêu chí đánh giá"
          className={`min-w-0 w-full space-y-6 lg:col-span-7 ${
            activeTab === "editor" ? "block" : "hidden lg:block"
          }`}
        >
          {/* Accessible Error Summary */}
          <ErrorSummary errors={errors} summaryRef={errorSummaryRef} />

          {/* Validation Success Announcement */}
          {isValidationSuccess ? (
            <div
              role="status"
              className="flex min-w-0 items-center gap-2 rounded-xl border border-primary-subtle bg-primary-subtle/50 p-4 text-xs font-semibold text-primary-strong"
            >
              <CheckCircle2 size={16} className="shrink-0 text-primary-strong" aria-hidden="true" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere] [word-break:break-word]">
                Cấu trúc mẫu hợp lệ! Toàn bộ các trường bắt buộc và trọng số đã được điền đầy đủ.
              </span>
            </div>
          ) : null}

          {/* Template Metadata Editor */}
          <TemplateMetaEditor
            name={template.name}
            description={template.description}
            onChangeName={(name) => {
              const nextTemplate = { ...template, name };
              setTemplate(nextTemplate);
              setErrors((prev) => syncErrorsWithTemplate(prev, nextTemplate));
            }}
            onChangeDescription={(description) => {
              setTemplate((prev) => ({ ...prev, description }));
            }}
            errors={errors}
          />

          {/* Group Editors */}
          <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
                Các nhóm năng lực & tiêu chuẩn ({template.groups.length})
              </h2>
              <span className="text-xs text-muted">Thứ tự hiển thị tương ứng trên phiếu đánh giá</span>
            </div>

            {template.groups.length === 0 ? (
              <div className="min-w-0 rounded-2xl border border-dashed border-border bg-white p-8 text-center">
                <FolderPlus size={32} className="mx-auto text-muted/60" aria-hidden="true" />
                <h3 className="mt-3 text-base font-bold text-ink">Chưa có nhóm tiêu chí nào</h3>
                <p className="mt-1 text-xs text-muted">
                  Bắt đầu thiết lập khung đánh giá bằng cách thêm nhóm tiêu chí đầu tiên hoặc tải mẫu tiêu chuẩn.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    id="add-first-group-button"
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={handleAddGroup}
                  >
                    + Thêm nhóm đầu tiên
                  </Button>
                </div>
              </div>
            ) : (
              template.groups.map((group, gIdx) => (
                <GroupEditor
                  key={group.id}
                  group={group}
                  index={gIdx}
                  totalGroups={template.groups.length}
                  errors={errors}
                  onUpdateGroup={(patch) => handleUpdateGroup(gIdx, patch)}
                  onMoveGroupUp={() => handleMoveGroup(gIdx, -1)}
                  onMoveGroupDown={() => handleMoveGroup(gIdx, 1)}
                  onRequestDeleteGroup={(triggerEl) =>
                    openConfirmDialog(
                      {
                        type: "group",
                        groupId: group.id,
                        groupName: group.name.trim() || `Nhóm ${gIdx + 1}`,
                        questionCount: group.questions.length,
                      },
                      triggerEl,
                    )
                  }
                  onAddQuestion={() => handleAddQuestion(gIdx)}
                  onUpdateQuestion={(qIdx, patch) => handleUpdateQuestion(gIdx, qIdx, patch)}
                  onMoveQuestion={(qIdx, dir) => handleMoveQuestion(gIdx, qIdx, dir)}
                  onRequestDeleteQuestion={(qId, qTitle, triggerEl) =>
                    openConfirmDialog(
                      {
                        type: "question",
                        groupId: group.id,
                        questionId: qId,
                        questionTitle: qTitle,
                      },
                      triggerEl,
                    )
                  }
                />
              ))
            )}

            {/* Add Group Button */}
            <div className="pt-2">
              <Button
                id="add-group-button"
                variant="secondary"
                type="button"
                onClick={handleAddGroup}
                className="w-full gap-2 border-dashed py-6 text-sm font-bold text-primary hover:border-primary hover:bg-primary-subtle/30"
              >
                <FolderPlus size={18} aria-hidden="true" />
                <span>+ Thêm nhóm tiêu chí mới</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Read-only Preview */}
        <div
          id="panel-preview"
          role="tabpanel"
          aria-label="Khu vực xem trước trực tiếp phiếu đánh giá"
          className={`min-w-0 w-full lg:col-span-5 ${
            activeTab === "preview" ? "block" : "hidden lg:block"
          }`}
        >
          <div className="min-w-0 w-full lg:sticky lg:top-6">
            <LivePreview template={template} />
          </div>
        </div>
      </div>

      {/* Destructive Confirm Dialog */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (isConfirmedRef.current) {
            isConfirmedRef.current = false;
            return;
          }
          let trigger = dialogTriggerRef.current;
          if (!trigger || !document.body.contains(trigger)) {
            if (activeDelete?.type === "reset") {
              trigger = document.getElementById("reset-template-button");
            } else if (activeDelete?.type === "load-sample") {
              trigger = document.getElementById("load-sample-button");
            } else if (activeDelete?.type === "group") {
              trigger = document.getElementById(`delete-group-${activeDelete.groupId}`);
            } else if (activeDelete?.type === "question") {
              trigger = document.getElementById(`delete-q-${activeDelete.questionId}`);
            }
          }
          const restore = () => {
            if (trigger && typeof trigger.focus === "function" && document.body.contains(trigger)) {
              trigger.focus();
            }
          };
          restore();
          requestAnimationFrame(restore);
          setTimeout(restore, 0);
          setTimeout(restore, 50);
        }}
        title={
          activeDelete?.type === "group"
            ? "Xác nhận xóa nhóm tiêu chí"
            : activeDelete?.type === "question"
              ? "Xác nhận xóa tiêu chí đánh giá"
              : activeDelete?.type === "load-sample"
                ? "Xác nhận tải mẫu tiêu chuẩn"
                : "Xác nhận đặt lại mẫu"
        }
        description={
          activeDelete?.type === "group"
            ? `Bạn có chắc chắn muốn xóa nhóm "${activeDelete.groupName}" cùng toàn bộ ${activeDelete.questionCount} tiêu chí bên trong? Thao tác này chỉ xóa khỏi bản nháp hiện tại.`
            : activeDelete?.type === "question"
              ? `Bạn có chắc muốn xóa tiêu chí "${activeDelete?.questionTitle}" khỏi nhóm?`
              : activeDelete?.type === "load-sample"
                ? "Bạn có chắc muốn tải lại khung năng lực tiêu chuẩn? Mọi thông tin đang chỉnh sửa trong bản nháp hiện tại sẽ được thay thế bằng dữ liệu mẫu ban đầu."
                : "Bạn có chắc muốn xóa sạch các nhóm và tiêu chí hiện tại để bắt đầu lại? Các thay đổi chưa lưu sẽ bị hủy bỏ."
        }
        confirmLabel={
          activeDelete?.type === "reset"
            ? "Đặt lại bản nháp"
            : activeDelete?.type === "load-sample"
              ? "Tải mẫu tiêu chuẩn"
              : "Xác nhận xóa"
        }
        confirmVariant={activeDelete?.type === "load-sample" ? "primary" : "danger"}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
