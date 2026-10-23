import type { Request, Response } from "express";
import { HttpError, notFound } from "../lib/http-error";
import * as mediaService from "../services/media.service";

export async function upload(req: Request, res: Response) {
  if (!req.file || req.file.size === 0) throw new HttpError(400, "Choose an image to upload.");
  const folder = req.body?.folder ?? "blog";
  if (!mediaService.isMediaFolder(folder)) throw new HttpError(400, "Unknown upload folder.");
  const url = await mediaService.saveImage(folder, req.file.buffer, req.file.originalname);
  res.status(201).json({ url });
}

// Media is never modified after upload, so it can be cached forever.
export async function serve(req: Request<{ id: string }>, res: Response) {
  const media = await mediaService.getImage(req.params.id);
  if (!media) throw notFound("Image");
  res
    .set({
      "Content-Type": media.mimeType,
      "Content-Length": String(media.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    })
    .send(Buffer.from(media.data));
}
