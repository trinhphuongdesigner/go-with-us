import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AssessmentBuilderView } from "./components/assessment-builder-view";

describe("Builder focused corrections", () => {
  it.each(["group", "question"])("preserves structural validation after deleting the last invalid %s", async (kind) => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);
    const confirmDelete = async (button: HTMLElement) => {
      await user.click(button);
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận xóa" }));
    };
    const cards = () => screen.getAllByTestId(/^group-card-/);
    while (cards().length > 1) {
      await confirmDelete(within(cards().at(-1)!).getAllByRole("button", { name: /^Xóa / })[0]);
    }
    const group = cards()[0];
    if (kind === "question") {
      const questions = () => within(group).getAllByTestId(/^question-card-/);
      while (questions().length > 1) {
        await confirmDelete(within(questions().at(-1)!).getByRole("button", { name: /^Xóa / }));
      }
      await user.clear(within(group).getByLabelText(/Tên tiêu chí \/ Câu hỏi/i));
    } else {
      await user.clear(within(group).getByLabelText(/Tên nhóm/i));
    }
    await user.click(screen.getByRole("button", { name: /Kiểm tra mẫu/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    const target = kind === "group" ? group : within(group).getByTestId(/^question-card-/);
    await confirmDelete(within(target).getAllByRole("button", { name: /^Xóa / })[0]);
    expect(within(screen.getByRole("alert")).getByText(kind === "group"
      ? /ít nhất một nhóm tiêu chí/i
      : /ít nhất một tiêu chí đánh giá/i)).toBeInTheDocument();
  });

  it.each([/Trọng số nhóm/i, /^Trọng số \(tham khảo\)/i])("allows sequential decimal entry in %s", async (label) => {
    const user = userEvent.setup();
    render(<AssessmentBuilderView />);
    const input = screen.getAllByLabelText(label)[0];
    await user.clear(input);
    expect(input).toHaveValue(null);
    expect(within(screen.getByTestId("live-preview-container")).queryByText(/NaN/)).not.toBeInTheDocument();
    await user.type(input, "0");
    expect(input).toHaveValue(0);
    await user.type(input, ".5");
    expect(input).toHaveValue(0.5);
    await user.click(screen.getByRole("button", { name: /Kiểm tra mẫu/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
