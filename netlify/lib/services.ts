// Lazy service container: { env, store, email, clock, config, limiter }. Built on first use and validated
// then (fail closed). Tests call setServicesForTest() / resetServices() to inject memory drivers.
import { getConfig } from "./config";
import { clockFromEnv } from "./clock";
import { readEnv, EnvError, type Env, type PlatformInfo } from "./env";
import type { BookingConfig } from "../../shared/config-schema";
import type { Clock } from "../../shared/datetime";
import { FileEmailSender } from "./email/file";
import { MemoryEmailSender } from "./email/memory";
import { ResendEmailSender } from "./email/resend";
import { RedirectingSender, type EmailSender } from "./email/sender";
import { log, setLogLevel } from "./log";
import { RateLimiter } from "./ratelimit";
import { setRetryDelay } from "./repos/ledger";
import { createStore } from "./store";
import type { KvStore } from "./store/kv";

export interface Services {
  env: Env;
  store: KvStore;
  email: EmailSender;
  clock: Clock;
  config: BookingConfig;
  limiter: RateLimiter;
}

let platform: PlatformInfo = {};
let cached: Services | null = null;
let cachedError: EnvError | null = null;

/** Called by the handler wrapper with Netlify's `context.deploy` so APP_ENV can be checked against it (H1). */
export function setPlatformContext(deployContext: string | null | undefined): void {
  if (deployContext && deployContext !== platform.context) {
    platform = { context: deployContext };
    cached = null;
    cachedError = null;
  }
}

function build(): Services {
  const env = readEnv(process.env, platform);
  setLogLevel(env.logLevel);
  if (env.appEnv === "test") setRetryDelay(0, 4);
  const config = getConfig();
  const store = createStore(env);
  const clock = clockFromEnv(env.fakeNow);
  let email: EmailSender;
  switch (env.emailDriver) {
    case "memory":
      email = new MemoryEmailSender();
      break;
    case "file":
      email = new FileEmailSender(env.emailOutboxDir);
      break;
    case "resend":
      email = new ResendEmailSender({ apiKey: env.resendApiKey as string, fromName: config.email.fromName, fromAddress: config.email.fromAddress });
      break;
  }
  if (env.emailRedirectTo) email = new RedirectingSender(email, env.emailRedirectTo);
  log("debug", "services ready", { driver: env.storeDriver });
  return { env, store, email, clock, config, limiter: new RateLimiter(store, clock) };
}

/** Throws EnvError (cached) when the environment is unsafe. Handlers answer a generic 500. */
export function getServices(): Services {
  if (cached) return cached;
  if (cachedError) throw cachedError;
  try {
    cached = build();
    return cached;
  } catch (err) {
    if (err instanceof EnvError) cachedError = err;
    throw err;
  }
}

export function setServicesForTest(over: Partial<Services>): Services {
  const base = getServices();
  cached = { ...base, ...over };
  if (over.store && !over.limiter) cached.limiter = new RateLimiter(over.store, cached.clock);
  if (over.clock && !over.limiter) cached.limiter = new RateLimiter(cached.store, over.clock);
  return cached;
}

export function resetServices(): void {
  cached = null;
  cachedError = null;
  platform = {};
}
