import { z } from "zod";

// Promo banner shown inside every blog article (like an ad), managed once in the admin panel.

const text = (max: number) => z.string().trim().max(max);

// Same rule as post images: our own uploads (/media/…) or absolute http(s) links.
const isImageUrl = (url: string) => url === "" || url.startsWith("/media/") || /^https?:\/\//.test(url);

// "" = not clickable, "lead" = opens the website's Rent Now form, or a site path (/products) or http(s) URL.
const isLink = (link: string) => link === "" || link === "lead" || /^\/(?!\/)/.test(link) || /^https?:\/\//.test(link);

export const blogBannerInputSchema = z.object({
  // On by default: with no image uploaded, the website shows its built-in RentOMate promo.
  enabled: z.boolean().default(true),
  image: text(500).refine(isImageUrl, "Invalid image URL.").default(""),
  alt: text(200).default(""),
  link: text(500).refine(isLink, "Link must be a page path like /products or a full https:// URL.").default("lead"),
  /** The banner goes after this many paragraphs of the article. */
  afterParagraph: z.number().int().min(0).max(20).default(2),
});

export type BlogBannerInput = z.infer<typeof blogBannerInputSchema>;
