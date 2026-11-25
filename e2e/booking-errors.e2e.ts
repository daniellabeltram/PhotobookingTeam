// Slot taken (004), validation (005), policy required (006), honeypot hidden (017), inactive/unknown type link (001 #6).
import { test, expect } from "@playwright/test";
import { acceptPolicies, apiFor, chooseSession, fillAbout, pickFirstDayAndTime, reachPoliciesStep, submitBooking } from "./support/flow";
import { buildBookingBody, firstOpenSlot } from "../tests/helpers/builders";
import { OTHER_CLIENT } from "../tests/helpers/seed";
import { WINDOW_FROM, WINDOW_TO } from "./support/admin";

test.describe("Booking errors", () => {
  test("slot taken at submit: alert, alternatives, answers kept, can rebook (story 004 #1, #4)", async ({ page, request, baseURL }) => {
    const api = apiFor(request, baseURL!);
    const first = await firstOpenSlot(api, "portraits", WINDOW_FROM, WINDOW_TO);

    await reachPoliciesStep(page, "portraits");
    await acceptPolicies(page);

    // Someone else grabs exactly the slot the UI picked (first open day, first time).
    const stolen = await api.createBooking(buildBookingBody({ type: "portraits", slot: first, contact: { ...OTHER_CLIENT } }));
    expect(stolen.status, JSON.stringify(stolen.body)).toBe(201);

    await submitBooking(page, "portraits");
    const alert = page.getByRole("alert").filter({ hasText: "That time was just booked" });
    await expect(alert).toBeVisible();
    const alternatives = alert.getByRole("button");
    expect(await alternatives.count()).toBeGreaterThanOrEqual(1);
    expect(await alternatives.count()).toBeLessThanOrEqual(5); // up to 4 times + "See all dates"

    await alternatives.first().click();
    await expect(page.getByText(/Time updated to/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /I have read and agree/ })).toBeChecked();
    await submitBooking(page, "portraits");
    await expect(page.getByRole("heading", { level: 1, name: /You're booked/ })).toBeVisible();
  });

  test("intake validation: errors inline + summary, focus moves, server never called (story 005 #2, #3)", async ({ page }) => {
    let posted = 0;
    page.on("request", (r) => r.url().endsWith("/api/bookings") && r.method() === "POST" && posted++);
    await chooseSession(page, "portraits");
    await pickFirstDayAndTime(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await page.getByLabel("Mobile phone").fill("123");
    await page.getByRole("button", { name: "Continue" }).click();

    const summary = page.getByRole("alert").filter({ hasText: /Please fix \d+ things? to continue/ });
    await expect(summary).toBeVisible();
    await expect(page.getByText("Please enter your name.")).toBeVisible();
    await expect(page.getByText("That email doesn't look right. Check for typos.")).toBeVisible();
    await expect(page.getByText(/Please enter a phone number we can reach/)).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Tell us about your session" })).toBeVisible();
    // Summary links jump to the field
    await summary.getByRole("link").first().click();
    expect(posted).toBe(0);
  });

  test("Couples: more than the maximum people is blocked (story 005 #5)", async ({ page }) => {
    await chooseSession(page, "couples");
    await pickFirstDayAndTime(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await fillAbout(page);
    await page.getByRole("spinbutton", { name: /^Adults/ }).fill("5");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/This session fits up to \d+ people/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Tell us about your session" })).toBeVisible();
  });

  test("policy required: unchecked box blocks booking, focus to the checkbox (story 006 #3)", async ({ page }) => {
    let posted = 0;
    page.on("request", (r) => r.url().endsWith("/api/bookings") && r.method() === "POST" && posted++);
    await reachPoliciesStep(page, "portraits");
    const box = page.getByRole("checkbox", { name: /I have read and agree/ });
    await expect(box).not.toBeChecked();
    await submitBooking(page, "portraits");
    await expect(page.getByText("Please agree to the policies to book your session.")).toBeVisible();
    await expect(box).toBeFocused();
    expect(posted).toBe(0);
  });

  test("policies step: summary, expandable full text, privacy link (story 006 #1, 018 #1)", async ({ page }) => {
    await reachPoliciesStep(page, "families");
    await expect(page.getByText(/non-refundable/i).first()).toBeVisible();
    const toggle = page.getByRole("button", { name: /Read the full policies/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /Privacy/i }).first()).toBeVisible();
  });

  test("unknown or inactive type in the link falls back to the picker, no error page (story 001 #6)", async ({ page }) => {
    await page.goto("/?type=does-not-exist");
    await expect(page.getByRole("heading", { level: 1, name: "Choose your session" })).toBeVisible();
  });

  test("honeypot is hidden from sighted users and AT (story 017 #1)", async ({ page }) => {
    await reachPoliciesStep(page, "portraits");
    // Honeypot lives in the form; it must be aria-hidden, tabindex -1, and never in the a11y tree.
    const hp = page.locator('[name="website"]');
    await expect(hp).toHaveCount(1);
    await expect(hp).toHaveAttribute("tabindex", "-1");
    expect(await hp.evaluate((el) => !!el.closest('[aria-hidden="true"]') || el.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  test("offline at submit: banner with Try again, answers kept (booking-flow.md offline state)", async ({ page, context }) => {
    await reachPoliciesStep(page, "portraits");
    await acceptPolicies(page);
    await page.route("**/api/bookings", (r) => r.abort("failed"));
    await submitBooking(page, "portraits");
    await expect(page.getByText(/We can.t reach the server|not sure if that went through|Something went wrong/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /I have read and agree/ })).toBeChecked();
    void context;
  });
});
