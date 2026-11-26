// GET /api/availability and GET /api/admin/availability share this runner (docs/api.md).
import type { AvailabilityData } from "../../../shared/api-types";
import { addDays, daysBetween, todayEt } from "../../../shared/datetime";
import { normalizeReference } from "../../../shared/reference";
import { availabilityQuerySchema } from "../../../shared/schemas/admin";
import { getSessionType } from "../config";
import { HttpError } from "../errors";
import { fieldErrors, validationFailed, type RequestContext } from "../http";
import { hashIp } from "../ip";
import { computeAvailability } from "./availability";
import { loadWorld, loadWorldForType } from "./world";

export async function runAvailability(url: URL, rc: RequestContext, admin: boolean): Promise<AvailabilityData> {
  const { svc } = rc;
  const parsed = availabilityQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
  const q = parsed.data;

  if (!admin && !svc.env.rateLimitDisabled) {
    const take = await svc.limiter.take("availability", hashIp(rc.ip, svc.env.adminSessionSecret), svc.config.limits.availabilityRateLimit);
    if (!take.allowed) {
      throw new HttpError("RATE_LIMITED", "Too many requests. Please wait a few minutes and try again.", undefined, { "retry-after": String(take.retryAfterSec) });
    }
  }

  const type = getSessionType(svc.config, q.type);
  if (!type || !type.active) throw new HttpError("SESSION_TYPE_UNAVAILABLE", "This session isn't available to book right now.");

  let durationMin = type.durationMin;
  if (type.durationOptionsMin) {
    if (q.durationMin === undefined) throw validationFailed({ durationMin: "Choose how long you need" });
    if (!type.durationOptionsMin.includes(q.durationMin)) throw validationFailed({ durationMin: "Choose one of the listed lengths" });
    durationMin = q.durationMin;
  }

  const now = svc.clock.now();
  const today = todayEt(now);
  const from = q.from ?? today;
  const to = q.to ?? addDays(from, 34);
  if (to < from) throw validationFailed({ to: "The end date must be on or after the start date" });
  if (daysBetween(from, to) > 62) throw validationFailed({ to: "Ask for at most 62 days at a time" });

  const excludeBookingId = admin && q.excludeBookingId ? (normalizeReference(q.excludeBookingId) ?? undefined) : undefined;
  const world = admin ? await loadWorld(svc, from, to) : await loadWorldForType(svc, type, from, to);
  const result = computeAvailability({
    config: svc.config,
    type,
    durationMin,
    from,
    to,
    nowIso: now,
    ledgers: world.ledgers,
    blocks: world.blocks,
    ignoreNoticeAndHorizon: admin,
    excludeBookingId,
    scanFirstOpen: !admin,
  });
  return {
    sessionTypeId: type.id,
    durationMin,
    timezone: "America/New_York",
    from: from < today ? today : from,
    to: !admin && to > result.horizonEndDate ? result.horizonEndDate : to,
    horizonEndDate: result.horizonEndDate,
    firstOpenDate: result.firstOpenDate,
    days: result.days,
  };
}
