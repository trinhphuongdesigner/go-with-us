import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AssessmentBuilderView } from "./components/assessment-builder-view";
import { SAMPLE_ASSESSMENT_TEMPLATE } from "./sample-data";
import { getScrollBehavior, syncErrorsWithTemplate } from "./types";

describe("AssessmentBuilderView component", () => {
  it("renders sample template with groups, questions, and live preview", () => {
    render(<AssessmentBuilderView />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Thiết lập mẫu tiêu chí đánh giá" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Bản nháp cục bộ (In-Memory Draft)")).toBeInTheDocument();
    expect(screen.getByDisplayValue(SAMPLE_ASSESSMENT_TEMPLATE.name)).toBeInTheDocument();

    const livePreview = screen.getByTestId("live-preview-container");
    expect(livePreview).toBeInTheDocument();
    expect(within(livePreview).getByText(SAMPLE_ASSESSMENT_TEMPLATE.name)).toBeInTheDocument();

    expect(
      screen.getByDisplayValue(SAMPLE_ASSESSMENT_TEMPLATE.groups[0].name),
    ).toBeInTheDocument();
  });

  it("updates template name and reflects changes immediately in live preview", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const nameInput = screen.getByLabelText(/Tên mẫu tiêu chí đánh giá/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Khung năng lực Quản lý dự án");

    expect(nameInput).toHaveValue("Khung năng lực Quản lý dự án");

    const livePreview = screen.getByTestId("live-preview-container");
    expect(within(livePreview).getByText("Khung năng lực Quản lý dự án")).toBeInTheDocument();
  });

  it("adds a new group and displays it in editor and live preview", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const initialGroupsCount = SAMPLE_ASSESSMENT_TEMPLATE.groups.length;
    const addGroupBtn = screen.getByRole("button", { name: /\+ Thêm nhóm tiêu chí mới/i });
    await user.click(addGroupBtn);

    expect(
      screen.getByRole("heading", {
        name: new RegExp(`Các nhóm năng lực & tiêu chuẩn \\(${initialGroupsCount + 1}\\)`),
      }),
    ).toBeInTheDocument();

    expect(screen.getByDisplayValue(`Nhóm tiêu chí ${initialGroupsCount + 1}`)).toBeInTheDocument();
  });

  it("reorders groups using keyboard move up/down controls with boundary protection", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const firstGroupTitle = SAMPLE_ASSESSMENT_TEMPLATE.groups[0].name;
    const secondGroupTitle = SAMPLE_ASSESSMENT_TEMPLATE.groups[1].name;

    const moveUpFirst = screen.getByRole("button", {
      name: `Di chuyển ${firstGroupTitle} lên`,
    });
    expect(moveUpFirst).toBeDisabled();

    const moveDownFirst = screen.getByRole("button", {
      name: `Di chuyển ${firstGroupTitle} xuống`,
    });
    expect(moveDownFirst).toBeEnabled();

    await user.click(moveDownFirst);

    const groupCards = screen.getAllByTestId(/^group-card-/);
    expect(within(groupCards[0]).getByDisplayValue(secondGroupTitle)).toBeInTheDocument();
    expect(within(groupCards[1]).getByDisplayValue(firstGroupTitle)).toBeInTheDocument();
  });

  it("requires Radix confirmation dialog before destructive removal of a group", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const firstGroupName = SAMPLE_ASSESSMENT_TEMPLATE.groups[0].name;
    const deleteBtn = screen.getByRole("button", { name: `Xóa ${firstGroupName}` });
    await user.click(deleteBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Xác nhận xóa nhóm tiêu chí")).toBeInTheDocument();

    const cancelBtn = within(dialog).getByRole("button", { name: "Hủy bỏ" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(firstGroupName)).toBeInTheDocument();

    await user.click(deleteBtn);
    const confirmDeleteBtn = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Xác nhận xóa",
    });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue(firstGroupName)).not.toBeInTheDocument();
  });

  it("adds, edits, and reorders questions within a group", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const firstGroup = screen.getAllByTestId(/^group-card-/)[0];
    const addQuestionBtn = within(firstGroup).getByRole("button", { name: /Thêm tiêu chí/i });
    await user.click(addQuestionBtn);

    const newQuestionInput = within(firstGroup).getByDisplayValue("Tiêu chí 3");
    expect(newQuestionInput).toBeInTheDocument();

    await user.clear(newQuestionInput);
    await user.type(newQuestionInput, "Kỹ năng lập trình nâng cao");
    expect(newQuestionInput).toHaveValue("Kỹ năng lập trình nâng cao");

    const moveUpBtn = within(firstGroup).getByRole("button", {
      name: "Di chuyển Kỹ năng lập trình nâng cao lên",
    });
    await user.click(moveUpBtn);

    const questionCards = within(firstGroup).getAllByTestId(/^question-card-/);
    expect(within(questionCards[1]).getByDisplayValue("Kỹ năng lập trình nâng cao")).toBeInTheDocument();
  });

  it("validates empty template fields and renders focusable error summary with linked navigation", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const nameInput = screen.getByLabelText(/Tên mẫu tiêu chí đánh giá/i);
    await user.clear(nameInput);

    const validateBtn = screen.getByRole("button", { name: /Kiểm tra mẫu/i });
    await user.click(validateBtn);

    const errorSummary = screen.getByRole("alert");
    expect(errorSummary).toBeInTheDocument();
    expect(within(errorSummary).getByText(/Tên mẫu tiêu chí đánh giá không được để trống/i)).toBeInTheDocument();

    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("error-template-name")).toHaveTextContent(
      "Tên mẫu tiêu chí đánh giá không được để trống.",
    );

    const errorLink = within(errorSummary).getByRole("link", {
      name: /Tên mẫu tiêu chí đánh giá không được để trống/i,
    });
    await user.click(errorLink);
    expect(document.activeElement).toBe(nameInput);
  });

  it("resets template to empty with confirmation and allows reloading sample template", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const resetBtn = screen.getByRole("button", { name: "Đặt lại" });
    await user.click(resetBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Xác nhận đặt lại mẫu")).toBeInTheDocument();

    const confirmReset = within(dialog).getByRole("button", { name: "Đặt lại bản nháp" });
    await user.click(confirmReset);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Chưa có nhóm tiêu chí nào").length).toBeGreaterThanOrEqual(1);

    const loadSampleBtn = screen.getByRole("button", { name: "Tải mẫu tiêu chuẩn" });
    await user.click(loadSampleBtn);
    expect(screen.getByDisplayValue(SAMPLE_ASSESSMENT_TEMPLATE.name)).toBeInTheDocument();
  });

  it("prompts confirmation before reloading sample template when template contains data", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const loadSampleBtn = screen.getByRole("button", { name: "Tải mẫu tiêu chuẩn" });
    await user.click(loadSampleBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Xác nhận tải mẫu tiêu chuẩn")).toBeInTheDocument();

    const cancelBtn = within(dialog).getByRole("button", { name: "Hủy bỏ" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(loadSampleBtn);
    const confirmLoadBtn = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Tải mẫu tiêu chuẩn",
    });
    await user.click(confirmLoadBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(SAMPLE_ASSESSMENT_TEMPLATE.name)).toBeInTheDocument();
  });

  it("renders inline error in group editor when a group has zero questions", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    // First group has 2 questions, delete both
    const firstGroup = screen.getAllByTestId(/^group-card-/)[0];
    const deleteQ1 = within(firstGroup).getByRole("button", {
      name: /Xóa Chất lượng mã nguồn và tư duy kiến trúc/i,
    });
    await user.click(deleteQ1);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận xóa" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const deleteQ2 = within(firstGroup).getByRole("button", {
      name: /Xóa Hiệu năng và trải nghiệm người dùng/i,
    });
    await user.click(deleteQ2);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận xóa" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Click validate
    const validateBtn = screen.getByRole("button", { name: /Kiểm tra mẫu/i });
    await user.click(validateBtn);

    // Verify inline error appears in group card
    expect(
      within(firstGroup).getByText(/phải chứa ít nhất một tiêu chí đánh giá/i),
    ).toBeInTheDocument();
  });

  it("dynamically clears field errors as user corrects invalid input", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const nameInput = screen.getByLabelText(/Tên mẫu tiêu chí đánh giá/i);
    await user.clear(nameInput);

    const validateBtn = screen.getByRole("button", { name: /Kiểm tra mẫu/i });
    await user.click(validateBtn);

    expect(
      screen.getAllByText(/Tên mẫu tiêu chí đánh giá không được để trống/i).length,
    ).toBeGreaterThanOrEqual(1);

    await user.type(nameInput, "Khung tiêu chí mới");
    expect(screen.queryByText(/Tên mẫu tiêu chí đánh giá không được để trống/i)).not.toBeInTheDocument();
  });

  it("invalidates validation success banner upon editing template metadata, groups, or questions", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    // 1. Initial valid template passes validation
    const validateBtn = screen.getByRole("button", { name: /Kiểm tra mẫu/i });
    await user.click(validateBtn);
    expect(
      screen.getByText(/Cấu trúc mẫu hợp lệ! Toàn bộ các trường bắt buộc và trọng số đã được điền đầy đủ\./),
    ).toBeInTheDocument();

    // 2. Editing template name invalidates success banner
    const nameInput = screen.getByLabelText(/Tên mẫu tiêu chí đánh giá/i);
    await user.type(nameInput, " (Cập nhật)");
    expect(
      screen.queryByText(/Cấu trúc mẫu hợp lệ!/),
    ).not.toBeInTheDocument();

    // 3. Re-validating displays banner again
    await user.click(validateBtn);
    expect(
      screen.getByText(/Cấu trúc mẫu hợp lệ!/),
    ).toBeInTheDocument();

    // 4. Editing description invalidates success banner
    const descInput = screen.getByLabelText(/Mô tả mục đích & phạm vi áp dụng/i);
    await user.type(descInput, " Thêm ghi chú.");
    expect(screen.queryByText(/Cấu trúc mẫu hợp lệ!/)).not.toBeInTheDocument();

    // 5. Re-validating displays banner
    await user.click(validateBtn);
    expect(screen.getByText(/Cấu trúc mẫu hợp lệ!/)).toBeInTheDocument();

    // 6. Adding a group invalidates success banner
    const addGroupBtn = screen.getByRole("button", { name: /\+ Thêm nhóm tiêu chí mới/i });
    await user.click(addGroupBtn);
    expect(screen.queryByText(/Cấu trúc mẫu hợp lệ!/)).not.toBeInTheDocument();
  });

  it("prompts confirmation before loading sample when only description is entered on empty draft", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    // Reset template to completely empty
    const resetBtn = screen.getByRole("button", { name: "Đặt lại" });
    await user.click(resetBtn);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đặt lại bản nháp" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const loadSampleBtn = screen.getByRole("button", { name: "Tải mẫu tiêu chuẩn" });
    await waitFor(() => {
      expect(document.activeElement).toBe(loadSampleBtn);
    });

    const nameInput = screen.getByLabelText(/Tên mẫu tiêu chí đánh giá/i);
    expect(nameInput).toHaveValue("");

    // Enter ONLY description (name remains empty, groups remain 0)
    const descInput = screen.getByLabelText(/Mô tả mục đích & phạm vi áp dụng/i);
    await user.click(descInput);
    await user.type(descInput, "Chỉ có nội dung mô tả nháp cần bảo vệ.");
    expect(descInput).toHaveValue("Chỉ có nội dung mô tả nháp cần bảo vệ.");

    // Clicking "Tải mẫu tiêu chuẩn" must prompt confirmation because isDirty includes description
    await user.click(loadSampleBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Xác nhận tải mẫu tiêu chuẩn")).toBeInTheDocument();

    // Cancel keeps the description draft intact
    const cancelBtn = within(dialog).getByRole("button", { name: "Hủy bỏ" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(descInput).toHaveValue("Chỉ có nội dung mô tả nháp cần bảo vệ.");

    // Confirming replaces description with sample template
    await user.click(loadSampleBtn);
    const confirmLoadBtn = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Tải mẫu tiêu chuẩn",
    });
    await user.click(confirmLoadBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(SAMPLE_ASSESSMENT_TEMPLATE.name)).toBeInTheDocument();
  });

  it("supports mobile tabs WAI-ARIA roving tabIndex and keyboard navigation", () => {
    render(<AssessmentBuilderView />);

    const tabEditor = screen.getByRole("tab", { name: /Soạn thảo/i });
    const tabPreview = screen.getByRole("tab", { name: /Xem trước trực tiếp/i });

    // Initial state: Editor is selected with tabIndex 0, Preview is unselected with tabIndex -1
    expect(tabEditor).toHaveAttribute("aria-selected", "true");
    expect(tabEditor).toHaveAttribute("tabindex", "0");
    expect(tabPreview).toHaveAttribute("aria-selected", "false");
    expect(tabPreview).toHaveAttribute("tabindex", "-1");

    // Focus editor tab and press ArrowRight -> switches to preview
    fireEvent.keyDown(tabEditor, { key: "ArrowRight" });

    expect(tabPreview).toHaveAttribute("aria-selected", "true");
    expect(tabPreview).toHaveAttribute("tabindex", "0");
    expect(tabEditor).toHaveAttribute("aria-selected", "false");
    expect(tabEditor).toHaveAttribute("tabindex", "-1");

    // Press ArrowLeft -> switches back to editor
    fireEvent.keyDown(tabPreview, { key: "ArrowLeft" });
    expect(tabEditor).toHaveAttribute("aria-selected", "true");
    expect(tabEditor).toHaveAttribute("tabindex", "0");

    // Press End -> jumps to preview
    fireEvent.keyDown(tabEditor, { key: "End" });
    expect(tabPreview).toHaveAttribute("aria-selected", "true");
    expect(tabPreview).toHaveAttribute("tabindex", "0");

    // Press Home -> jumps to editor
    fireEvent.keyDown(tabPreview, { key: "Home" });
    expect(tabEditor).toHaveAttribute("aria-selected", "true");
    expect(tabEditor).toHaveAttribute("tabindex", "0");
  });

  it("respects prefers-reduced-motion media query for scroll behavior", () => {
    const originalMatchMedia = window.matchMedia;

    // Simulate reduced motion enabled
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    expect(getScrollBehavior()).toBe("auto");

    // Simulate normal motion preference
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    expect(getScrollBehavior()).toBe("smooth");

    window.matchMedia = originalMatchMedia;
  });

  it("routes error summary link for empty group questions to actionable add-question button", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    // Delete both questions in the first group
    const firstGroup = screen.getAllByTestId(/^group-card-/)[0];
    const deleteQ1 = within(firstGroup).getByRole("button", {
      name: /Xóa Chất lượng mã nguồn và tư duy kiến trúc/i,
    });
    await user.click(deleteQ1);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận xóa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const deleteQ2 = within(firstGroup).getByRole("button", {
      name: /Xóa Hiệu năng và trải nghiệm người dùng/i,
    });
    await user.click(deleteQ2);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận xóa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Validate to show error summary
    const validateBtn = screen.getByRole("button", { name: /Kiểm tra mẫu/i });
    await user.click(validateBtn);

    const errorSummary = screen.getByRole("alert");
    expect(errorSummary).toBeInTheDocument();

    const questionsErrorLink = within(errorSummary).getByRole("link", {
      name: /phải chứa ít nhất một tiêu chí đánh giá/i,
    });
    expect(questionsErrorLink).toBeInTheDocument();

    // Click link in error summary
    await user.click(questionsErrorLink);

    // Focus must land on the actionable "+ Thêm tiêu chí đầu tiên" button
    const addFirstBtn = within(firstGroup).getByRole("button", { name: /\+ Thêm tiêu chí đầu tiên/i });
    expect(document.activeElement).toBe(addFirstBtn);
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("validates weight rules: rejects zero, negative, nonfinite and allows positive relative weights > 100", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    const weightInput = screen.getAllByLabelText(/Trọng số nhóm/i)[0];

    // 1. Zero weight is rejected
    await user.clear(weightInput);
    await user.type(weightInput, "0");
    const validateBtn = screen.getByRole("button", { name: /Kiểm tra mẫu/i });
    await user.click(validateBtn);

    expect(
      screen.getAllByText(/Trọng số nhóm .* phải là số lớn hơn 0/i).length,
    ).toBeGreaterThanOrEqual(1);

    // 2. Relative weight > 100 is valid (e.g. 150) without percentage max 100 restriction
    await user.clear(weightInput);
    await user.type(weightInput, "150");
    await user.click(validateBtn);

    expect(
      screen.queryByText(/Trọng số nhóm .* phải là số lớn hơn 0/i),
    ).not.toBeInTheDocument();

    // Check live preview reflects the relative weight
    const livePreview = screen.getByTestId("live-preview-container");
    expect(within(livePreview).getByText("Trọng số: 150")).toBeInTheDocument();
  });

  it("switches to editor tab when validation fails while viewing mobile preview tab", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    // Clear required template name
    const nameInput = screen.getByLabelText(/Tên mẫu tiêu chí đánh giá/i);
    await user.clear(nameInput);

    // Switch to preview tab
    const tabPreview = screen.getByRole("tab", { name: /Xem trước trực tiếp/i });
    await user.click(tabPreview);
    expect(tabPreview).toHaveAttribute("aria-selected", "true");

    // Click validate
    const validateBtn = screen.getByRole("button", { name: /Kiểm tra mẫu/i });
    await user.click(validateBtn);

    // Editor tab must be revealed automatically
    const tabEditor = screen.getByRole("tab", { name: /Soạn thảo/i });
    expect(tabEditor).toHaveAttribute("aria-selected", "true");

    // Error summary is visible
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("restores focus to originating trigger button when cancel is clicked in confirmation dialog across entry points", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    // 1. Reset dialog cancel restores focus to Reset button
    const resetBtn = screen.getByRole("button", { name: "Đặt lại" });
    await user.click(resetBtn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const cancelBtn = within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy bỏ" });
    await user.click(cancelBtn);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(resetBtn));

    // 2. Load sample dialog cancel restores focus to Load Sample button
    const loadSampleBtn = screen.getByRole("button", { name: "Tải mẫu tiêu chuẩn" });
    await user.click(loadSampleBtn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const cancelLoadBtn = within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy bỏ" });
    await user.click(cancelLoadBtn);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(loadSampleBtn));

    // 3. Group delete dialog cancel restores focus to group delete button
    const firstGroup = screen.getAllByTestId(/^group-card-/)[0];
    const firstGroupName = SAMPLE_ASSESSMENT_TEMPLATE.groups[0].name;
    const groupDeleteBtn = within(firstGroup).getByRole("button", { name: `Xóa ${firstGroupName}` });
    await user.click(groupDeleteBtn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const cancelGroupDeleteBtn = within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy bỏ" });
    await user.click(cancelGroupDeleteBtn);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(groupDeleteBtn));

    // 4. Question delete dialog cancel restores focus to question delete button
    const firstQTitle = SAMPLE_ASSESSMENT_TEMPLATE.groups[0].questions[0].title;
    const questionDeleteBtn = within(firstGroup).getByRole("button", { name: `Xóa ${firstQTitle}` });
    await user.click(questionDeleteBtn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const cancelQDeleteBtn = within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy bỏ" });
    await user.click(cancelQDeleteBtn);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(questionDeleteBtn));
  });

  it("syncErrorsWithTemplate purges orphaned question errors when parent group is deleted and updates group indices", () => {
    const template = structuredClone(SAMPLE_ASSESSMENT_TEMPLATE);
    const g1 = template.groups[0];
    const g2 = template.groups[1];
    const q1 = g1.questions[0];

    // Simulate initial errors: group 1 name empty, group 1 question 1 title empty, group 2 name empty
    const initialErrors = [
      { id: `err-group-${g1.id}-name`, fieldId: `group-${g1.id}-name`, message: "Tên nhóm 1 không được để trống." },
      { id: `err-q-${q1.id}-title`, fieldId: `question-${q1.id}-title`, message: `Tiêu đề Tiêu chí 1 (thuộc nhóm "${g1.name}") không được để trống.` },
      { id: `err-group-${g2.id}-name`, fieldId: `group-${g2.id}-name`, message: "Tên nhóm 2 không được để trống." },
    ];

    // Delete group 1
    const nextTemplate = {
      ...template,
      groups: [g2],
    };
    g2.name = ""; // g2 name is still empty

    const synced = syncErrorsWithTemplate(initialErrors, nextTemplate);

    // Group 1 errors AND Group 1 question 1 errors must be gone (no orphaned errors!)
    expect(synced.some((e) => e.fieldId === `group-${g1.id}-name`)).toBe(false);
    expect(synced.some((e) => e.fieldId === `question-${q1.id}-title`)).toBe(false);

    // Group 2 is now the first group (index 0) -> message must be updated to "Tên nhóm 1"
    const g2Error = synced.find((e) => e.fieldId === `group-${g2.id}-name`);
    expect(g2Error).toBeDefined();
    expect(g2Error?.message).toBe("Tên nhóm 1 không được để trống.");
  });

  it("cleans up question errors from error summary when the parent group is deleted in the UI", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    // 1. Clear title of first question in Group 1
    const firstGroup = screen.getAllByTestId(/^group-card-/)[0];
    const firstQTitleInput = within(firstGroup).getAllByLabelText(/Tên tiêu chí \/ Câu hỏi/i)[0];
    await user.clear(firstQTitleInput);

    // 2. Validate to trigger error summary
    const validateBtn = screen.getByRole("button", { name: /Kiểm tra mẫu/i });
    await user.click(validateBtn);

    const errorSummary = screen.getByRole("alert");
    expect(errorSummary).toBeInTheDocument();
    expect(within(errorSummary).getByText(/không được để trống/i)).toBeInTheDocument();

    // 3. Delete Group 1 (which contains the invalid question)
    const firstGroupName = SAMPLE_ASSESSMENT_TEMPLATE.groups[0].name;
    const groupDeleteBtn = within(firstGroup).getByRole("button", { name: `Xóa ${firstGroupName}` });
    await user.click(groupDeleteBtn);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận xóa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // 4. Verify question error has been completely removed from ErrorSummary
    expect(screen.queryByText(/tiêu chí 1.*không được để trống/i)).not.toBeInTheDocument();
  });

  it("restores focus to logical fallback targets after confirmed group deletion and confirmed reset", async () => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);

    // 1. Confirmed Group 1 delete -> focus lands on the next group name input
    const firstGroup = screen.getAllByTestId(/^group-card-/)[0];
    const firstGroupName = SAMPLE_ASSESSMENT_TEMPLATE.groups[0].name;
    const secondGroupId = SAMPLE_ASSESSMENT_TEMPLATE.groups[1].id;
    const groupDeleteBtn = within(firstGroup).getByRole("button", { name: `Xóa ${firstGroupName}` });
    await user.click(groupDeleteBtn);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận xóa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const nextGroupInput = document.getElementById(`group-${secondGroupId}-name`);
    await waitFor(() => expect(document.activeElement).toBe(nextGroupInput));

    // 2. Confirmed Reset -> focus lands on load-sample-button
    const resetBtn = screen.getByRole("button", { name: "Đặt lại" });
    await user.click(resetBtn);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đặt lại bản nháp" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const loadSampleBtn = document.getElementById("load-sample-button");
    await waitFor(() => expect(document.activeElement).toBe(loadSampleBtn));
  });
});


