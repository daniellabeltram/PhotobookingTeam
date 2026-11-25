// Request builders for the documented API (docs/api.md). Pure TS: usable from vitest and Playwright.
import { BASE_URL, CLIENT, TYPE_IDS, type TypeKey, ADMIN_EMAIL, ADMIN_PASSWORD } from "./seed";
import { addMinutesHHmm } from "./clock";

export type Slot = { startUtc: string; endUtc: string; localDate: string; localTime: string; label: string; rangeLabel: string; miniSlotId?: string };
export type Day = { date: string; status: "open" | "closed" | "full"; slots: Slot[]; mini?: { spotsLeft: number; totalSpots: number; location: string; theme: string | null } };
export type ApiResult<T = any> = { status: number; headers: Headers; body: T; raw: Response };

/** A transport sends a Request and returns a Response (real HTTP, or a handler call in vitest). */
export type Transport = (req: Request) => Promise<Response>;
export const httpTransport: Transport = (req) => fetch(req);

export const newKey = () => crypto.randomUUID();

export class Api {
  cookie = "";
  private transport: Transport;
  private base: string;
  constructor(transport: Transport = httpTransport, base: string = BASE_URL) {
    this.transport = transport;
    this.base = base;
  }

  async call<T = any>(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string>; idempotencyKey?: string | null; origin?: boolean; rawBody?: string; ip?: string } = {}): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    const hasBody = opts.body !== undefined || opts.rawBody !== undefined;
    if (hasBody) headers["content-type"] ??= "application/json";
    if (this.cookie) headers["cookie"] = this.cookie;
    if (opts.origin ?? (method !== "GET" && path.startsWith("/api/admin"))) headers["origin"] = this.base;
    if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;
    if (opts.ip) headers["x-nf-client-connection-ip"] = opts.ip;
    const req = new Request(this.base + path, { method, headers, body: hasBody ? (opts.rawBody ?? JSON.stringify(opts.body)) : undefined });
    const res = await this.transport(req);
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* csv or empty */ }
    return { status: res.status, headers: res.headers, body, raw: res };
  }
  get = <T = any>(path: string, o?: Parameters<Api["call"]>[2]) => this.call<T>("GET", path, o);
  post = <T = any>(path: string, body?: unknown, o: Parameters<Api["call"]>[2] = {}) => this.call<T>("POST", path, { ...o, body });
  patch = <T = any>(path: string, body?: unknown, o: Parameters<Api["call"]>[2] = {}) => this.call<T>("PATCH", path, { ...o, body });
  del = <T = any>(path: string, o?: Parameters<Api["call"]>[2]) => this.call<T>("DELETE", path, o);

  /** Signs in and keeps the session cookie (dbp_admin locally, __Host-dbp_admin in production). */
  async login(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
    const r = await this.post("/api/admin/login", { email, password });
    const set = r.raw.headers.getSetCookie?.() ?? [];
    const c = set.map((s) => s.split(";")[0] ?? "").find((s) => /dbp_admin=/.test(s));
    if (r.status === 200 && c) this.cookie = c;
    return r;
  }

  availability(type: TypeKey | string, from: string, to: string, durationMin?: number) {
    const id = (TYPE_IDS as Record<string, string>)[type] ?? type;
    return this.get<{ data: { days: Day[]; firstOpenDate: string | null; horizonEndDate: string } }>(
      `/api/availability?type=${id}&from=${from}&to=${to}${durationMin ? `&durationMin=${durationMin}` : ""}`,
    );
  }

  createBooking(body: unknown, key: string | null = newKey(), o: Parameters<Api["call"]>[2] = {}) {
    return this.post("/api/bookings", body, { ...o, idempotencyKey: key });
  }
}

/** First open slot of a type on/after `from` (within 60 days). Returns the day too. */
export async function firstOpenSlot(api: Api, type: TypeKey | string, from: string, to: string, durationMin?: number, nth = 0) {
  const r = await api.availability(type, from, to, durationMin);
  if (r.status !== 200) throw new Error(`availability ${type} -> ${r.status} ${JSON.stringify(r.body)}`);
  const slots = r.body.data.days.filter((d) => d.status === "open").flatMap((d) => d.slots.map((s) => ({ ...s, day: d })));
  const picked = slots[nth];
  if (!picked) throw new Error(`no open slot #${nth} for ${type} ${from}..${to}`);
  return picked;
}

export const POLICY_VERSION = "v0.1-draft";

type BodyOpts = {
  type: TypeKey;
  slot: Slot;
  durationMin?: number;
  contact?: Partial<{ fullName: string; email: string; phone: string; preferredContact: string }>;
  policyAccepted?: boolean;
  policyVersion?: string;
  override?: Record<string, unknown>;
};

/** A valid POST /api/bookings body for any session type (docs/api.md). Field names for `extra` follow docs/api.md and the
 *  intake catalogue; if shared/api-types.ts differs, fix them HERE, once. */
export function buildBookingBody(o: BodyOpts): Record<string, any> {
  const id = TYPE_IDS[o.type];
  const contact = { fullName: CLIENT.fullName, email: CLIENT.email, phone: CLIENT.phone, preferredContact: "email", ...o.contact };
  const body: Record<string, any> = {
    sessionTypeId: id,
    startUtc: o.slot.startUtc,
    contact,
    subjectsNames: CLIENT.subjectsNames,
    people: { adults: 2, children: 0, pets: 0 },
    policy: { accepted: o.policyAccepted ?? true, version: o.policyVersion ?? POLICY_VERSION },
    website: "",
  };
  if (o.type === "minis") {
    body.miniSlotId = o.slot.miniSlotId;
    body.people = { adults: 2, children: 2, pets: 0 };
  } else {
    body.location = { kind: "help_me_choose" };
    body.styleNotes = CLIENT.styleNotes;
    body.anythingElse = CLIENT.anythingElse;
    body.portfolioOptOut = false;
  }
  if (o.type === "portraits") body.people = { adults: 1, children: 0, pets: 0 };
  if (o.type === "couples") body.extra = { couples: { occasion: "engagement", surpriseProposal: false } };
  if (o.type === "families") {
    body.people = { adults: 2, children: 2, pets: 1 };
    body.extra = { families: { childrenAges: CLIENT.childrenAges, extendedFamily: false } };
  }
  if (o.type === "events") {
    const dur = o.durationMin ?? 120;
    body.durationMin = dur;
    body.people = { adults: 10, children: 0, pets: 0 };
    body.location = { kind: "own", text: "QA Venue, 1 Clematis St, West Palm Beach" };
    body.extra = {
      events: {
        eventName: "QA Birthday",
        eventType: "Birthday",
        venueAddress: "QA Venue, 1 Clematis St, West Palm Beach",
        eventStartTime: o.slot.localTime,
        eventEndTime: addMinutesHHmm(o.slot.localTime, dur),
        guestCount: 20,
        onsiteContactName: "Pat Planner",
        onsiteContactPhone: "5615550100",
        timeline: "Cake at 4",
      },
    };
  }
  return { ...body, ...(o.override ?? {}) };
}

/** Counts bookings overlapping (buffers included) in an admin list; for the story 004 #9 invariant. */
export function findOverlaps(items: { id: string; busyStartUtc?: string; busyEndUtc?: string; startUtc: string; endUtc: string; status: string }[], bufferMin = 0) {
  const active = items.filter((b) => ["requested", "pending_deposit", "confirmed"].includes(b.status));
  const out: [string, string][] = [];
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!, b = active[j]!;
      const as = +new Date(a.busyStartUtc ?? new Date(+new Date(a.startUtc) - bufferMin * 60000)), ae = +new Date(a.busyEndUtc ?? new Date(+new Date(a.endUtc) + bufferMin * 60000));
      const bs = +new Date(b.busyStartUtc ?? new Date(+new Date(b.startUtc) - bufferMin * 60000)), be = +new Date(b.busyEndUtc ?? new Date(+new Date(b.endUtc) + bufferMin * 60000));
      if (as < be && bs < ae) out.push([a.id, b.id]);
    }
  return out;
}

/** Tiny CSV parser (RFC 4180, handles quotes, doubled quotes, CRLF inside fields). Strips a BOM. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\r" && text[i + 1] === "\n") { row.push(f); rows.push(row); row = []; f = ""; i++; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
