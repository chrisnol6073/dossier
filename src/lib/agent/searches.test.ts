import { describe, expect, it } from "vitest";

import { EMPTY_QUERY, type FoundPosting } from "@/lib/job-search/search";

import { agentSearchPlan, EUROPE_QA_SEARCHES, excludedTerms, mergePostings, titleExcluded } from "./searches";

const main = { ...EMPTY_QUERY, keywords: "QA Engineer", country: "ie" };
const posting = (externalId: string, title: string): FoundPosting => ({
  source: "COMPANY_BOARDS",
  externalId,
  title,
  company: "",
  place: "",
  remote: null,
  salary: "",
  postedAt: null,
  url: "",
  via: "",
  description: "",
  complete: false,
});

describe("the agent's searches", () => {
  it("plans the main search and the rest, each with its source, without the BA, gaps or repeats", () => {
    const plan = agentSearchPlan(main, "JSEARCH", [
      { ...main, source: null },
      { ...main, country: "gb", source: "COMPANY_BOARDS" },
      { ...main, country: "de", source: "ARBEITSAGENTUR" },
      { ...main, keywords: " ", source: "JOOBLE" },
    ]);
    expect(plan).toEqual([
      { source: "JSEARCH", query: main },
      { source: "COMPANY_BOARDS", query: { ...main, country: "gb" } },
    ]);
    expect(agentSearchPlan(main, null, [{ ...main, source: "JOOBLE" }])).toEqual([{ source: "JOOBLE", query: main }]);
  });

  it("leaves out excluded titles as whole words, and each posting once", () => {
    const terms = excludedTerms("Java, C#, .NET");
    expect(titleExcluded("Java SDET", terms)).toBe(true);
    expect(titleExcluded("QA Engineer (C#)", terms)).toBe(true);
    expect(titleExcluded("JavaScript Test Engineer", terms)).toBe(false);
    expect(titleExcluded("QA Engineer", [])).toBe(false);
    const merged = mergePostings([[posting("1", "QA Engineer"), posting("2", "Java SDET")], [posting("1", "QA Engineer"), posting("3", "Test Lead")]], terms);
    expect(merged.map((entry) => entry.externalId)).toEqual(["1", "3"]);
  });

  it("has a European QA set that plans fully", () => {
    expect(agentSearchPlan(main, "COMPANY_BOARDS", EUROPE_QA_SEARCHES)).toHaveLength(EUROPE_QA_SEARCHES.length + 1);
  });
});
