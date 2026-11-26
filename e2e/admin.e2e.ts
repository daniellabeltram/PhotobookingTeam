// Admin: login required (010), approve/decline (013, 020), cancel frees the slot (013 #4), blocked dates (015), CSV (016).
import { test, expect } from "@playwright/test";
import { adminApi, adminLogin, adminLoggedIn, seedBooking, WINDOW_FROM, WINDOW_TO } from "./support/admin";
import { apiFor } from "./support/flow";
import { firstOpenSlot, parseCsv } from "../tests/helpers/builders";
import { addDays, longDayLabel } from "../tests/helpers/clock";
import { CLIENT, ADMIN_EMAIL } from "../tests/helpers/seed";

test.describe("Admin access", () => {
  test("not signed in: admin shows login, no booking data, API refuses (story 010 #1, #2)", async ({ page, request, baseURL }) => {
    const responses: string[] = [];
    page.on("response", async (r) => r.url().includes("/api/admin/") && responses.push(`${r.status()} ${r.url()}`));
    await page.goto("/admin/");
    await expect(page.getByRole("heading", { level: 1, name: "Admin sign in" })).toBeVisible();
    expect(await page.content()).not.toContain(CLIENT.email);
    expect(responses.every((r) => r.startsWith("401"))).toBe(true);
    const r = await apiFor(request, baseURL!).get("/api/admin/bookings");
    expect(r.status).toBe(401);
  });

  test("wrong password: same message, no hint which part was wrong (story 010 #4)", async ({ page }) => {
    await adminLogin(page, ADMIN_EMAIL, "definitely-the-wrong-passphrase");
    await expect(page.getByRole("alert").filter({ hasText: "match" }).first()).toContainText("That email and password don't match. Please try again.");
    await adminLogin(page, "nobody@example.test", "definitely-the-wrong-passphrase");
    await expect(page.getByRole("alert").filter({ hasText: "match" }).first()).toContainText("That email and password don't match. Please try again.");
  });

  test("sign in, sign out, back button shows no data (story 010 #6)", async ({ page, request, baseURL }) => {
    await seedBooking(await adminApi(request, baseURL!), "portraits", { nth: 20 });
    await adminLoggedIn(page);
    await expect(page.getByText(CLIENT.fullName).first()).toBeVisible();
    await page.getByRole("link", { name: "Blocked dates" }).click(); // pushes a history entry we can go Back to
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Admin sign in" })).toBeVisible();
    await page.goBack();
    // After Back the visitor must see the sign-in screen (or at least no client data) and never a blank page.
    await expect(page.getByRole("heading", { level: 1, name: "Admin sign in" }), "Back after sign out should land on the login screen").toBeVisible();
    expect(await page.getByText(CLIENT.fullName).count()).toBe(0);
  });
});

test.describe("Admin bookings", () => {
  test("list shows a new booking; filters live in the URL; detail shows intake and policy (011, 012)", async ({ page, request, baseURL }) => {
    const admin = await adminApi(request, baseURL!);
    const { reference } = await seedBooking(admin, "families", { nth: 3 });
    await adminLoggedIn(page);
    await expect(page.getByText(CLIENT.fullName).first()).toBeVisible();
    await page.goto(`/admin/#/bookings/${reference}`);
    await expect(page).toHaveTitle(new RegExp(`Booking ${reference}`));
    await expect(page.getByRole("link", { name: /561.*555.*0142/ })).toHaveAttribute("href", /^tel:/);
    await expect(page.getByRole("link", { name: CLIENT.email })).toHaveAttribute("href", /^mailto:/);
    await expect(page.getByText(CLIENT.childrenAges)).toBeVisible();
    await expect(page.getByText(/Accepted v0\.1-draft|v0\.1-draft/)).toBeVisible();
    await page.getByRole("link", { name: /All bookings/ }).click();
    await page.goto("/admin/#/bookings?status=confirmed&view=all");
    expect(page.url()).toContain("status=confirmed");
  });

  test("Events request: approve moves to Pending deposit (020 #11)", async ({ page, request, baseURL }) => {
    const admin = await adminApi(request, baseURL!);
    const { reference } = await seedBooking(admin, "events", { nth: 2, durationMin: 120 });
    await adminLoggedIn(page);
    await page.goto(`/admin/#/bookings/${reference}`); // open exactly the booking we seeded
    await expect(page.getByRole("button", { name: "Mark deposit paid" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
    await page.getByRole("button", { name: "Approve request" }).click();
    const dlg = page.getByRole("alertdialog");
    await expect(dlg).toContainText("Approve this request?");
    await dlg.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Pending deposit").first()).toBeVisible();
    const d = await admin.get(`/api/admin/bookings/${reference}`);
    expect(d.body.data.status).toBe("pending_deposit");
  });

  test("Events request: decline frees the slot (020 #16)", async ({ page, request, baseURL }) => {
    const admin = await adminApi(request, baseURL!);
    const { reference, slot } = await seedBooking(admin, "events", { nth: 5, durationMin: 120 });
    await adminLoggedIn(page);
    await page.goto(`/admin/#/bookings/${reference}`); // open exactly the booking we seeded
    await page.getByRole("button", { name: "Decline" }).first().click();
    const dlg = page.getByRole("alertdialog");
    await expect(dlg).toContainText("Decline this request?");
    await dlg.getByRole("button", { name: "Decline request" }).click();
    await expect(page.getByText("Declined").first()).toBeVisible();
    const open = await admin.availability("events", slot.localDate, slot.localDate, 120);
    expect(open.body.data.days[0]!.slots.map((s: any) => s.startUtc)).toContain(slot.startUtc);
  });

  test("cancel: dialog says the slot is freed; slot is offered again (013 #4, must-have 8)", async ({ page, request, baseURL }) => {
    const admin = await adminApi(request, baseURL!);
    const { reference, slot } = await seedBooking(admin, "couples", { nth: 6 });
    const before = await admin.availability("couples", slot.localDate, slot.localDate);
    expect(before.body.data.days[0]!.slots.map((s: any) => s.startUtc)).not.toContain(slot.startUtc);

    await adminLoggedIn(page);
    await page.goto(`/admin/#/bookings/${reference}`); // open exactly the booking we seeded
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const dlg = page.getByRole("alertdialog");
    await expect(dlg).toContainText(/frees .* so someone else can book it/);
    await expect(dlg.getByRole("button", { name: "Keep booking" })).toBeFocused();
    const reason = dlg.getByLabel(/reason/i);
    if (await reason.count()) await reason.selectOption({ index: 1 });
    await dlg.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByText(/Cancelled/).first()).toBeVisible();

    const after = await admin.availability("couples", slot.localDate, slot.localDate);
    expect(after.body.data.days[0]!.slots.map((s: any) => s.startUtc)).toContain(slot.startUtc);
    const d = await admin.get(`/api/admin/bookings/${reference}`);
    expect(d.body.data.status).toBe("cancelled");
    expect(d.body.data.history.at(-1).toStatus).toBe("cancelled");
  });
});

test.describe("Blocked dates", () => {
  test("blocking a date removes it for clients; removing the block restores it (015 #1, #2, #5)", async ({ page, request, baseURL }) => {
    const admin = await adminApi(request, baseURL!);
    const slot = await firstOpenSlot(admin, "portraits", addDays(WINDOW_FROM, 20), WINDOW_TO);
    const date = slot.localDate;

    await adminLoggedIn(page);
    await page.getByRole("link", { name: "Blocked dates" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Blocked dates" })).toBeVisible();
    await page.getByLabel("From date").fill(date);
    await page.getByLabel("To date").fill(date);
    expect.soft(await page.getByLabel("Reason (optional, private)").count(), 'Label should be "Reason (optional, private)" (admin.md section 5)').toBe(1);
    await page.getByLabel(/^Reason/).fill("QA weather backup");
    await page.getByRole("button", { name: "Block these dates" }).click();
    await expect(page.getByText(/Dates blocked/)).toBeVisible();

    const blocked = await admin.availability("portraits", date, date);
    expect(blocked.body.data.days.find((d: any) => d.date === date)?.slots ?? []).toHaveLength(0);
    expect(JSON.stringify((await admin.get("/api/availability?type=portraits&from=" + date + "&to=" + date)).body)).not.toContain("QA weather backup");

    // Client calendar shows the day as unavailable.
    await page.goto("/");
    await page.getByRole("radio", { name: /Portraits/ }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();
    const [y, m] = date.split("-");
    for (let i = 0; i < 6; i++) {
      if (await page.getByRole("gridcell", { name: new RegExp(`${longDayLabel(date)}, unavailable`) }).count()) break;
      await page.getByRole("button", { name: "Next month" }).click();
    }
    await expect(page.getByRole("gridcell", { name: new RegExp(`${longDayLabel(date)}, unavailable`) })).toBeVisible();
    void y; void m;

    // Remove it again
    await page.goto("/admin/");
    await page.getByRole("link", { name: "Blocked dates" }).click();
    await page.getByRole("button", { name: /Remove block/ }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove block" }).click();
    const back = await admin.availability("portraits", date, date);
    expect(back.body.data.days.find((d: any) => d.date === date)?.slots.length).toBeGreaterThan(0);
  });

  test("end before start is rejected with a message (015 #4)", async ({ page }) => {
    await adminLoggedIn(page);
    await page.getByRole("link", { name: "Blocked dates" }).click();
    await page.getByLabel("From date").fill("2026-12-20");
    await page.getByLabel("To date").fill("2026-12-18");
    await page.getByRole("button", { name: "Block these dates" }).click();
    await expect(page.getByText("The end date can't be before the start date.")).toBeVisible();
  });

  test("block over an existing booking warns, and does not change the booking (015 #3)", async ({ page, request, baseURL }) => {
    const admin = await adminApi(request, baseURL!);
    const { reference, slot } = await seedBooking(admin, "families", { nth: 9 });
    await adminLoggedIn(page);
    await page.getByRole("link", { name: "Blocked dates" }).click();
    await page.getByLabel("From date").fill(slot.localDate);
    await page.getByLabel("To date").fill(slot.localDate);
    await page.getByRole("button", { name: "Block these dates" }).click();
    const dlg = page.getByRole("alertdialog");
    await expect(dlg).toContainText("Some bookings fall in this range");
    await dlg.getByRole("button", { name: "Go back" }).click();
    const d = await admin.get(`/api/admin/bookings/${reference}`);
    expect(d.body.data.status).toBe("pending_deposit");
  });
});

test.describe("CSV export", () => {
  test("Export CSV downloads bookings-YYYY-MM-DD.csv with BOM, header and the booking (016 #1, #3, #6)", async ({ page, request, baseURL }) => {
    const admin = await adminApi(request, baseURL!);
    const { reference } = await seedBooking(admin, "portraits", { nth: 12 });
    await adminLoggedIn(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Export CSV/ }).or(page.getByRole("button", { name: /Export CSV/ })).first().click()]);
    expect(download.suggestedFilename()).toMatch(/^bookings-\d{4}-\d{2}-\d{2}\.csv$/);
    const path = await download.path();
    const text = (await import("node:fs")).readFileSync(path!, "utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const rows = parseCsv(text);
    expect(rows[0]!.slice(0, 4)).toEqual(["Reference", "Status", "Session type", "Date (ET)"]);
    expect(rows.some((r) => r[0] === reference)).toBe(true);
  });

  test("CSV link without a session is refused (016 #5)", async ({ request, baseURL }) => {
    const r = await apiFor(request, baseURL!).get("/api/admin/export.csv");
    expect(r.status).toBe(401);
  });
});
