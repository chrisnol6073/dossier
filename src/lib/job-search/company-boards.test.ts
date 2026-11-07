import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { json, stubFetch } from "@/lib/ai/test-http";

import { clearJobSearchCache } from "./cache";
import { ashbyJobs, companyBoards, countriesIn, greenhouseJobs, htmlToText, inCountry, leverJobs, matchingJobs, titleMatches } from "./company-boards";
import { DEFAULT_COMPANY_BOARDS, parseCompanyBoards, type CompanyBoard } from "./company-boards-list";
import { EMPTY_QUERY } from "./search";

const greenhouse: CompanyBoard = { ats: "greenhouse", slug: "acme", name: "Acme" };
const lever: CompanyBoard = { ats: "lever", slug: "bolt", name: "Bolt" };
const ashby: CompanyBoard = { ats: "ashby", slug: "wayflyer", name: "Wayflyer" };

const greenhouseBoard = {
  jobs: [
    { id: 1, title: "Senior QA Engineer", location: { name: "Dublin, Ireland" }, absolute_url: "https://boards.greenhouse.io/acme/jobs/1", first_published: "2026-11-01T10:00:00Z" },
    { id: 2, title: "Product Designer", location: { name: "Dublin, Ireland" }, absolute_url: "https://boards.greenhouse.io/acme/jobs/2" },
    { id: 3, title: "Test Automation Engineer", location: { name: "Remote - EMEA" }, absolute_url: "https://boards.greenhouse.io/acme/jobs/3", first_published: "2026-11-03T10:00:00Z" },
    { id: 4, title: "QA Engineer", location: { name: "New York, NY" }, absolute_url: "https://boards.greenhouse.io/acme/jobs/4" },
  ],
};
const leverBoard = [
  {
    id: "abc",
    text: "SDET (Payments)",
    hostedUrl: "https://jobs.lever.co/bolt/abc",
    createdAt: 1762300000000,
    country: "BG",
    workplaceType: "hybrid",
    descriptionPlain: "Test payments.",
    lists: [{ text: "Requirements", content: "<li>Playwright</li><li>Postman</li>" }],
    categories: { location: "Sofia" },
    salaryRange: { min: 40000, max: 55000, currency: "EUR", interval: "per-year-salary" },
  },
];
const ashbyBoard = {
  jobs: [
    {
      id: "u1",
      title: "Quality Assurance Lead",
      location: "London",
      secondaryLocations: [{ location: "Dublin", address: { postalAddress: { addressCountry: "Ireland" } } }],
      address: { postalAddress: { addressCountry: "United Kingdom" } },
      isRemote: true,
      workplaceType: "Hybrid",
      publishedAt: "2026-11-04T09:00:00.000+00:00",
      jobUrl: "https://jobs.ashbyhq.com/wayflyer/u1",
      descriptionPlain: "Lead QA.",
      compensation: { compensationTierSummary: "€70K – €85K" },
    },
    { id: "u2", title: "Hidden QA", isListed: false },
  ],
};

beforeEach(() => clearJobSearchCache());
afterEach(() => vi.unstubAllGlobals());

describe("the board list", () => {
  it("reads one board a line, with or without a name, once each", () => {
    expect(parseCompanyBoards("greenhouse:intercom Intercom\n# comment\nlever:bolt, ashby:Wayflyer Wayflyer Ltd\nnonsense\nGreenhouse:INTERCOM")).toEqual([
      { ats: "greenhouse", slug: "intercom", name: "Intercom" },
      { ats: "lever", slug: "bolt", name: "bolt" },
      { ats: "ashby", slug: "Wayflyer", name: "Wayflyer Ltd" },
    ]);
  });

  it("has a built-in European list", () => {
    expect(DEFAULT_COMPANY_BOARDS.length).toBeGreaterThan(50);
    expect(DEFAULT_COMPANY_BOARDS).toContainEqual({ ats: "greenhouse", slug: "intercom", name: "Intercom" });
  });
});

describe("matching", () => {
  it("matches titles by alternatives, word starts and QA synonyms", () => {
    expect(titleMatches("Senior Quality Assurance Engineer", "QA Engineer, SDET")).toBe(true);
    expect(titleMatches("Software Tester", "test")).toBe(true);
    expect(titleMatches("SDET II", "QA Engineer, SDET")).toBe(true);
    expect(titleMatches("Backend Engineer", "QA Engineer, SDET")).toBe(false);
    expect(titleMatches("Anything", "")).toBe(true);
  });

  it("finds countries in locations, by name or city", () => {
    expect([...countriesIn("Dublin, Ireland")]).toEqual(["ie"]);
    expect([...countriesIn("Belfast")]).toEqual(["gb"]);
    expect([...countriesIn("Sofia / Remote (UK)")].sort()).toEqual(["bg", "gb"]);
    expect([...countriesIn("Remote - Sweden")]).toEqual(["se"]);
    expect([...countriesIn("Boston, MA")]).toEqual([]);
    expect([...countriesIn("London, UK")]).toEqual(["gb"]);
  });

  it("counts remote across Europe for a European country, not a US-only posting", () => {
    expect(inCountry({ where: "Remote - EMEA", countries: [], remote: true }, "bg")).toBe(true);
    expect(inCountry({ where: "Remote - Europe", countries: [], remote: true }, "us")).toBe(false);
    expect(inCountry({ where: "Remote - US, worldwide", countries: [], remote: true }, "ie")).toBe(false);
    expect(inCountry({ where: "New York", countries: [], remote: false }, "ie")).toBe(false);
  });

  it("turns Greenhouse HTML into lines", () => {
    expect(htmlToText("<p>About</p><ul><li>One &amp; two</li><li>Three</li></ul>")).toBe("About\n\n- One & two\n- Three");
  });
});

describe("reading boards", () => {
  it("maps each ATS to the shared shape", () => {
    expect(greenhouseJobs(greenhouse, greenhouseBoard)[0]).toMatchObject({
      source: "COMPANY_BOARDS",
      externalId: "greenhouse:acme:1",
      company: "Acme",
      title: "Senior QA Engineer",
      place: "Dublin, Ireland",
      via: "Greenhouse",
      complete: false,
    });
    expect(leverJobs(lever, leverBoard)[0]).toMatchObject({
      externalId: "lever:bolt:abc",
      company: "Bolt",
      salary: "EUR 40,000–55,000 per year salary",
      countries: ["bg"],
      complete: true,
      description: "Test payments.\n\nRequirements\nPlaywrightPostman",
    });
    const [wayflyer, ...rest] = ashbyJobs(ashby, ashbyBoard);
    expect(rest).toEqual([]);
    expect(wayflyer).toMatchObject({ externalId: "ashby:wayflyer:u1", countries: ["gb", "ie"], salary: "€70K – €85K", remote: false });
  });

  it("keeps the postings in the country with the keywords, newest first", () => {
    const jobs = [...greenhouseJobs(greenhouse, greenhouseBoard), ...ashbyJobs(ashby, ashbyBoard)];
    const ireland = matchingJobs(jobs, { ...EMPTY_QUERY, keywords: "QA, Test Automation", country: "ie" });
    expect(ireland.map((job) => job.externalId)).toEqual(["ashby:wayflyer:u1", "greenhouse:acme:3", "greenhouse:acme:1"]);
    const remote = matchingJobs(jobs, { ...EMPTY_QUERY, keywords: "QA, Test", country: "ie", remoteOnly: true });
    expect(remote.map((job) => job.externalId)).toEqual(["greenhouse:acme:3"]);
    const cork = matchingJobs(jobs, { ...EMPTY_QUERY, keywords: "QA", country: "ie", place: "Cork" });
    expect(cork).toEqual([]);
  });

  it("searches every board, leaving out one that fails", async () => {
    const requests = stubFetch(({ url }) =>
      url.hostname === "boards-api.greenhouse.io" ? json(greenhouseBoard) : url.hostname === "api.lever.co" ? json(leverBoard) : json({}, { status: 404 }),
    );
    const page = await companyBoards.search({ ...EMPTY_QUERY, keywords: "QA, SDET, Test", country: "bg" }, { boards: [greenhouse, lever, ashby] }, null);
    expect(requests.map(({ url }) => url.hostname).sort()).toEqual(["api.ashbyhq.com", "api.lever.co", "boards-api.greenhouse.io"]);
    expect(page.postings.map((posting) => posting.externalId)).toEqual(["greenhouse:acme:3", "lever:bolt:abc"]);
    expect(page.postings[0]).not.toHaveProperty("where");
    expect(page.next).toBeNull();
  });

  it("fails when no board answers", async () => {
    stubFetch(() => json({}, { status: 500 }));
    await expect(companyBoards.search({ ...EMPTY_QUERY, keywords: "QA", country: "ie" }, { boards: [greenhouse] }, null)).rejects.toMatchObject({ problem: "unavailable" });
  });

  it("fetches a Greenhouse posting's text when it's opened", async () => {
    stubFetch(() => json({ content: "&lt;p&gt;Hello&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Playwright&lt;/li&gt;&lt;/ul&gt;" }));
    const [posting] = greenhouseJobs(greenhouse, greenhouseBoard);
    expect(await companyBoards.details(posting, { boards: [greenhouse] })).toBe("Hello\n\n- Playwright");
    expect(await companyBoards.details(posting, { boards: [lever] })).toBeNull();
  });
});
