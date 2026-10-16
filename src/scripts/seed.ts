// `npm run db:seed`: creates the first admin (from ADMIN_USERNAME / ADMIN_PASSWORD) and imports
// the articles that used to be hardcoded in the website. Safe to run more than once.
import { hashPassword, normalizeUsername, passwordProblem, usernameProblem } from "../auth/password";
import { prisma } from "../lib/prisma";

const paragraphs = (...texts: string[]) => texts.map((text) => ({ type: "paragraph" as const, text }));

const POSTS = [
  {
    slug: "rent-vs-buy-water-purifier",
    title: "Renting vs buying a water purifier: which makes sense for you?",
    excerpt: "Buying means a big upfront cost plus yearly servicing. Renting spreads it into a small monthly fee with maintenance included.",
    publishedOn: "2026-09-15",
    readMinutes: 4,
    featured: true,
    blocks: paragraphs(
      "A good RO purifier is a significant purchase, and the price on the box is only the start. Over the years you also pay for service visits, filter changes and the occasional repair.",
      "Renting turns all of that into one predictable monthly fee. With RentOMate there is no machine cost, installation is free, and maintenance and filter replacements are included for as long as you rent.",
      "Renting is especially useful if you live in a rented home or expect to move, since you are not tied to a machine you own. Buying can make sense if you plan to stay put for many years and are happy to manage servicing yourself.",
      "Not sure yet? Our 7-day risk-free trial lets you try the purifier at home before you commit.",
    ),
  },
  {
    slug: "how-often-change-ro-filters",
    title: "How often should RO purifier filters be changed?",
    excerpt: "Filters wear out at different rates depending on your water quality and usage. Here is what to watch for.",
    publishedOn: "2026-08-28",
    readMinutes: 3,
    featured: false,
    blocks: paragraphs(
      "An RO purifier uses several stages: sediment and carbon pre-filters, the RO membrane, and post-filters such as UV, UF or mineral cartridges. Each wears out at its own pace.",
      "Pre-filters typically need changing more often than the membrane, because they catch dirt and chlorine before the water reaches it. How often depends on your water's hardness, TDS and how much water your household uses.",
      "Signs a filter is due include a change in taste or smell, slower water flow, or a TDS reading that creeps up.",
      "On a RentOMate plan you do not need to track any of this: our team checks the purifier during service visits and swaps filters at no cost when they are due.",
    ),
  },
  {
    slug: "what-is-tds-drinking-water",
    title: "What is TDS, and why does it matter for drinking water?",
    excerpt: "TDS measures the dissolved minerals and salts in water. Too high affects taste and health; too low strips useful minerals.",
    publishedOn: "2026-08-10",
    readMinutes: 3,
    featured: false,
    blocks: paragraphs(
      "TDS stands for Total Dissolved Solids: the minerals, salts and metals dissolved in water, usually measured in milligrams per litre (mg/L).",
      "The Indian drinking water standard, IS 10500, sets an acceptable TDS limit of 500 mg/L. Water well above that can taste salty or bitter and may contain more contaminants.",
      "RO purification brings TDS down, but very low TDS water can taste flat and lacks useful minerals. That is why purifiers with TDS control and mineral enrichment aim for a balanced level rather than the lowest possible number.",
      "RentOMate purifiers combine RO, UV and UF with TDS control and copper and mineral enrichment, so the water is both safe and pleasant to drink.",
    ),
  },
];

async function seedAdmin() {
  if ((await prisma.admin.count()) > 0) return console.log("Admins already exist – skipping admin seed.");

  const username = normalizeUsername(process.env.ADMIN_USERNAME || "");
  const password = process.env.ADMIN_PASSWORD || "";
  const problem = (username ? usernameProblem(username) : "ADMIN_USERNAME is not set.") ?? passwordProblem(password);
  if (problem) {
    console.warn(`No admin created: ${problem} Set ADMIN_USERNAME/ADMIN_PASSWORD in .env, or run \`npm run admin:create\`.`);
    return;
  }
  await prisma.admin.create({ data: { username, passwordHash: await hashPassword(password) } });
  console.log(`Created admin "${username}".`);
}

async function seedPosts() {
  if ((await prisma.post.count()) > 0) return console.log("Posts already exist – skipping post seed.");
  for (const post of POSTS) {
    await prisma.post.create({
      data: { ...post, category: "Guides", author: "RentOMate Team", status: "PUBLISHED", publishedOn: new Date(`${post.publishedOn}T00:00:00Z`) },
    });
  }
  console.log(`Imported ${POSTS.length} blog posts.`);
}

seedAdmin()
  .then(seedPosts)
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
