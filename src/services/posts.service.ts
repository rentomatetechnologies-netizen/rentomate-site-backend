import type { Post } from "../generated/prisma/client";
import { HttpError, notFound } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import type { PostInput } from "../validation/post.schema";
import { notifyIndexNow } from "./indexnow.service";
import { revalidateWebsite } from "./revalidate.service";

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

/** Dates as YYYY-MM-DD so the editor's date input can use them directly. */
const toAdminPost = (post: Post) => ({ ...post, publishedOn: toDateString(post.publishedOn) });

async function assertSlugFree(slug: string, exceptId?: number) {
  const clash = await prisma.post.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw new HttpError(409, `Another post already uses the URL "${slug}".`);
}

/* ---------- admin ---------- */

export async function listPosts() {
  const posts = await prisma.post.findMany({ orderBy: [{ publishedOn: "desc" }, { id: "desc" }], omit: { blocks: true } });
  return posts.map((post) => ({ ...post, publishedOn: toDateString(post.publishedOn) }));
}

export async function getPost(id: number) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw notFound("Post");
  return toAdminPost(post);
}

/** Submits the pages that change when these posts appear on or leave the site; drafts are never public, so they are skipped. */
function notifySearchEngines(...posts: Pick<Post, "slug" | "status">[]) {
  const published = posts.filter((post) => post.status === "PUBLISHED");
  if (published.length) notifyIndexNow(["/blog", ...published.map((post) => `/blog/${post.slug}`)]);
}

export async function createPost(input: PostInput) {
  await assertSlugFree(input.slug);
  const post = await prisma.post.create({ data: input });
  revalidateWebsite();
  notifySearchEngines(post);
  return toAdminPost(post);
}

export async function updatePost(id: number, input: PostInput) {
  const before = await prisma.post.findUnique({ where: { id }, select: { slug: true, status: true } });
  if (!before) throw notFound("Post");
  await assertSlugFree(input.slug, id);
  const post = await prisma.post.update({ where: { id }, data: input });
  revalidateWebsite();
  // The old URL too, so a renamed or unpublished post drops out of search.
  notifySearchEngines(before, post);
  return toAdminPost(post);
}

export async function deletePost(id: number) {
  const post = await prisma.post.findUnique({ where: { id }, select: { slug: true, status: true } });
  const { count } = await prisma.post.deleteMany({ where: { id } });
  if (!count || !post) throw notFound("Post");
  revalidateWebsite();
  notifySearchEngines(post);
}

export async function getDashboard() {
  const [published, drafts, admins, recent] = await Promise.all([
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "DRAFT" } }),
    prisma.admin.count(),
    prisma.post.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, status: true, updatedAt: true, coverImage: true },
    }),
  ]);
  return { stats: { published, drafts, total: published + drafts, admins }, recent };
}

/* ---------- public (read by the website) ---------- */

const toPublicSummary = (post: Omit<Post, "blocks">) => ({
  id: post.id,
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  category: post.category,
  author: post.author,
  coverImage: post.coverImage,
  coverAlt: post.coverAlt,
  coverCaption: post.coverCaption,
  date: toDateString(post.publishedOn),
  readMinutes: post.readMinutes,
  featured: post.featured,
  seoTitle: post.seoTitle,
  seoDescription: post.seoDescription,
  focusKeyword: post.focusKeyword,
  keywords: post.keywords,
  updatedAt: post.updatedAt.toISOString(),
});

export async function listPublishedPosts() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ featured: "desc" }, { publishedOn: "desc" }, { id: "desc" }],
    omit: { blocks: true },
  });
  return posts.map(toPublicSummary);
}

export async function getPublishedPost(slug: string) {
  const post = await prisma.post.findFirst({ where: { slug, status: "PUBLISHED" } });
  if (!post) throw notFound("Post");
  return { ...toPublicSummary(post), blocks: post.blocks };
}
