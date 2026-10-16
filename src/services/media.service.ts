import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

/**
 * Saves an uploaded image as UPLOADS_DIR/<folder>/img<N>.<ext> (img1, img2, …) and returns its public URL path,
 * e.g. /media/blog/img3.jpg.
 */
export async function saveImage(folder: MediaFolder, bytes: Buffer) {
  const mimeType = detectImageType(bytes);
  if (!mimeType) throw new HttpError(400, "Only JPG, PNG, WebP, GIF or AVIF images are allowed.");

  const dir = path.join(config.uploadsDir, folder);
  await fs.mkdir(dir, { recursive: true });
  const taken = (await fs.readdir(dir)).map((name) => Number(/^img(\d+)\./.exec(name)?.[1] ?? 0));

  // "wx" fails if the file already exists, so two uploads at the same moment can't overwrite each other.
  for (let n = Math.max(0, ...taken) + 1; ; n++) {
    const filename = `img${n}.${EXTENSIONS[mimeType]}`;
    try {
      await fs.writeFile(path.join(dir, filename), bytes, { flag: "wx" });
      return `/media/${folder}/${filename}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

/** Images uploaded before files moved to disk are still stored in Postgres and served from /media/<id>. */
export const getImage = (id: string) =>
  /^[a-z0-9]{20,40}$/.test(id) ? prisma.media.findUnique({ where: { id }, select: { data: true, mimeType: true, size: true } }) : null;
