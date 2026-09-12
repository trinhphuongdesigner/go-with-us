import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

function monitorPageHealth(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    if (failure === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
    failures.push(`requestfailed: ${request.method()} ${request.url()} (${failure})`);
  });
  page.on("response", (response) => { if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`); });
  return () => expect(failures, "trang không được có lỗi console, runtime hoặc request").toEqual([]);
}

async function openAs(page: Page, account: "employee" | "company-admin" | "super-admin", path: string) {
  await page.addInitScript((token) => window.localStorage.setItem("careermate-v2-session", token), `demo-token-${account}`);
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
}

test("nhân viên xem, sửa hồ sơ và giữ phiên mới sau khi tải lại", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await openAs(page, "employee", "/ho-so");

  await expect(page.getByRole("heading", { name: "Nguyễn Khánh Linh" })).toBeVisible();
  await expect(page.getByText("Phiên hồ sơ 4")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Gợi ý từ Milo" })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
  await page.getByRole("textbox", { name: "Họ và tên" }).fill("Nguyễn Khánh Linh Demo");
  await page.getByRole("textbox", { name: "Chức danh hiện tại" }).fill("Senior Product Designer");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByText("Đã lưu hồ sơ")).toBeVisible();
  await expect(page.getByText("Phiên hồ sơ 5")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Nguyễn Khánh Linh Demo" })).toBeVisible();
  await expect(page.getByText("Phiên hồ sơ 5")).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  assertHealthy();
});

test("HR tìm kiếm danh sách và mở hồ sơ nhân sự ở chế độ chỉ đọc", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await openAs(page, "company-admin", "/nhan-su");

  await expect(page.getByRole("heading", { name: "Đội ngũ Acme Việt Nam" })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Tìm nhân sự" });
  await search.fill("không tồn tại");
  await expect(page.getByRole("heading", { name: "Không có kết quả phù hợp" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await page.getByRole("link", { name: "Xem hồ sơ của Nguyễn Khánh Linh" }).click();

  await expect(page).toHaveURL(/\/nhan-su\/demo-employee$/);
  await expect(page.getByRole("heading", { name: "Nguyễn Khánh Linh" })).toBeVisible();
  await expect(page.getByText("Hồ sơ chỉ đọc")).toBeVisible();
  await expect(page.getByRole("button", { name: /Chỉnh sửa/ })).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  assertHealthy();
});

test("super admin chọn tenant rõ ràng và giữ scope khi mở hồ sơ", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await openAs(page, "super-admin", "/nhan-su");

  const selector = page.getByRole("combobox", { name: "Chọn doanh nghiệp" });
  await expect(selector).toHaveValue("00000000-0000-5000-8000-000000000101");
  await expect(page.getByRole("heading", { name: "Đội ngũ Acme Việt Nam" })).toBeVisible();
  await page.getByRole("link", { name: "Xem hồ sơ của Nguyễn Khánh Linh" }).click();
  await expect(page).toHaveURL(/companyId=00000000-0000-5000-8000-000000000101/);
  await expect(page.getByRole("heading", { name: "Nguyễn Khánh Linh" })).toBeVisible();
  await expect(page.getByText("Hồ sơ chỉ đọc")).toBeVisible();
  assertHealthy();
});

test("đường dẫn nhân sự trực tiếp trả trạng thái 403 dễ hiểu cho nhân viên", async ({ page }) => {
  await openAs(page, "employee", "/nhan-su");
  await expect(page.getByRole("heading", { name: "Khu vực này không thuộc vai trò của bạn" })).toBeVisible();
  await page.goto("/nhan-su/demo-employee");
  await expect(page.getByRole("heading", { name: "Khu vực này không thuộc vai trò của bạn" })).toBeVisible();
});

test("profile và roster có empty, filtered-empty, error và stale với đường phục hồi", async ({ page }) => {
  await openAs(page, "employee", "/ho-so?state=empty");
  await expect(page.getByRole("heading", { name: "Hồ sơ của bạn đang chờ nội dung" })).toBeVisible();
  await page.goto("/ho-so?state=error");
  await expect(page.getByRole("heading", { name: "Chưa thể tải hồ sơ" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page).toHaveURL(/\/ho-so$/);
  await expect(page.getByRole("heading", { name: "Nguyễn Khánh Linh" })).toBeVisible();
  await page.goto("/ho-so?state=stale");
  await expect(page.getByRole("heading", { name: "Hồ sơ đã thay đổi ở nơi khác" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải lại hồ sơ" })).toBeVisible();

  await openAs(page, "company-admin", "/nhan-su?state=empty");
  await expect(page.getByRole("heading", { name: "Chưa có nhân sự trong danh sách" })).toBeVisible();
  await page.goto("/nhan-su?state=error");
  await expect(page.getByRole("heading", { name: "Chưa thể tải danh sách nhân sự" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page).toHaveURL(/\/nhan-su$/);
  await expect(page.getByRole("heading", { name: "Đội ngũ Acme Việt Nam" })).toBeVisible();

  await page.goto("/nhan-su/demo-employee?state=error");
  await expect(page.getByRole("heading", { name: "Chưa thể tải hồ sơ nhân sự" })).toBeVisible();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page).toHaveURL(/\/nhan-su\/demo-employee$/);
  await expect(page.getByRole("heading", { name: "Nguyễn Khánh Linh" })).toBeVisible();
});

test("hero hồ sơ và các điều khiển chính giữ kích thước dễ đọc, dễ chạm", async ({ page }, testInfo) => {
  await openAs(page, "employee", "/ho-so");
  for (const name of ["Mở menu chính", "Tìm kiếm", "Thông báo"]) {
    const button = page.getByRole("button", { name });
    if (testInfo.project.name !== "mobile-390" && name === "Mở menu chính") continue;
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  if (testInfo.project.name === "tablet-768") {
    const heading = await page.getByRole("heading", { name: "Nguyễn Khánh Linh" }).boundingBox();
    expect(heading?.height).toBeLessThanOrEqual(82);
  }

  await openAs(page, "company-admin", "/nhan-su");
  await page.getByRole("searchbox", { name: "Tìm nhân sự" }).fill("Linh");
  const clearSearch = page.getByRole("button", { name: "Xóa nội dung tìm kiếm" });
  const clearSearchBox = await clearSearch.boundingBox();
  expect(clearSearchBox?.width).toBeGreaterThanOrEqual(44);
  expect(clearSearchBox?.height).toBeGreaterThanOrEqual(44);
});

test("hồ sơ giữ LCP dưới ngân sách 2.5 giây trên dữ liệu demo", async ({ page }) => {
  await page.addInitScript(() => {
    const metrics = window as typeof window & { __careermateProfileLcp?: number };
    new PerformanceObserver((list) => {
      metrics.__careermateProfileLcp = list.getEntries().at(-1)?.startTime ?? metrics.__careermateProfileLcp;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await openAs(page, "employee", "/ho-so");
  await expect(page.getByRole("heading", { name: "Nguyễn Khánh Linh" })).toBeVisible();
  await page.waitForTimeout(250);
  const lcp = await page.evaluate(
    () => (window as typeof window & { __careermateProfileLcp?: number }).__careermateProfileLcp ?? 0,
  );
  expect(lcp, "trình duyệt phải ghi nhận Largest Contentful Paint của hồ sơ").toBeGreaterThan(0);
  expect(lcp).toBeLessThan(2_500);
});

test("profile dùng focus keyboard rõ và tắt chuyển động khi người dùng yêu cầu", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAs(page, "employee", "/ho-so");
  const edit = page.getByRole("button", { name: "Chỉnh sửa hồ sơ" });
  await edit.focus();
  await expect(edit).toBeFocused();
  const style = await edit.evaluate((element) => ({
    outlineWidth: getComputedStyle(element).outlineWidth,
    transitionDuration: getComputedStyle(element).transitionDuration,
  }));
  expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2);
  expect(["0.01ms", "0.00001s", "1e-05s"]).toContain(style.transitionDuration);
});
