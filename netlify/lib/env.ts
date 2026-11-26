// Typed environment reader with production guards (ADR 0002, 0003, 0004; security design review H1, H2).
// It FAILS CLOSED: any unsafe combination throws EnvError and the function answers a generic 500.
// Empty strings count as "not set" (.env.example lists every name with an empty value).

export type AppEnv = "local" | "test" | "preview" | "production";

/** Which rule failed. Logged as a code, never with the value that was wrong. */
export type EnvRule =
  | "app_env_missing"
  | "app_env_invalid"
  | "app_env_platform_mismatch"
  | "prod_redirect_to_set"
  | "prod_fake_now_set"
  | "prod_rate_limit_disabled_set"
  | "prod_payment_override_set"
  | "prod_store_driver"
  | "prod_email_driver"
  | "prod_namespace"
  | "namespace_production_outside_production"
  | "namespace_missing"
  | "store_driver_invalid"
  | "email_driver_invalid"
  | "preview_redirect_missing"
  | "resend_key_missing"
  | "admin_email_missing"
  | "admin_email_placeholder"
  | "session_secret_missing"
  | "session_secret_weak"
  | "session_secret_denied"
  | "totp_secret_denied"
  | "password_hash_missing"
  | "password_hash_invalid"
  | "password_hash_dev"
  | "password_hash_iterations"
  | "totp_required_in_production"
  | "totp_secret_invalid";

export class EnvError extends Error {
  readonly rule: EnvRule;
  constructor(rule: EnvRule) {
    super(`Invalid environment: ${rule}`);
    this.name = "EnvError";
    this.rule = rule;
  }
}

/** Local-only development defaults. They are REJECTED in preview and production (H2). */
export const DEV_PASSPHRASE_HINT = "dev-passphrase-change-me";
export const DEV_PASSWORD_HASH =
  "pbkdf2-sha256$600000$47NM2GmxJ_mzMB7xWHkBSQ$VM0MBCFBavLXXUKWkpncBqF72KBjpf9lhnTRXYAY9sc";
export const DEV_SESSION_SECRET = "local-development-session-secret-0123456789-abcdef";

/**
 * Every session-secret literal that exists in this repository (dev default, e2e seed, unit-test values, the old
 * .env.example placeholder). Preview and production refuse them even though they are long enough (review H-1).
 * tests/unit/backend/env.test.ts scans the repo and fails if a new literal appears that is not listed here.
 */
export const DENIED_SESSION_SECRETS: readonly string[] = [
  DEV_SESSION_SECRET,
  "e2e-session-secret-0123456789abcdef0123456789abcdef", // tests/helpers/seed.ts
  "unit-test-secret-0123456789-abcdefghijklmnop", // tests/unit/backend/auth.test.ts
  "replace-me-with-32-or-more-random-bytes-not-real", // the old .env.example value
];
/** TOTP secrets that are public (RFC and library examples) or used in tests. A prefix match is refused too. */
export const DENIED_TOTP_SECRETS: readonly string[] = ["JBSWY3DPEHPK3PXP", "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"];
/** Preview and production secrets are base64url of at least 32 random bytes (43+ characters). */
export const SESSION_SECRET_FORMAT = /^[A-Za-z0-9_-]{43,}$/;
const DEV_ADMIN_EMAIL = "admin@example.test";

export const MIN_HASH_ITERATIONS = 600_000;
export const MAX_HASH_ITERATIONS = 2_000_000;

export interface Env {
  appEnv: AppEnv;
  storeDriver: "memory" | "file" | "netlify-blobs";
  dataDir: string;
  dataNamespace: string | null;
  emailDriver: "memory" | "file" | "resend";
  emailOutboxDir: string;
  resendApiKey: string | null;
  emailRedirectTo: string | null;
  adminEmail: string;
  adminPasswordHash: string;
  adminSessionSecret: string;
  adminTotpSecret: string | null;
  publicBaseUrl: string;
  paymentLinkOverrideUrl: string | null;
  /** Honored only in local and test. */
  fakeNow: string | null;
  /** Switches off the booking and availability limits (never the login limiter). Never in production. */
  rateLimitDisabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

type Source = Record<string, string | undefined>;

/** What the Netlify platform says about this deploy (Functions v2 `context.deploy.context`). */
export interface PlatformInfo {
  /** "production" | "deploy-preview" | "branch-deploy" | "dev" */
  context?: string | null;
}

function val(src: Source, key: string): string | null {
  const v = src[key];
  return v === undefined || v.trim() === "" ? null : v.trim();
}

function parseHashIterations(hash: string): number | null {
  const parts = hash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return null;
  const n = Number(parts[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const PLACEHOLDER_WORDS = ["replace-me", "not-real", "changeme", "change-me", "example", "placeholder"];

export function readEnv(src: Source = process.env, platform: PlatformInfo = {}): Env {
  const onNetlify = src.NETLIFY === "true" && src.NETLIFY_DEV !== "true";
  const platformContext = platform.context ?? val(src, "CONTEXT");

  // ---- APP_ENV ----
  const rawAppEnv = val(src, "APP_ENV");
  if (!rawAppEnv && (onNetlify || platformContext)) throw new EnvError("app_env_missing"); // never default to "local" on the platform
  const appEnv = (rawAppEnv ?? "local") as AppEnv;
  if (!["local", "test", "preview", "production"].includes(appEnv)) throw new EnvError("app_env_invalid");

  if (platformContext) {
    const isProdContext = platformContext === "production";
    const isPreviewContext = platformContext === "deploy-preview" || platformContext === "branch-deploy";
    if (isProdContext && appEnv !== "production") throw new EnvError("app_env_platform_mismatch");
    if (isPreviewContext && appEnv !== "preview") throw new EnvError("app_env_platform_mismatch");
    if (appEnv === "production" && !isProdContext) throw new EnvError("app_env_platform_mismatch");
    if (platformContext === "dev" && appEnv === "production") throw new EnvError("app_env_platform_mismatch");
  }
  if (onNetlify && (appEnv === "local" || appEnv === "test")) throw new EnvError("app_env_platform_mismatch");
  // Any platform context except `netlify dev` refuses local/test, and with them every dev default (review L-4)
  if (platformContext && platformContext !== "dev" && (appEnv === "local" || appEnv === "test")) throw new EnvError("app_env_platform_mismatch");

  const isProd = appEnv === "production";
  const isDeployed = isProd || appEnv === "preview";
  const devDefaults = appEnv === "local" || appEnv === "test";

  // ---- production refusals ----
  if (isProd) {
    if (val(src, "EMAIL_REDIRECT_TO")) throw new EnvError("prod_redirect_to_set");
    if (val(src, "FAKE_NOW")) throw new EnvError("prod_fake_now_set");
    if (val(src, "RATE_LIMIT_DISABLED")) throw new EnvError("prod_rate_limit_disabled_set");
    if (val(src, "PAYMENT_LINK_OVERRIDE_URL")) throw new EnvError("prod_payment_override_set");
  }

  // ---- store ----
  const storeDriverRaw = val(src, "STORE_DRIVER") ?? (appEnv === "test" ? "memory" : devDefaults ? "file" : "netlify-blobs");
  if (!["memory", "file", "netlify-blobs"].includes(storeDriverRaw)) throw new EnvError("store_driver_invalid");
  const storeDriver = storeDriverRaw as Env["storeDriver"];
  const dataNamespace = val(src, "DATA_NAMESPACE");
  if (isProd) {
    if (storeDriver !== "netlify-blobs") throw new EnvError("prod_store_driver");
    if (dataNamespace !== "production") throw new EnvError("prod_namespace");
  } else if (dataNamespace === "production") {
    throw new EnvError("namespace_production_outside_production");
  }
  if (storeDriver === "netlify-blobs" && !dataNamespace) throw new EnvError("namespace_missing");
  if (isDeployed && storeDriver !== "netlify-blobs") {
    // preview must not run on a throwaway store either: it would silently lose bookings
    throw new EnvError("store_driver_invalid");
  }

  // ---- email ----
  const emailDriverRaw = val(src, "EMAIL_DRIVER") ?? (appEnv === "test" ? "memory" : devDefaults ? "file" : "resend");
  if (!["memory", "file", "resend"].includes(emailDriverRaw)) throw new EnvError("email_driver_invalid");
  const emailDriver = emailDriverRaw as Env["emailDriver"];
  if (isProd && emailDriver !== "resend") throw new EnvError("prod_email_driver");
  if (isDeployed && emailDriver !== "resend") throw new EnvError("email_driver_invalid");
  const resendApiKey = val(src, "RESEND_API_KEY");
  if (emailDriver === "resend" && !resendApiKey) throw new EnvError("resend_key_missing");
  const emailRedirectTo = val(src, "EMAIL_REDIRECT_TO");
  if (appEnv === "preview" && emailDriver === "resend" && !emailRedirectTo) throw new EnvError("preview_redirect_missing");

  // ---- admin credentials (H2) ----
  const adminEmail = val(src, "ADMIN_EMAIL") ?? (devDefaults ? DEV_ADMIN_EMAIL : null);
  if (!adminEmail) throw new EnvError("admin_email_missing");
  if (isDeployed && /(\.test|\.invalid|\.localhost|@example\.(com|org|net)|\.example\.(com|org|net))$/i.test(adminEmail)) {
    throw new EnvError("admin_email_placeholder");
  }

  const adminSessionSecret = val(src, "ADMIN_SESSION_SECRET") ?? (devDefaults ? DEV_SESSION_SECRET : null);
  if (!adminSessionSecret) throw new EnvError("session_secret_missing");
  if (isDeployed) {
    const lower = adminSessionSecret.toLowerCase();
    if (DENIED_SESSION_SECRETS.includes(adminSessionSecret)) throw new EnvError("session_secret_denied");
    if (!SESSION_SECRET_FORMAT.test(adminSessionSecret) || PLACEHOLDER_WORDS.some((w) => lower.includes(w))) {
      throw new EnvError("session_secret_weak");
    }
  } else if (Buffer.byteLength(adminSessionSecret, "utf8") < 16) {
    throw new EnvError("session_secret_weak");
  }

  const adminPasswordHash = val(src, "ADMIN_PASSWORD_HASH") ?? (devDefaults ? DEV_PASSWORD_HASH : null);
  if (!adminPasswordHash) throw new EnvError("password_hash_missing");
  const iterations = parseHashIterations(adminPasswordHash);
  if (iterations === null) throw new EnvError("password_hash_invalid");
  if (isDeployed) {
    if (adminPasswordHash === DEV_PASSWORD_HASH) throw new EnvError("password_hash_dev");
    if (iterations < MIN_HASH_ITERATIONS || iterations > MAX_HASH_ITERATIONS) throw new EnvError("password_hash_iterations");
  }

  const adminTotpSecret = val(src, "ADMIN_TOTP_SECRET");
  if (adminTotpSecret && !/^[A-Z2-7]{16,}=*$/i.test(adminTotpSecret.replace(/\s+/g, ""))) throw new EnvError("totp_secret_invalid");
  if (isProd && !adminTotpSecret) throw new EnvError("totp_required_in_production");
  if (isDeployed && adminTotpSecret) {
    const norm = adminTotpSecret.replace(/\s+/g, "").toUpperCase();
    if (DENIED_TOTP_SECRETS.some((d) => norm === d || norm.startsWith(d))) throw new EnvError("totp_secret_denied");
  }

  // ---- the rest ----
  const fakeNow = devDefaults ? val(src, "FAKE_NOW") : null; // preview ignores it, production refused it above
  const publicBaseUrl = (val(src, "PUBLIC_BASE_URL") ?? val(src, "URL") ?? "http://localhost:5173").replace(/\/+$/, "");
  const paymentOverride = isProd ? null : val(src, "PAYMENT_LINK_OVERRIDE_URL");
  const level = val(src, "LOG_LEVEL") ?? "info";

  return {
    appEnv,
    storeDriver,
    dataDir: val(src, "DATA_DIR") ?? ".data/store",
    dataNamespace,
    emailDriver,
    emailOutboxDir: val(src, "EMAIL_OUTBOX_DIR") ?? ".data/outbox",
    resendApiKey,
    emailRedirectTo,
    adminEmail,
    adminPasswordHash,
    adminSessionSecret,
    adminTotpSecret: adminTotpSecret ? adminTotpSecret.replace(/\s+/g, "") : null,
    publicBaseUrl,
    paymentLinkOverrideUrl: paymentOverride,
    fakeNow,
    rateLimitDisabled: !isProd && !!val(src, "RATE_LIMIT_DISABLED"),
    logLevel: (["debug", "info", "warn", "error"].includes(level) ? level : "info") as Env["logLevel"],
  };
}
