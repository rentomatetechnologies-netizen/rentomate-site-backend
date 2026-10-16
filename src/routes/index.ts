import { Router } from "express";
import { adminRoutes } from "./admin.routes";
import { authRoutes } from "./auth.routes";
import { publicRoutes } from "./public.routes";

export const routes = Router();

routes.get("/health", (_req, res) => {
  res.json({ ok: true });
});
routes.use("/api/auth", authRoutes);
routes.use("/api/admin", adminRoutes);
routes.use(publicRoutes);
