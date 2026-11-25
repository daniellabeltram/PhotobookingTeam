// Error codes and their HTTP status (docs/api.md "Error codes"). Browser-safe.
export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  SLOT_TAKEN: 409,
  POLICY_VERSION_CHANGED: 409,
  REQUEST_IN_PROGRESS: 409,
  VERSION_CONFLICT: 409,
  BLOCK_OVERLAPS_BOOKINGS: 409,
  MINI_DAY_HAS_BOOKINGS: 409,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_TRANSITION: 422,
  IDEMPOTENCY_KEY_REUSED: 422,
  SESSION_TYPE_UNAVAILABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  BUSY: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
}
