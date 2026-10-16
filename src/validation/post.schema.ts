import { z } from "zod";

// Server-side validation for blog posts. The admin UI sends this shape; anything else is rejected or stripped.

const text = (max: number) => z.string().trim().max(max);

// Image URLs are our own uploads (/media/…) or absolute http(s) links. Blocks javascript:, data: etc.
const isImageUrl = (url: string) => url === "" || url.startsWith("/media/") || /^https?:\/\//.test(url);
const imageUrl = text(500).refine(isImageUrl, "Invalid image URL.");

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: text(5000) }),
  z.object({ type: z.literal("heading"), text: text(200) }),
  z.object({ type: z.literal("quote"), text: text(1000) }),
  z.object({ type: z.literal("list"), items: z.array(text(1000)).max(50) }),
  z.object({ type: z.literal("image"), url: imageUrl, alt: text(200), caption: text(300) }),
  // Question/answer pairs: shown as an accordion and emitted as FAQPage structured data.
  z.object({ type: z.literal("faq"), items: z.array(z.object({ question: text(300), answer: text(2000) })).max(30) }),
  // Call-to-action banner that opens the website's lead form.
  z.object({ type: z.literal("cta"), text: text(200), buttonLabel: text(40) }),
  // Table of contents: the website fills it in from the post's headings.
  z.object({ type: z.literal("toc") }),
]);

export type Block = z.infer<typeof blockSchema>;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

export const MAX_EXCERPT_WORDS = 1000;

const countWords = (value: string) => value.split(/\s+/).filter(Boolean).length;

export function estimateReadMinutes(blocks: Block[]) {
  const words = blocks
    .flatMap((block) => {
      if (block.type === "list") return block.items;
      if (block.type === "faq") return block.items.flatMap((item) => [item.question, item.answer]);
      if (block.type === "image") return [block.caption];
      if (block.type === "toc") return [];
      return [block.text];
    })
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export const postInputSchema = z
  .object({
    // Titles may have line breaks (Shift+Enter in the editor): keep single breaks, drop blank lines and stray spaces.
    title: text(200)
      .min(1, "Title is required.")
      .transform((title) =>
        title
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join("\n"),
      ),
    slug: text(100).optional().default(""),
    excerpt: text(10000)
      .refine((value) => countWords(value) <= MAX_EXCERPT_WORDS, `Excerpt can be at most ${MAX_EXCERPT_WORDS} words.`)
      .default(""),
    category: text(60).default(""),
    author: text(80).default(""),
    coverImage: imageUrl.default(""),
    coverAlt: text(200).default(""),
    publishedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Publish date must be a valid date.")
      .refine((d) => !Number.isNaN(Date.parse(d)), "Publish date must be a valid date."),
    readMinutes: z.union([z.number(), z.string()]).optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
    featured: z.boolean().default(false),
    blocks: z.array(blockSchema).max(200).default([]),
    seoTitle: text(200).default(""),
    seoDescription: text(400).default(""),
  })
  .transform((input, ctx) => {
    // Drop empty blocks, blank list items, half-filled FAQs and extra tables of contents (one per post).
    const blocks = input.blocks
      .map((block) => {
        if (block.type === "list") return { ...block, items: block.items.filter(Boolean) };
        if (block.type === "faq") return { ...block, items: block.items.filter((item) => item.question && item.answer) };
        return block;
      })
      .filter((block, i, all) => {
        if (block.type === "toc") return all.findIndex((b) => b.type === "toc") === i;
        if (block.type === "image") return block.url;
        if (block.type === "list" || block.type === "faq") return block.items.length;
        return block.text;
      });

    const slug = slugify(input.slug || input.title);
    if (!slug) ctx.addIssue({ code: "custom", message: "Slug must contain letters or numbers." });
    if (input.status === "PUBLISHED" && !input.excerpt) ctx.addIssue({ code: "custom", message: "Add an excerpt before publishing." });
    if (input.status === "PUBLISHED" && blocks.length === 0) ctx.addIssue({ code: "custom", message: "Add some content before publishing." });

    const manual = Number.parseInt(String(input.readMinutes ?? ""), 10);
    const readMinutes = Math.min(Math.max(Number.isFinite(manual) && manual > 0 ? manual : estimateReadMinutes(blocks), 1), 120);

    return { ...input, slug, blocks, readMinutes, publishedOn: new Date(`${input.publishedOn}T00:00:00Z`) };
  });

export type PostInput = z.infer<typeof postInputSchema>;
