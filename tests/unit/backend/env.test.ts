// One test per rule in netlify/lib/env.ts (security review H1, H2).
import { describe, expect, it } from "vitest";
import { DEV_PASSWORD_HASH, EnvError, readEnv, type EnvRule } from "../../../netlify/lib/env";

const STRONG_SECRET = "k7Qw2mVx9pLr4TnB8sYd6HfJ3cZaE5uG1oXiR0vN";
// A syntactically valid hash that is NOT the dev hash (600000 iterations)
const REAL_HASH = "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TOTP = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

const production = (over: Record<string, string | undefined> = {}) => ({
  APP_ENV: "production",
  STORE_DRIVER: "netlify-blobs",
  DATA_NAMESPACE: "production",
  EMAIL_DRIVER: "resend",
  RESEND_API_KEY: "re_test_fake_key_for_unit_tests",
  ADMIN_EMAIL: "daniella@studio-mail.invalidtld-free.org",
  ADMIN_PASSWORD_HASH: REAL_HASH,
  ADMIN_SESSION_SECRET: STRONG_SECRET,
  ADMIN_TOTP_SECRET: TOTP,
  PUBLIC_BASE_URL: "https://book.example.org",
  ...over,
});
const preview = (over: Record<string, string | undefined> = {}) => ({
  ...production(),
  APP_ENV: "preview",
  DATA_NAMESPACE: "preview",
  EMAIL_REDIRECT_TO: "inbox@mail.test",
  ADMIN_TOTP_SECRET: undefined,
  ...over,
});

function rule(src: Record<string, string | undefined>, platform = {}): EnvRule | null {
  try {
    readEnv(src, platform);
    return null;
  } catch (e) {
    if (e instanceof EnvError) return e.rule;
    throw e;
  }
}

describe("env: baseline", () => {
  it("accepts a clean production, preview, local and test environment", () => {
    expect(rule(production())).toBeNull();
    expect(rule(preview())).toBeNull();
    expect(rule({ APP_ENV: "local" })).toBeNull();
    expect(rule({ APP_ENV: "test" })).toBeNull();
  });
  it("local defaults: file store, file email, dev credentials", () => {
    const env = readEnv({});
    expect(env.appEnv).toBe("local");
    expect(env.storeDriver).toBe("file");
    expect(env.emailDriver).toBe("file");
    expect(env.adminEmail).toBe("admin@example.test");
    expect(env.adminPasswordHash).toBe(DEV_PASSWORD_HASH);
  });
  it("treats empty strings as not set (.env.example lists every name with no value)", () => {
    const env = readEnv({ APP_ENV: "local", DATA_NAMESPACE: "", ADMIN_PASSWORD_HASH: "", EMAIL_REDIRECT_TO: "", FAKE_NOW: "" });
    expect(env.dataNamespace).toBeNull();
    expect(env.adminPasswordHash).toBe(DEV_PASSWORD_HASH);
    expect(env.fakeNow).toBeNull();
  });
});

describe("env H1: APP_ENV must match the platform", () => {
  it("a missing APP_ENV on Netlify is an error, not 'local'", () => {
    expect(rule({ NETLIFY: "true" })).toBe("app_env_missing");
    expect(rule({}, { context: "production" })).toBe("app_env_missing");
  });
  it("a missing APP_ENV off the platform defaults to local", () => {
    expect(readEnv({}).appEnv).toBe("local");
  });
  it("rejects an unknown APP_ENV", () => {
    expect(rule({ APP_ENV: "staging" })).toBe("app_env_invalid");
  });
  it("production context requires APP_ENV=production, and the reverse", () => {
    expect(rule(preview(), { context: "production" })).toBe("app_env_platform_mismatch");
    expect(rule(production(), { context: "deploy-preview" })).toBe("app_env_platform_mismatch");
    expect(rule(production(), { context: "branch-deploy" })).toBe("app_env_platform_mismatch");
    expect(rule(production(), { context: "production" })).toBeNull();
    expect(rule(preview(), { context: "deploy-preview" })).toBeNull();
    expect(rule(preview(), { context: "branch-deploy" })).toBeNull();
  });
  it("local or test on the Netlify platform is refused", () => {
    expect(rule({ APP_ENV: "local", NETLIFY: "true" })).toBe("app_env_platform_mismatch");
    expect(rule({ APP_ENV: "test", NETLIFY: "true" })).toBe("app_env_platform_mismatch");
  });
});

describe("env H1: production refuses test switches", () => {
  it("EMAIL_REDIRECT_TO", () => expect(rule(production({ EMAIL_REDIRECT_TO: "x@mail.test" }))).toBe("prod_redirect_to_set"));
  it("FAKE_NOW", () => expect(rule(production({ FAKE_NOW: "2026-12-01T09:00:00-05:00" }))).toBe("prod_fake_now_set"));
  it("RATE_LIMIT_DISABLED", () => expect(rule(production({ RATE_LIMIT_DISABLED: "1" }))).toBe("prod_rate_limit_disabled_set"));
  it("PAYMENT_LINK_OVERRIDE_URL", () => expect(rule(production({ PAYMENT_LINK_OVERRIDE_URL: "https://pay.test/x" }))).toBe("prod_payment_override_set"));
  it("preview ignores FAKE_NOW; local and test honor it", () => {
    expect(readEnv(preview({ FAKE_NOW: "2026-12-01T09:00:00-05:00" })).fakeNow).toBeNull();
    expect(readEnv({ APP_ENV: "local", FAKE_NOW: "2026-12-01T09:00:00-05:00" }).fakeNow).not.toBeNull();
    expect(readEnv({ APP_ENV: "test", FAKE_NOW: "2026-12-01T09:00:00-05:00" }).fakeNow).not.toBeNull();
  });
  it("production needs the real store, email driver and namespace", () => {
    expect(rule(production({ STORE_DRIVER: "file" }))).toBe("prod_store_driver");
    expect(rule(production({ STORE_DRIVER: "memory" }))).toBe("prod_store_driver");
    expect(rule(production({ EMAIL_DRIVER: "file" }))).toBe("prod_email_driver");
    expect(rule(production({ DATA_NAMESPACE: "preview" }))).toBe("prod_namespace");
    expect(rule(production({ DATA_NAMESPACE: undefined }))).toBe("prod_namespace");
  });
});

describe("env H1: namespaces", () => {
  it("DATA_NAMESPACE=production is only allowed in production", () => {
    expect(rule(preview({ DATA_NAMESPACE: "production" }))).toBe("namespace_production_outside_production");
    expect(rule({ APP_ENV: "local", DATA_NAMESPACE: "production" })).toBe("namespace_production_outside_production");
  });
  it("netlify-blobs needs a namespace", () => {
    expect(rule(preview({ DATA_NAMESPACE: undefined }))).toBe("namespace_missing");
  });
  it("preview must redirect every email", () => {
    expect(rule(preview({ EMAIL_REDIRECT_TO: undefined }))).toBe("preview_redirect_missing");
  });
  it("resend needs its key", () => {
    expect(rule(production({ RESEND_API_KEY: undefined }))).toBe("resend_key_missing");
  });
});

describe("env H2: weak or placeholder secrets", () => {
  it("rejects a session secret under 32 bytes or with placeholder words (preview and production)", () => {
    expect(rule(production({ ADMIN_SESSION_SECRET: "short-secret" }))).toBe("session_secret_weak");
    expect(rule(preview({ ADMIN_SESSION_SECRET: "replace-me-with-32-or-more-random-bytes-not-real" }))).toBe("session_secret_weak");
    expect(rule(production({ ADMIN_SESSION_SECRET: "a".repeat(20) + "not-real" + "b".repeat(20) }))).toBe("session_secret_weak");
    expect(rule(production({ ADMIN_SESSION_SECRET: undefined }))).toBe("session_secret_missing");
  });
  it("rejects the dev password hash outside local and test", () => {
    expect(rule(production({ ADMIN_PASSWORD_HASH: DEV_PASSWORD_HASH }))).toBe("password_hash_dev");
    expect(rule(preview({ ADMIN_PASSWORD_HASH: DEV_PASSWORD_HASH }))).toBe("password_hash_dev");
  });
  it("rejects hash iterations outside 600000 to 2000000", () => {
    expect(rule(production({ ADMIN_PASSWORD_HASH: REAL_HASH.replace("$600000$", "$100000$") }))).toBe("password_hash_iterations");
    expect(rule(production({ ADMIN_PASSWORD_HASH: REAL_HASH.replace("$600000$", "$2000001$") }))).toBe("password_hash_iterations");
    expect(rule(production({ ADMIN_PASSWORD_HASH: REAL_HASH.replace("$600000$", "$2000000$") }))).toBeNull();
  });
  it("rejects a malformed or missing hash", () => {
    expect(rule(production({ ADMIN_PASSWORD_HASH: "not-a-hash" }))).toBe("password_hash_invalid");
    expect(rule(production({ ADMIN_PASSWORD_HASH: undefined }))).toBe("password_hash_missing");
  });
  it("rejects placeholder admin emails in preview and production", () => {
    expect(rule(production({ ADMIN_EMAIL: "admin@example.test" }))).toBe("admin_email_placeholder");
    expect(rule(production({ ADMIN_EMAIL: "someone@example.com" }))).toBe("admin_email_placeholder");
    expect(rule(preview({ ADMIN_EMAIL: "someone@sub.example.com" }))).toBe("admin_email_placeholder");
    expect(rule(production({ ADMIN_EMAIL: undefined }))).toBe("admin_email_missing");
  });
  it("dev defaults never apply in preview or production", () => {
    expect(rule(production({ ADMIN_PASSWORD_HASH: undefined, ADMIN_SESSION_SECRET: undefined, ADMIN_EMAIL: undefined }))).not.toBeNull();
  });
});

describe("env: TOTP", () => {
  it("is required in production, optional elsewhere", () => {
    expect(rule(production({ ADMIN_TOTP_SECRET: undefined }))).toBe("totp_required_in_production");
    expect(rule(preview())).toBeNull();
    expect(rule({ APP_ENV: "local" })).toBeNull();
  });
  it("rejects a malformed secret", () => {
    expect(rule(production({ ADMIN_TOTP_SECRET: "not base32 !!" }))).toBe("totp_secret_invalid");
  });
});

describe("env: limits", () => {
  it("RATE_LIMIT_DISABLED works outside production only", () => {
    expect(readEnv({ APP_ENV: "test", RATE_LIMIT_DISABLED: "1" }).rateLimitDisabled).toBe(true);
    expect(readEnv(preview({ RATE_LIMIT_DISABLED: "1" })).rateLimitDisabled).toBe(true);
    expect(readEnv({ APP_ENV: "test" }).rateLimitDisabled).toBe(false);
  });
  it("PAYMENT_LINK_OVERRIDE_URL is ignored in production (also refused)", () => {
    expect(readEnv(preview({ PAYMENT_LINK_OVERRIDE_URL: "https://pay.test/x" })).paymentLinkOverrideUrl).toBe("https://pay.test/x");
  });
});
