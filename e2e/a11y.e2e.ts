// Axe scans on every page (story 019 #1, #2, #3). Fails on serious or critical WCAG 2.1 A/AA violations.
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { acceptPolicies, chooseSession, fillIntake, pickFirstDayAndTime, submitBooking } from "./support/flow";
import { adminLoggedIn, adminApi, seedBooking } from "./support/admin";

async function scan(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${name}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), `${name} axe`).toEqual([]);
  // Story 019 #2: no horizontal page scroll.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${name} horizontal scroll`).toBe(true);
}

test.describe("Accessibility: client pages", () => {
  test("all five booking steps", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Choose your session" })).toBeVisible();
    await scan(page, "step 1 session");
    await chooseSession(page, "families");
    await scan(page, "step 2 date (before choosing)");
    await pickFirstDayAndTime(page);
    await scan(page, "step 2 date (time chosen)");
    await page.getByRole("button", { name: "Continue" }).click();
    await scan(page, "step 3 intake (pristine)");
    await page.getByRole("button", { name: "Continue" }).click();
    await scan(page, "step 3 intake (errors shown)");
    await fillIntake(page, "families");
    await page.getByRole("button", { name: "Continue" }).click();
    await scan(page, "step 4 policies");
    await page.getByRole("button", { name: /Read the full policies/ }).click();
    await scan(page, "step 4 policies (expanded)");
    await acceptPolicies(page);
    await submitBooking(page, "families");
    await expect(page.getByRole("heading", { level: 1, name: /You're booked/ })).toBeVisible();
    await scan(page, "step 5 confirmation");
  });

  for (const path of ["/policies.html", "/privacy.html"]) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await scan(page, path);
    });
  }

  test("no third-party scripts or trackers in the booking flow (story 018 #6)", async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url()); });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(external).toEqual([]);
  });
});

test.describe("Accessibility: admin pages", () => {
  test("login, list, detail, blocked dates, minis", async ({ page, request, baseURL }) => {
    await page.goto("/admin/");
    await expect(page.getByRole("heading", { level: 1, name: "Admin sign in" })).toBeVisible();
    await scan(page, "admin login");

    const api = await adminApi(request, baseURL!);
    await seedBooking(api, "portraits", { nth: 15 });
    await adminLoggedIn(page);
    await scan(page, "admin list");
    await page.getByRole("link", { name: /Portraits/ }).first().click();
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await scan(page, "admin detail");
    await page.goto("/admin/");
    await page.getByRole("link", { name: "Blocked dates" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Blocked dates" })).toBeVisible();
    await scan(page, "admin blocked dates");
    await page.getByRole("link", { name: "Add minis slots" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Add Holiday Minis slots" })).toBeVisible();
    await scan(page, "admin minis");
  });
});
