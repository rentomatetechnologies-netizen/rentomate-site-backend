import { hashPassword, normalizeUsername, passwordProblem, usernameProblem } from "../auth/password";
import { HttpError, notFound } from "../lib/http-error";
import { prisma } from "../lib/prisma";

const publicFields = { id: true, username: true, createdAt: true, lastLoginAt: true } as const;

export const listAdmins = () => prisma.admin.findMany({ orderBy: { username: "asc" }, select: publicFields });

export async function createAdmin(rawUsername: string, password: string) {
  const username = normalizeUsername(rawUsername);
  const problem = usernameProblem(username) ?? passwordProblem(password);
  if (problem) throw new HttpError(400, problem);

  if (await prisma.admin.findUnique({ where: { username }, select: { id: true } })) {
    throw new HttpError(409, `The username "${username}" is already taken.`);
  }
  return prisma.admin.create({ data: { username, passwordHash: await hashPassword(password) }, select: publicFields });
}

export async function deleteAdmin(id: number, currentAdminId: number) {
  if (id === currentAdminId) throw new HttpError(400, "You can't remove your own account.");
  // Their sessions are deleted too (cascade), signing them out everywhere.
  const { count } = await prisma.admin.deleteMany({ where: { id } });
  if (!count) throw notFound("Admin");
}
