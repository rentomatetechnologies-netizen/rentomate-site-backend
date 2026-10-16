import { DUMMY_HASH, hashPassword, normalizeUsername, passwordProblem, verifyPassword } from "../auth/password";
import { hashToken, newSessionToken } from "../auth/session-token";
import { config } from "../config";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";

// Login, sessions and password changes. All credential checks happen here, on the server.

const ATTEMPT_WINDOW_MS = 15 * 60_000;
const MAX_FAILS_PER_USERNAME = 8;
const MAX_FAILS_PER_IP = 30;

type ClientInfo = { ip: string; userAgent: string };

async function isLoginBlocked(username: string, ip: string) {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const [byUser, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { username, createdAt: { gt: since } } }),
    prisma.loginAttempt.count({ where: { ip, createdAt: { gt: since } } }),
  ]);
  return byUser >= MAX_FAILS_PER_USERNAME || byIp >= MAX_FAILS_PER_IP;
}

/** Checks credentials and opens a session. Returns the raw session token for the cookie. */
export async function login(rawUsername: string, password: string, client: ClientInfo) {
  const username = normalizeUsername(rawUsername);

  if (await isLoginBlocked(username, client.ip)) {
    throw new HttpError(429, "Too many failed attempts. Please wait 15 minutes and try again.");
  }

  const admin = await prisma.admin.findUnique({ where: { username } });
  // Always run a hash comparison so timing doesn't reveal whether the username exists.
  const valid = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);

  if (!admin || !valid) {
    await prisma.$transaction([
      prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - ATTEMPT_WINDOW_MS) } } }),
      prisma.loginAttempt.create({ data: { username, ip: client.ip } }),
    ]);
    throw new HttpError(401, "Incorrect username or password.");
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionHours * 3600_000);
  await prisma.$transaction([
    prisma.loginAttempt.deleteMany({ where: { username } }),
    prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    prisma.session.create({
      data: { tokenHash: hashToken(token), adminId: admin.id, expiresAt, ip: client.ip, userAgent: client.userAgent.slice(0, 300) },
    }),
    prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
  ]);

  return { token, expiresAt, admin: { id: admin.id, username: admin.username } };
}

/** The admin behind a session token, or null if missing/expired/revoked. */
export async function findSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { tokenHash: true, expiresAt: true, admin: { select: { id: true, username: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return { ...session.admin, sessionHash: session.tokenHash };
}

export const logout = (token: string) => prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });

/** Changes the password and signs this admin out on every other device. */
export async function changePassword(adminId: number, keepSessionHash: string, currentPassword: string, newPassword: string) {
  const admin = await prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
  if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
    throw new HttpError(400, "Your current password is incorrect.");
  }
  const problem = passwordProblem(newPassword);
  if (problem) throw new HttpError(400, problem);

  await prisma.$transaction([
    prisma.admin.update({ where: { id: adminId }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.session.deleteMany({ where: { adminId, NOT: { tokenHash: keepSessionHash } } }),
  ]);
}
