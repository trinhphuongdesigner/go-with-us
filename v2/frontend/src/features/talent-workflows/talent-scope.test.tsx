import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTalentScope } from "./shared";
import { apiRequest } from "@/lib/api";

let searchParams = new URLSearchParams();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/job-requirements",
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));
vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    session: {
      accessToken: "test-token",
      user: {
        id: "hr-a",
        role: "HR",
        companyId: "company-a",
        permissions: ["people:read", "people:write"],
      },
    },
  }),
}));
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  listAvailableCompaniesLive: vi.fn(),
}));

function ScopeHarness() {
  const scope = useTalentScope();
  return (
    <div>
      <output aria-label="company id">{scope.companyId}</output>
      <output aria-label="ready">{String(scope.ready)}</output>
      {scope.selector}
    </div>
  );
}

function renderScope() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ScopeHarness />
    </QueryClientProvider>,
  );
}

describe("talent company URL scope", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    replace.mockReset();
    vi.mocked(apiRequest).mockReset().mockResolvedValue([
      { id: "company-a", name: "Company A" },
      { id: "company-b", name: "Company B" },
    ]);
  });

  it("uses an allowed company from the URL before the primary company", async () => {
    searchParams = new URLSearchParams("companyId=company-b");
    renderScope();

    await waitFor(() => expect(screen.getByLabelText("company id")).toHaveTextContent("company-b"));
    expect(screen.getByLabelText("Doanh nghiệp đang xem")).toHaveValue("company-b");
  });

  it("fails closed when an explicit URL company is outside the membership allowlist", async () => {
    searchParams = new URLSearchParams("companyId=company-c");
    renderScope();

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(screen.getByLabelText("company id")).toHaveTextContent("");
    expect(screen.getByLabelText("ready")).toHaveTextContent("false");
    expect(screen.getByLabelText("Doanh nghiệp đang xem")).toHaveValue("");
  });

  it("updates the URL and preserves other query state when selection changes", async () => {
    searchParams = new URLSearchParams("companyId=company-a&state=empty");
    renderScope();
    const selector = await screen.findByLabelText("Doanh nghiệp đang xem");
    await waitFor(() => expect(selector).not.toBeDisabled());

    await userEvent.setup().selectOptions(selector, "company-b");

    expect(replace).toHaveBeenCalledWith("/job-requirements?companyId=company-b&state=empty");
  });
});
