import "server-only";

import { z } from "zod";

import { fetchPosting } from "@/lib/posting-fetch";

import { countryName } from "./countries";
import type { JobSourceAdapter, RequestContext, SourceCredentials } from "./adapter";
import { jobSearchError } from "./errors";
import { requestJson } from "./http";
import { POSTED_WITHIN, safeLink, type FoundPosting, type SearchPage, type SearchQuery } from "./search";
import { plainText } from "./text";

// Jooble: an index of job sites in most countries, Ireland, Bulgaria and
// Sweden among them, which Adzuna doesn't cover. Its REST API takes a POST
// to /api/{key}; each key is made on one country's Jooble site and only
// searches that country, so keys are kept by country. The free plan allows
// 500 requests per key in total. It only sends a snippet of each posting,
// so the rest comes from the posting's page when it's selected.

const BASE = "https://jooble.org";
const PAGE_SIZE = 20;
/** The distances Jooble takes, in km. */
const RADII = [0, 4, 8, 16, 26, 40, 80] as const;

const maybeText = z.string().nullish().catch(null);

const jobSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: maybeText,
  location: maybeText,
  snippet: maybeText,
  salary: maybeText,
  source: maybeText,
  type: maybeText,
  link: maybeText,
  company: maybeText,
  updated: maybeText,
});
type Job = z.output<typeof jobSchema>;

const responseSchema = z.object({ totalCount: z.coerce.number().nullish().catch(null), jobs: z.array(z.unknown()) });

/** The key for a country: its own, else one saved without a country. */
export function joobleKeyFor(keys: Readonly<Record<string, string>>, country: string): string | null {
  return keys[country] ?? keys["*"] ?? null;
}

/** The largest distance Jooble takes that isn't over the one asked for. */
export function joobleRadius(km: number): number {
  return RADII.filter((radius) => radius <= km).at(-1) ?? 0;
}

/** Jooble writes times without a zone ("2026-11-05T12:55:35.3870000"); they're taken as UTC. */
function postedAtOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.slice(0, 23)}Z`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export function postingFromJob(job: Job): FoundPosting {
  const title = plainText(job.title);
  return {
    source: "JOOBLE",
    externalId: job.id.slice(0, 500),
    title: title.slice(0, 500),
    company: plainText(job.company).slice(0, 300),
    place: plainText(job.location).slice(0, 300),
    remote: /\bremote\b/i.test(`${title} ${job.location ?? ""} ${job.type ?? ""}`) ? true : null,
    salary: plainText(job.salary).slice(0, 200),
    postedAt: postedAtOf(job.updated),
    url: safeLink(job.link).slice(0, 2000),
    via: plainText(job.source).slice(0, 100),
    description: plainText(job.snippet).slice(0, 100_000),
    complete: false,
  };
}

/** The request body: place or else the country's name as the location, "remote" with the keywords for remote only. */
export function joobleBody(query: SearchQuery, page: number) {
  return {
    keywords: query.remoteOnly ? `${query.keywords} remote` : query.keywords,
    location: query.place || (query.country ? countryName(query.country) : ""),
    ...(query.place ? { radius: String(joobleRadius(query.radiusKm)) } : {}),
    page: String(page),
    ResultOnPage: String(PAGE_SIZE),
    companysearch: "false",
  };
}

async function searchPage(query: SearchQuery, { keys }: SourceCredentials["JOOBLE"], next: string | null, context: RequestContext = {}): Promise<SearchPage> {
  const key = joobleKeyFor(keys, query.country);
  if (!key) throw jobSearchError("no-key", "JOOBLE", { country: query.country });
  const page = next?.startsWith("page:") ? Math.max(1, Number(next.slice("page:".length)) || 1) : 1;
  const url = new URL(`${context.baseUrl ?? BASE}/api/${encodeURIComponent(key)}`);
  const answer = responseSchema.safeParse(await requestJson("JOOBLE", url, { body: joobleBody(query, page), signal: context.signal, logPath: "/api" }));
  // The path holds the key: it never goes in the log.
  if (!answer.success) throw jobSearchError("changed", "JOOBLE", { detail: "/api: unexpected answer" });

  // Jooble has no date filter: postings updated before the limit are left out here.
  const days = POSTED_WITHIN.find((option) => option.value === query.postedWithin)?.days;
  const since = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;

  const seen = new Set<string>();
  const postings: FoundPosting[] = [];
  for (const item of answer.data.jobs) {
    const job = jobSchema.safeParse(item);
    if (!job.success || seen.has(job.data.id)) continue;
    seen.add(job.data.id);
    const posting = postingFromJob(job.data);
    if (since !== null && posting.postedAt && Date.parse(posting.postedAt) < since) continue;
    postings.push(posting);
  }
  const total = answer.data.totalCount ?? 0;
  return { postings, next: page * PAGE_SIZE < total && answer.data.jobs.length > 0 ? `page:${page + 1}` : null };
}

export const jooble: JobSourceAdapter<"JOOBLE"> = {
  source: "JOOBLE",
  search: searchPage,
  // The rest of the posting is on its page, which the guarded fetcher reads like "Fetch" does (E7-8).
  details: async (posting) => {
    if (!posting.url) return null;
    const page = await fetchPosting(posting.url);
    return page.ok ? page.text : null;
  },
  test: async (credentials, context) => {
    const country = Object.keys(credentials.keys).find((code) => code !== "*") ?? "ie";
    await searchPage({ keywords: "developer", place: "", country, radiusKm: 25, remoteOnly: false, postedWithin: "any" }, credentials, null, context);
  },
};
