import { Router } from "express";
import multer from "multer";
import * as admins from "../controllers/admins.controller";
import * as auth from "../controllers/auth.controller";
import * as media from "../controllers/media.controller";
import * as posts from "../controllers/posts.controller";
import * as settings from "../controllers/settings.controller";
import { requireCsrfHeader } from "../middleware/csrf";
import { requireAdmin } from "../middleware/require-admin";
import { MAX_IMAGE_BYTES } from "../services/media.service";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

// /api/admin – everything here requires a logged-in admin.
export const adminRoutes = Router();

adminRoutes.use(requireCsrfHeader, requireAdmin);

adminRoutes.get("/dashboard", posts.dashboard);

adminRoutes.get("/posts", posts.list);
adminRoutes.post("/posts", posts.create);
adminRoutes.get("/posts/:id", posts.get);
adminRoutes.put("/posts/:id", posts.update);
adminRoutes.delete("/posts/:id", posts.remove);

adminRoutes.get("/settings/hero", settings.getHero);
adminRoutes.put("/settings/hero", settings.updateHero);
adminRoutes.get("/settings/blog-banner", settings.getBlogBanner);
adminRoutes.put("/settings/blog-banner", settings.updateBlogBanner);

adminRoutes.post("/media", upload.single("image"), media.upload);

adminRoutes.get("/admins", admins.list);
adminRoutes.post("/admins", admins.create);
adminRoutes.delete("/admins/:id", admins.remove);

adminRoutes.put("/account/password", auth.changePassword);
