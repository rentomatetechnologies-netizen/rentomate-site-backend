import type { Request, Response } from "express";
import { z } from "zod";
import { SESSION_COOKIE, sessionCookieOptions } from "../auth/session-token";
import { HttpError } from "../lib/http-error";
import { currentAdmin } from "../middleware/require-admin";
import * as authService from "../services/auth.service";

const loginSchema = z.object({ username: z.string().max(100), password: z.string().max(200) });
const passwordSchema = z.object({ currentPassword: z.string().max(500), newPassword: z.string().max(500) });

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Enter your username and password.");

  const { token, expiresAt, admin } = await authService.login(parsed.data.username, parsed.data.password, {
    ip: req.ip ?? "unknown",
    userAgent: req.get("user-agent") ?? "",
  });
  res.cookie(SESSION_COOKIE, token, { ...sessionCookieOptions(), expires: expiresAt });
  res.json({ username: admin.username });
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && token) await authService.logout(token);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.json({ ok: true });
}

export function me(req: Request, res: Response) {
  const { id, username } = currentAdmin(req);
  res.json({ id, username });
}

export async function changePassword(req: Request, res: Response) {
  const admin = currentAdmin(req);
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Fill in both password fields.");
  await authService.changePassword(admin.id, admin.sessionHash, parsed.data.currentPassword, parsed.data.newPassword);
  res.json({ ok: true });
}
