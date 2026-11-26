// The only file that talks to /api. Everything is typed by ./types.
import type {
  ActionResult,
  AdminSession,
  Availability,
  BlockCreateBody,
  BlockItem,
  BookingDetail,
  BookingFilters,
  BookingList,
  BookingRequestBody,
  BookingResult,
  EmailKind,
  MiniDay,
  MiniSlotsResult,
  OverlapBooking,
  PolicyDoc,
  PublicConfig,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly retryAfter: number | null;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}, retryAfter: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }

  /** True when we never got an answer, so the server may or may not have acted. */
  get isNetwork(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }

  fieldErrors(): Record<string, string> {
    const fe = this.details['fieldErrors'];
    return fe && typeof fe === 'object' ? (fe as Record<string, string>) : {};
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

let unauthorizedHandler: (() => void) | null = null;
/** The admin app registers this so any 401 sends the user back to sign in. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  opts.signal?.addEventListener('abort', () => controller.abort());
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    credentials: 'same-origin',
    signal: controller.signal,
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), init);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    const timedOut = controller.signal.aborted;
    throw new ApiError(0, timedOut ? 'TIMEOUT' : 'NETWORK', "We can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;
    const retry = Number(res.headers.get('Retry-After'));
    const err = new ApiError(
      res.status,
      e?.code ?? 'INTERNAL',
      e?.message ?? 'Something went wrong. Please try again.',
      e?.details ?? {},
      Number.isFinite(retry) && retry > 0 ? retry : null,
    );
    if (res.status === 401 && err.code === 'UNAUTHORIZED' && unauthorizedHandler) unauthorizedHandler();
    throw err;
  }
  return (json as { data: T }).data;
}

// ---------- Public ----------
export const getConfig = (): Promise<PublicConfig> => request('/api/config');
export const getPolicy = (version: string): Promise<PolicyDoc> =>
  request(`/api/policies/${encodeURIComponent(version)}`);

export function getAvailability(p: {
  type: string;
  from?: string;
  to?: string;
  durationMin?: number;
}): Promise<Availability> {
  return request('/api/availability', { query: p });
}

export function createBooking(body: BookingRequestBody, idempotencyKey: string): Promise<BookingResult> {
  return request('/api/bookings', {
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': idempotencyKey },
    timeoutMs: 25000,
  });
}

// ---------- Admin: session ----------
export const adminLogin = (b: { email: string; password: string; totp?: string }): Promise<AdminSession> =>
  request('/api/admin/login', { method: 'POST', body: b });
export const adminLogout = (): Promise<void> => request('/api/admin/logout', { method: 'POST' });
export const adminSession = (): Promise<AdminSession> => request('/api/admin/session');

// ---------- Admin: bookings ----------
export const listBookings = (f: BookingFilters & { pageSize?: number }): Promise<BookingList> =>
  request('/api/admin/bookings', { query: { ...f } });
export const getBooking = (id: string): Promise<BookingDetail> =>
  request(`/api/admin/bookings/${encodeURIComponent(id)}`);
export const patchBooking = (id: string, body: Record<string, unknown>): Promise<ActionResult> =>
  request(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: 'PATCH', body });
export const rescheduleBooking = (id: string, body: Record<string, unknown>): Promise<ActionResult> =>
  request(`/api/admin/bookings/${encodeURIComponent(id)}/reschedule`, { method: 'POST', body });
export const resendEmail = (id: string, kind?: EmailKind): Promise<{ kind: string; status: string }> =>
  request(`/api/admin/bookings/${encodeURIComponent(id)}/resend-email`, {
    method: 'POST',
    body: kind ? { kind } : {},
  });
export const deleteClientData = (id: string, body: { confirmReference: string; expectedVersion: number }): Promise<{ booking: BookingDetail }> =>
  request(`/api/admin/bookings/${encodeURIComponent(id)}/delete-client-data`, { method: 'POST', body });
export const adminAvailability = (p: {
  type: string;
  from?: string;
  to?: string;
  durationMin?: number;
  excludeBookingId?: string;
}): Promise<Availability> => request('/api/admin/availability', { query: p });

/** A plain link: the browser sends the session cookie and downloads the file. */
export function exportCsvUrl(f: BookingFilters): string {
  const { page: _page, ...rest } = f;
  void _page;
  return buildUrl('/api/admin/export.csv', { ...rest });
}

// ---------- Admin: blocks ----------
export const listBlocks = (includePast = false): Promise<{ items: BlockItem[] }> =>
  request('/api/admin/blocks', { query: includePast ? { includePast: 'true' } : undefined });
export const createBlock = (body: BlockCreateBody): Promise<{ block: BlockItem; overlappingBookings: OverlapBooking[] }> =>
  request('/api/admin/blocks', { method: 'POST', body });
export const deleteBlock = (id: string): Promise<void> =>
  request(`/api/admin/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---------- Admin: mini days ----------
export const listMiniDays = (from?: string): Promise<{ items: MiniDay[] }> =>
  request('/api/admin/mini-days', { query: { from } });
export const addMiniSlots = (date: string, body: { location?: string; theme?: string; startTimes: string[] }): Promise<MiniSlotsResult> =>
  request(`/api/admin/mini-days/${encodeURIComponent(date)}/slots`, { method: 'POST', body });
export const deleteMiniSlot = (date: string, slotId: string): Promise<void> =>
  request(`/api/admin/mini-days/${encodeURIComponent(date)}/slots/${encodeURIComponent(slotId)}`, { method: 'DELETE' });
export const deleteMiniDay = (date: string): Promise<void> =>
  request(`/api/admin/mini-days/${encodeURIComponent(date)}`, { method: 'DELETE' });
