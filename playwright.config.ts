import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { adminPasswordHash } from "./tests/helpers/hash";
import { ADMIN_EMAIL, ADMIN_SESSION_SECRET } from "./tests/helpers/seed";
import { FIXED_NOW_ISO } from "./tests/helpers/clock";

const PORT = 5173;
// Sandbox has Chromium build 1243 while Playwright wants 1255: use the installed binary when it exists.
const CHROMIUM = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
const launchOptions = existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {};
// A fresh data dir per run (under the gitignored .data/e2e/) so no cleanup command is needed and
// bookings from an earlier run can never leak into this one. The webServer env is read only by the main process.
// PW_E2E_DATA is set once by the main process; workers inherit it so specs can read the email outbox.
process.env.PW_E2E_DATA ??= `.data/e2e/run-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
const DATA = process.env.PW_E2E_DATA;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts", // *.e2e.ts so vitest never collects these
  fullyParallel: false,
  workers: 1, // one shared data dir, one pinned clock
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "off", video: "off", locale: "en-US" },
  projects: [
    { name: "phone", use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Los_Angeles", launchOptions } },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 }, timezoneId: "UTC", launchOptions } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/api/config`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_ENV: "local",
      STORE_DRIVER: "file",
      EMAIL_DRIVER: "file",
      DATA_DIR: `${DATA}/store`,
      EMAIL_OUTBOX_DIR: `${DATA}/outbox`,
      FAKE_NOW: FIXED_NOW_ISO,
      RATE_LIMIT_DISABLED: "1",
      ADMIN_EMAIL,
      ADMIN_PASSWORD_HASH: adminPasswordHash(),
      ADMIN_SESSION_SECRET,
      ADMIN_TOTP_SECRET: "",
      PUBLIC_BASE_URL: `http://localhost:${PORT}`,
      LOG_LEVEL: "info",
    },
  },
});
