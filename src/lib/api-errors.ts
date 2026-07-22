/**
 * Centralised API error handling for admin (and other) route handlers.
 *
 * Goals:
 *  - One consistent mapping from error → HTTP status (the guards throw the
 *    sentinel strings "UNAUTHORIZED" / "FORBIDDEN" / "NOT_FOUND").
 *  - Never leak an unexpected internal error message to the client; unknown
 *    errors collapse to a generic 500 while the real cause is logged server-side.
 *
 * Usage in a route:
 *   try { ctx = await requirePlatformAdmin({ apiMode: true }); }
 *   catch (e) { return apiError(e); }
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Sentinel messages thrown by the auth guards, mapped to their HTTP status. */
const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BAD_REQUEST: 400,
};

/**
 * Throw this from inside a handler to return a controlled, client-safe error.
 * e.g. `throw new ApiError("Cancellation reason is required", 400)`
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Build the field-level message map from a ZodError (validation failure). */
function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Convert any thrown value into a safe NextResponse.
 * - Auth sentinel strings → 401/403/404
 * - ApiError → its declared status + message
 * - ZodError → 400 with per-field messages
 * - anything else → 500 "Something went wrong" (real cause logged, not leaked)
 */
export function apiError(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }

  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", fields: zodFieldErrors(e) },
      { status: 400 },
    );
  }

  if (e instanceof Error && STATUS_BY_CODE[e.message] !== undefined) {
    return NextResponse.json({ error: e.message }, { status: STATUS_BY_CODE[e.message] });
  }

  // Unknown / unexpected — log the real cause, return an opaque message.
  console.error("[api] unhandled error:", e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
