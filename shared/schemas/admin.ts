// Request schemas for the admin endpoints and the public query strings (docs/api.md). Browser-safe.
import { z } from "zod";
import { isValidDate, normalizeInstant } from "../datetime";
import { BOOKING_STATUSES } from "../status";

const instant = z
  .string({ error: "Choose a time" })
  .refine((v) => normalizeInstant(v) !== null, "Choose a time")
  .transform((v) => normalizeInstant(v) as string);
const etDate = (msg = "Enter a date like 2026-12-05") => z.string({ error: msg }).refine(isValidDate, msg);
const version = z.number({ error: "expectedVersion is required" }).int().min(1);
const note = (max = 1000) => z.string().trim().max(max, `Keep this under ${max} characters`);

export const loginSchema = z.strictObject({
  email: z.string({ error: "Enter your email" }).trim().min(1, "Enter your email").max(254),
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password").max(200),
  totp: z.string().trim().max(12).optional(),
});

export const patchSchema = z.discriminatedUnion(
  "action",
  [
    z.strictObject({ action: z.literal("approve"), expectedVersion: version }),
    z.strictObject({
      action: z.literal("decline"),
      expectedVersion: version,
      messageToClient: note().optional(),
      note: note().optional(),
      notifyClient: z.boolean().optional(),
    }),
    z.strictObject({
      action: z.literal("mark_paid"),
      expectedVersion: version,
      amountCents: z.number({ error: "Enter the amount received" }).int("Enter whole cents").min(0).max(100_000_000),
      receivedOn: etDate("Enter the date received"),
      method: note(50).optional(),
      note: note().optional(),
    }),
    z.strictObject({
      action: z.literal("confirm_without_payment"),
      expectedVersion: version,
      note: z.string({ error: "A note is required" }).trim().min(1, "A note is required").max(1000),
    }),
    z.strictObject({
      action: z.literal("cancel"),
      expectedVersion: version,
      reason: z.enum(["client_cancelled", "deposit_not_received", "photographer_cancelled", "other"], { error: "Choose a reason" }),
      note: note().optional(),
      notifyClient: z.boolean().optional(),
    }),
    z.strictObject({ action: z.literal("complete"), expectedVersion: version }),
  ],
  { error: "Choose an action" },
);

export const rescheduleSchema = z.strictObject({
  expectedVersion: version,
  startUtc: instant,
  durationMin: z.number().int().min(5).max(24 * 60).optional(),
  miniSlotId: z.string().max(60).nullish(),
  reason: z.enum(["client_request", "weather", "photographer"], { error: "Choose a reason" }),
  note: note().optional(),
  notifyClient: z.boolean().optional(),
});

export const resendSchema = z.strictObject({
  kind: z.enum(["booking_received", "request_received", "approved", "declined", "confirmed", "cancelled", "rescheduled"]).optional(),
});

export const deleteDataSchema = z.strictObject({
  confirmReference: z.string({ error: "Type the booking reference to confirm" }).trim().max(20),
  expectedVersion: version,
});

const label = z.string().trim().max(100, "Keep the label under 100 characters").nullish();
export const blockSchema = z.discriminatedUnion(
  "kind",
  [
    z.strictObject({
      kind: z.literal("all_day"),
      startDate: etDate("Enter a start date"),
      endDate: etDate("Enter an end date"),
      label,
      confirmOverlaps: z.boolean().optional(),
    }),
    z.strictObject({
      kind: z.literal("time_range"),
      startDate: etDate("Enter a date"),
      endDate: etDate("Enter a date"),
      startTime: z.string({ error: "Enter a start time" }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 15:00"),
      endTime: z.string({ error: "Enter an end time" }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 18:00"),
      label,
      confirmOverlaps: z.boolean().optional(),
    }),
  ],
  { error: "Choose a block type" },
);

export const miniSlotsSchema = z.strictObject({
  location: z.string().trim().min(1, "Enter a location").max(100, "Keep the location under 100 characters").optional(),
  theme: z.string().trim().max(60, "Keep the theme under 60 characters").nullish(),
  startTimes: z.array(z.string().max(40), { error: "Add at least one start time" }).min(1, "Add at least one start time").max(30, "Add at most 30 times at once"),
});

// ---- query strings ----
const csvList = (allowed?: readonly string[]) =>
  z
    .string()
    .max(300)
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
    .refine((l) => !allowed || l.every((x) => allowed.includes(x)), "Unknown value in the list");

export const listQuerySchema = z.object({
  view: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  status: csvList(BOOKING_STATUSES).optional(),
  rescheduled: z.literal("true").optional(),
  flag: z.enum(["deposit_overdue", "reply_overdue", "email_not_sent"]).optional(),
  type: csvList().optional(),
  from: etDate().optional(),
  to: etDate().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const availabilityQuerySchema = z.object({
  type: z.string({ error: "type is required" }).min(1, "type is required").max(60),
  from: etDate().optional(),
  to: etDate().optional(),
  durationMin: z.coerce.number().int().min(5).max(24 * 60).optional(),
  excludeBookingId: z.string().max(20).optional(),
});
