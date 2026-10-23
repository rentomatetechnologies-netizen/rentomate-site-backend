import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Upload subfolders inside UPLOADS_DIR: blog post images and homepage hero slides. */
export const MEDIA_FOLDERS = ["blog", "hero"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export const isMediaFolder = (value: unknown): value is MediaFolder => MEDIA_FOLDERS.includes(value as MediaFolder);

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

// Detect the type from the file's bytes, not the client-supplied MIME type. SVG is not accepted (can carry scripts).
function detectImageType(bytes: Buffer): keyof typeof EXTENSIONS | null {
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString("latin1");
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 12) === "ftypavif") return "image/avif";
  return null;
}

// Multipart filenames arrive latin1-decoded; re-decode so names like "குடிநீர்.jpg" survive.
const decodeFilename = (name: string) => (/[^\x00-\xff]/.test(name) ? name : Buffer.from(name, "latin1").toString("utf8"));

/** The uploaded file's own name without its extension, minus anything unsafe in a path or URL. */
function baseName(originalName: string) {
  const name = path.basename(decodeFilename(originalName).replace(/\\/g, "/"));
  const stem = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const safe = stem
    .replace(/[\x00-\x1f\x7f/\\:*?"<>|#%&{}^~[\]`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 150);
  return safe || "image";
}

/**
 * Saves an uploaded image under the name it was uploaded with, as UPLOADS_DIR/<folder>/<name>.<ext>, and returns
 * its public URL path, e.g. /media/blog/ro-purifier.jpg. If that name is taken, -1, -2, … is added so an existing
 * image (cached forever by browsers) is never overwritten.
 */
export async function saveImage(folder: MediaFolder, bytes: Buffer, originalName: string) {
  const mimeType = detectImageType(bytes);
  if (!mimeType) throw new HttpError(400, "Only JPG, PNG, WebP, GIF or AVIF images are allowed.");

  const dir = path.join(config.uploadsDir, folder);
  await fs.mkdir(dir, { recursive: true });
  const base = baseName(originalName);

  // "wx" fails if the file already exists, so two uploads at the same moment can't overwrite each other.
  for (let n = 0; ; n++) {
    const filename = `${n === 0 ? base : `${base}-${n}`}.${EXTENSIONS[mimeType]}`;
    try {
      await fs.writeFile(path.join(dir, filename), bytes, { flag: "wx" });
      return `/media/${folder}/${encodeURIComponent(filename)}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

/** Images uploaded before files moved to disk are still stored in Postgres and served from /media/<id>. */
export const getImage = (id: string) =>
  /^[a-z0-9]{20,40}$/.test(id) ? prisma.media.findUnique({ where: { id }, select: { data: true, mimeType: true, size: true } }) : null;
