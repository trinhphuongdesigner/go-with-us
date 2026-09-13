import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

function monitorPageHealth(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    const isCancelledNextNavigation = failure === "net::ERR_ABORTED" && request.url().includes("_rsc=");
    if (isCancelledNextNavigation) return;
    failures.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText})`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`response: ${response.status()} ${response.url()}`);
  });
  return () => expect(failures, "trang không được có lỗi console, runtime hoặc request").toEqual([]);
}

async function gotoVerified(page: Page, path: string) {
  await page.goto(path);
  const expectedSha = process.env.CAREERMATE_EXPECTED_SHA;
  expect(expectedSha, "E2E phải được gắn với SHA đầy đủ").toMatch(/^[0-9a-f]{40}$/);
  await expect(page.locator('meta[name="careermate-build-sha"]')).toHaveAttribute("content", expectedSha!);
}

test("root layout không thay đổi API chuẩn của trình duyệt", async ({ page }) => {
  await page.addInitScript(() => {
    const runtime = window as typeof window & {
      __nativeSetAttribute?: typeof Element.prototype.setAttribute;
    };
    runtime.__nativeSetAttribute = Element.prototype.setAttribute;
  });

  await gotoVerified(page, "/login");

  expect(
    await page.evaluate(() => {
      const runtime = window as typeof window & {
        __nativeSetAttribute?: typeof Element.prototype.setAttribute;
      };
      return {
        setAttribute: runtime.__nativeSetAttribute === Element.prototype.setAttribute,
        extensionGuardScripts: Array.from(document.scripts).filter((script) =>
          script.textContent?.includes("bis_skin_checked"),
        ).length,
      };
    }),
  ).toEqual({ setAttribute: true, extensionGuardScripts: 0 });
});

test("đăng nhập bằng tài khoản mẫu và lọc navigation theo quyền", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await gotoVerified(page, "/login");
  await expect(page.getByRole("heading", { name: "Mở không gian CareerMate" })).toBeVisible();

  await page.getByRole("button", { name: /^Nhân viên Xem hồ sơ/ }).click();
  await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chào buổi sáng");

  const width = page.viewportSize()?.width ?? 1440;
  if (width < 768) {
    await page.getByRole("button", { name: "Mở menu chính" }).click();
  }
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Lộ trình phát triển" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đội ngũ" })).toHaveCount(0);
  assertHealthy();
});

test("login có thể thao tác bằng bàn phím và đạt kiểm tra accessibility tự động", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await gotoVerified(page, "/login");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  assertHealthy();
});

test("chặn URL quản trị trực tiếp và dashboard đạt kiểm tra accessibility", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await gotoVerified(page, "/login");
  await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const dashboardResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(dashboardResults.violations).toEqual([]);

  await gotoVerified(page, "/he-thong");
  await expect(page.getByRole("heading", { name: "Khu vực này không thuộc vai trò của bạn" })).toBeVisible();
  await expect(page.getByText("Quản trị hệ thống", { exact: true })).toHaveCount(0);
  assertHealthy();
});

test("lộ trình Milo hiển thị và hỗ trợ chỉnh thứ tự bằng bàn phím", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await gotoVerified(page, "/login");
  await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).click();
  await gotoVerified(page, "/lo-trinh");
  await expect(page.getByRole("heading", { name: "Lộ trình phát triển của bạn" })).toBeVisible();
  const visibleMilo = page.locator('img[alt^="Milo"]:visible');
  await expect(visibleMilo).toBeVisible();
  await expect
    .poll(() => visibleMilo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
    .toBe(true);
  await page.getByRole("button", { name: "Tùy chỉnh lộ trình" }).click();

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("button", { name: "Thêm bước" }).click();
  await expect(page.locator('input[value="Bước phát triển mới"]:visible')).toBeVisible();
  await expect(page.locator('[data-testid="roadmap-milestone-leadership"]:visible')).toBeVisible();

  const moveDown = page.getByRole("button", { name: "Di chuyển Nền tảng xuống" });
  await moveDown.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nền tảng đã được di chuyển xuống.")).toBeAttached();
  await page.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(page.getByText(/Bản nháp v4/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Bản nháp v4/)).toBeVisible();
  await expect(page.locator('[data-testid="roadmap-milestone-feedback"]:visible')).toBeVisible();
  await expect(page.locator('[data-testid^="roadmap-milestone-"]:visible').first()).toContainText("Giao tiếp & phản hồi");
  assertHealthy();
});

test("bản nháp lộ trình không rò sang tài khoản khác trên cùng trình duyệt", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await gotoVerified(page, "/login");
  await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).click();
  await gotoVerified(page, "/lo-trinh");
  await page.getByRole("button", { name: "Tùy chỉnh lộ trình" }).click();
  await page.locator('input[id^="milestone-title-"]:visible').first().fill("Lộ trình riêng của Linh");
  await page.getByRole("button", { name: "Lưu bản nháp" }).click();

  await page.evaluate(() => window.localStorage.removeItem("careermate-v2-session"));
  await gotoVerified(page, "/login");
  await page.getByRole("button", { name: /^Quản lý nhân sự Theo dõi đội ngũ/ }).click();
  await page.getByRole("button", { name: /Tiếp tục với vai trò Quản lý nhân sự/ }).click();
  await gotoVerified(page, "/lo-trinh");

  await expect(page.getByText("Lộ trình riêng của Linh")).toHaveCount(0);
  await expect(page.getByText(/Bản nháp v3/)).toBeVisible();
  assertHealthy();
});

test("dialog tìm kiếm, thông báo và menu di động đạt accessibility", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await gotoVerified(page, "/login");
  await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Tìm kiếm" }).click();
  let results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Đóng tìm kiếm" }).click();

  await page.getByRole("button", { name: "Thông báo" }).click();
  results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Đóng thông báo" }).click();

  if ((page.viewportSize()?.width ?? 1440) < 768) {
    await page.getByRole("button", { name: "Mở menu chính" }).click();
    results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);
  }
  assertHealthy();
});

test("dashboard hiển thị rõ trạng thái rỗng và lỗi", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await gotoVerified(page, "/login");
  await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).click();
  await gotoVerified(page, "/dashboard?state=empty");
  await expect(page.getByRole("heading", { name: "Chưa có dữ liệu tổng quan" })).toBeVisible();

  await gotoVerified(page, "/dashboard?state=error");
  await expect(page.getByRole("heading", { name: "Chưa thể tải tổng quan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  assertHealthy();
});

test("dashboard giữ LCP dưới ngân sách 2.5 giây trên dữ liệu demo", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("careermate-v2-session", "demo-token-employee");
    const metrics = window as typeof window & { __careermateLcp?: number };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      metrics.__careermateLcp = entries.at(-1)?.startTime ?? metrics.__careermateLcp;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await gotoVerified(page, "/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chào buổi sáng");
  await page.waitForTimeout(250);
  const lcp = await page.evaluate(() => (window as typeof window & { __careermateLcp?: number }).__careermateLcp ?? 0);
  expect(lcp, "trình duyệt phải ghi nhận Largest Contentful Paint").toBeGreaterThan(0);
  expect(lcp).toBeLessThan(2_500);
});

test("reduced motion vô hiệu hóa chuyển động dài và bàn phím vẫn vào được hành động chính", async ({ page }) => {
  const assertHealthy = monitorPageHealth(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoVerified(page, "/login");

  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  const transitionDuration = await focused.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(["0.01ms", "0.00001s", "1e-05s"]).toContain(transitionDuration);

  await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);
  assertHealthy();
});
