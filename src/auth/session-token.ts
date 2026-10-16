import crypto from "node:crypto";
import type { CookieOptions } from "express";
import { config } from "../config";

// The cookie holds a random token; the database only stores its SHA-256 hash,
// so a leaked database can't be used to hijack sessions.

export const SESSION_COOKIE = "rom_admin_session";

export const newSessionToken = () => crypto.randomBytes(32).toString("base64url");

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "strict",
  secure: config.cookieSecure,
  path: "/",
});
