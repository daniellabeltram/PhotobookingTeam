// Must-have 1: happy path for each session type through the confirmation screen and email (stories 001, 005, 007, 008, 009, 020).
import { test, expect } from "@playwright/test";
import { acceptPolicies, reachPoliciesStep, submitBooking } from "./support/flow";
import { adminApi, ensureMiniDay } from "./support/admin";
import { emailFolders, emailsMentioning, icsFor } from "./support/outbox";
import { TYPE_NAMES, CLIENT, type TypeKey } from "../tests/helpers/seed";

const INSTANT: TypeKey[] = ["portraits", "couples", "families"];

test.describe("Booking happy paths", () => {
  for (const type of INSTANT) {
    test(`${TYPE_NAMES[type]}: pick, intake, policies, confirmation, email`, async ({ page }) => {
      await reachPoliciesStep(page, type);
      await acceptPolicies(page);
      await submitBooking(page, type);

      await expect(page.getByRole("heading", { level: 1, name: new RegExp(`You're booked, ${CLIENT.fullName.split(" ")[0]}`) })).toBeVisible();
      const ref = (await page.getByText(/DBP-[A-Z0-9]{6}/).first().innerText()).match(/DBP-[A-Z0-9]{6}/)![0];
      await expect(page.getByText(/Eastern Time/).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /Pay my retainer/ }).or(page.getByRole("button", { name: /Pay my retainer/ }))).toBeVisible();
      // By design (orchestrator ruling 2026-11-26): in v1 the calendar file goes by email only.
      await expect(page.getByRole("button", { name: /Add to calendar/ })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /Add to calendar/ })).toHaveCount(0);
      // 375px: no horizontal scroll (story 019 #2, 007 #7)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      // Email written to the outbox with the same reference.
      await expect.poll(() => emailsMentioning(ref).length, { message: "client + admin emails in outbox" }).toBeGreaterThanOrEqual(1);
      // The confirmation email carries the .ics (story 008 #3).
      await expect.poll(() => icsFor(ref, "booking_received").length, { message: "booking_received email has an .ics attachment" }).toBe(1);
      const ics = icsFor(ref, "booking_received")[0]!;
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("BEGIN:VEVENT");
      expect(ics).toContain(ref);
      expect(ics).toMatch(/DTSTART/);
    });
  }

  test("Events: request flow shows 'request', no payment, no calendar file", async ({ page }) => {
    await reachPoliciesStep(page, "events");
    await acceptPolicies(page);
    await submitBooking(page, "events");

    await expect(page.getByRole("heading", { level: 1, name: /Request (sent|received)/ })).toBeVisible();
    await expect(page.getByText(/not confirmed/i).first()).toBeVisible();
    await expect(page.getByText(/No payment is due yet|You won't be charged|isn't confirmed until/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Pay my retainer|Pay retainer/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Pay my retainer|Pay retainer/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Add to calendar/ })).toHaveCount(0);
    await expect(page.getByText(/held for \d+ hours/i)).toHaveCount(0);
    const ref = (await page.getByText(/DBP-[A-Z0-9]{6}/).first().innerText()).match(/DBP-[A-Z0-9]{6}/)![0];
    await expect.poll(() => emailsMentioning(ref).some((e) => /event request/i.test(e.text))).toBe(true);
    // A request email has no .ics (story 020 #5).
    expect(emailFolders(ref, "request_received").length).toBeGreaterThanOrEqual(1);
    expect(icsFor(ref, "request_received")).toHaveLength(0);
  });

  test("Holiday Minis: short form, books a mini slot", async ({ page, request, baseURL }) => {
    const admin = await adminApi(request, baseURL!);
    await ensureMiniDay(admin);
    await reachPoliciesStep(page, "minis");
    await acceptPolicies(page);
    await submitBooking(page, "minis");
    await expect(page.getByRole("heading", { level: 1, name: /You're booked|Your mini is booked/ })).toBeVisible();
    await expect(page.getByText(/DBP-[A-Z0-9]{6}/).first()).toBeVisible();
  });

  test("Conditional intake fields appear only for their session type (must-have 6)", async ({ page }) => {
    for (const [type, present, absent] of [
      ["couples", /What.s the occasion/, /Children.s ages/],
      ["families", /Children.s ages/, /What.s the occasion/],
    ] as const) {
      await page.goto("/");
      await page.getByRole("radio", { name: new RegExp(TYPE_NAMES[type]) }).first().click();
      await page.getByRole("button", { name: "Continue" }).click();
      const { pickFirstDayAndTime } = await import("./support/flow");
      await pickFirstDayAndTime(page);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByLabel(present)).toBeVisible();
      await expect(page.getByLabel(absent)).toHaveCount(0);
    }
  });

  test("Confirmation survives reload and has no booking data in the URL (story 007 #4)", async ({ page }) => {
    await reachPoliciesStep(page, "portraits");
    await acceptPolicies(page);
    await submitBooking(page, "portraits");
    await expect(page.getByRole("heading", { level: 1, name: /You're booked/ })).toBeVisible();
    expect(page.url()).not.toMatch(/DBP-|@|zelda/i);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /You're booked|Looking for your booking/ })).toBeVisible();
  });
});
