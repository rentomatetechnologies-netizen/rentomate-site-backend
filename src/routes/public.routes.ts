import express, { Router } from "express";
import { config } from "../config";
import * as media from "../controllers/media.controller";
import * as posts from "../controllers/posts.controller";
import * as settings from "../controllers/settings.controller";

// Read-only, no login: published posts and homepage content for the website, and uploaded images.
export const publicRoutes = Router();

publicRoutes.get("/api/public/posts", posts.listPublished);
publicRoutes.get("/api/public/posts/:slug", posts.getPublished);
publicRoutes.get("/api/public/hero", settings.getHero);
publicRoutes.get("/api/public/blog-banner", settings.getBlogBanner);
publicRoutes.get("/media/:id", media.serve);
// Uploaded files on disk: /media/blog/img1.jpg → UPLOADS_DIR/blog/img1.jpg
publicRoutes.use("/media", express.static(config.uploadsDir, { index: false, dotfiles: "deny", maxAge: "7d" }));
