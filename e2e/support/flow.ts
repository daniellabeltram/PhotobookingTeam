// Page helpers for the client booking flow. Selectors follow docs/design/booking-flow.md (roles, labels, copy).
import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { Api, type Transport } from "../../tests/helpers/builders";
import { CLIENT, TYPE_NAMES, type TypeKey } from "../../tests/helpers/seed";

export const AVAILABLE_DAY = /, \d+ times? available/i;

/** Api client that talks over Playwright's request context (shares nothing with browser cookies). */
export function apiFor(request: APIRequestContext, baseURL: string): Api {
  const t: Transport = async (req) => {
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => (headers[k] = v));
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
    const r = await request.fetch(req.url, { method: req.method, headers, data: body, failOnStatusCode: false, maxRedirects: 0 });
    const resHeaders = new Headers();
    r.headersArray().forEach((h) => resHeaders.append(h.name, h.value));
    return new Response([204, 304].includes(r.status()) ? null : new Uint8Array(await r.body()), { status: r.status(), headers: resHeaders });
  };
  return new Api(t, baseURL);
}

export async function chooseSession(page: Page, type: TypeKey) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Choose your session" })).toBeVisible();
  await page.getByRole("radio", { name: new RegExp(TYPE_NAMES[type], "i") }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pick a date and time" })).toBeVisible();
}

/** Picks the earliest selectable day (paging forward through months) and its first time. Returns the chosen day label. */
export async function pickFirstDayAndTime(page: Page): Promise<string> {
  const day = page.getByRole("gridcell", { name: AVAILABLE_DAY });
  for (let i = 0; i < 8; i++) {
    if (await day.count()) break;
    const next = page.getByRole("button", { name: "Next month" });
    if (await next.isDisabled().catch(() => true)) break;
    await next.click();
  }
  await expect(day.first(), "at least one open day in the booking window").toBeVisible();
  const label = (await day.first().getAttribute("aria-label")) ?? (await day.first().innerText());
  await day.first().click();
  const times = page.getByRole("radiogroup", { name: /Available times/i }).locator('[role="radio"], button');
  await expect(times.first()).toBeVisible();
  await times.first().click();
  await expect(page.getByText(/You chose .* Eastern/i)).toBeVisible();
  return label;
}

export async function fillAbout(page: Page, over: Partial<typeof CLIENT> = {}) {
  const c = { ...CLIENT, ...over };
  await page.getByLabel("Full name").fill(c.fullName);
  await page.getByLabel("Email", { exact: true }).fill(c.email);
  await page.getByLabel("Mobile phone").fill(c.phone);
}

export async function setCount(page: Page, label: "Adults" | "Children" | "Pets", n: number) {
  await page.getByRole("spinbutton", { name: new RegExp(`^${label}`) }).fill(String(n));
}

/** Fills step 3 for a type with valid answers. */
export async function fillIntake(page: Page, type: TypeKey) {
  await expect(page.getByRole("heading", { level: 1, name: "Tell us about your session" })).toBeVisible();
  await fillAbout(page);
  await page.getByLabel(/Who.s being photographed/).fill(CLIENT.subjectsNames);
  if (type === "minis") {
    await setCount(page, "Adults", 2);
    await setCount(page, "Children", 2);
    return;
  }
  await setCount(page, "Adults", type === "portraits" ? 1 : 2);
  if (type === "families") {
    await setCount(page, "Children", 2);
    await page.getByLabel(/Children.s ages/).fill(CLIENT.childrenAges);
    await page.getByRole("group", { name: /extended family/i }).getByRole("radio", { name: "No" }).check();
  }
  if (type === "couples") {
    await page.getByLabel(/What.s the occasion/).selectOption({ label: "Engagement" });
    await page.getByRole("group", { name: /surprise proposal/i }).getByRole("radio", { name: "No" }).check();
  }
  if (type === "events") {
    await page.getByLabel("Event name").fill("QA Birthday");
    await page.getByLabel("Type of event").selectOption({ label: "Birthday" });
    await page.getByLabel("Venue name and address").fill("QA Venue, 1 Clematis St, West Palm Beach");
    await page.getByLabel("Expected guests").fill("20");
    await page.getByLabel("On-site contact name").fill("Pat Planner");
    await page.getByLabel("On-site contact phone").fill("5615550100");
    // Start prefilled from step 2; end time is ours to set (2 hours later is checked by the server rules).
    const start = await page.getByLabel("Start time").inputValue();
    const [h = 0, m = 0] = start.split(":").map(Number);
    const end = `${String((h + 2) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    await page.getByLabel("End time").fill(end);
  }
  if (type !== "events") {
    await page.getByRole("radio", { name: "Help me choose" }).check();
  } else {
    await page.getByRole("radio", { name: "Enter my own" }).check();
    await page.getByLabel("Address or place name").fill("QA Venue, 1 Clematis St, West Palm Beach");
  }
}

export const SUBMIT_LABEL: Record<TypeKey, string> = {
  portraits: "Book my session",
  couples: "Book my session",
  families: "Book my session",
  events: "Send my request",
  minis: "Book my mini",
};

export async function acceptPolicies(page: Page) {
  await page.getByRole("checkbox", { name: /I have read and agree to the booking, cancellation and weather policies/ }).check();
}

/** Runs the whole happy path up to (not including) the final submit. */
export async function reachPoliciesStep(page: Page, type: TypeKey) {
  await chooseSession(page, type);
  if (type === "events") await page.getByLabel(/How long do you need/).selectOption({ index: 0 });
  await pickFirstDayAndTime(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillIntake(page, type);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Almost done/ })).toBeVisible();
}

export async function submitBooking(page: Page, type: TypeKey) {
  await page.getByRole("button", { name: SUBMIT_LABEL[type] }).click();
}
