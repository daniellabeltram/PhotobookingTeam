// The one error type handlers throw. http.ts turns it into the documented error body.
import { ERROR_STATUS, type ErrorCode } from "../../shared/errors";

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly headers?: Record<string, string>;
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, headers?: Record<string, string>) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
    this.headers = headers;
  }
}

export const notFound = (message = "We couldn't find that."): HttpError => new HttpError("NOT_FOUND", message);
