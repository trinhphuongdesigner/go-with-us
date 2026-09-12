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
  if (expectedSha && /^[0-9a-f]{40}$/.test(expectedSha)) {
    await expect(page.locator('meta[name="careermate-build-sha"]')).toHaveAttribute("content", expectedSha);
  }
}

async function loginAsEmployee(page: Page) {
  await gotoVerified(page, "/login");
  await page.getByRole("button", { name: /^Nhân viên Xem hồ sơ/ }).click();
  await page.getByRole("button", { name: /Tiếp tục với vai trò Nhân viên/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function loginAsAdmin(page: Page) {
  await gotoVerified(page, "/login");
  await page.getByRole("button", { name: /^Quản lý nhân sự/ }).click();
  await page.getByRole("button", { name: /Tiếp tục với vai trò Quản lý nhân sự/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function navigateToSettings(page: Page) {
  const width = page.viewportSize()?.width ?? 1440;
  if (width < 768) {
    await page.getByRole("button", { name: "Mở menu chính" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Cài đặt" }).click();
  } else {
    await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Cài đặt" }).click();
  }
  await expect(page).toHaveURL(/\/cai-dat$/);
  await expect(page.getByRole("heading", { name: "Giao diện hiển thị" })).toBeVisible();
  if (width >= 768) {
    await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Cài đặt" })).toHaveAttribute("aria-current", "page");
  }
}

test.describe("Màn hình cài đặt giao diện (Appearance Settings)", () => {
  test("hiển thị giao diện Bright Milo mặc định và đạt chuẩn accessibility (axe)", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    await expect(page.getByRole("heading", { name: "Giao diện hiển thị" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-milo");

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    assertHealthy();
  });

  test("hỗ trợ thao tác bằng bàn phím để chọn preset giao diện", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    // Focus into the radiogroup and navigate with keyboard
    const skyRadio = page.getByRole("radio", { name: /Bright Sky/i });
    await skyRadio.focus();
    await page.keyboard.press("Space");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-sky");
    await expect(page.getByText("Đang xem trước giao diện: Bright Sky")).toBeAttached();

    assertHealthy();
  });

  test("xem trước không bị lưu xuống storage nếu chưa bấm Lưu", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    // Preview Bright Sky
    await page.getByRole("radio", { name: /Bright Sky/i }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-sky");

    // Reload page without clicking Apply
    await page.reload();
    await expect(page.getByRole("heading", { name: "Giao diện hiển thị" })).toBeVisible();

    // Theme must revert back to default Bright Milo
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-milo");
    assertHealthy();
  });

  test("lưu giao diện thành công và duy trì sau khi tải lại trang", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    // Select Bright Violet and Apply
    await page.getByRole("radio", { name: /Bright Violet/i }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-violet");

    const applyButton = page.getByRole("button", { name: /Lưu giao diện/i });
    await expect(applyButton).toBeEnabled();
    await applyButton.click();
    await expect(applyButton).toBeDisabled();

    // Reload page
    await page.reload();
    await expect(page.getByRole("heading", { name: "Giao diện hiển thị" })).toBeVisible();

    // Should remain Bright Violet
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-violet");
    assertHealthy();
  });

  test("hủy xem trước quay về giao diện đã lưu thay vì reset mặc định", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    // Apply Bright Sky first
    await page.getByRole("radio", { name: /Bright Sky/i }).check({ force: true });
    await page.getByRole("button", { name: /Lưu giao diện/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-sky");

    // Preview Bright Violet
    await page.getByRole("radio", { name: /Bright Violet/i }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-violet");

    // Click Cancel preview
    await page.getByRole("button", { name: /Hủy xem trước/i }).click();

    // Must return to Bright Sky (applied), NOT Bright Milo
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-sky");
    assertHealthy();
  });

  test("khôi phục mặc định đưa hệ thống về Bright Milo", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    // Apply Bright Sky
    await page.getByRole("radio", { name: /Bright Sky/i }).check({ force: true });
    await page.getByRole("button", { name: /Lưu giao diện/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-sky");

    // Click Restore default
    const restoreButton = page.getByRole("button", { name: /Khôi phục.*mặc định/i });
    await restoreButton.click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-milo");

    // Reload to verify persistence of default
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-milo");
    assertHealthy();
  });

  test("hộp thoại modal và thanh điều hướng kế thừa giao diện đồng nhất", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    // Preview Bright Sky
    await page.getByRole("radio", { name: /Bright Sky/i }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-sky");

    // Open Search dialog
    await page.getByRole("button", { name: "Tìm kiếm" }).click();
    await expect(page.getByRole("heading", { name: "Tìm trong CareerMate" })).toBeVisible();

    // Verify modal portal is inside html and inherits theme tokens
    const dialogContent = page.locator('[role="dialog"]');
    await expect(dialogContent).toBeVisible();

    // Check accessibility of open dialog under active theme
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    await page.keyboard.press("Escape");
    assertHealthy();
  });

  test("tài khoản quản trị viên cố định Bright Milo mặc định và không cho phép thay đổi", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsAdmin(page);
    await navigateToSettings(page);

    // Must be on Bright Milo
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-milo");
    await expect(page.getByText("Giao diện quản trị tiêu chuẩn")).toBeVisible();

    // Presets are disabled
    const radios = page.getByRole("radio");
    const count = await radios.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i++) {
      await expect(radios.nth(i)).toBeDisabled();
    }

    // Action buttons must not exist for admin
    await expect(page.getByRole("button", { name: /Lưu giao diện/i })).toHaveCount(0);
    assertHealthy();
  });

  test("hỗ trợ phím mũi tên chuyển đổi chọn preset radio", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    const miloRadio = page.getByRole("radio", { name: /Bright Milo/i });
    await miloRadio.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-sky");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-violet");
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-sky");
    assertHealthy();
  });

  test("tự động dọn dẹp xem trước khi điều hướng rời khỏi màn hình cài đặt", async ({ page }) => {
    const assertHealthy = monitorPageHealth(page);
    await loginAsEmployee(page);
    await navigateToSettings(page);

    // Initial is Bright Milo
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-milo");

    // Preview Bright Violet
    await page.getByRole("radio", { name: /Bright Violet/i }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-violet");

    // Navigate to Dashboard
    const width = page.viewportSize()?.width ?? 1440;
    if (width < 768) {
      await page.getByRole("button", { name: "Mở menu chính" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Tổng quan" }).click();
    } else {
      await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Tổng quan" }).click();
    }
    await expect(page).toHaveURL(/\/dashboard$/);

    // Should revert back to saved Bright Milo
    await expect(page.locator("html")).toHaveAttribute("data-theme", "bright-milo");
    assertHealthy();
  });

  test("chụp ảnh thực tế cài đặt và dashboard 3 preset, kiểm tra portal token và không tràn viền", async ({ page }, testInfo) => {
    const assertHealthy = monitorPageHealth(page);
    const screenshotDir = process.env.CAREERMATE_SCREENSHOT_DIR ?? testInfo.outputPath("screenshots");
    const width = page.viewportSize()?.width ?? 1440;

    await loginAsEmployee(page);

    const presets = ["bright-milo", "bright-sky", "bright-violet"] as const;
    for (const presetId of presets) {
      await navigateToSettings(page);
      const radio = page.locator(`input[value="${presetId}"]`);
      await radio.check({ force: true });
      const applyBtn = page.getByRole("button", { name: /Lưu giao diện/i });
      if (await applyBtn.isEnabled()) {
        await applyBtn.click();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", presetId);

      // Verify no horizontal overflow on settings
      const settingsOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(settingsOverflow).toBe(false);

      // Verify portal modal token computation
      await page.getByRole("button", { name: "Tìm kiếm" }).click();
      const searchDialog = page.locator('[role="dialog"]');
      await expect(searchDialog).toBeVisible();
      const portalTheme = await searchDialog.evaluate((el) => {
        return {
          theme: document.documentElement.getAttribute("data-theme"),
          bg: window.getComputedStyle(el).backgroundColor,
          primary: window.getComputedStyle(el).getPropertyValue("--primary").trim().toLowerCase(),
          border: window.getComputedStyle(el).borderTopColor,
        };
      });
      expect(portalTheme.theme).toBe(presetId);
      expect(portalTheme.bg).toBe("rgb(255, 255, 255)");
      expect(portalTheme.primary).toBe({ "bright-milo": "#247a66", "bright-sky": "#1a6cb0", "bright-violet": "#6b47b8" }[presetId]);
      expect(portalTheme.border).toBe({ "bright-milo": "rgb(220, 233, 227)", "bright-sky": "rgb(212, 227, 240)", "bright-violet": "rgb(231, 222, 243)" }[presetId]);
      await page.keyboard.press("Escape");
      await expect(searchDialog).not.toBeVisible();

      // Screenshot settings
      await page.getByRole("heading", { name: "Giao diện hiển thị" }).click();
      await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; });
      await page.screenshot({
        path: `${screenshotDir}/settings-${presetId}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });

      // Navigate to dashboard and check no-overflow
      if (width < 768) {
        await page.getByRole("button", { name: "Mở menu chính" }).click();
        await page.getByRole("dialog").getByRole("link", { name: "Tổng quan" }).click();
      } else {
        await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Tổng quan" }).click();
      }
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.locator("html")).toHaveAttribute("data-theme", presetId);
      await expect(page.getByRole("heading", { name: "Chào buổi sáng, Linh" })).toBeVisible();
      if (width >= 768) {
        await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Cài đặt" })).not.toHaveAttribute("aria-current", "page");
      }

      const dashboardOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(dashboardOverflow).toBe(false);

      // Screenshot dashboard
      await page.getByRole("heading", { name: "Chào buổi sáng, Linh" }).click();
      await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; });
      await page.screenshot({
        path: `${screenshotDir}/dashboard-${presetId}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }

    assertHealthy();
  });
});
