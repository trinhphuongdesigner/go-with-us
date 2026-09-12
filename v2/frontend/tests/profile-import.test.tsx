import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileImportDetailView, ProfileImportListView } from "@/features/profile-import/profile-import-ui";
import {
  ApiError,
  ProfileConflictError,
  applyProfileImport,
  getProfileImport,
  listProfileImports,
  type ProfileImportDetail,
} from "@/lib/api";
import type { Session } from "@/lib/types";

const push = vi.fn();
const testSession: Session = {
  accessToken: "test-token",
  user: {
    id: "employee-1",
    companyId: "company-1",
    companyName: "Acme Test",
    email: "employee@example.invalid",
    name: "Nguyễn Test",
    title: "Chuyên viên",
    initials: "NT",
    role: "EMPLOYEE",
    permissions: ["profile:self"],
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ session: testSession, status: "authenticated" }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    applyProfileImport: vi.fn(),
    createProfileImport: vi.fn(),
    getProfileImport: vi.fn(),
    listProfileImports: vi.fn(),
    parseProfileImport: vi.fn(),
  };
});

const detail: ProfileImportDetail = {
  id: "10000000-0000-4000-8000-000000000010",
  status: "PARSED" as const,
  fileName: "profile.txt",
  mimeType: "text/plain",
  sizeBytes: 120,
  sha256: "digest",
  version: 1,
  proposalVersion: 2,
  profileVersion: 1,
  aiStatus: "ok" as const,
  clarificationQuestions: [],
  warnings: ["DEMO_DATA"],
  traceId: "10000000-0000-4000-8000-000000000014",
  promptVersion: "profile-import-v1",
  schemaVersion: "job-title-v1",
  model: "deterministic-demo",
  createdAt: "2026-09-11T08:15:00.000Z",
  updatedAt: "2026-09-11T08:16:12.000Z",
  proposal: {
    id: "10000000-0000-4000-8000-000000000011",
    version: 2,
    items: [
      {
        proposalItemId: "10000000-0000-4000-8000-000000000012",
        field: "jobTitle",
        value: "Product Designer",
        supportStatus: "SUPPORTED",
        evidenceRefs: [{
          sourceId: "source",
          sourceVersionId: "version",
          blockId: "block",
          charStart: 2,
          charEnd: 18,
          quote: "Product Designer",
          quoteSha256: "quote-digest",
          pageNumber: 1,
          sheetName: null,
          context: "Current role: Product Designer",
        }],
      },
      {
        proposalItemId: "10000000-0000-4000-8000-000000000013",
        field: "summary",
        value: "Tóm tắt chưa rõ",
        supportStatus: "AMBIGUOUS",
        evidenceRefs: [{
          sourceId: "source",
          sourceVersionId: "version",
          blockId: "ambiguous-block",
          charStart: 0,
          charEnd: 18,
          quote: "Tóm tắt chưa rõ",
          quoteSha256: "ambiguous-digest",
          pageNumber: 1,
          sheetName: null,
          context: "Tóm tắt chưa rõ",
        }],
      },
    ],
  },
};

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("profile import review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProfileImports).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    vi.mocked(getProfileImport).mockResolvedValue(detail);
  });

  it("keeps invalid uploads in an inline, focusable recovery flow", async () => {
    const user = userEvent.setup();
    const { container } = renderWithQuery(<ProfileImportListView />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    await user.upload(input!, new File([], "profile.txt", { type: "text/plain" }));
    await user.click(screen.getByRole("button", { name: "Tải lên và kiểm tra" }));

    const summary = screen.getByText("Chưa thể tải tài liệu").parentElement!;
    expect(summary).toHaveTextContent("Tài liệu đang trống");
    await waitFor(() => expect(summary).toHaveFocus());
  });

  it("uses Milo for review guidance without implying automatic persistence", async () => {
    renderWithQuery(<ProfileImportListView />);

    expect(screen.getByRole("complementary", { name: "Gợi ý từ Milo" })).toBeVisible();
    expect(screen.getByAltText("Milo nhắc bạn kiểm tra minh chứng")).toBeVisible();
    expect(screen.getByText(/Tài liệu không bao giờ tự thay đổi hồ sơ/)).toBeVisible();
  });

  it("selects only supported evidence-backed items and sends all review decisions", async () => {
    const user = userEvent.setup();
    const proposal = detail.proposal!;
    vi.mocked(applyProfileImport).mockResolvedValue({
      commandId: "command-1",
      status: "APPLIED",
      createdEntityIds: ["entity-1"],
      skippedItemIds: [proposal.items[1].proposalItemId],
      profileVersion: 2,
    });
    renderWithQuery(<ProfileImportDetailView importId={detail.id} />);

    expect(await screen.findByRole("checkbox", { name: /Chức danh hiện tại/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Giới thiệu chuyên môn/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cập nhật 1 mục" }));

    await waitFor(() => expect(applyProfileImport).toHaveBeenCalledTimes(1));
    expect(vi.mocked(applyProfileImport).mock.calls[0]?.[2]).toMatchObject({
      proposalVersion: 2,
      items: [
        { proposalItemId: proposal.items[0].proposalItemId, selected: true },
        { proposalItemId: proposal.items[1].proposalItemId, selected: false },
      ],
    });
    expect(vi.mocked(applyProfileImport).mock.calls[0]?.[3]).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText("Hồ sơ đã được cập nhật")).toBeVisible();
  });

  it("restores the persisted AI outcome and uses a human-readable demo warning", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ProfileImportDetailView importId={detail.id} />);

    expect(await screen.findByRole("heading", { name: "AI đã tạo đề xuất có dẫn nguồn" })).toBeVisible();
    expect(screen.getByText(/Đây là dữ liệu mẫu chạy sẵn để bạn xem luồng/)).toBeVisible();
    await user.click(screen.getAllByText(/Xem minh chứng/)[0]);
    expect(screen.getByText(/Current role: Product Designer/)).toBeVisible();
    expect(screen.queryByText(/vị trí trong tài liệu/)).not.toBeInTheDocument();
  });

  it("turns an optimistic conflict into a stale state that blocks apply", async () => {
    const user = userEvent.setup();
    vi.mocked(applyProfileImport).mockRejectedValue(new ProfileConflictError({
      detail: "Phiên hồ sơ đã thay đổi",
      currentProfileVersion: 3,
      currentProposalVersion: 4,
    }));
    renderWithQuery(<ProfileImportDetailView importId={detail.id} />);

    await user.click(await screen.findByRole("button", { name: "Cập nhật 1 mục" }));

    expect(await screen.findByRole("heading", { name: "Hồ sơ đã thay đổi ở nơi khác" })).toBeVisible();
    expect(screen.getByText("Phiên mới: hồ sơ 3, đề xuất 4.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cập nhật 1 mục" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tải lại dữ liệu" })).toBeVisible();
  });

  it("keeps a stale profile locked until a successful refetch returns a new version", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (value: ProfileImportDetail) => void;
    vi.mocked(applyProfileImport).mockRejectedValue(new ApiError("Phiên hồ sơ đã thay đổi", 409));
    renderWithQuery(<ProfileImportDetailView importId={detail.id} />);

    await user.click(await screen.findByRole("button", { name: "Cập nhật 1 mục" }));
    const refreshPromise = new Promise<ProfileImportDetail>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.mocked(getProfileImport).mockImplementationOnce(() => refreshPromise);
    await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }));

    expect(screen.getByRole("button", { name: "Đang tải bản mới…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cập nhật 1 mục" })).toBeDisabled();
    resolveRefresh({ ...detail, profileVersion: 2 });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Hồ sơ đã thay đổi ở nơi khác" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Cập nhật 1 mục" })).toBeEnabled();
  });

  it("keeps the stale lock when refetch fails", async () => {
    const user = userEvent.setup();
    vi.mocked(applyProfileImport).mockRejectedValue(new ApiError("Phiên hồ sơ đã thay đổi", 409));
    renderWithQuery(<ProfileImportDetailView importId={detail.id} />);

    await user.click(await screen.findByRole("button", { name: "Cập nhật 1 mục" }));
    vi.mocked(getProfileImport).mockRejectedValueOnce(new ApiError("Mất kết nối", 503));
    await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }));

    expect(await screen.findByRole("heading", { name: "Hồ sơ đã thay đổi ở nơi khác" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cập nhật 1 mục" })).toBeDisabled();
  });
});
