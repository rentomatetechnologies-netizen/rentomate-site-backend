import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";

/**
 * Write requests must carry `x-rentomate-admin: 1`. Browsers don't let other sites add custom headers
 * without a CORS preflight (which this API never approves), so this blocks cross-site request forgery.
 * Combined with the SameSite=Strict session cookie.
 */
export const CSRF_HEADER = "x-rentomate-admin";

export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD" && req.get(CSRF_HEADER) !== "1") {
    throw new HttpError(403, "Invalid request.");
  }
  next();
}
