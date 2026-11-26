// Client emails (docs/design/emails.md sections 1 and 3, stories 008, 013, 014, 020).
// Greets by first name only and never repeats free-text answers (review M5).
import { formatDateLong, formatDateShort, formatRangeEt, formatTime } from "../../../../shared/datetime";
import { formatUsd } from "../../../../shared/money";
import type { ClientEmailKind } from "../../../../shared/models";
import { firstNameOf } from "../sender";
import { changeParagraph, compose, sessionLines, subj, tipBullets, weatherParagraph, type Block, type EmailContext, type Rendered } from "./common";

function whenWord(ctx: EmailContext): string {
  const b = ctx.booking;
  return `${formatDateShort(b.startUtc)} at ${formatTime(b.startUtc)}`;
}

function paymentBlock(ctx: EmailContext): Block[] {
  const b = ctx.booking;
  const due = formatUsd(b.pricing.amountDueCents);
  const full = b.pricing.amountDueKind === "full";
  const estimated = b.pricing.amountDueKind === "estimated_deposit";
  const hold = ctx.config.scheduling.unpaidHoldHours;
  const title = full ? "One quick step: pay to hold your spot" : "One quick step: hold your date";
  const lead = full
    ? `Mini sessions are paid in full to book. Please pay ${due} within ${hold} hours. If it hasn't arrived by then, your spot may be released.`
    : `Please pay your ${estimated ? "estimated " : ""}${due} retainer within ${hold} hours. If it hasn't arrived by then, your time may be released. The retainer goes toward your session fee.`;
  const blocks: Block[] = [{ title, paragraphs: [lead] }];
  if (b.pricing.paymentLinkUrl) {
    blocks.push({
      link: { label: full ? "Pay in full" : "Pay retainer", url: b.pricing.paymentLinkUrl },
      paragraphs: [`Please include your booking reference ${b.id} with the payment. Once I receive it, I'll send a final "you're confirmed" note.`],
    });
  } else {
    blocks.push({ paragraphs: ["Daniella will send you a payment link shortly."] });
  }
  return blocks;
}

export function renderClientEmail(kind: ClientEmailKind, ctx: EmailContext): Rendered {
  const { config, booking: b } = ctx;
  const name = firstNameOf(b.contact?.fullName);
  const greeting = `Hi ${name},`;
  const policyLine = changeParagraph(config, b.policyVersion, ctx.baseUrl);
  const isMini = b.sessionTypeId === "holiday-minis";
  const when = whenWord(ctx);

  switch (kind) {
    case "booking_received": {
      const confirmed = b.status === "confirmed";
      const subject = subj(
        confirmed
          ? `You're booked: ${when}`
          : isMini
            ? `Your Holiday Mini is booked: ${when}`
            : `Your ${b.sessionTypeName} session is booked: ${when}`,
      );
      const blocks: Block[] = [
        { title: "Your session", lines: sessionLines(ctx) },
        ...(confirmed ? [] : paymentBlock(ctx)),
        { title: "Add it to your calendar", paragraphs: ["The invite is attached (.ics). Open it to add the session."] },
        { title: "What to wear and bring", bullets: tipBullets(ctx.type) },
        { title: "Need to change something?", paragraphs: [weatherParagraph, policyLine] },
      ];
      const { text, html } = compose(
        { preheader: confirmed ? "Your session is booked." : "One quick step to hold your date.", greeting, intro: ["Thank you for booking with me. I'm so excited to photograph you!"], blocks },
        config,
      );
      return { subject, text, html };
    }
    case "request_received": {
      const subject = subj(`We received your event request — ${b.id}`);
      const blocks: Block[] = [
        { title: "Your request", lines: sessionLines(ctx) },
        {
          title: "What happens next",
          paragraphs: [
            "This is a request, so your time is not confirmed yet. I'm holding it for you while I review.",
            `I'll reply within ${config.scheduling.requestResponseDays} days. If it's a yes, I'll send a link for the retainer to lock in your date.`,
            "No payment is due yet.",
          ],
        },
        { title: "Planning", bullets: tipBullets(ctx.type) },
        { paragraphs: [policyLine] },
      ];
      const { text, html } = compose(
        { preheader: "Request received. Not confirmed yet.", greeting, intro: ["Thank you for thinking of me for your event."], blocks },
        config,
      );
      return { subject, text, html };
    }
    case "approved": {
      const subject = subj(`Your event is approved — ${b.id}`);
      const blocks: Block[] = [
        { title: "Your event", lines: sessionLines(ctx) },
        ...paymentBlock(ctx),
        { title: "Add it to your calendar", paragraphs: ["The invite is attached (.ics)."] },
        { title: "Planning", bullets: tipBullets(ctx.type) },
        { paragraphs: [weatherParagraph, policyLine] },
      ];
      const { text, html } = compose(
        { preheader: "Good news: your event is approved.", greeting, intro: ["I'd love to photograph your event. Good news: it's approved!"], blocks },
        config,
      );
      return { subject, text, html };
    }
    case "declined": {
      const subject = subj(`About your event request — ${b.id}`);
      const note = b.decline?.messageToClient?.trim();
      const blocks: Block[] = [
        { paragraphs: [`I'm not able to take ${formatDateLong(b.startUtc)} at ${formatTime(b.startUtc)} Eastern Time.`] },
        ...(note ? [{ title: "A note from Daniella", paragraphs: [note] }] : []),
        { paragraphs: ["No payment was taken and nothing is owed.", `I'd be happy to look at another date: choose a new time at ${ctx.baseUrl}/ or just reply and let me know.`] },
      ];
      const { text, html } = compose(
        { preheader: "An update on your event request.", greeting, intro: ["Thank you for thinking of me for your event."], blocks, signoff: ["Warmly,", "Daniella", config.business.name] },
        config,
      );
      return { subject, text, html };
    }
    case "confirmed": {
      const subject = subj(`You're confirmed: ${when}`);
      const paid = b.payment ? `Your ${formatUsd(b.payment.amountCents)} retainer arrived. ` : "";
      const blocks: Block[] = [
        { title: "Your session", lines: sessionLines(ctx) },
        { paragraphs: ["Your calendar invite is attached. Tips for what to wear are in your first email.", weatherParagraph, policyLine] },
      ];
      const { text, html } = compose(
        { preheader: "You're confirmed.", greeting, intro: [`${paid}You're confirmed!`], blocks },
        config,
      );
      return { subject, text, html };
    }
    case "cancelled": {
      const subject = subj(`Your ${b.sessionTypeName} on ${formatDateShort(b.startUtc)} was cancelled`);
      const blocks: Block[] = [
        { paragraphs: [`Your session on ${formatDateLong(b.startUtc)}, ${formatRangeEt(b.startUtc, b.endUtc)}, has been cancelled.`, "Questions about your retainer or a new date? Just reply and I'll sort it out."] },
      ];
      const { text, html } = compose({ preheader: "Your session was cancelled.", greeting, intro: [], blocks, signoff: ["Warmly,", "Daniella", config.business.name] }, config);
      return { subject, text, html };
    }
    case "rescheduled": {
      const stillRequest = b.status === "requested";
      const subject = subj(stillRequest ? `Your event request has a new time — ${b.id}` : `Your ${b.sessionTypeName} has moved: ${when}`);
      const blocks: Block[] = [
        { title: stillRequest ? "Your request" : "Your new time", lines: sessionLines(ctx) },
        {
          paragraphs: stillRequest
            ? ["This is still a request awaiting my approval, so it isn't confirmed yet. No payment is due yet."]
            : ["Your updated calendar invite is attached. It replaces the earlier one.", weatherParagraph],
        },
        { paragraphs: [policyLine] },
      ];
      const { text, html } = compose(
        { preheader: "Your session time changed.", greeting, intro: ["Your session time has changed."], blocks },
        config,
      );
      return { subject, text, html };
    }
  }
}
