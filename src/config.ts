import "dotenv/config";
import path from "node:path";

const env = process.env;
const isProduction = env.NODE_ENV === "production";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

export const config = {
  isProduction,
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL,
  sessionHours: Number(env.SESSION_HOURS) || 12,
  // Session cookies are HTTPS-only in production unless explicitly disabled (e.g. testing over plain http).
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : isProduction,
  // Which proxies may set X-Forwarded-For. Default trusts loopback and private networks (the website / Docker network).
  trustProxy: env.TRUST_PROXY || "loopback, linklocal, uniquelocal",
  revalidateUrl: env.FRONTEND_REVALIDATE_URL || "",
  revalidateSecret: env.REVALIDATE_SECRET || "",
  // Uploaded images live here, one subfolder per use (blog/, hero/). Default: the "uploads" folder next to this project.
  uploadsDir: path.resolve(env.UPLOADS_DIR || path.join(process.cwd(), "..", "uploads")),
};
