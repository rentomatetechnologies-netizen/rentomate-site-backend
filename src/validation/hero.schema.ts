import { z } from "zod";

// Homepage hero: the carousel images on the right of the hero.

const text = (max: number) => z.string().trim().max(max);

// Same rule as post images: our own uploads (/media/…) or absolute http(s) links.
const isImageUrl = (url: string) => url === "" || url.startsWith("/media/") || /^https?:\/\//.test(url);
const imageUrl = text(500).refine(isImageUrl, "Invalid image URL.");

export const HERO_SLIDE_COUNT = 3;

const heroSlideSchema = z.object({
  image: imageUrl.default(""),
  alt: text(200).default(""),
});

export const heroInputSchema = z.object({
  slides: z.array(heroSlideSchema).length(HERO_SLIDE_COUNT, `Exactly ${HERO_SLIDE_COUNT} carousel slides are required.`),
});

export type HeroInput = z.infer<typeof heroInputSchema>;
