import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const SEARCH_ROUTE = "**/people-search/query";

async function signInAsSyntheticCompanyAdmin(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("careermate-v2-session", "demo-token-company-admin"));
}

const plan = {
  raw_query: "React trên 3 năm",
  required_skills: [{ phrase: "React", required: true }],
  preferred_skills: [],
  min_experience_years: 3,
  availability: null,
  needs_clarification: false,
  clarification_reason: null,
};

test("mocked UI: auth header, contract evidence, responsive overflow, basic a11y", async ({ page }, testInfo) => {
  await signInAsSyntheticCompanyAdmin(page);
  await page.route(SEARCH_ROUTE, async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer demo-token-company-admin");
    await route.fulfill({ json: {
      status: "ok",
      plan,
      candidates: [{
        user_id: "3a65de39-49f1-40c7-8f1d-df80a565d46e",
        name: "Nguyễn Văn A",
        title: "Kỹ sư phần mềm",
        company_id: "11395991-a669-475f-9af5-912afbbe554b",
        score: 91,
        score_version: "people-search-v1",
        factors: [{ code: "EXPERIENCE", label: "Kinh nghiệm", weight: 0.6, contribution: 91 }],
        evidence: [{ type: "employment", user_id: null, employment_id: "e1", job_title: null, title: "Kỹ sư", status: "ACTIVE", start_date: "2022-01-01", end_date: "" }],
      }],
      unsupported_reasons: ["Domain bắt buộc chưa có dữ liệu chuẩn hoá."],
      explanation: null,
      explanation_source: "deterministic_fallback",
    } });
  });

  await page.goto("/nhan-su/tim-kiem");
  await page.getByLabel("Mô tả yêu cầu tìm kiếm nhân sự").fill("Tìm nhân sự React");
  await page.getByLabel("Số năm kinh nghiệm tối thiểu").fill("3");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).last().click();

  await expect(page.getByText("Nguyễn Văn A")).toBeVisible();
  await expect(page.getByText("Giải thích AI chưa khả dụng", { exact: false })).toBeVisible();
  await expect(page.getByText("Không xem kết quả này là khớp đủ tiêu chí bắt buộc.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `../reports/people-search/${testInfo.project.name}.png`, fullPage: true });
});

test("mocked UI: clarification state", async ({ page }) => {
  await signInAsSyntheticCompanyAdmin(page);
  await page.route(SEARCH_ROUTE, (route) => route.fulfill({ json: {
    status: "needs_clarification",
    plan: { ...plan, needs_clarification: true, clarification_reason: "Vui lòng nêu rõ vai trò cần tuyển và kỹ năng bắt buộc." },
    candidates: [],
    unsupported_reasons: [],
    explanation: null,
    explanation_source: null,
  } }));
  await page.goto("/nhan-su/tim-kiem");
  await page.getByLabel("Mô tả yêu cầu tìm kiếm nhân sự").fill("Tìm người giỏi");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).last().click();
  await expect(page.getByText("Vui lòng nêu rõ vai trò cần tuyển và kỹ năng bắt buộc.")).toBeVisible();
});

test("real local API: browser-origin authenticated contract and CORS check", async ({ page }) => {
  test.skip(!process.env.CAREERMATE_LOCAL_API_TOKEN, "CAREERMATE_LOCAL_API_TOKEN chưa được cấp; không dùng credential cố định trong frontend.");
  const apiUrl = process.env.CAREERMATE_LOCAL_API_URL ?? "http://127.0.0.1:8131/api/v2";
  await page.goto("/login");
  const result = await page.evaluate(async ({ apiUrl, token }) => {
    const response = await fetch(`${apiUrl}/people-search/query`, {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Tìm kỹ sư phần mềm" }),
    });
    return { ok: response.ok, body: await response.json() };
  }, { apiUrl, token: process.env.CAREERMATE_LOCAL_API_TOKEN! });
  expect(result.ok).toBe(true);
  expect(result.body).toMatchObject({ plan: { raw_query: "Tìm kỹ sư phần mềm" }, candidates: expect.any(Array) });
});
