import { describe, expect, it, vi } from "vitest";

import { applicationNote, END, findNote, mergeNote, noteName, START } from "./vault";

vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const application = {
  id: "app1",
  company: "Acme: Payments",
  role: "QA Engineer",
  title: "",
  location: "Dublin",
  mode: "Hybrid",
  salary: "€60k",
  postingUrl: "https://acme.example/jobs/1",
  postingText: "We test payments.\n---\nMore <!-- hidden --> text",
  status: "INTERVIEW" as const,
  sentAt: new Date("2026-11-01T10:00:00Z"),
  nextInterviewAt: null,
  deadline: null,
  agentScore: 82,
  createdAt: new Date("2026-10-30T10:00:00Z"),
  updatedAt: new Date("2026-11-02T10:00:00Z"),
  match: { items: [{ requirement: "Playwright", result: "covered", skill: "Playwright", experienceIds: [], note: null }] },
  notes: [{ body: "Called\nthe recruiter", createdAt: new Date("2026-11-02T09:00:00Z") }],
};

describe("vault notes", () => {
  it("makes safe file names", () => {
    expect(noteName("Acme: Payments – QA/Test [Lead]?")).toBe("Acme Payments – QA Test Lead");
    expect(noteName("  ...  ")).toBe("Untitled");
  });

  it("writes an application's note with frontmatter, match, notes and the posting", () => {
    const note = applicationNote(application, "http://localhost:3001");
    expect(note.frontmatter).toContain('company: "Acme: Payments"');
    expect(note.frontmatter).toContain("status: Interview");
    expect(note.frontmatter).toContain("jobs_ireland_id: app1");
    expect(note.frontmatter).toContain("tags: [jobs-ireland, application, status/interview]");
    expect(note.body).toContain("# Acme: Payments – QA Engineer");
    expect(note.body).toContain("[Open in Jobs Ireland](http://localhost:3001/applications/app1)");
    expect(note.body).toContain("- ✅ Playwright");
    expect(note.body).toContain("- 2026-11-02: Called the recruiter");
    // Text from elsewhere can't break the note's frontmatter or markers.
    expect(note.body).not.toContain("<!--");
    expect(note.body).not.toMatch(/^---$/m);
  });

  it("writes a find's note with the score and reasons", () => {
    const note = findNote(
      {
        id: "f1",
        title: "SDET",
        company: "Bolt",
        place: "Sofia",
        remote: false,
        salary: "",
        url: "https://jobs.lever.co/bolt/1",
        via: "Lever",
        description: "Build tests.",
        score: 88,
        reasons: ["Playwright", 3],
        redFlags: [],
        postedAt: null,
        createdAt: new Date("2026-11-05T00:00:00Z"),
      },
      null,
    );
    expect(note.frontmatter).toContain("score: 88");
    expect(note.body).toContain("**Score:** 88/100 · via Lever");
    expect(note.body).toContain("## Why it fits\n\n- Playwright");
    expect(note.body).not.toContain("What gives pause");
  });

  it("rewrites only its own part, keeping what's below the end line", () => {
    const part = { frontmatter: "---\na: 1\n---\n", body: "New" };
    const first = mergeNote(null, part);
    expect(first).toBe(`---\na: 1\n---\n${START}\nNew\n${END}\n\n`);
    const edited = `${first}My own thoughts.\n`;
    expect(mergeNote(edited, { ...part, body: "Newer" })).toBe(`---\na: 1\n---\n${START}\nNewer\n${END}\n\nMy own thoughts.\n`);
    // A note someone made by hand keeps its body below ours.
    expect(mergeNote("---\nx: 2\n---\nHand-written\n", part)).toBe(`---\na: 1\n---\n${START}\nNew\n${END}\n\nHand-written\n`);
  });
});
