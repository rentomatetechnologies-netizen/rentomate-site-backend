import { Router } from "express";
import * as auth from "../controllers/auth.controller";
import { requireCsrfHeader } from "../middleware/csrf";
import { requireAdmin } from "../middleware/require-admin";

// /api/auth
export const authRoutes = Router();

authRoutes.use(requireCsrfHeader);
authRoutes.post("/login", auth.login);
authRoutes.post("/logout", auth.logout);
authRoutes.get("/me", requireAdmin, auth.me);
