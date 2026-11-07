import { afterEach, describe, expect, it, vi } from "vitest";

import { json, stubFetch } from "@/lib/ai/test-http";

import { parseJoobleKeys } from "./config";
import { JobSearchError } from "./errors";
import { jooble, joobleBody, joobleKeyFor, joobleRadius } from "./jooble";
import { EMPTY_QUERY } from "./search";

vi.mock("@/lib/env", () => ({ env: { JOBS_IRELAND_SECRET: "a".repeat(32) } }));
vi.mock("@/lib/posting-fetch", () => ({ fetchPosting: vi.fn() }));

const query = { ...EMPTY_QUERY, keywords: "QA Engineer", country: "ie" };
const answer = {
  totalCount: 45,
  jobs: [
    {
      id: 1234567890,
      title: "<b>QA</b> Engineer",
      location: "Dublin",
      snippet: "Join our&nbsp;team testing payments...",
      salary: "€50,000 - €60,000",
      source: "irishjobs.ie",
      type: "Full-time",
      link: "https://ie.jooble.org/jdp/123",
      company: "Acme",
      updated: "2026-11-05T12:55:35.3870000",
    },
    { id: 1234567890, title: "Duplicate" },
    { id: 99, title: "Old QA role", updated: "2020-01-01T00:00:00.0000000" },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("Jooble keys", () => {
  it("reads one key per country, by code or name, and a key on its own for any country", () => {
    expect(parseJoobleKeys("ie=abc, Bulgaria: def\nUK=ghi")).toEqual({ ie: "abc", bg: "def", gb: "ghi" });
    expect(parseJoobleKeys("solo-key")).toEqual({ "*": "solo-key" });
    expect(joobleKeyFor({ ie: "abc", "*": "any" }, "ie")).toBe("abc");
    expect(joobleKeyFor({ ie: "abc", "*": "any" }, "se")).toBe("any");
    expect(joobleKeyFor({ ie: "abc" }, "se")).toBeNull();
  });
});

describe("Jooble search", () => {
  it("POSTs the search to the key's address, with the country's name as the place", async () => {
    const requests = stubFetch(() => json(answer));
    await jooble.search(query, { keys: { ie: "KEY1" } }, null);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.href).toBe("https://jooble.org/api/KEY1");
    expect(requests[0].body).toEqual({ keywords: "QA Engineer", location: "Ireland", page: "1", ResultOnPage: "20", companysearch: "false" });
  });

  it("sends the place with the nearest distance it takes, and remote with the keywords", () => {
    expect(joobleBody({ ...query, place: "Cork", radiusKm: 50, remoteOnly: true }, 2)).toMatchObject({
      keywords: "QA Engineer remote",
      location: "Cork",
      radius: "40",
      page: "2",
    });
    expect(joobleRadius(10)).toBe(8);
    expect(joobleRadius(200)).toBe(80);
  });

  it("maps postings once each, as UTC, and leaves out ones older than asked", async () => {
    stubFetch(() => json(answer));
    const page = await jooble.search({ ...query, postedWithin: "month" }, { keys: { "*": "K" } }, null);
    expect(page.next).toBe("page:2");
    expect(page.postings).toEqual([
      {
        source: "JOOBLE",
        externalId: "1234567890",
        title: "QA Engineer",
        company: "Acme",
        place: "Dublin",
        remote: null,
        salary: "€50,000 - €60,000",
        postedAt: "2026-11-05T12:55:35.387Z",
        url: "https://ie.jooble.org/jdp/123",
        via: "irishjobs.ie",
        description: "Join our team testing payments...",
        complete: false,
      },
    ]);
  });

  it("asks for a key for the country when there is none", async () => {
    stubFetch(() => json(answer));
    await expect(jooble.search({ ...query, country: "se" }, { keys: { ie: "K" } }, null)).rejects.toMatchObject({ problem: "no-key", message: expect.stringContaining("Sweden") });
  });

  it("keeps the key out of the error's log detail", async () => {
    stubFetch(() => json({ error: "denied" }, { status: 403 }));
    const error = await jooble.search(query, { keys: { ie: "SECRET" } }, null).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(JobSearchError);
    expect((error as JobSearchError).problem).toBe("key");
    expect((error as JobSearchError).detail).not.toContain("SECRET");
  });
});
