import "server-only";

import { z } from "zod";

import type { JobSourceAdapter, RequestContext, SourceCredentials } from "./adapter";
import { cached, remember } from "./cache";
import type { CompanyAts, CompanyBoard } from "./company-boards-list";
import { countryCodeFor } from "./countries";
import { JobSearchError, jobSearchError } from "./errors";
import { requestJson } from "./http";
import { POSTED_WITHIN, safeLink, type FoundPosting, type SearchPage, type SearchQuery } from "./search";
import { plainText } from "./text";

// Company job boards: the public Greenhouse, Lever and Ashby boards of a
// list of companies (company-boards-list.ts, or the user's own in Settings),
// read straight from the ATS, so every posting is the employer's own. There
// is no search on their side: each board is read whole (and kept for half an
// hour), then filtered here by the words of the title, the country and the
// place. Nothing about the user is sent: each request is a plain GET of a
// public board.

const PAGE_SIZE = 20;
/** Boards read at once. */
const CONCURRENCY = 8;
/** A big company's whole board, descriptions included, can run to several MB. */
const BOARD_MAX_BYTES = 20 * 1024 * 1024;
const BOARD_TIMEOUT_MS = 20_000;

const ORIGINS: Record<CompanyAts, string> = {
  greenhouse: "https://boards-api.greenhouse.io",
  lever: "https://api.lever.co",
  ashby: "https://api.ashbyhq.com",
};

/** A posting as read from a board, before the filters. */
export type BoardJob = FoundPosting & {
  /** Where it is, every location the board gives, for matching the country. */
  where: string;
  /** Country codes the board states outright (Lever and Ashby do). */
  countries: string[];
};

// ─── Where a posting is ──────────────────────────────────────────────────────

/** European countries: a posting that's remote in "Europe" or "EMEA" counts for each. */
export const EUROPE = new Set(
  (
    "ad al at ba be bg by ch cy cz de dk ee es fi fo fr gb gg gi gr hr hu ie im is it je li lt lu lv mc md me mk mt nl no pl pt ro rs se si sk sm ua va xk"
  ).split(" "),
);

/** Cities companies write without their country, by the country they're in. */
const CITIES: Record<string, string> = {
  dublin: "ie", cork: "ie", galway: "ie", limerick: "ie", waterford: "ie", athlone: "ie", shannon: "ie", kilkenny: "ie",
  belfast: "gb", london: "gb", manchester: "gb", edinburgh: "gb", glasgow: "gb", bristol: "gb", cambridge: "gb", oxford: "gb",
  leeds: "gb", birmingham: "gb", newcastle: "gb", cardiff: "gb", reading: "gb", brighton: "gb", "milton keynes": "gb",
  sofia: "bg", plovdiv: "bg", varna: "bg", burgas: "bg", "stara zagora": "bg",
  stockholm: "se", gothenburg: "se", "göteborg": "se", malmo: "se", "malmö": "se", lund: "se", uppsala: "se",
  brussels: "be", antwerp: "be", ghent: "be", leuven: "be", liege: "be",
  amsterdam: "nl", rotterdam: "nl", utrecht: "nl", eindhoven: "nl", "the hague": "nl",
  berlin: "de", munich: "de", hamburg: "de", frankfurt: "de", cologne: "de", stuttgart: "de", dusseldorf: "de", "düsseldorf": "de",
  paris: "fr", lyon: "fr", nantes: "fr", toulouse: "fr",
  madrid: "es", barcelona: "es", valencia: "es", malaga: "es", "málaga": "es",
  lisbon: "pt", porto: "pt", warsaw: "pl", krakow: "pl", "kraków": "pl", wroclaw: "pl", gdansk: "pl", poznan: "pl",
  prague: "cz", brno: "cz", vienna: "at", zurich: "ch", "zürich": "ch", geneva: "ch", lausanne: "ch",
  copenhagen: "dk", aarhus: "dk", oslo: "no", helsinki: "fi", espoo: "fi", tallinn: "ee", tartu: "ee", riga: "lv", vilnius: "lt",
  bucharest: "ro", cluj: "ro", "cluj-napoca": "ro", iasi: "ro", budapest: "hu", athens: "gr", milan: "it", rome: "it", turin: "it",
  belgrade: "rs", zagreb: "hr", ljubljana: "si", bratislava: "sk", luxembourg: "lu", valletta: "mt", sliema: "mt", "st julian's": "mt",
  "new york": "us", "san francisco": "us", toronto: "ca",
};

const REMOTE_EUROPE = /\b(europe|european|emea|eu|eea)\b/i;
const REMOTE_ANYWHERE = /\b(worldwide|global|anywhere)\b/i;

/** The country codes a location names, by its parts: "Dublin, Ireland" or "London / Remote (UK)". */
export function countriesIn(where: string): Set<string> {
  const codes = new Set<string>();
  for (const part of where.split(/[,/|;()\n·•]+|\s[-–—]\s|\bor\b/i)) {
    const name = part.trim().replace(/^(remote|hybrid|on-?site|office)\s*[-:–]?\s*/i, "").trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    // Two letters are a US state or Canadian province as often as a country ("Boston, MA"): only UK and US count.
    const code = CITIES[lower] ?? (name.length > 2 ? countryCodeFor(name) : lower === "uk" ? "gb" : lower === "us" ? "us" : "");
    if (code) codes.add(code);
  }
  return codes;
}

/** Whether a posting is in the search's country: there outright, or remote across Europe for a European country. */
export function inCountry(job: Pick<BoardJob, "where" | "countries" | "remote">, country: string): boolean {
  if (!country) return true;
  const named = new Set([...job.countries, ...countriesIn(job.where)]);
  if (named.has(country)) return true;
  if (job.remote !== true || !EUROPE.has(country)) return false;
  return REMOTE_EUROPE.test(job.where) || (REMOTE_ANYWHERE.test(job.where) && [...named].every((code) => EUROPE.has(code)));
}

// ─── What it is ──────────────────────────────────────────────────────────────

const words = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/[^\p{L}\p{N}#+.]+/u).filter(Boolean);

/** Words that stand for each other in a title. */
const SAME: Record<string, string[]> = {
  qa: ["qa", "quality", "qe"],
  quality: ["quality", "qa", "qe"],
  qe: ["qe", "quality", "qa"],
  sdet: ["sdet", "sdete"],
  tester: ["tester", "test", "testing"],
  test: ["test", "tester", "testing", "tests"],
  testing: ["testing", "test", "tester"],
};

/**
 * Whether a title matches the keywords. Phrases split by commas, "|" or
 * " OR " are alternatives; within one, every word must start a word of the
 * title ("test" finds "Tester"), with QA and quality, test and tester
 * standing for each other.
 */
export function titleMatches(title: string, keywords: string): boolean {
  const titleWords = words(title);
  const phrases = keywords.split(/,|\||\s+or\s+/i).map(words).filter((phrase) => phrase.length > 0);
  if (phrases.length === 0) return true;
  return phrases.some((phrase) =>
    phrase.every((word) => (SAME[word] ?? [word]).some((form) => titleWords.some((titleWord) => titleWord.startsWith(form)))),
  );
}

// ─── Reading the boards ──────────────────────────────────────────────────────

const maybeText = z.string().nullish().catch(null);
const maybeBool = z.boolean().nullish().catch(null);
const toIso = (value: string | number | null | undefined): string | null => {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};
const remoteOf = (text: string): boolean | null => (/\bremote\b/i.test(text) ? true : /\b(on-?site|in office)\b/i.test(text) ? false : null);

const greenhouseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.union([z.number(), z.string()]).transform(String),
      title: maybeText,
      updated_at: maybeText,
      first_published: maybeText,
      absolute_url: maybeText,
      location: z.object({ name: maybeText }).nullish().catch(null),
      offices: z.array(z.object({ name: maybeText, location: maybeText }).catch({ name: null, location: null })).nullish().catch(null),
    }).catch({ id: "", title: null, updated_at: null, first_published: null, absolute_url: null, location: null, offices: null }),
  ),
});

const leverSchema = z.array(
  z.object({
    id: z.string(),
    text: maybeText,
    hostedUrl: maybeText,
    createdAt: z.number().nullish().catch(null),
    country: maybeText,
    workplaceType: maybeText,
    descriptionPlain: maybeText,
    additionalPlain: maybeText,
    lists: z.array(z.object({ text: maybeText, content: maybeText }).catch({ text: null, content: null })).nullish().catch(null),
    categories: z
      .object({ location: maybeText, allLocations: z.array(z.string()).nullish().catch(null), commitment: maybeText })
      .nullish()
      .catch(null),
    salaryRange: z
      .object({ min: z.number().nullish().catch(null), max: z.number().nullish().catch(null), currency: maybeText, interval: maybeText })
      .nullish()
      .catch(null),
  }).catch({ id: "", text: null, hostedUrl: null, createdAt: null, country: null, workplaceType: null, descriptionPlain: null, additionalPlain: null, lists: null, categories: null, salaryRange: null }),
);

const ashbyAddress = z.object({ postalAddress: z.object({ addressCountry: maybeText, addressLocality: maybeText }).nullish().catch(null) }).nullish().catch(null);
const ashbySchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      title: maybeText,
      location: maybeText,
      secondaryLocations: z.array(z.object({ location: maybeText, address: ashbyAddress }).catch({ location: null, address: null })).nullish().catch(null),
      address: ashbyAddress,
      isRemote: maybeBool,
      isListed: maybeBool,
      workplaceType: maybeText,
      publishedAt: maybeText,
      jobUrl: maybeText,
      descriptionPlain: maybeText,
      compensation: z.object({ compensationTierSummary: maybeText }).nullish().catch(null),
    }).catch({ id: "", title: null, location: null, secondaryLocations: null, address: null, isRemote: null, isListed: null, workplaceType: null, publishedAt: null, jobUrl: null, descriptionPlain: null, compensation: null }),
  ),
});

const job = (board: CompanyBoard, id: string, fields: Omit<BoardJob, "source" | "externalId" | "company" | "via">): BoardJob => ({
  source: "COMPANY_BOARDS",
  externalId: `${board.ats}:${board.slug}:${id}`.slice(0, 500),
  company: board.name.slice(0, 300),
  via: board.ats === "greenhouse" ? "Greenhouse" : board.ats === "lever" ? "Lever" : "Ashby",
  ...fields,
});

/** The jobs on a Greenhouse board: its list has no descriptions, which come when one is opened. */
export function greenhouseJobs(board: CompanyBoard, answer: unknown): BoardJob[] {
  const parsed = greenhouseSchema.safeParse(answer);
  if (!parsed.success) throw jobSearchError("changed", "COMPANY_BOARDS", { detail: `greenhouse ${board.slug}: unexpected answer` });
  return parsed.data.jobs
    .filter((entry) => entry.id)
    .map((entry) => {
      const where = [entry.location?.name, ...(entry.offices ?? []).flatMap((office) => [office.name, office.location])].filter(Boolean).join(" | ");
      return job(board, entry.id, {
        title: plainText(entry.title).slice(0, 500),
        place: plainText(entry.location?.name).slice(0, 300),
        remote: remoteOf(where),
        salary: "",
        postedAt: toIso(entry.first_published ?? entry.updated_at),
        url: safeLink(entry.absolute_url).slice(0, 2000),
        description: "",
        complete: false,
        where,
        countries: [],
      });
    });
}

export function leverJobs(board: CompanyBoard, answer: unknown): BoardJob[] {
  const parsed = leverSchema.safeParse(answer);
  if (!parsed.success) throw jobSearchError("changed", "COMPANY_BOARDS", { detail: `lever ${board.slug}: unexpected answer` });
  return parsed.data
    .filter((entry) => entry.id)
    .map((entry) => {
      const locations = [entry.categories?.location, ...(entry.categories?.allLocations ?? [])].filter(Boolean) as string[];
      const where = [...new Set(locations)].join(" | ");
      const sections = (entry.lists ?? []).map((list) => [plainText(list.text), plainText(list.content)].filter(Boolean).join("\n")).filter(Boolean);
      const description = [entry.descriptionPlain?.trim(), ...sections, entry.additionalPlain?.trim()].filter(Boolean).join("\n\n").slice(0, 100_000);
      const salary = entry.salaryRange;
      const amount = (value: number) => Math.round(value).toLocaleString("en-US");
      return job(board, entry.id, {
        title: plainText(entry.text).slice(0, 500),
        place: plainText(entry.categories?.location).slice(0, 300),
        remote: entry.workplaceType === "remote" ? true : entry.workplaceType === "onsite" ? false : remoteOf(where),
        salary:
          salary && (salary.min || salary.max)
            ? [salary.currency, salary.min && salary.max ? `${amount(salary.min)}–${amount(salary.max)}` : amount((salary.min || salary.max)!), salary.interval?.replace(/-/g, " ")]
                .filter(Boolean)
                .join(" ")
                .slice(0, 200)
            : "",
        postedAt: toIso(entry.createdAt),
        url: safeLink(entry.hostedUrl).slice(0, 2000),
        description,
        complete: description.length > 0,
        where,
        countries: entry.country && /^[a-z]{2}$/i.test(entry.country) ? [entry.country.toLowerCase()] : [],
      });
    });
}

export function ashbyJobs(board: CompanyBoard, answer: unknown): BoardJob[] {
  const parsed = ashbySchema.safeParse(answer);
  if (!parsed.success) throw jobSearchError("changed", "COMPANY_BOARDS", { detail: `ashby ${board.slug}: unexpected answer` });
  return parsed.data.jobs
    .filter((entry) => entry.id && entry.isListed !== false)
    .map((entry) => {
      const addresses = [entry.address, ...(entry.secondaryLocations ?? []).map((location) => location.address)];
      const countries = addresses.map((address) => countryCodeFor(address?.postalAddress?.addressCountry ?? "")).filter(Boolean);
      const where = [entry.location, ...(entry.secondaryLocations ?? []).map((location) => location.location)].filter(Boolean).join(" | ");
      // Ashby sets isRemote on hybrid roles too: the workplace type says more when there is one.
      const workplace = entry.workplaceType?.toLowerCase().replace(/[^a-z]/g, "");
      const remote = workplace === "remote" ? true : workplace === "onsite" || workplace === "hybrid" ? false : entry.isRemote === true ? true : null;
      const description = (entry.descriptionPlain ?? "").trim().slice(0, 100_000);
      return job(board, entry.id, {
        title: plainText(entry.title).slice(0, 500),
        place: plainText(entry.location).slice(0, 300),
        remote,
        salary: plainText(entry.compensation?.compensationTierSummary).slice(0, 200),
        postedAt: toIso(entry.publishedAt),
        url: safeLink(entry.jobUrl).slice(0, 2000),
        description,
        complete: description.length > 0,
        where: remote ? `${where} | Remote` : where,
        countries: [...new Set(countries)],
      });
    });
}

function boardUrl(board: CompanyBoard, baseUrl?: string): URL {
  const slug = encodeURIComponent(board.slug);
  const origin = baseUrl ? `${baseUrl}/${board.ats}` : ORIGINS[board.ats];
  if (board.ats === "greenhouse") return new URL(`${origin}/v1/boards/${slug}/jobs`);
  if (board.ats === "lever") {
    const url = new URL(`${origin}/v0/postings/${slug}`);
    url.searchParams.set("mode", "json");
    return url;
  }
  const url = new URL(`${origin}/posting-api/job-board/${slug}`);
  url.searchParams.set("includeCompensation", "true");
  return url;
}

const READERS: Record<CompanyAts, (board: CompanyBoard, answer: unknown) => BoardJob[]> = { greenhouse: greenhouseJobs, lever: leverJobs, ashby: ashbyJobs };

/** A board's jobs, from the cache when it was read in the last half hour. */
async function readBoard(board: CompanyBoard, context: RequestContext): Promise<BoardJob[]> {
  const key = `board:${board.ats}:${board.slug.toLowerCase()}`;
  const hit = cached<BoardJob[]>(key);
  if (hit) return hit;
  const answer = await requestJson("COMPANY_BOARDS", boardUrl(board, context.baseUrl), {
    signal: context.signal,
    timeoutMs: BOARD_TIMEOUT_MS,
    maxBytes: BOARD_MAX_BYTES,
    logPath: `${board.ats}:${board.slug}`,
  });
  const jobs = READERS[board.ats](board, answer);
  remember(key, jobs);
  return jobs;
}

/** Every board's jobs, a few boards at a time; a board that fails is left out, unless they all do. */
export async function readBoards(boards: readonly CompanyBoard[], context: RequestContext = {}): Promise<BoardJob[]> {
  const queue = [...boards];
  const results: BoardJob[][] = [];
  let failures = 0;
  let firstError: unknown = null;
  const worker = async () => {
    for (let board = queue.shift(); board; board = queue.shift()) {
      try {
        results.push(await readBoard(board, context));
      } catch (error) {
        if (context.signal?.aborted) throw error;
        failures += 1;
        firstError ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, boards.length) }, worker));
  if (boards.length > 0 && failures === boards.length) {
    throw firstError instanceof JobSearchError ? firstError : jobSearchError("unavailable", "COMPANY_BOARDS", { detail: "no board answered" });
  }
  return results.flat();
}

/** The jobs that fit the search, newest first. */
export function matchingJobs(jobs: readonly BoardJob[], query: SearchQuery, now = Date.now()): BoardJob[] {
  const days = POSTED_WITHIN.find((option) => option.value === query.postedWithin)?.days;
  const since = days ? now - days * 24 * 60 * 60 * 1000 : null;
  const place = query.place.trim().toLowerCase();
  return jobs
    .filter((entry) => titleMatches(entry.title, query.keywords))
    .filter((entry) => inCountry(entry, query.country))
    .filter((entry) => !query.remoteOnly || entry.remote === true)
    .filter((entry) => !place || entry.where.toLowerCase().includes(place) || entry.remote === true)
    .filter((entry) => since === null || !entry.postedAt || Date.parse(entry.postedAt) >= since)
    .toSorted((a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0));
}

/** The posting without what was only for matching. */
function asPosting(job: BoardJob): FoundPosting {
  const posting: Partial<BoardJob> = { ...job };
  delete posting.where;
  delete posting.countries;
  return posting as FoundPosting;
}

async function searchPage(query: SearchQuery, { boards }: SourceCredentials["COMPANY_BOARDS"], next: string | null, context: RequestContext = {}): Promise<SearchPage> {
  const offset = next?.startsWith("offset:") ? Math.max(0, Number(next.slice("offset:".length)) || 0) : 0;
  const matches = matchingJobs(await readBoards(boards, context), query);
  const page = matches.slice(offset, offset + PAGE_SIZE).map(asPosting);
  return { postings: page, next: offset + PAGE_SIZE < matches.length ? `offset:${offset + PAGE_SIZE}` : null };
}

const greenhouseDetailSchema = z.object({ content: maybeText });

/** A Greenhouse posting's text, which its board's list leaves out. */
async function details(posting: FoundPosting, { boards }: SourceCredentials["COMPANY_BOARDS"], context: RequestContext = {}): Promise<string | null> {
  const [ats, slug, id] = posting.externalId.split(":");
  if (ats !== "greenhouse" || !slug || !id) return null;
  const known = boards.some((board) => board.ats === "greenhouse" && board.slug.toLowerCase() === slug.toLowerCase());
  if (!known) return null;
  const origin = context.baseUrl ? `${context.baseUrl}/greenhouse` : ORIGINS.greenhouse;
  const url = new URL(`${origin}/v1/boards/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}`);
  const answer = greenhouseDetailSchema.safeParse(await requestJson("COMPANY_BOARDS", url, { signal: context.signal, logPath: `greenhouse:${slug}` }));
  if (!answer.success || !answer.data.content) return null;
  // Greenhouse sends the HTML escaped: back to HTML, then to text with its line breaks.
  return htmlToText(decodeEntities(answer.data.content)) || null;
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", amp: "&" };

export function decodeEntities(text: string): string {
  return text.replace(/&(lt|gt|quot|#39|apos|amp);/g, (_, name: string) => ENTITIES[name]);
}

/** HTML as text, a line for each block and "- " for each list item. */
export function htmlToText(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|h[1-6]|ul|ol)>|<br\s*\/?>/gi, "\n")
    .split("\n")
    .map((line) => plainText(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 100_000);
}

export const companyBoards: JobSourceAdapter<"COMPANY_BOARDS"> = {
  source: "COMPANY_BOARDS",
  search: searchPage,
  details,
  test: async ({ boards }, context) => {
    if (boards.length === 0) throw new JobSearchError("no-key", "Add at least one company board in Settings → Job search.");
    // A few boards are enough to show they answer.
    await readBoards(boards.slice(0, 3), context);
  },
};
