import { prisma } from "../lib/prisma";
import { blogBannerInputSchema, type BlogBannerInput } from "../validation/blog-banner.schema";
import { HERO_SLIDE_COUNT, heroInputSchema, type HeroInput } from "../validation/hero.schema";
import { revalidateWebsite } from "./revalidate.service";

const HERO_KEY = "hero";
const BLOG_BANNER_KEY = "blogBanner";

async function saveSetting<T extends object>(key: string, value: T) {
  await prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  revalidateWebsite();
  return value;
}

/* ---------- homepage hero ---------- */

const emptyHero = (): HeroInput => ({
  slides: Array.from({ length: HERO_SLIDE_COUNT }, () => ({ image: "", alt: "" })),
});

/** Heroes saved before the carousel had one `screenImage`; it becomes the first slide. */
function upgradeSavedHero(value: unknown) {
  if (!value || typeof value !== "object" || "slides" in value) return value;
  const { screenImage = "", screenAlt = "", ...rest } = value as { screenImage?: string; screenAlt?: string };
  return { ...rest, slides: [{ image: screenImage, alt: screenAlt }, ...emptyHero().slides.slice(1)] };
}

/** The saved hero, or empty fields (the website then shows its built-in defaults). */
export async function getHero(): Promise<HeroInput> {
  const row = await prisma.siteSetting.findUnique({ where: { key: HERO_KEY } });
  const parsed = row && heroInputSchema.safeParse(upgradeSavedHero(row.value));
  return parsed?.success ? parsed.data : emptyHero();
}

export const saveHero = (input: HeroInput) => saveSetting(HERO_KEY, input);

/* ---------- blog banner ---------- */

/** The saved blog banner, or a disabled empty one. */
export async function getBlogBanner(): Promise<BlogBannerInput> {
  const row = await prisma.siteSetting.findUnique({ where: { key: BLOG_BANNER_KEY } });
  const parsed = blogBannerInputSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : blogBannerInputSchema.parse({});
}

export const saveBlogBanner = (input: BlogBannerInput) => saveSetting(BLOG_BANNER_KEY, input);
