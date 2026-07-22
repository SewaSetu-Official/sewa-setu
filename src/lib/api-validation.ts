/**
 * Request validation helpers built on zod.
 *
 * Routes call `parseBody(req, schema)` instead of hand-rolling `req.json()` +
 * manual field checks. On failure these throw, and `apiError()` renders a safe
 * 400 with per-field messages — so a route's catch block handles validation,
 * auth, and unexpected errors uniformly.
 */
import { z, ZodError } from "zod";
import { ApiError } from "@/lib/api-errors";

/** Parse + validate a JSON request body. Throws on bad JSON or schema failure. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("Invalid JSON", 400);
  }
  return schema.parse(raw); // throws ZodError → handled by apiError
}

/** Validate already-extracted query params (a plain object) against a schema. */
export function parseQuery<T extends z.ZodTypeAny>(
  params: Record<string, unknown>,
  schema: T,
): z.infer<T> {
  return schema.parse(params);
}

export { z, ZodError };
