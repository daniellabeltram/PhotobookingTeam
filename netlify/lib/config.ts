// Loads, validates and caches the business config (ADR 0007). A bad config throws at cold start.
import bookingConfig from "../../config/booking.config";
import { intakeFields } from "../../config/intake-fields";
import { policies } from "../../config/policies/index";
import { bookingConfigSchema, intakeFieldSchema, policySchema, type BookingConfig, type IntakeFieldDef, type PolicyVersion, type SessionType } from "../../shared/config-schema";

let cachedConfig: BookingConfig | null = null;
let cachedCatalogue: IntakeFieldDef[] | null = null;

export function getConfig(): BookingConfig {
  if (!cachedConfig) {
    const parsed = bookingConfigSchema.parse(bookingConfig);
    if (!policies[parsed.policyVersion]) throw new Error("policyVersion has no policy file");
    const catalogue = getCatalogue();
    const known = new Set(catalogue.map((f) => f.id));
    for (const t of parsed.sessionTypes) {
      for (const f of t.intakeExtraFields) if (!known.has(f.id)) throw new Error(`Unknown intake field ${f.id}`);
    }
    cachedConfig = parsed;
  }
  return cachedConfig;
}

export function getCatalogue(): IntakeFieldDef[] {
  cachedCatalogue ??= intakeFields.map((f) => intakeFieldSchema.parse(f));
  return cachedCatalogue;
}

export function getPolicy(version: string): PolicyVersion | null {
  const raw = Object.hasOwn(policies, version) ? policies[version] : undefined;
  return raw ? policySchema.parse(raw) : null;
}

export function getSessionType(config: BookingConfig, id: string): SessionType | undefined {
  return config.sessionTypes.find((t) => t.id === id);
}
