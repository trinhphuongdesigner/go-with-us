import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DemoAccountPicker } from "@/features/auth/login-form";

describe("DemoAccountPicker", () => {
  it("supports keyboard selection and exposes its pressed state", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DemoAccountPicker selectedId="employee" onSelect={onSelect} />);

    const employee = screen.getByRole("button", { name: /Nhân viên/i });
    const manager = screen.getByRole("button", { name: /Quản lý nhân sự/i });
    expect(employee).toHaveAttribute("aria-pressed", "true");

    manager.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "company-admin" }));
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(<DemoAccountPicker selectedId="employee" onSelect={() => undefined} />);
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
