/**
 * Info about the work. Files are created as blank stubs by `npm run assets`.
 * Everything except the title/name is optional, so the site builds before
 * anything is filled in. Empty strings and nulls count as "not filled in".
 *
 *   src/content/projects/<folder>.json      one per artwork folder (client / community / bounty)
 *   src/content/works/<folder>/<piece>.json one per piece
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const CATEGORIES = [
  "meme", "banner", "pfp", "logo", "branding", "ad", "poster", "illustration", "sticker", "merch",
] as const;

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const link = z.preprocess(blank, z.url().optional());
const text = z.preprocess(blank, z.string().optional());
const num = z.preprocess(blank, z.number().optional());

const award = z.preprocess(blank, z.object({
  type: z.enum(["bounty", "contest"]),
  name: z.string(),          // "Sonunu Art Bounty"
  result: text,              // "Winner", "2nd place", "Shortlisted"
  prize: text,               // "500 USDC"
  link,                      // announcement tweet
}).optional());

// Ids mirror the file path, which mirrors the media ids: "magic-eden/21"
const idFromPath = ({ entry }: { entry: string }) => entry.replace(/\.json$/, "");

const projects = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/projects", generateId: idFromPath }),
  schema: z.object({
    name: z.string(),                                                     // "Magic Eden"
    kind: z.enum(["client", "bounty", "contest", "personal", "spec"]).default("client"),
    x: link,                                                              // https://x.com/MagicEden
    website: link,
    description: text,
    award,                                                                // when the whole folder is a bounty entry
    order: z.number().default(0),
    hidden: z.boolean().default(false),
  }),
});

const works = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/works", generateId: idFromPath }),
  schema: z.object({
    title: z.string(),
    client: text,                       // overrides the project name, e.g. "Audi" inside "ads"
    tweet: link,                        // the post where it went up
    year: z.preprocess(blank, z.number().int().optional()),
    categories: z.array(z.enum(CATEGORIES)).default([]),
    description: text,
    award,                              // overrides the project's award
    stats: z.preprocess(blank, z.object({ likes: num, reposts: num, views: num }).optional()),
    featured: z.boolean().default(false),
    hidden: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { projects, works };
