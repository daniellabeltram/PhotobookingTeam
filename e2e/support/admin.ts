// Admin page helpers (docs/design/admin.md) and API seeding for e2e.
import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, type TypeKey } from "../../tests/helpers/seed";
import { buildBookingBody, firstOpenSlot, newKey, type Api } from "../../tests/helpers/builders";
import { addDays } from "../../tests/helpers/clock";
import { apiFor } from "./flow";

export const WINDOW_FROM = "2026-12-01";
export const WINDOW_TO = "2027-01-31";

export async function adminLogin(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto("/admin/");
  await expect(page.getByRole("heading", { level: 1, name: "Admin sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function adminLoggedIn(page: Page) {
  await adminLogin(page);
  await expect(page.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible();
}

export async function adminApi(request: APIRequestContext, baseURL: string): Promise<Api> {
  const api = apiFor(request, baseURL);
  const r = await api.login();
  expect(r.status, "admin API login").toBe(200);
  return api;
}

/** Creates a booking through the public API (fast setup). `nth` picks a later open slot to avoid clashes. */
export async function seedBooking(api: Api, type: TypeKey, opts: { nth?: number; from?: string; contact?: Record<string, string>; durationMin?: number } = {}) {
  const slot = await firstOpenSlot(api, type, opts.from ?? WINDOW_FROM, addDays(opts.from ?? WINDOW_FROM, 60), opts.durationMin, opts.nth ?? 0);
  const body = buildBookingBody({ type, slot, contact: opts.contact, durationMin: opts.durationMin });
  const res = await api.createBooking(body, newKey());
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { slot, reference: res.body.data.reference as string, booking: res.body.data };
}

/** Ensures a mini day exists on `date` with three slots (needs an admin session). */
export async function ensureMiniDay(api: Api, date = "2026-12-12") {
  const r = await api.post(`/api/admin/mini-days/${date}/slots`, { location: "Phillips Point", theme: "Winter", startTimes: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"] });
  expect([201, 409]).toContain(r.status);
}
