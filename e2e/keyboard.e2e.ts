// Keyboard-only booking of a Portraits session (story 019 #4, 002 #16). Only keyboard events after page load.
import { test, expect, type Locator, type Page } from "@playwright/test";
import { AVAILABLE_DAY } from "./support/flow";
import { CLIENT } from "../tests/helpers/seed";

async function isFocused(l: Locator) {
  return l.first().evaluate((el) => el === document.activeElement).catch(() => false);
}

/** Tab until `target` has focus. Fails (no keyboard trap / unreachable control) after `max` presses. */
async function tabTo(page: Page, target: Locator, what: string, max = 80) {
  for (let i = 0; i < max; i++) {
    if ((await target.count()) && (await isFocused(target))) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard: could not reach "${what}" with Tab within ${max} presses`);
}

test("keyboard-only: book a Portraits session end to end, focus always visible", async ({ page }) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1, name: "Choose your session" });
  await expect(h1).toBeVisible();

  // Step 1: radiogroup, arrows move, Space selects.
  const portraits = page.getByRole("radio", { name: /Portraits/ }).first();
  await tabTo(page, page.getByRole("radio"), "session radio group");
  for (let i = 0; i < 5 && !(await isFocused(portraits)); i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(portraits).toBeChecked();
  await tabTo(page, page.getByRole("button", { name: "Continue" }), "Continue");
  await page.keyboard.press("Enter");

  // Step 2: grid with roving tabindex, arrows to an open day, Enter selects, Tab to time, Space selects.
  await expect(page.getByRole("heading", { level: 1, name: "Pick a date and time" })).toBeFocused();
  await tabTo(page, page.locator('[role="grid"] [tabindex="0"]'), "calendar grid");
  for (let i = 0; i < 60; i++) {
    const name = (await page.locator(":focus").getAttribute("aria-label")) ?? "";
    if (AVAILABLE_DAY.test(name)) break;
    await page.keyboard.press("ArrowRight");
  }
  await page.keyboard.press("Enter");
  const firstTime = page.getByRole("radiogroup", { name: /Available times/ }).locator('[role="radio"], button').first();
  await tabTo(page, firstTime, "first time");
  await page.keyboard.press("Space");
  await tabTo(page, page.getByRole("button", { name: "Continue" }), "Continue (step 2)");
  await page.keyboard.press("Enter");

  // Step 3
  await expect(page.getByRole("heading", { level: 1, name: "Tell us about your session" })).toBeFocused();
  await tabTo(page, page.getByLabel("Full name"), "Full name");
  await page.keyboard.type(CLIENT.fullName);
  await tabTo(page, page.getByRole("textbox", { name: "Email" }), "Email");
  await page.keyboard.type(CLIENT.email);
  await tabTo(page, page.getByLabel("Mobile phone"), "Mobile phone");
  await page.keyboard.type(CLIENT.phone);
  await tabTo(page, page.getByLabel(/Who.s being photographed/), "Names");
  await page.keyboard.type(CLIENT.subjectsNames);
  await tabTo(page, page.getByRole("spinbutton", { name: /^Adults/ }), "Adults");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("1");
  // Location: Tab reaches the radio group, ArrowDown twice reaches "Help me choose".
  await tabTo(page, page.getByRole("radio", { name: /favorite spot|Pick a favorite/ }), "location radios");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Help me choose" })).toBeChecked();
  await tabTo(page, page.getByRole("button", { name: "Continue" }), "Continue (step 3)");
  await page.keyboard.press("Enter");

  // Step 4
  await expect(page.getByRole("heading", { level: 1, name: /Almost done/ })).toBeFocused();
  const box = page.getByRole("checkbox", { name: /I have read and agree/ });
  await tabTo(page, box, "policy checkbox");
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  await tabTo(page, page.getByRole("button", { name: "Book my session" }), "Book my session");
  // Focus ring must be visible on the focused control (WCAG 2.4.7): outline or box-shadow non-empty.
  const ring = await page.locator(":focus").evaluate((el) => {
    const s = getComputedStyle(el);
    return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
  });
  expect(ring, "visible focus indicator").toBe(true);
  await page.keyboard.press("Enter");

  // Step 5
  await expect(page.getByRole("heading", { level: 1, name: /You're booked/ })).toBeFocused();
});
