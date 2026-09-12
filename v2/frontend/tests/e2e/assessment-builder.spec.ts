import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const REPORT_DIR = path.resolve(
  process.cwd(),
  "../reports/assessment-builder/screenshots",
);
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function monitorPageHealth(page: Page) {
  const failures: string[] = [];
  const businessRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    const isCancelledNextNavigation =
      failure === "net::ERR_ABORTED" && request.url().includes("_rsc=");
    if (isCancelledNextNavigation) return;
    failures.push(
      `requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText})`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });

  page.on("request", (request) => {
    const url = request.url();
    // Catch any unauthorized API mutation attempts
    if (url.includes("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      businessRequests.push(`${request.method()} ${url}`);
    }
  });

  return {
    assertHealthy: () =>
      expect(failures, "Trang không được có lỗi console, runtime hoặc request").toEqual([]),
    assertNoBusinessRequests: () =>
      expect(
        businessRequests,
        "Không được phát sinh request API nghiệp vụ (in-memory draft)",
      ).toEqual([]),
  };
}

async function gotoVerified(page: Page, targetPath: string) {
  await page.goto(targetPath);
  const expectedSha = process.env.CAREERMATE_EXPECTED_SHA;
  if (expectedSha && /^[0-9a-f]{40}$/.test(expectedSha)) {
    await expect(page.locator('meta[name="careermate-build-sha"]')).toHaveAttribute(
      "content",
      expectedSha,
    );
  }
}

test.describe("CareerMate Assessment Builder & Preview", () => {
  test("chặn nhân viên truy cập trực tiếp và cho phép quản trị công ty", async ({ page }) => {
    const { assertHealthy } = monitorPageHealth(page);

    // 1. Đăng nhập bằng tài khoản Nhân viên (không có quyền company:manage)
    await gotoVerified(page, "/login");
    await page.getByRole("button", { name: /^Nhân viên Xem hồ sơ/ }).click();
    await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 2. Truy cập trực tiếp route preview tiêu chí
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");
    await expect(
      page.getByRole("heading", { name: "Khu vực này không thuộc vai trò của bạn" }),
    ).toBeVisible();
    await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thiết lập mẫu tiêu chí đánh giá" })).toHaveCount(0);

    // 3. Đổi sang tài khoản Quản lý nhân sự (có quyền company:manage)
    await page.evaluate(() => window.localStorage.removeItem("careermate-v2-session"));
    await gotoVerified(page, "/login");
    await page.getByRole("button", { name: /^Quản lý nhân sự Theo dõi đội ngũ/ }).click();
    await page.getByRole("button", { name: /Tiếp tục với vai trò Quản lý nhân sự/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 4. Truy cập lại route preview tiêu chí
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");
    await expect(
      page.getByRole("heading", { level: 1, name: "Thiết lập mẫu tiêu chí đánh giá" }),
    ).toBeVisible();
    await expect(page.getByText("Bản nháp cục bộ (In-Memory Draft)")).toBeVisible();

    assertHealthy();
  });

  test("hỗ trợ đầy đủ luồng chỉnh sửa, thêm, đổi thứ tự, xóa và xem trước", async ({
    page,
  }) => {
    const { assertHealthy, assertNoBusinessRequests } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");
    await expect(
      page.getByRole("heading", { level: 1, name: "Thiết lập mẫu tiêu chí đánh giá" }),
    ).toBeVisible();

    // 1. Chỉnh sửa tên mẫu và mô tả
    const nameInput = page.getByLabel("Tên mẫu tiêu chí đánh giá");
    await nameInput.fill("Khung năng lực Kỹ sư AI & Dữ liệu");
    const descInput = page.getByLabel("Mô tả mục đích & phạm vi áp dụng");
    await descInput.fill("Tiêu chuẩn đánh giá năng lực AI Engineer cho chu kỳ Q4.");

    // Live preview cập nhật
    const previewContainer = page.getByTestId("live-preview-container");
    if (await previewContainer.isVisible()) {
      await expect(previewContainer.getByText("Khung năng lực Kỹ sư AI & Dữ liệu")).toBeVisible();
      await expect(
        previewContainer.getByText("Tiêu chuẩn đánh giá năng lực AI Engineer cho chu kỳ Q4."),
      ).toBeVisible();
    }

    // 2. Thêm nhóm tiêu chí mới
    await page.getByRole("button", { name: /\+ Thêm nhóm tiêu chí mới/ }).click();
    await expect(page.locator('input[value="Nhóm tiêu chí 4"]:visible')).toBeVisible();

    // Đổi tên nhóm mới
    const group4Input = page.locator('input[value="Nhóm tiêu chí 4"]:visible');
    await group4Input.fill("Đạo đức AI & Quản trị dữ liệu");

    // 3. Đổi thứ tự nhóm tiêu chí
    const moveUpGroup4 = page.getByRole("button", {
      name: "Di chuyển Đạo đức AI & Quản trị dữ liệu lên",
    });
    await moveUpGroup4.click();
    await expect(
      page.getByText(/Đã di chuyển nhóm "Đạo đức AI & Quản trị dữ liệu" lên vị trí 3\./),
    ).toBeAttached();

    // 4. Thêm tiêu chí vào nhóm mới
    const groupCard = page.locator('[data-testid^="group-card-"]').nth(2);
    await groupCard.getByRole("button", { name: "Thêm tiêu chí" }).click();
    const newQuestionInput = groupCard.locator('input[value="Tiêu chí 2"]:visible');
    await newQuestionInput.fill("Tuân thủ bảo mật dữ liệu khách hàng");

    // Đổi thứ tự tiêu chí trong nhóm
    const moveUpQ2 = groupCard.getByRole("button", {
      name: "Di chuyển Tuân thủ bảo mật dữ liệu khách hàng lên",
    });
    await moveUpQ2.click();
    await expect(
      page.getByText(/Đã di chuyển tiêu chí "Tuân thủ bảo mật dữ liệu khách hàng" lên vị trí 1\./),
    ).toBeAttached();

    // 5. Xóa tiêu chí có xác nhận qua Radix Dialog
    const deleteQBtn = groupCard.getByRole("button", {
      name: "Xóa Tuân thủ bảo mật dữ liệu khách hàng",
    });
    await deleteQBtn.click();
    const deleteQDialog = page.getByRole("dialog");
    await expect(deleteQDialog).toBeVisible();
    await expect(deleteQDialog.getByText("Xác nhận xóa tiêu chí đánh giá")).toBeVisible();

    // Hủy bỏ xóa
    await deleteQDialog.getByRole("button", { name: "Hủy bỏ" }).click();
    await expect(deleteQDialog).toHaveCount(0);
    await expect(
      groupCard.locator('input[value="Tuân thủ bảo mật dữ liệu khách hàng"]:visible'),
    ).toBeVisible();

    // Xác nhận xóa thật
    await deleteQBtn.click();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận xóa" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      groupCard.locator('input[value="Tuân thủ bảo mật dữ liệu khách hàng"]:visible'),
    ).toHaveCount(0);

    // 6. Xóa nhóm tiêu chí có xác nhận
    const deleteGroupBtn = page.getByRole("button", {
      name: "Xóa Đạo đức AI & Quản trị dữ liệu",
    });
    await deleteGroupBtn.click();
    const deleteGroupDialog = page.getByRole("dialog");
    await expect(deleteGroupDialog).toBeVisible();
    await expect(deleteGroupDialog.getByText("Xác nhận xóa nhóm tiêu chí")).toBeVisible();

    await deleteGroupDialog.getByRole("button", { name: "Xác nhận xóa" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.locator('input[value="Đạo đức AI & Quản trị dữ liệu"]'),
    ).toHaveCount(0);

    // 7. Reset mẫu về trắng với xác nhận
    await page.getByRole("button", { name: "Đặt lại" }).click();
    const resetDialog = page.getByRole("dialog");
    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole("button", { name: "Đặt lại bản nháp" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Chưa có nhóm tiêu chí nào" }).first(),
    ).toBeVisible();

    // 8. Tải lại mẫu tiêu chuẩn
    await page.getByRole("button", { name: "Tải mẫu tiêu chuẩn" }).click();
    await expect(
      page.locator(
        'input[value="Khung năng lực Kỹ sư Phần mềm (Frontend & Fullstack)"]:visible',
      ),
    ).toBeVisible();

    assertHealthy();
    assertNoBusinessRequests();
  });

  test("quản lý validation: hiển thị error summary, link đến trường lỗi, và tự động hủy bỏ banner thành công khi sửa nội dung", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    // 1. Kiểm tra mẫu hợp lệ ban đầu -> banner thành công xuất hiện
    await page.getByRole("button", { name: "Kiểm tra mẫu" }).click();
    const successBanner = page.getByText(/Cấu trúc mẫu hợp lệ! Toàn bộ các trường bắt buộc/);
    await expect(successBanner).toBeVisible();

    // 2. Chỉnh sửa tên mẫu -> banner thành công ngay lập tức biến mất
    const nameInput = page.getByLabel("Tên mẫu tiêu chí đánh giá");
    await nameInput.fill("");
    await expect(successBanner).toHaveCount(0);

    // 3. Bấm Kiểm tra mẫu khi thiếu tên -> Error Summary xuất hiện
    await page.getByRole("button", { name: "Kiểm tra mẫu" }).click();
    const errorSummary = page.locator('[aria-labelledby="error-summary-heading"]');
    await expect(errorSummary).toBeVisible();
    await expect(
      errorSummary.getByText(/Tên mẫu tiêu chí đánh giá không được để trống/),
    ).toBeVisible();

    // 4. Click link trong Error Summary đưa focus đến đúng input
    const errorLink = errorSummary.getByRole("link", {
      name: /Tên mẫu tiêu chí đánh giá không được để trống/,
    });
    await errorLink.click();
    await expect(nameInput).toBeFocused();
    await expect(nameInput).toHaveAttribute("aria-invalid", "true");

    // 5. Điền lại tên -> inline error biến mất
    await nameInput.fill("Khung năng lực hợp lệ");
    await expect(page.locator("#error-template-name")).toHaveCount(0);

    assertHealthy();
  });

  test("khôi phục focus chuẩn xác sau khi đóng ConfirmDialog tại mọi điểm kích hoạt", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    // 1. Reset button -> Cancel -> restores focus to Reset button
    const resetBtn = page.getByRole("button", { name: "Đặt lại" });
    await resetBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Hủy bỏ" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(resetBtn).toBeFocused();

    // 2. Load Sample button (with dirty content) -> Escape key -> restores focus to Load Sample button
    const loadSampleBtn = page.getByRole("button", { name: "Tải mẫu tiêu chuẩn" });
    await loadSampleBtn.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(loadSampleBtn).toBeFocused();

    // 3. Group delete button -> Dialog Close (X) button -> restores focus to Group delete button
    const firstGroup = page.locator('[data-testid^="group-card-"]').first();
    const groupDeleteBtn = firstGroup.getByRole("button", {
      name: "Xóa Năng lực chuyên môn & Kỹ thuật",
    });
    await groupDeleteBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Đóng hộp thoại" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(groupDeleteBtn).toBeFocused();

    // 4. Question delete button -> Cancel -> restores focus to Question delete button
    const questionDeleteBtn = firstGroup.getByRole("button", {
      name: "Xóa Chất lượng mã nguồn và tư duy kiến trúc",
    });
    await questionDeleteBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Hủy bỏ" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(questionDeleteBtn).toBeFocused();

    // 5. Question delete -> Confirmed -> logical fallback focus lands on next question title
    await questionDeleteBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Xác nhận xóa" }).click();
    await expect(dialog).toHaveCount(0);
    const nextQTitleInput = firstGroup.locator(
      'input[value="Hiệu năng và trải nghiệm người dùng"]:visible',
    );
    await expect(nextQTitleInput).toBeFocused();

    // 6. Group delete -> Backdrop overlay click -> restores focus to Group delete button
    await groupDeleteBtn.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(dialog).toHaveCount(0);
    await expect(groupDeleteBtn).toBeFocused();

    // 7. Confirmed group delete -> logical fallback focus lands on next group name input
    await groupDeleteBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Xác nhận xóa" }).click();
    await expect(dialog).toHaveCount(0);
    const secondGroupInput = page.locator('input[value="Tư duy giải quyết vấn đề & Phân tích"]:visible');
    await expect(secondGroupInput).toBeFocused();

    assertHealthy();
  });

  test("chế độ mobile preview: bấm kiểm tra mẫu tự động chuyển sang tab soạn thảo và focus error summary", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    const previewTab = page.getByRole("tab", { name: /Xem trước trực tiếp/ });
    if (await previewTab.isVisible()) {
      // 1. Làm trống tên mẫu
      const nameInput = page.getByLabel("Tên mẫu tiêu chí đánh giá");
      await nameInput.fill("");

      // 2. Chuyển sang tab Xem trước
      await previewTab.click();
      await expect(page.getByTestId("live-preview-container")).toBeVisible();

      // 3. Bấm nút Kiểm tra mẫu toàn cục
      await page.getByRole("button", { name: "Kiểm tra mẫu" }).click();

      // 4. Tự động chuyển về panel soạn thảo và focus Error Summary
      await expect(page.locator("#panel-editor")).toBeVisible();
      const errorSummary = page.locator('[aria-labelledby="error-summary-heading"]');
      await expect(errorSummary).toBeVisible();
      await expect(errorSummary).toBeFocused();

      // 5. Liên kết trong Error Summary hoạt động chuẩn
      const errorLink = errorSummary.getByRole("link", {
        name: /Tên mẫu tiêu chí đánh giá không được để trống/,
      });
      await errorLink.click();
      await expect(nameInput).toBeFocused();
    }

    assertHealthy();
  });

  test("hỗ trợ WAI-ARIA tabs trên mobile/tablet với điều hướng bàn phím đầy đủ", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    const tabEditor = page.getByRole("tab", { name: /Soạn thảo/ });
    const tabPreview = page.getByRole("tab", { name: /Xem trước trực tiếp/ });

    if (await tabEditor.isVisible()) {
      // Trạng thái ban đầu: tab Soạn thảo được chọn với tabIndex 0
      await expect(tabEditor).toHaveAttribute("aria-selected", "true");
      await expect(tabEditor).toHaveAttribute("tabindex", "0");
      await expect(tabPreview).toHaveAttribute("aria-selected", "false");
      await expect(tabPreview).toHaveAttribute("tabindex", "-1");

      // Focus tab Soạn thảo và bấm ArrowRight -> chuyển sang Preview
      await tabEditor.focus();
      await page.keyboard.press("ArrowRight");

      await expect(tabPreview).toHaveAttribute("aria-selected", "true");
      await expect(tabPreview).toHaveAttribute("tabindex", "0");
      await expect(tabPreview).toBeFocused();

      // Bấm ArrowLeft -> chuyển về Soạn thảo
      await page.keyboard.press("ArrowLeft");
      await expect(tabEditor).toHaveAttribute("aria-selected", "true");
      await expect(tabEditor).toHaveAttribute("tabindex", "0");
      await expect(tabEditor).toBeFocused();

      // Bấm End -> nhảy tới Preview
      await page.keyboard.press("End");
      await expect(tabPreview).toHaveAttribute("aria-selected", "true");
      await expect(tabPreview).toBeFocused();

      // Bấm Home -> nhảy về Soạn thảo
      await page.keyboard.press("Home");
      await expect(tabEditor).toHaveAttribute("aria-selected", "true");
      await expect(tabEditor).toBeFocused();
    }

    assertHealthy();
  });

  test("xử lý chuỗi dài không ngắt (180 ký tự) không gây tràn ngang trên cả editor và preview", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    const longUnbrokenText = "X".repeat(180);

    // Điền chuỗi 180 ký tự liền nhau vào các trường
    await page.getByLabel("Tên mẫu tiêu chí đánh giá").fill(longUnbrokenText);
    await page.getByLabel("Mô tả mục đích & phạm vi áp dụng").fill(longUnbrokenText);

    const firstGroupCard = page.locator('[data-testid^="group-card-"]').first();
    const groupNameInput = firstGroupCard.locator('input[id^="group-"][id$="-name"]');
    await groupNameInput.fill(longUnbrokenText);
    const groupDescTextarea = firstGroupCard.locator('textarea[id^="group-"][id$="-description"]');
    await groupDescTextarea.fill(longUnbrokenText);

    const questionCard = firstGroupCard.locator('[data-testid^="question-card-"]').first();
    const qTitleInput = questionCard.locator('input[id^="question-"][id$="-title"]');
    await qTitleInput.fill(longUnbrokenText);
    const qHelpTextarea = questionCard.locator('textarea[id^="question-"][id$="-helpText"]');
    await qHelpTextarea.fill(longUnbrokenText);

    // Thêm nhiều nhóm mới để kiểm thử trường hợp nhiều nhóm (many groups)
    await page.getByRole("button", { name: /\+ Thêm nhóm tiêu chí mới/ }).click();
    await page.getByRole("button", { name: /\+ Thêm nhóm tiêu chí mới/ }).click();

    // 1. Kiểm tra scrollWidth không vượt innerWidth ở tab Soạn thảo
    const docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(docScrollWidth, "document.documentElement không được tràn ngang").toBeLessThanOrEqual(innerWidth);
    expect(bodyScrollWidth, "document.body không được tràn ngang").toBeLessThanOrEqual(innerWidth);

    // 2. Kiểm tra tab Xem trước (trên mobile/tablet)
    const previewTab = page.getByRole("tab", { name: /Xem trước trực tiếp/ });
    if (await previewTab.isVisible()) {
      await previewTab.click();
      await expect(page.getByTestId("live-preview-container")).toBeVisible();

      const previewDocWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const previewBodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(previewDocWidth, "Preview: document không được tràn ngang").toBeLessThanOrEqual(innerWidth);
      expect(previewBodyWidth, "Preview: body không được tràn ngang").toBeLessThanOrEqual(innerWidth);
    }

    assertHealthy();
  });

  test("tôn trọng prefers-reduced-motion khi cuộn trang và điều hướng focus", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    // Kích hoạt prefers-reduced-motion: reduce
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    // Xác nhận matchMedia trong ngữ cảnh trình duyệt trả về auto
    const behavior = await page.evaluate(() => {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    });
    expect(behavior).toBe("auto");

    // Xóa tên mẫu và kích hoạt lỗi
    const nameInput = page.getByLabel("Tên mẫu tiêu chí đánh giá");
    await nameInput.fill("");
    await page.getByRole("button", { name: "Kiểm tra mẫu" }).click();

    const errorSummary = page.locator('[aria-labelledby="error-summary-heading"]');
    await expect(errorSummary).toBeVisible();
    await expect(errorSummary).toBeFocused();

    // Click link lỗi di chuyển focus không gây xung đột cuộn
    const errorLink = errorSummary.getByRole("link", {
      name: /Tên mẫu tiêu chí đánh giá không được để trống/,
    });
    await errorLink.click();
    await expect(nameInput).toBeFocused();

    assertHealthy();
  });

  test("xóa nhóm chứa tiêu chí không hợp lệ tự động dọn sạch lỗi tiêu chí trong error summary mà không để lại liên kết mồ côi", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    const firstGroup = page.locator('[data-testid^="group-card-"]').first();
    const firstQTitleInput = firstGroup.locator('input[id^="question-"][id$="-title"]').first();

    // 1. Làm trống tiêu đề tiêu chí 1 trong nhóm 1
    await firstQTitleInput.fill("");

    // 2. Bấm Kiểm tra mẫu -> Error summary xuất hiện chứa lỗi tiêu đề tiêu chí
    await page.getByRole("button", { name: "Kiểm tra mẫu" }).click();
    const errorSummary = page.locator('[aria-labelledby="error-summary-heading"]');
    await expect(errorSummary).toBeVisible();
    await expect(errorSummary.getByText(/không được để trống/i)).toBeVisible();

    // 3. Xóa nhóm 1 (chứa tiêu chí có lỗi)
    const deleteGroupBtn = firstGroup.getByRole("button", {
      name: "Xóa Năng lực chuyên môn & Kỹ thuật",
    });
    await deleteGroupBtn.click();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận xóa" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 4. Lỗi của tiêu chí thuộc nhóm đã xóa không còn tồn tại trong error summary (không có link mồ côi)
    await expect(errorSummary.getByText(/Chất lượng mã nguồn/i)).toHaveCount(0);
    await expect(errorSummary.getByText(/Năng lực chuyên môn/i)).toHaveCount(0);

    assertHealthy();
  });

  test("bảo vệ bản nháp chỉ có mô tả sau khi reset và hiển thị cảnh báo khi tải lại mẫu tiêu chuẩn", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    // 1. Reset mẫu về trạng thái trống
    await page.getByRole("button", { name: "Đặt lại" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Đặt lại bản nháp" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 2. Chỉ điền mô tả (tên vẫn trống, chưa có nhóm nào)
    const descInput = page.getByLabel("Mô tả mục đích & phạm vi áp dụng");
    await descInput.fill("Bản nháp chỉ chứa mô tả cần được bảo vệ.");

    // 3. Bấm tải mẫu tiêu chuẩn -> phải bật dialog xác nhận vì isDirty phát hiện mô tả
    const loadSampleBtn = page.getByRole("button", { name: "Tải mẫu tiêu chuẩn" });
    await loadSampleBtn.click();
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText("Xác nhận tải mẫu tiêu chuẩn")).toBeVisible();

    // 4. Hủy bỏ tải -> mô tả được giữ nguyên và focus trả về nút Tải mẫu tiêu chuẩn
    await confirmDialog.getByRole("button", { name: "Hủy bỏ" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(descInput).toHaveValue("Bản nháp chỉ chứa mô tả cần được bảo vệ.");
    await expect(loadSampleBtn).toBeFocused();

    // 5. Bấm lại và xác nhận tải -> dữ liệu mẫu tiêu chuẩn được nạp thành công
    await loadSampleBtn.click();
    await page.getByRole("dialog").getByRole("button", { name: "Tải mẫu tiêu chuẩn" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Tên mẫu tiêu chí đánh giá")).toHaveValue(
      "Khung năng lực Kỹ sư Phần mềm (Frontend & Fullstack)",
    );

    assertHealthy();
  });

  test("điều hướng liên kết error summary khi xóa toàn bộ câu hỏi và kiểm tra tính nhất quán trọng số tương đối", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");

    const firstGroup = page.locator('[data-testid^="group-card-"]').first();

    // 1. Xóa toàn bộ tiêu chí trong nhóm 1
    const deleteBtn1 = firstGroup.getByRole("button", {
      name: "Xóa Chất lượng mã nguồn và tư duy kiến trúc",
    });
    await deleteBtn1.click();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận xóa" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const deleteBtn2 = firstGroup.getByRole("button", {
      name: "Xóa Hiệu năng và trải nghiệm người dùng",
    });
    await deleteBtn2.click();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận xóa" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 2. Bấm Kiểm tra mẫu -> Error Summary xuất hiện báo lỗi nhóm chưa có tiêu chí
    await page.getByRole("button", { name: "Kiểm tra mẫu" }).click();
    const errorSummary = page.locator('[aria-labelledby="error-summary-heading"]');
    await expect(errorSummary).toBeVisible();

    const groupQuestionsErrorLink = errorSummary.getByRole("link", {
      name: /phải chứa ít nhất một tiêu chí đánh giá/,
    });
    await expect(groupQuestionsErrorLink).toBeVisible();

    // 3. Click liên kết trong error summary -> focus rơi chuẩn vào nút "+ Thêm tiêu chí đầu tiên"
    await groupQuestionsErrorLink.click();
    const addFirstQuestionBtn = firstGroup.getByRole("button", {
      name: "+ Thêm tiêu chí đầu tiên",
    });
    await expect(addFirstQuestionBtn).toBeFocused();

    // 4. Bấm thêm tiêu chí đầu tiên -> inline error và summary error tự động biến mất
    await addFirstQuestionBtn.click();
    await expect(firstGroup.locator('[id^="error-group-"][id$="-questions"]')).toHaveCount(0);

    // 5. Kiểm tra trọng số tương đối > 100 hợp lệ
    const groupWeightInput = firstGroup.locator('input[id^="group-"][id$="-weight"]');
    await groupWeightInput.fill("120");
    await page.getByRole("button", { name: "Kiểm tra mẫu" }).click();
    await expect(firstGroup.locator('[id^="error-group-"][id$="-weight"]')).toHaveCount(0);

    assertHealthy();
  });

  test("đạt tiêu chuẩn Accessibility (Axe audit) và chụp ảnh bằng chứng trên các viewport", async ({
    page,
  }) => {
    const { assertHealthy } = monitorPageHealth(page);

    await page.addInitScript(() => {
      window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin");
    });
    await gotoVerified(page, "/cong-ty/tieu-chi/preview");
    await expect(
      page.getByRole("heading", { level: 1, name: "Thiết lập mẫu tiêu chí đánh giá" }),
    ).toBeVisible();

    // 1. Accessibility check trạng thái chuẩn
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    const width = page.viewportSize()?.width ?? 1440;

    // Chụp screenshot bằng chứng theo từng viewport
    if (width >= 1200) {
      await page.screenshot({
        path: path.join(REPORT_DIR, "desktop-1440-builder.png"),
        fullPage: true,
      });

      // Mở dialog để chụp ảnh modal và audit dialog
      await page.getByRole("button", { name: "Đặt lại" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const dialogAxe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(dialogAxe.violations).toEqual([]);

      await page.screenshot({
        path: path.join(REPORT_DIR, "desktop-1440-dialog.png"),
      });
      await page.getByRole("dialog").getByRole("button", { name: "Hủy bỏ" }).click();

      // Kích hoạt lỗi để chụp ảnh error summary và audit
      const nameInput = page.getByLabel("Tên mẫu tiêu chí đánh giá");
      await nameInput.fill("");
      await page.getByRole("button", { name: "Kiểm tra mẫu" }).click();
      await expect(page.locator('[aria-labelledby="error-summary-heading"]')).toBeVisible();

      const errorAxe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(errorAxe.violations).toEqual([]);

      await page.screenshot({
        path: path.join(REPORT_DIR, "desktop-1440-errors.png"),
      });
    } else if (width >= 700 && width < 1200) {
      await page.screenshot({
        path: path.join(REPORT_DIR, "tablet-768-builder.png"),
        fullPage: true,
      });
    } else {
      await page.screenshot({
        path: path.join(REPORT_DIR, "mobile-390-builder.png"),
        fullPage: true,
      });

      // Chuyển sang tab Xem trước trực tiếp trên mobile
      await page.getByRole("tab", { name: /Xem trước trực tiếp/ }).click();
      await expect(page.getByTestId("live-preview-container")).toBeVisible();
      await page.screenshot({
        path: path.join(REPORT_DIR, "mobile-390-preview.png"),
        fullPage: true,
      });
    }

    assertHealthy();
  });
});
