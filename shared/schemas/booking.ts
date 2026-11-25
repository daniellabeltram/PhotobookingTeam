// POST /api/bookings body schema, built per session type from the intake catalogue (ADR 0007).
// Rejects unknown fields and fields of other session types. Browser-safe: the catalogue is passed in.
import { z } from "zod";
import { isValidDate, normalizeInstant } from "../datetime";
import type { IntakeFieldDef, SessionType } from "../config-schema";

const PHONE_MSG = "Enter a 10-digit US phone number, or a number starting with + and the country code";

export function normalizePhone(value: string): string {
  return value.replace(/[\s().-]+/g, "");
}
export const isValidPhone = (value: string): boolean => /^\d{10}$/.test(value) || /^\+\d{8,15}$/.test(value);

function byId(catalogue: IntakeFieldDef[]): Map<string, IntakeFieldDef> {
  return new Map(catalogue.map((f) => [f.id, f]));
}

/** One field from its catalogue definition. `required` comes from the session type (or the common rules). */
export function fieldSchema(def: IntakeFieldDef, required: boolean): z.ZodType {
  const req = `${def.label} is required`;
  let schema: z.ZodType;
  switch (def.input) {
    case "email":
      schema = z
        .string({ error: req })
        .trim()
        .max(def.maxLength ?? 254, `Keep this under ${def.maxLength ?? 254} characters`)
        .pipe(z.email("Enter an email like name@example.com"));
      break;
    case "tel":
      schema = z
        .string({ error: req })
        .max(40, PHONE_MSG)
        .transform(normalizePhone)
        .refine(isValidPhone, PHONE_MSG);
      break;
    case "number":
      schema = z
        .number({ error: `${def.label} must be a whole number` })
        .int(`${def.label} must be a whole number`)
        .min(def.min ?? 0, `${def.label} must be at least ${def.min ?? 0}`)
        .max(def.max ?? 1_000_000, `${def.label} must be at most ${def.max ?? 1_000_000}`);
      break;
    case "checkbox":
      schema = z.boolean({ error: "Choose yes or no" });
      break;
    case "select":
      schema = z.enum((def.options ?? []).map((o) => o.value) as [string, ...string[]], { error: `Choose a ${def.label.toLowerCase()}` });
      break;
    case "date":
      schema = z.string({ error: req }).refine(isValidDate, "Enter a date like 2026-12-05");
      break;
    case "time":
      schema = z.string({ error: req }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 14:30");
      break;
    default: {
      const max = def.maxLength ?? 1000;
      const s = z.string({ error: req }).trim().max(max, `Keep this under ${max} characters`);
      schema = required ? s.min(1, req) : s;
    }
  }
  return required ? schema : schema.nullish();
}

export interface BookingSchemaArgs {
  type: SessionType;
  catalogue: IntakeFieldDef[];
  portfolioOptOutEnabled: boolean;
}

export type ParsedBooking = {
  sessionTypeId: string;
  startUtc: string;
  durationMin?: number;
  miniSlotId?: string | null;
  contact: { fullName: string; email: string; phone: string; preferredContact: "email" | "call" | "text" };
  subjectsNames: string;
  people: { adults: number; children: number; pets: number };
  location?: { kind: "suggested"; optionId: string } | { kind: "own"; text: string } | { kind: "help_me_choose" };
  styleNotes?: string | null;
  mustHaveShots?: string | null;
  anythingElse?: string | null;
  heardAbout?: string | null;
  extra: Record<string, Record<string, string | number | boolean | null | undefined>>;
  portfolioOptOut?: boolean | null;
  policy: { accepted: true; version: string };
  website?: string;
};

export function buildBookingSchema({ type, catalogue, portfolioOptOutEnabled }: BookingSchemaArgs): z.ZodType<ParsedBooking> {
  const defs = byId(catalogue);
  const def = (id: string): IntakeFieldDef => {
    const d = defs.get(id);
    if (!d) throw new Error(`Intake field ${id} is not in the catalogue`);
    return d;
  };
  const short = type.commonFieldsProfile === "short";

  // ---- extra fields grouped by the part of the id before the dot ----
  const groups = new Map<string, Record<string, z.ZodType>>();
  for (const f of type.intakeExtraFields) {
    const [prefix, name] = f.id.split(".") as [string, string];
    const shape = groups.get(prefix) ?? {};
    shape[name] = fieldSchema(def(f.id), f.required);
    groups.set(prefix, shape);
  }
  const extraShape: Record<string, z.ZodType> = {};
  for (const [prefix, shape] of groups) {
    extraShape[prefix] = z.preprocess((v) => (v === undefined ? {} : v), z.strictObject(shape));
  }
  const extra = z.preprocess((v) => (v === undefined ? {} : v), z.strictObject(extraShape));

  const common = (id: string, required: boolean) => fieldSchema(def(id), required);
  const shape: Record<string, z.ZodType> = {
    sessionTypeId: z.string({ error: "Choose a session type" }).max(60),
    startUtc: z
      .string({ error: "Choose a time" })
      .refine((v) => normalizeInstant(v) !== null, "Choose a time")
      .transform((v) => normalizeInstant(v) as string),
    durationMin: z.number().int().min(5).max(24 * 60).optional(),
    miniSlotId: z.string().max(60).nullish(),
    contact: z.strictObject({
      fullName: common("contact.fullName", true),
      email: common("contact.email", true),
      phone: common("contact.phone", true),
      preferredContact: common("contact.preferredContact", true),
    }),
    subjectsNames: common("subjectsNames", true),
    people: z.strictObject({
      adults: common("people.adults", true),
      children: common("people.children", true),
      pets: common("people.pets", true),
    }),
    anythingElse: common("anythingElse", false),
    heardAbout: common("heardAbout", false),
    extra,
    policy: z.strictObject({
      accepted: z
        .boolean({ error: "Please accept the policies to book" })
        .refine((v) => v === true, "Please accept the policies to book"),
      version: z.string({ error: "Policy version is required" }).max(40),
    }),
    website: z.string().max(200).optional(),
  };
  if (!short) {
    shape.styleNotes = common("styleNotes", false);
    shape.mustHaveShots = common("mustHaveShots", false);
    shape.location = z.discriminatedUnion(
      "kind",
      [
        z.strictObject({ kind: z.literal("suggested"), optionId: z.string().max(60) }),
        z.strictObject({ kind: z.literal("own"), text: z.string().trim().min(1, "Enter the location").max(300, "Keep this under 300 characters") }),
        z.strictObject({ kind: z.literal("help_me_choose") }),
      ],
      { error: "Choose a location" },
    );
  }
  if (portfolioOptOutEnabled) shape.portfolioOptOut = z.boolean().nullish();

  return z.strictObject(shape).superRefine((v, ctx) => {
    const o = v as unknown as ParsedBooking;
    const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });

    const total = o.people.adults + o.people.children; // pets are not people
    if (total < 1) add(["people", "adults"], "At least one person is needed");
    if (type.maxPeople !== null && type.extraPersonFeeCents === undefined && total > type.maxPeople) {
      add(["people", "adults"], `This session is for up to ${type.maxPeople} people`);
    }

    if (type.kind === "mini") {
      if (!o.miniSlotId) add(["miniSlotId"], "Choose a mini time");
    } else if (o.miniSlotId) {
      add(["miniSlotId"], "Only Holiday Minis use a mini slot");
    }

    if (type.durationOptionsMin) {
      if (o.durationMin === undefined) add(["durationMin"], "Choose how long you need");
      else if (!type.durationOptionsMin.includes(o.durationMin)) add(["durationMin"], "Choose one of the listed lengths");
    } else if (o.durationMin !== undefined && o.durationMin !== type.durationMin) {
      add(["durationMin"], "That length isn't available for this session");
    }

    if (!short) {
      const loc = o.location;
      if (loc?.kind === "suggested" && !type.locationOptions.some((l) => l.id === loc.optionId)) add(["location", "optionId"], "Choose one of the listed locations");
      if (loc?.kind === "own" && !type.allowOwnLocation) add(["location"], "This session doesn't take your own location");
      if (loc?.kind === "help_me_choose" && !type.allowHelpMeChoose) add(["location"], "Please choose a location");
    }

    // Events: the end must be after the start (story 005 #8)
    const ev = o.extra["events"];
    if (ev && typeof ev["eventStartTime"] === "string" && typeof ev["eventEndTime"] === "string" && ev["eventEndTime"] <= ev["eventStartTime"]) {
      add(["extra", "events", "eventEndTime"], "The event must end after it starts");
    }
  }) as unknown as z.ZodType<ParsedBooking>;
}
