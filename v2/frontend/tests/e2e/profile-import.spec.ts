import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const parsedImportId = "10000000-0000-4000-8000-000000000010";

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

async function openAsEmployee(page: Page, path: string) {
  await page.addInitScript(() => window.localStorage.setItem("careermate-v2-session", "demo-token-employee"));
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
}

test("nhập file, phân tích, duyệt nguồn và áp dụng chọn lọc", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await openAsEmployee(page, "/ho-so");
  await page.getByRole("link", { name: "Nhập hồ sơ từ tài liệu" }).click();
  await expect(page).toHaveURL(/\/ho-so\/import$/);
  await expect(page.getByRole("heading", { name: "Nhập hồ sơ từ tài liệu" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Gợi ý từ Milo" })).toBeVisible();
  const fileInput = page.locator('input[type="file"]');
  for (let index = 0; index < 20 && !(await fileInput.evaluate((element) => element === document.activeElement)); index += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(fileInput).toBeFocused();
  const pickerOutline = await page.locator('label[for="profile-import-file"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(pickerOutline).toEqual({ style: "solid", width: "3px" });

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);

  await fileInput.setInputFiles({ name: "wave1-profile.txt", mimeType: "text/plain", buffer: Buffer.from("Current role: Product Specialist") });
  await page.getByRole("button", { name: "Tải lên và kiểm tra" }).click();
  await expect(page).toHaveURL(/\/ho-so\/import\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Phân tích tài liệu" }).click();
  await expect(page.getByRole("heading", { name: "AI đã tạo đề xuất có dẫn nguồn" })).toBeVisible();
  await expect(page.getByText("Chuyên viên phát triển sản phẩm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cập nhật 1 mục" }).click();
  await expect(page.getByRole("heading", { name: "Hồ sơ đã được cập nhật" })).toBeVisible();
  assertHealthy();
});

test("hiển thị empty, error và stale với đường phục hồi", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await openAsEmployee(page, "/ho-so/import?state=empty");
  await expect(page.getByRole("heading", { name: "Chưa có tài liệu nào" })).toBeVisible();

  await page.goto("/ho-so/import?state=error");
  await expect(page.getByRole("heading", { name: "Chưa thể tải lịch sử" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();

  await page.goto(`/ho-so/import/${parsedImportId}?state=stale`);
  await expect(page.getByRole("heading", { name: "Hồ sơ đã thay đổi ở nơi khác" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cập nhật 1 mục" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Tải lại dữ liệu" })).toBeVisible();
  assertHealthy();
});

test("màn hình nhập hồ sơ đạt LCP và reduced motion trên production build", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const metrics = window as typeof window & { __careermateImportLcp?: number };
    new PerformanceObserver((list) => {
      metrics.__careermateImportLcp = list.getEntries().at(-1)?.startTime ?? metrics.__careermateImportLcp;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await openAsEmployee(page, "/ho-so/import");
  await expect(page.locator('meta[name="careermate-build-sha"]')).toHaveAttribute(
    "content",
    process.env.CAREERMATE_EXPECTED_SHA!,
  );
  await page.waitForTimeout(250);
  const lcp = await page.evaluate(
    () => (window as typeof window & { __careermateImportLcp?: number }).__careermateImportLcp ?? 0,
  );
  expect(lcp).toBeGreaterThan(0);
  expect(lcp).toBeLessThan(2_500);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.focus();
  const transitionDuration = await page.locator('label[for="profile-import-file"]').evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(["0.01ms", "0.00001s", "1e-05s"]).toContain(transitionDuration);

  if (page.viewportSize()?.width === 768) {
    const overviewLabel = page.getByRole("link", { name: "Tổng quan" }).locator("span").last();
    const box = await overviewLabel.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
    expect(box.scrollHeight).toBeLessThanOrEqual(box.clientHeight);
    const fontSize = await overviewLabel.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(12);
  }
});
