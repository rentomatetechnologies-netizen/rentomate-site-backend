import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE } from "../auth/session-token";
import { HttpError } from "../lib/http-error";
import { findSession } from "../services/auth.service";

/** Rejects requests without a valid, unexpired session (checked against the database on every request). */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  const admin = typeof token === "string" && token ? await findSession(token) : null;
  if (!admin) throw new HttpError(401, "Please log in.");
  req.admin = admin;
  next();
}

/** For handlers mounted behind requireAdmin. */
export function currentAdmin(req: Request) {
  if (!req.admin) throw new HttpError(401, "Please log in.");
  return req.admin;
}
