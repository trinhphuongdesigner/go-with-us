import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/app-state";

describe("dashboard feedback states", () => {
  it("announces loading and error states", () => {
    const { rerender } = render(<LoadingState label="Đang tải tổng quan" />);
    expect(screen.getByRole("status", { name: "Đang tải tổng quan" })).toBeInTheDocument();

    rerender(<ErrorState title="Không tải được" description="Thử lại sau." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được");
  });

  it("offers a keyboard-operable retry action", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState title="Không tải được" description="Thử lại sau." onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders empty-state recovery guidance", () => {
    render(<EmptyState title="Chưa có dữ liệu" description="Hãy cập nhật hồ sơ." />);
    expect(screen.getByText("Hãy cập nhật hồ sơ.")).toBeVisible();
  });
});
