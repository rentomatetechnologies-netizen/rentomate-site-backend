import type { Request, Response } from "express";
import * as settingsService from "../services/settings.service";
import { blogBannerInputSchema } from "../validation/blog-banner.schema";
import { heroInputSchema } from "../validation/hero.schema";

export async function getHero(_req: Request, res: Response) {
  res.json(await settingsService.getHero());
}

export async function updateHero(req: Request, res: Response) {
  const input = heroInputSchema.parse(req.body);
  res.json(await settingsService.saveHero(input));
}

export async function getBlogBanner(_req: Request, res: Response) {
  res.json(await settingsService.getBlogBanner());
}

export async function updateBlogBanner(req: Request, res: Response) {
  const input = blogBannerInputSchema.parse(req.body);
  res.json(await settingsService.saveBlogBanner(input));
}
