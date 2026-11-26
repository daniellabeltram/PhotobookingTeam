// GET /api/config: the public projection of the config (ADR 0007). No admin email, rate limits or retention internals.
import type { PublicConfig, PublicSessionType } from "../../../shared/api-types";
import type { SessionType } from "../../../shared/config-schema";
import { addDays, todayEt } from "../../../shared/datetime";
import { depositCardText, depositSummaryText, priceLabel } from "../../../shared/money";
import { getCatalogue, getPolicy } from "../config";
import type { Services } from "../services";
import { computeAvailability } from "./availability";
import { loadWorld } from "./world";

async function nextMiniDates(svc: Services, type: SessionType): Promise<{ date: string; spotsLeft: number }[]> {
  const now = svc.clock.now();
  const today = todayEt(now);
  const end = addDays(today, type.bookingHorizonDays);
  const world = await loadWorld(svc, today, end);
  const res = computeAvailability({
    config: svc.config,
    type,
    durationMin: type.durationMin,
    from: today,
    to: end,
    nowIso: now,
    ledgers: world.ledgers,
    blocks: world.blocks,
  });
  return res.days
    .filter((d) => d.status === "open" && d.mini)
    .slice(0, 3)
    .map((d) => ({ date: d.date, spotsLeft: d.mini?.spotsLeft ?? 0 }));
}

function hasLink(t: SessionType): boolean {
  const l = t.depositPaymentLink;
  return typeof l === "string" ? true : l !== null && Object.keys(l).length > 0;
}

export async function buildPublicConfig(svc: Services): Promise<PublicConfig> {
  const { config } = svc;
  const policy = getPolicy(config.policyVersion);
  if (!policy) throw new Error("current policy missing");
  const sessionTypes: PublicSessionType[] = [];
  for (const t of config.sessionTypes.filter((x) => x.active)) {
    sessionTypes.push({
      id: t.id,
      name: t.name,
      description: t.description,
      included: t.included,
      kind: t.kind,
      bookingMode: t.bookingMode,
      durationMin: t.durationMin,
      ...(t.durationOptionsMin ? { durationOptionsMin: t.durationOptionsMin } : {}),
      bufferMin: t.bufferMin,
      price: { fromCents: t.priceFromCents, unit: t.priceUnit, label: priceLabel(t) },
      deposit: {
        kind: t.deposit.kind,
        text: depositSummaryText(t),
        cardText: depositCardText(t),
        ...(t.deposit.kind === "percent" ? { percent: t.deposit.percent } : {}),
        ...(t.deposit.kind === "flat" ? { amountCents: t.deposit.amountCents } : {}),
      },
      hasPaymentLink: hasLink(t),
      maxPeople: t.maxPeople,
      includedPeople: t.includedPeople ?? null,
      extraPersonFeeCents: t.extraPersonFeeCents ?? null,
      locationOptions: t.kind === "mini" ? [] : t.locationOptions,
      allowOwnLocation: t.allowOwnLocation,
      allowHelpMeChoose: t.allowHelpMeChoose,
      commonFieldsProfile: t.commonFieldsProfile,
      intakeExtraFields: t.intakeExtraFields,
      bookingHorizonDays: t.bookingHorizonDays,
      nextMiniDates: t.kind === "mini" ? await nextMiniDates(svc, t) : null,
      whatToBringText: t.whatToBringText,
    });
  }
  return {
    business: {
      name: config.business.name,
      contactEmail: config.business.contactEmail,
      siteUrl: config.business.siteUrl,
      timezone: config.business.timezone,
    },
    scheduling: {
      minimumNoticeHours: config.scheduling.minimumNoticeHours,
      unpaidHoldHours: config.scheduling.unpaidHoldHours,
      requestResponseDays: config.scheduling.requestResponseDays,
    },
    features: { portfolioOptOutEnabled: config.features.portfolioOptOutEnabled },
    privacy: {
      dataRetentionMonths: config.privacy.dataRetentionMonths,
      privacyContactEmail: config.privacy.privacyContactEmail,
      lastUpdated: config.privacy.lastUpdated,
    },
    policy: { version: policy.version, summaryTemplate: policy.summaryTemplate, summaryVariants: policy.summaryVariants, values: policy.values },
    intakeFields: getCatalogue().map((f) => ({ ...f })),
    sessionTypes,
  };
}
