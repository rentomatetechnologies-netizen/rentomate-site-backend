// `npm run admin:create -- <username>` (or `node dist/scripts/create-admin.js <username>` in Docker):
// creates an admin, or resets the password if the username exists.
// The password is asked for interactively (hidden), or read from ADMIN_PASSWORD when not in a terminal.
import { hashPassword, normalizeUsername, passwordProblem, usernameProblem } from "../auth/password";
import { prisma } from "../lib/prisma";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (char: string) => {
      if (char === "\r" || char === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (char === "\u0003") {
        process.exit(130);
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const username = normalizeUsername(process.argv[2] || "");
  const usernameError = usernameProblem(username);
  if (usernameError) throw new Error(`${usernameError}\nUsage: npm run admin:create -- <username>`);

  let password = process.env.ADMIN_PASSWORD || "";
  if (process.stdin.isTTY) {
    password = await askHidden(`Password for ${username}: `);
    if ((await askHidden("Repeat password: ")) !== password) throw new Error("Passwords do not match.");
  }
  const passwordError = passwordProblem(password);
  if (passwordError) throw new Error(passwordError);

  const passwordHash = await hashPassword(password);
  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    // Resetting a password signs that admin out everywhere.
    await prisma.$transaction([
      prisma.admin.update({ where: { id: existing.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { adminId: existing.id } }),
    ]);
    console.log(`Password reset for "${username}".`);
  } else {
    await prisma.admin.create({ data: { username, passwordHash } });
    console.log(`Created admin "${username}".`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
