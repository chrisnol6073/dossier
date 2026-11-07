import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveSettings } from "@/lib/settings-data";
import { createTestClient, resetDatabase } from "@/test/db";

import { syncVault, VAULT_FOLDER } from "./vault";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
vi.mock("@/lib/env", () => ({ env: { JOBS_IRELAND_SECRET: "a".repeat(32) } }));

const prisma = () => db.client!;
let dir = "";

beforeEach(async () => {
  await resetDatabase(prisma());
  dir = await mkdtemp(path.join(tmpdir(), "vault-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));
afterAll(() => prisma().$disconnect());

const now = new Date("2026-11-07T12:00:00Z");

describe("syncVault", () => {
  it("writes applications, good finds and an overview, and keeps the user's own notes", async () => {
    const application = await prisma().application.create({
      data: { company: "Acme", role: "QA Engineer", status: "SENT", sentAt: now, notes: { create: { body: "Applied on their site" } } },
    });
    await prisma().application.create({ data: { company: "Hidden", role: "Draft", awaitingReview: true } });
    await saveSettings({ agentMinScore: 70 });
    await prisma().agentCandidate.createMany({
      data: [
        { source: "COMPANY_BOARDS", externalId: "a", title: "SDET", company: "Bolt", score: 85, dedupeKey: "a", createdAt: now },
        { source: "COMPANY_BOARDS", externalId: "b", title: "Tester", company: "Low", score: 40, dedupeKey: "b", createdAt: now },
        { source: "COMPANY_BOARDS", externalId: "c", title: "QA", company: "Gone", score: 90, dedupeKey: "c", status: "DISMISSED", createdAt: now },
      ],
    });

    expect(await syncVault(dir, now, "http://localhost:3001")).toEqual({ applications: 1, finds: 1 });
    const root = path.join(dir, VAULT_FOLDER);
    expect(await readdir(path.join(root, "Applications"))).toEqual(["Acme – QA Engineer.md"]);
    expect(await readdir(path.join(root, "Job finds"))).toEqual(["Bolt – SDET.md"]);
    const overview = await readFile(path.join(root, "Jobs Ireland.md"), "utf8");
    expect(overview).toContain("### Sent (1)\n\n- [[Jobs Ireland/Applications/Acme – QA Engineer|Acme – QA Engineer]]");
    expect(overview).toContain("- 85 · [[Jobs Ireland/Job finds/Bolt – SDET|Bolt – SDET]]");

    // The user renames the note and writes below the end line; the next sync finds it by its id.
    const file = path.join(root, "Applications", "Acme – QA Engineer.md");
    const renamed = path.join(root, "Applications", "Acme (my name).md");
    await writeFile(renamed, `${await readFile(file, "utf8")}Interview prep: ask about CI.\n`);
    await rm(file);
    await prisma().application.update({ where: { id: application.id }, data: { status: "INTERVIEW" } });
    await syncVault(dir, now, null);
    expect(await readdir(path.join(root, "Applications"))).toEqual(["Acme (my name).md"]);
    const note = await readFile(renamed, "utf8");
    expect(note).toContain("status: Interview");
    expect(note).toContain("Interview prep: ask about CI.");
    expect(note).not.toContain("Open in Jobs Ireland");
  });
});
