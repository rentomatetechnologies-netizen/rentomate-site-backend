import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";
import { MAX_IMAGE_BYTES } from "../services/media.service";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found." });
}

// Express 5 forwards errors thrown in async handlers here.
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0]?.message ?? "Invalid input." });
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? `Image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` : error.message });
  }
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ error: "Invalid JSON body." });

  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
