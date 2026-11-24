// Rebrand stored content: replaces old brand spellings ("Rent O' Mate", "Rent O’ Mate", "RentOMate", "RentOmate",
// "Rent O Mate", "Rent-O-Mate") with "Rentomate" in every blog post and in the site settings (homepage hero, blog banner).
//
// Safe to run any number of times: once nothing old is left, it changes nothing.
// Never touches slugs, publish dates, status, image URLs or image file names.
//
// In the backend container (docker compose exec -T backend …):
//   node dist/scripts/rebrand-posts.js --backup > posts-backup.json   full copy of every post and setting, as JSON
//   node dist/scripts/rebrand-posts.js                                dry run: lists what would change, writes nothing
//   node dist/scripts/rebrand-posts.js --apply                        writes the changes in one transaction, then refreshes the website
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { revalidateWebsiteNow } from "../services/revalidate.service";

const BRAND = "Rentomate";
const TITLE_SUFFIX = ` | ${BRAND}`;

// "Rent", optional spaces or hyphens, a capital "O", an optional apostrophe (straight, curly, backtick or HTML entity),
// optional spaces or hyphens, then "Mate" or "mate". The capital "O" is required, so "Rentomate" and "rentomate.life" never match.
const OLD_BRAND = /Rent[\s-]*O(?:'|’|‘|`|&apos;|&#0?39;|&rsquo;)?[\s-]*[Mm]ate/g;
const HAS_OLD_BRAND = new RegExp(OLD_BRAND.source);

// Keys holding URLs or file paths; their values are left exactly as they are.
const SKIP_KEYS = new Set(["url", "href", "image", "src", "coverImage"]);

const rebrandText = (text: string) => text.replace(OLD_BRAND, BRAND);

/** Every string inside a JSON value, rebranded, except under keys that hold URLs or file paths. */
function rebrandJson(value: unknown, key = ""): unknown {
  if (typeof value === "string") return SKIP_KEYS.has(key) ? value : rebrandText(value);
  if (Array.isArray(value)) return value.map((item) => rebrandJson(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrandJson(v, k)]));
  }
  return value;
}

/** An SEO title that ends with the brand in any old form ("… | RentOMate", "… - Rent O' Mate") ends with " | Rentomate". */
const rebrandSeoTitle = (seoTitle: string) => rebrandText(seoTitle).replace(/\s*[|\-–—:]\s*Rentomate\s*$/, TITLE_SUFFIX);

const TEXT_FIELDS = ["title", "excerpt", "author", "coverAlt", "coverCaption", "seoDescription", "focusKeyword", "keywords"] as const;

async function backup() {
  const [posts, settings] = await Promise.all([prisma.post.findMany({ orderBy: { id: "asc" } }), prisma.siteSetting.findMany()]);
  process.stdout.write(JSON.stringify({ takenAt: new Date().toISOString(), posts, settings }, null, 2));
}

async function rebrand(apply: boolean) {
  const posts = await prisma.post.findMany({ orderBy: { id: "asc" } });
  const settings = await prisma.siteSetting.findMany();
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  const titlesToReview: string[] = [];

  for (const post of posts) {
    const data: Prisma.PostUpdateInput = {};
    const changed: string[] = [];

    for (const field of TEXT_FIELDS) {
      const next = rebrandText(post[field]);
      if (next !== post[field]) {
        data[field] = next;
        changed.push(field);
      }
    }
    const seoTitle = rebrandSeoTitle(post.seoTitle);
    if (seoTitle !== post.seoTitle) {
      data.seoTitle = seoTitle;
      changed.push("seoTitle");
    }
    const blocks = rebrandJson(post.blocks);
    if (JSON.stringify(blocks) !== JSON.stringify(post.blocks)) {
      data.blocks = blocks as Prisma.InputJsonValue;
      changed.push("blocks");
    }

    // The website adds " | Rentomate" to titles that don't name the brand; these name it somewhere other than the end.
    if (seoTitle.includes(BRAND) && !seoTitle.endsWith(TITLE_SUFFIX)) titlesToReview.push(`${post.slug}: "${seoTitle}"`);

    if (changed.length) {
      console.log(`post ${post.slug}: ${changed.join(", ")}${data.seoTitle ? `\n    seoTitle -> "${seoTitle}"` : ""}`);
      writes.push(prisma.post.update({ where: { id: post.id }, data }));
    }
  }

  for (const setting of settings) {
    const value = rebrandJson(setting.value);
    if (JSON.stringify(value) !== JSON.stringify(setting.value)) {
      console.log(`setting ${setting.key}: text updated`);
      writes.push(prisma.siteSetting.update({ where: { key: setting.key }, data: { value: value as Prisma.InputJsonValue } }));
    }
  }

  // After the changes, old spellings can only remain in URLs and file names: reported here, never changed.
  const leftovers = [
    ...posts.map((p) => [`post ${p.slug}`, JSON.stringify({ ...p, blocks: rebrandJson(p.blocks) }, (k, v) => (TEXT_FIELDS.includes(k as never) || k === "seoTitle" ? "" : v))] as const),
    ...settings.map((s) => [`setting ${s.key}`, JSON.stringify(rebrandJson(s.value))] as const),
  ]
    .filter(([, json]) => HAS_OLD_BRAND.test(json))
    .map(([name]) => name);

  console.log(`\n${writes.length} of ${posts.length} posts and ${settings.length} settings need changes.`);
  if (titlesToReview.length) console.log(`SEO titles naming the brand but not ending in "${TITLE_SUFFIX}" (left as typed, review in the admin panel):\n  ${titlesToReview.join("\n  ")}`);
  if (leftovers.length) console.log(`Old spellings inside URLs/file names (not changed): ${leftovers.join(", ")}`);

  if (!apply) return console.log("\nDry run: nothing was written. Take a backup (--backup), then run again with --apply.");
  if (!writes.length) return console.log("Nothing to write.");

  await prisma.$transaction(writes);
  console.log(`Saved ${writes.length} changes.`);
  console.log((await revalidateWebsiteNow()) ? "Website refreshed." : "Website refresh failed or is not configured: rebuild or restart the website.");
}

const args = new Set(process.argv.slice(2));
(args.has("--backup") ? backup() : rebrand(args.has("--apply")))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
