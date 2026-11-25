// Zod schema and types for config/booking.config.ts (ADR 0007). Browser-safe.
// Keys are camelCase. Business values are [PLACEHOLDER]s until Daniella confirms them (docs/04).
import { z } from "zod";

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
const cents = z.number().int().min(0);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use kebab-case");
const rateLimit = z.strictObject({ max: z.number().int().min(1), windowMinutes: z.number().int().min(1) });

export const intakeFieldSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  input: z.enum(["text", "textarea", "email", "tel", "number", "select", "checkbox", "date", "time"]),
  maxLength: z.number().int().positive().optional(),
  options: z.array(z.strictObject({ value: z.string(), label: z.string() })).optional(),
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  helpText: z.string().optional(),
});
export type IntakeFieldDef = z.infer<typeof intakeFieldSchema>;

const windowSchema = z.strictObject({ start: hm, end: hm });
const windowSetEntry = z.strictObject({
  months: z.array(z.number().int().min(1).max(12)).min(1),
  windows: z.array(windowSchema).min(1),
});

const depositSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("flat"), amountCents: cents }),
  z.strictObject({ kind: z.literal("percent"), percent: z.number().min(1).max(100) }),
  z.strictObject({ kind: z.literal("full") }),
  z.strictObject({ kind: z.literal("none") }),
]);

const httpsUrl = z.url().refine((u) => u.startsWith("https://"), "Payment links must be https://");

export const sessionTypeSchema = z.strictObject({
  id: kebab,
  name: z.string().min(1),
  description: z.string().min(1),
  included: z.array(z.string()),
  kind: z.enum(["standard", "mini"]),
  active: z.boolean(),
  bookingMode: z.enum(["instant", "request"]),
  durationMin: z.number().int().min(5),
  durationOptionsMin: z.array(z.number().int().min(5)).optional(),
  bufferMin: z.number().int().min(0),
  windowSet: z.string().optional(),
  minimumNoticeHours: z.number().int().min(0).optional(),
  bookingHorizonDays: z.number().int().min(1).max(730),
  priceFromCents: cents,
  priceUnit: z.enum(["session", "hour"]),
  deposit: depositSchema,
  depositPaymentLink: z.union([httpsUrl, z.null(), z.record(z.string(), httpsUrl)]),
  maxPeople: z.number().int().min(1).nullable(),
  includedPeople: z.number().int().min(1).optional(),
  extraPersonFeeCents: cents.optional(),
  locationOptions: z.array(z.strictObject({ id: kebab, label: z.string().min(1) })),
  allowOwnLocation: z.boolean(),
  allowHelpMeChoose: z.boolean(),
  intakeExtraFields: z.array(z.strictObject({ id: z.string().min(1), required: z.boolean() })),
  commonFieldsProfile: z.enum(["full", "short"]),
  whatToBringText: z.string(),
  countsTowardDailyCap: z.boolean(),
});
export type SessionType = z.infer<typeof sessionTypeSchema>;

export const bookingConfigSchema = z
  .strictObject({
    business: z.strictObject({
      name: z.string().min(1),
      siteUrl: z.url(),
      contactEmail: z.email(),
      contactPhone: z.string().optional(),
      timezone: z.literal("America/New_York"),
    }),
    email: z.strictObject({
      fromName: z.string().min(1),
      fromAddress: z.email(),
      replyTo: z.email(),
      adminNotificationEmail: z.email(),
    }),
    scheduling: z.strictObject({
      slotIntervalMin: z.number().int().min(5),
      minimumNoticeHours: z.number().int().min(0),
      maxSessionsPerDay: z.number().int().min(1),
      unpaidHoldHours: z.number().int().min(1),
      requestResponseDays: z.number().int().min(1),
      workingDays: z.array(z.number().int().min(1).max(7)).min(1),
      windowSets: z.record(z.string(), z.array(windowSetEntry).min(1)),
    }),
    sessionTypes: z.array(sessionTypeSchema).min(1),
    policyVersion: z.string().min(1),
    privacy: z.strictObject({
      dataRetentionMonths: z.number().int().min(1),
      privacyContactEmail: z.email(),
      lastUpdated: isoDate,
    }),
    features: z.strictObject({ portfolioOptOutEnabled: z.boolean() }),
    limits: z.strictObject({
      bookingRateLimit: rateLimit,
      bookingGlobalLimit: rateLimit,
      availabilityRateLimit: rateLimit,
      loginFailureLimit: rateLimit,
    }),
    admin: z.strictObject({ sessionIdleMinutes: z.number().int().min(5), sessionMaxHours: z.number().int().min(1) }),
  })
  .superRefine((cfg, ctx) => {
    const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const ids = new Set<string>();
    const maxBuffer = Math.max(0, ...cfg.sessionTypes.map((t) => t.bufferMin));
    cfg.sessionTypes.forEach((t, i) => {
      if (ids.has(t.id)) bad(["sessionTypes", i, "id"], `Duplicate session type id ${t.id}`);
      ids.add(t.id);
      if (t.kind === "standard" && !t.windowSet) bad(["sessionTypes", i, "windowSet"], "Standard types need a windowSet");
      if (t.windowSet && !cfg.scheduling.windowSets[t.windowSet]) bad(["sessionTypes", i, "windowSet"], `Unknown windowSet ${t.windowSet}`);
      for (const opt of t.durationOptionsMin ?? []) {
        if (opt < t.durationMin) bad(["sessionTypes", i, "durationOptionsMin"], "Options must be at least durationMin");
        if (opt % cfg.scheduling.slotIntervalMin !== 0) bad(["sessionTypes", i, "durationOptionsMin"], "Options must be multiples of slotIntervalMin");
      }
      if (t.kind === "mini" && t.countsTowardDailyCap) bad(["sessionTypes", i, "countsTowardDailyCap"], "Minis never count toward the cap");
      if (t.kind === "mini" && (t.bufferMin * 2 + t.durationMin) >= 24 * 60) bad(["sessionTypes", i], "Mini busy time too long");
    });
    for (const [name, sets] of Object.entries(cfg.scheduling.windowSets)) {
      sets.forEach((set, si) =>
        set.windows.forEach((w, wi) => {
          const path = ["scheduling", "windowSets", name, si, "windows", wi];
          const s = Number(w.start.slice(0, 2)) * 60 + Number(w.start.slice(3));
          const e = Number(w.end.slice(0, 2)) * 60 + Number(w.end.slice(3));
          if (s >= e) bad(path, "Window start must be before end");
          // ADR 0002: every busy interval must stay inside one ET date.
          if (e + maxBuffer > 24 * 60) bad(path, "Window end plus the largest buffer must be at most 24:00");
          if (s - maxBuffer < 0) bad(path, "Window start minus the largest buffer must be at least 00:00");
        }),
      );
    }
    if (cfg.sessionTypes.length > 0 && cfg.sessionTypes.filter((t) => t.kind === "mini").length > 1) {
      bad(["sessionTypes"], "At most one mini type is supported in v1");
    }
  });

export type BookingConfig = z.infer<typeof bookingConfigSchema>;
export type BookingConfigInput = z.input<typeof bookingConfigSchema>;

// ---- policies (config/policies/*.ts) ----
export const policySchema = z.strictObject({
  version: z.string().min(1),
  effectiveDate: isoDate,
  summaryTemplate: z.string().min(1),
  /** Other wording for request-mode types (Events) and paid-in-full types (Minis). The base template is the instant/retainer one. */
  summaryVariants: z.strictObject({ request: z.string().min(1), full: z.string().min(1) }),
  values: z.record(z.string(), z.union([z.number(), z.string()])),
  sections: z.array(z.strictObject({ heading: z.string().min(1), paragraphs: z.array(z.string().min(1)).min(1) })).min(1),
});
export type PolicyVersion = z.infer<typeof policySchema>;
