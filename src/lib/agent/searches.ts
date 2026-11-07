import { z } from "zod";

import { EMPTY_QUERY, JOB_SOURCES, postingKey, searchQuerySchema, type FoundPosting, type JobSource, type SearchQuery } from "@/lib/job-search/search";

// The job agent's searches: the main one (Settings → Job agent's "What it
// looks for", through the source in Settings → Job search) and more, each
// through its own source, so one run can look in several countries and
// sources at once. Shared by the server and the Settings screen.

/** More searches a run makes, besides the main one. */
export const AGENT_MAX_SEARCHES = 12;

/** One more search: a search as Find jobs asks it, and the source for it (null: the one in Settings → Job search). */
export const agentSearchSchema = searchQuerySchema.extend({
  source: z.enum(JOB_SOURCES).nullable(),
});
export type AgentSearch = z.output<typeof agentSearchSchema>;

/** The searches a run makes, each with its source; the BA is never searched on its own (#223), and one without keywords or a country is skipped. */
export function agentSearchPlan(main: SearchQuery, mainSource: JobSource | null, more: readonly AgentSearch[]): { source: JobSource; query: SearchQuery }[] {
  const plan = [{ source: mainSource, query: main }, ...more.map(({ source, ...query }) => ({ source: source ?? mainSource, query }))];
  const seen = new Set<string>();
  return plan.filter((entry): entry is { source: JobSource; query: SearchQuery } => {
    if (!entry.source || entry.source === "ARBEITSAGENTUR") return false;
    if (!entry.query.keywords.trim() || !entry.query.country) return false;
    const key = `${entry.source}:${JSON.stringify(entry.query)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The words and phrases of "Java, C#, .NET". */
export function excludedTerms(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether a title has one of the terms as a whole word: "Java" leaves out
 * "Java SDET" but not "JavaScript Tester".
 */
export function titleExcluded(title: string, terms: readonly string[]): boolean {
  return terms.some((term) => new RegExp(`(^|[^\\p{L}\\p{N}#+])${escape(term)}($|[^\\p{L}\\p{N}#+])`, "iu").test(title));
}

/** Postings from every search, each once, without the excluded titles. */
export function mergePostings(pages: readonly (readonly FoundPosting[])[], excluded: readonly string[]): FoundPosting[] {
  const seen = new Set<string>();
  const merged: FoundPosting[] = [];
  for (const posting of pages.flat()) {
    const key = postingKey(posting);
    if (seen.has(key) || titleExcluded(posting.title, excluded)) continue;
    seen.add(key);
    merged.push(posting);
  }
  return merged;
}

/** The roles Chris looks for, as one search's alternatives. */
export const EUROPE_QA_KEYWORDS = "QA Engineer, Quality Engineer, SDET, Test Automation, Test Engineer, QA Lead, Test Analyst, QA Analyst";

/** A ready set of searches: QA roles on company boards in Ireland, the UK, Bulgaria, Sweden, Belgium and the Netherlands, and Jooble in Ireland and Bulgaria. */
export const EUROPE_QA_SEARCHES: readonly AgentSearch[] = [
  ...["ie", "gb", "bg", "se", "be", "nl"].map((country) => ({ ...EMPTY_QUERY, source: "COMPANY_BOARDS" as const, keywords: EUROPE_QA_KEYWORDS, country })),
  { ...EMPTY_QUERY, source: "JOOBLE", keywords: "QA Engineer", country: "ie" },
  { ...EMPTY_QUERY, source: "JOOBLE", keywords: "QA Engineer", country: "bg", place: "Sofia" },
];

/** Titles a QA search usually wants left out. */
export const EUROPE_QA_EXCLUDED = "Java, C#, .NET";
