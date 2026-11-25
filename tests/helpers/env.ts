// Import FIRST in every integration test: pins env before any handler module is loaded.
import { ADMIN_EMAIL, ADMIN_SESSION_SECRET } from "./seed";
import { adminPasswordHash } from "./hash";
import { FIXED_NOW_ISO } from "./clock";

export function applyTestEnv(over: Record<string, string | undefined> = {}) {
  const e: Record<string, string | undefined> = {
    APP_ENV: "test",
    STORE_DRIVER: "memory",
    EMAIL_DRIVER: "memory",
    ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: adminPasswordHash(),
    ADMIN_SESSION_SECRET,
    ADMIN_TOTP_SECRET: "",
    FAKE_NOW: FIXED_NOW_ISO,
    RATE_LIMIT_DISABLED: "1",
    PUBLIC_BASE_URL: "http://localhost:5173",
    LOG_LEVEL: "debug",
    ...over,
  };
  for (const [k, v] of Object.entries(e)) {
    if (v === undefined || v === "") delete process.env[k];
    else process.env[k] = v;
  }
}
applyTestEnv();
