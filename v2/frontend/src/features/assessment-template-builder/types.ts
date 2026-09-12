export interface AssessmentQuestion {
  id: string;
  title: string;
  helpText: string;
  weight: number;
  maxScore?: number;
}

export interface AssessmentGroup {
  id: string;
  name: string;
  description: string;
  weight: number;
  scoreDimension?: "CONTRIBUTION" | "ATTITUDE";
  questions: AssessmentQuestion[];
}

export interface AssessmentTemplate {
  id: string;
  name: string;
  description: string;
  groups: AssessmentGroup[];
}

export interface ValidationError {
  id: string;
  fieldId: string;
  message: string;
}

export type ActiveTab = "editor" | "preview";

export type PendingDeleteTarget =
  | { type: "group"; groupId: string; groupName: string; questionCount: number }
  | { type: "question"; groupId: string; questionId: string; questionTitle: string }
  | { type: "reset" }
  | { type: "load-sample" }
  | null;

export function getScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "auto";
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function syncErrorsWithTemplate(
  prevErrors: ValidationError[],
  currentTemplate: AssessmentTemplate,
): ValidationError[] {
  if (prevErrors.length === 0) return [];

  const nextErrors: ValidationError[] = [];

  // 1. Template name validation
  const hasTemplateNameErr = prevErrors.some((e) => e.fieldId === "template-name");
  if (hasTemplateNameErr && !currentTemplate.name.trim()) {
    nextErrors.push({
      id: "err-template-name",
      fieldId: "template-name",
      message: "Tên mẫu tiêu chí đánh giá không được để trống.",
    });
  }

  // 2. Empty groups validation
  const hasNoGroupsErr = prevErrors.some((e) => e.fieldId === "add-group-button");
  if (currentTemplate.groups.length === 0 && (hasNoGroupsErr || prevErrors.length > 0)) {
    nextErrors.push({
      id: "err-no-groups",
      fieldId: "add-group-button",
      message: "Mẫu đánh giá cần có ít nhất một nhóm tiêu chí.",
    });
  }

  // 3. Groups and questions validation
  currentTemplate.groups.forEach((group, gIdx) => {
    const groupDisplay = group.name.trim() || `Nhóm ${gIdx + 1}`;

    // Group name
    const hasNameErr = prevErrors.some((e) => e.fieldId === `group-${group.id}-name`);
    if (hasNameErr && !group.name.trim()) {
      nextErrors.push({
        id: `err-group-${group.id}-name`,
        fieldId: `group-${group.id}-name`,
        message: `Tên nhóm ${gIdx + 1} không được để trống.`,
      });
    }

    // Group weight
    const hasWeightErr = prevErrors.some((e) => e.fieldId === `group-${group.id}-weight`);
    if (hasWeightErr && (!Number.isFinite(group.weight) || group.weight <= 0)) {
      nextErrors.push({
        id: `err-group-${group.id}-weight`,
        fieldId: `group-${group.id}-weight`,
        message: `Trọng số nhóm "${groupDisplay}" phải là số lớn hơn 0.`,
      });
    }

    // Group empty questions
    const hasQuestionsErr = prevErrors.some((e) => e.fieldId === `group-${group.id}-questions`);
    if (group.questions.length === 0 && (hasQuestionsErr || prevErrors.length > 0)) {
      nextErrors.push({
        id: `err-group-${group.id}-questions`,
        fieldId: `group-${group.id}-questions`,
        message: `Nhóm "${groupDisplay}" phải chứa ít nhất một tiêu chí đánh giá.`,
      });
    }

    // Questions within group
    group.questions.forEach((q, qIdx) => {
      const qDisplay = q.title.trim() || `Tiêu chí ${qIdx + 1}`;

      const hasQTitleErr = prevErrors.some((e) => e.fieldId === `question-${q.id}-title`);
      if (hasQTitleErr && !q.title.trim()) {
        nextErrors.push({
          id: `err-q-${q.id}-title`,
          fieldId: `question-${q.id}-title`,
          message: `Tiêu đề ${qDisplay} (thuộc nhóm "${groupDisplay}") không được để trống.`,
        });
      }

      const hasQWeightErr = prevErrors.some((e) => e.fieldId === `question-${q.id}-weight`);
      if (hasQWeightErr && (!Number.isFinite(q.weight) || q.weight <= 0)) {
        nextErrors.push({
          id: `err-q-${q.id}-weight`,
          fieldId: `question-${q.id}-weight`,
          message: `Trọng số tiêu chí "${qDisplay}" phải là số lớn hơn 0.`,
        });
      }
    });
  });

  return nextErrors;
}
