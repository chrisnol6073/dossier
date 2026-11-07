import "server-only";

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { ApplicationStatus } from "@/generated/prisma/enums";
import { matchSchema, type Match } from "@/lib/application-data";
import { statusLabel } from "@/lib/applications-list";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { loadSettings, saveSettings } from "@/lib/settings-data";

// The Obsidian vault (Jobs Ireland): with JOBS_IRELAND_VAULT_DIR set (a
// vault folder mounted into the container), Jobs Ireland keeps a Markdown
// note for each application and for each job the agent found worth a look,
// under "Jobs Ireland/" in the vault, plus an overview note. Only the part
// between the start and end markers is Jobs Ireland's: it's rewritten on
// each sync, and anything written below the end marker is kept. A note is
// found again by the id in its frontmatter, so renaming or moving it within
// its folder keeps it linked. Nothing is ever deleted from the vault.

export const VAULT_FOLDER = "Jobs Ireland";
const APPLICATIONS = "Applications";
const FINDS = "Job finds";
const OVERVIEW = "Jobs Ireland.md";
export const START = "<!-- jobs-ireland:start · written by Jobs Ireland, which rewrites everything up to the end line -->";
export const END = "<!-- jobs-ireland:end · your own notes go below this line and are kept -->";

/** Syncs run at most this often on their own. */
const EVERY_MS = 15 * 60 * 1000;
/** Finds older than this aren't written any more (their notes stay). */
const FINDS_DAYS = 60;

export type VaultResult = { applications: number; finds: number };

/** The vault folder, when one is set. */
export const vaultDir = (dir = env.JOBS_IRELAND_VAULT_DIR) => dir ?? null;

// ─── Markdown ────────────────────────────────────────────────────────────────

/** A file name Windows, macOS and Obsidian all take: no \ / : * ? " < > | # ^ [ ], at most 120 characters. */
export function noteName(text: string): string {
  const clean = text
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 120)
    .trim();
  return clean || "Untitled";
}

/** A YAML value: plain when safe, else quoted. */
function yaml(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return '""';
  if (typeof value !== "string") return String(value);
  return /^[\w .,@()/+-]+$/.test(value) && !/^[\d.+-]/.test(value) && !/^(true|false|null|yes|no)$/i.test(value) ? value : JSON.stringify(value);
}

function frontmatter(fields: Record<string, string | number | boolean | null | undefined | string[]>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => (Array.isArray(value) ? `${key}: [${value.map(yaml).join(", ")}]` : `${key}: ${yaml(value)}`));
  return `---\n${lines.join("\n")}\n---\n`;
}

const day = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null);
const tag = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Text from elsewhere, so it can't close our markers or start frontmatter. */
const safe = (text: string) => text.replace(/<!--|-->/g, "").replace(/^---$/gm, "—").trim();

const RESULT_LABEL: Record<Match["items"][number]["result"], string> = { covered: "✅", partial: "🟡", gap: "❌" };

type ApplicationNote = {
  id: string;
  company: string;
  role: string;
  title: string;
  location: string;
  mode: string;
  salary: string;
  postingUrl: string;
  postingText: string;
  status: ApplicationStatus;
  sentAt: Date | null;
  nextInterviewAt: Date | null;
  deadline: Date | null;
  agentScore: number | null;
  createdAt: Date;
  updatedAt: Date;
  match: unknown;
  notes: { body: string; createdAt: Date }[];
};

/** Jobs Ireland's part of an application's note. */
export function applicationNote(application: ApplicationNote, appUrl: string | null): { frontmatter: string; body: string } {
  const role = application.role || application.title || "Application";
  const company = application.company || "Unknown company";
  const status = statusLabel(application.status);
  const match = matchSchema.safeParse(application.match);
  const facts = [
    `**Status:** ${status}`,
    application.sentAt ? `**Applied:** ${day(application.sentAt)}` : null,
    application.nextInterviewAt ? `**Next interview:** ${application.nextInterviewAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : null,
    application.deadline ? `**Deadline:** ${day(application.deadline)}` : null,
    application.agentScore !== null ? `**Agent score:** ${application.agentScore}/100` : null,
  ].filter(Boolean);
  const where = [application.location, application.mode, application.salary].filter(Boolean).join(" · ");
  const links = [
    appUrl ? `[Open in Jobs Ireland](${appUrl}/applications/${application.id})` : null,
    application.postingUrl ? `[Posting](${application.postingUrl})` : null,
  ].filter(Boolean);
  const sections = [
    `# ${safe(company)} – ${safe(role)}`,
    facts.join(" · "),
    where ? safe(where) : null,
    links.length ? links.join(" · ") : null,
    match.success && match.data.items.length
      ? `## How you match\n\n${match.data.items
          .map((item) => `- ${RESULT_LABEL[item.result]} ${safe(item.requirement)}${item.note ? ` — ${safe(item.note)}` : ""}`)
          .join("\n")}`
      : null,
    application.notes.length
      ? `## Notes from Jobs Ireland\n\n${application.notes.map((note) => `- ${day(note.createdAt)}: ${safe(note.body).replace(/\n+/g, " ")}`).join("\n")}`
      : null,
    application.postingText.trim() ? `## The posting\n\n${safe(application.postingText).slice(0, 20_000)}` : null,
  ].filter(Boolean);
  return {
    frontmatter: frontmatter({
      type: "job-application",
      company,
      role,
      status,
      location: application.location || null,
      salary: application.salary || null,
      posting: application.postingUrl || null,
      applied: day(application.sentAt),
      next_interview: application.nextInterviewAt?.toISOString() ?? null,
      deadline: day(application.deadline),
      agent_score: application.agentScore,
      created: day(application.createdAt),
      updated: day(application.updatedAt),
      jobs_ireland_id: application.id,
      tags: ["jobs-ireland", "application", `status/${tag(status)}`],
    }),
    body: sections.join("\n\n"),
  };
}

type FindNote = {
  id: string;
  title: string;
  company: string;
  place: string;
  remote: boolean | null;
  salary: string;
  url: string;
  via: string;
  description: string;
  score: number;
  reasons: unknown;
  redFlags: unknown;
  postedAt: Date | null;
  createdAt: Date;
};

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

/** Jobs Ireland's part of a job find's note. */
export function findNote(find: FindNote, appUrl: string | null): { frontmatter: string; body: string } {
  const title = find.title || "Job";
  const company = find.company || "Unknown company";
  const reasons = strings(find.reasons);
  const flags = strings(find.redFlags);
  const where = [find.place, find.remote ? "Remote" : "", find.salary].filter(Boolean).join(" · ");
  const links = [find.url ? `[Posting](${find.url})` : null, appUrl ? `[Agent screen](${appUrl}/agent)` : null].filter(Boolean);
  const sections = [
    `# ${safe(company)} – ${safe(title)}`,
    `**Score:** ${find.score}/100${find.postedAt ? ` · **Posted:** ${day(find.postedAt)}` : ""}${find.via ? ` · via ${safe(find.via)}` : ""}`,
    where ? safe(where) : null,
    links.length ? links.join(" · ") : null,
    reasons.length ? `## Why it fits\n\n${reasons.map((reason) => `- ${safe(reason)}`).join("\n")}` : null,
    flags.length ? `## What gives pause\n\n${flags.map((flag) => `- ${safe(flag)}`).join("\n")}` : null,
    find.description.trim() ? `## The posting\n\n${safe(find.description).slice(0, 20_000)}` : null,
  ].filter(Boolean);
  return {
    frontmatter: frontmatter({
      type: "job-find",
      company,
      role: title,
      score: find.score,
      location: find.place || null,
      remote: find.remote,
      posting: find.url || null,
      posted: day(find.postedAt),
      found: day(find.createdAt),
      jobs_ireland_id: find.id,
      tags: ["jobs-ireland", "job-find"],
    }),
    body: sections.join("\n\n"),
  };
}

/** The note with Jobs Ireland's part replaced and the rest kept: what's below the end marker, or, in a note without markers, all of its body. */
export function mergeNote(existing: string | null, part: { frontmatter: string; body: string }): string {
  const ours = `${part.frontmatter}${START}\n${part.body}\n${END}\n`;
  if (existing === null) return `${ours}\n`;
  const end = existing.indexOf(END);
  if (end >= 0) return ours + existing.slice(end + END.length).replace(/^\n/, "");
  const body = existing.replace(/^---\n[\s\S]*?\n---\n?/, "");
  return `${ours}\n${body}`;
}

// ─── Files ───────────────────────────────────────────────────────────────────

/** Notes in a folder by the jobs_ireland_id in their frontmatter. */
async function notesById(folder: string): Promise<Map<string, string>> {
  const byId = new Map<string, string>();
  const names = await readdir(folder).catch(() => [] as string[]);
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    const head = (await readFile(path.join(folder, name), "utf8").catch(() => "")).slice(0, 3000);
    const id = /^jobs_ireland_id:\s*"?([\w-]+)"?\s*$/m.exec(head)?.[1];
    if (id) byId.set(id, name);
  }
  return byId;
}

/** Writes through a temporary file, so Obsidian never sees half a note. */
async function writeNote(file: string, text: string): Promise<void> {
  const temporary = `${file}.jobs-ireland-tmp`;
  await writeFile(temporary, text, "utf8");
  await rename(temporary, file);
}

/** Writes each note, returning the file name each id ended up in. */
async function writeNotes(
  folder: string,
  entries: { id: string; name: string; part: { frontmatter: string; body: string } }[],
): Promise<Map<string, string>> {
  await mkdir(folder, { recursive: true });
  const known = await notesById(folder);
  const taken = new Set((await readdir(folder).catch(() => [] as string[])).map((name) => name.toLowerCase()));
  const written = new Map<string, string>();
  for (const entry of entries) {
    let name = known.get(entry.id);
    if (!name) {
      name = `${noteName(entry.name)}.md`;
      if (taken.has(name.toLowerCase())) name = `${noteName(entry.name)} (${entry.id.slice(-6)}).md`;
      taken.add(name.toLowerCase());
    }
    const file = path.join(folder, name);
    const existing = await readFile(file, "utf8").catch(() => null);
    const next = mergeNote(existing, entry.part);
    if (next !== existing) await writeNote(file, next);
    written.set(entry.id, name);
  }
  return written;
}

const link = (folder: string, name: string) => `[[${VAULT_FOLDER}/${folder}/${name.replace(/\.md$/, "")}|${name.replace(/\.md$/, "")}]]`;

const ORDER: ApplicationStatus[] = [
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.SCREENING,
  ApplicationStatus.SENT,
  ApplicationStatus.DRAFT,
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.DECLINED,
];

/** Writes every note and the overview into the vault. */
export async function syncVault(dir: string, now = new Date(), appUrl = env.JOBS_IRELAND_PUBLIC_URL ?? null): Promise<VaultResult> {
  const root = path.join(dir, VAULT_FOLDER);
  const settings = await loadSettings();

  const applications = await prisma.application.findMany({
    where: { awaitingReview: false, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { notes: { orderBy: { createdAt: "asc" }, select: { body: true, createdAt: true } } },
  });
  const finds = await prisma.agentCandidate.findMany({
    where: {
      status: { not: "DISMISSED" },
      score: { gte: settings.agentMinScore },
      createdAt: { gte: new Date(now.getTime() - FINDS_DAYS * 24 * 60 * 60 * 1000) },
    },
    orderBy: { score: "desc" },
  });

  const applicationNames = await writeNotes(
    path.join(root, APPLICATIONS),
    applications.map((application) => ({
      id: application.id,
      name: `${application.company || "Unknown company"} – ${application.role || application.title || "Application"}`,
      part: applicationNote(application, appUrl),
    })),
  );
  const findNames = await writeNotes(
    path.join(root, FINDS),
    finds.map((find) => ({ id: find.id, name: `${find.company || "Unknown company"} – ${find.title || "Job"}`, part: findNote(find, appUrl) })),
  );

  const byStatus = ORDER.map((status) => {
    const rows = applications.filter((application) => application.status === status);
    if (rows.length === 0) return null;
    return `### ${statusLabel(status)} (${rows.length})\n\n${rows.map((row) => `- ${link(APPLICATIONS, applicationNames.get(row.id)!)}`).join("\n")}`;
  }).filter(Boolean);
  const overview = {
    frontmatter: frontmatter({ type: "jobs-ireland-overview", updated: now.toISOString(), tags: ["jobs-ireland"] }),
    body: [
      "# Jobs Ireland",
      `Updated ${now.toISOString().slice(0, 16).replace("T", " ")} UTC${appUrl ? ` · [Open Jobs Ireland](${appUrl})` : ""}`,
      `## Applications\n\n${byStatus.length ? byStatus.join("\n\n") : "None yet."}`,
      `## Job finds worth a look (score ${settings.agentMinScore}+)\n\n${
        finds.length ? finds.map((find) => `- ${find.score} · ${link(FINDS, findNames.get(find.id)!)}`).join("\n") : "None yet: turn on the job agent in Settings → Job agent."
      }`,
    ].join("\n\n"),
  };
  await mkdir(root, { recursive: true });
  const overviewFile = path.join(root, OVERVIEW);
  const existing = await readFile(overviewFile, "utf8").catch(() => null);
  await writeNote(overviewFile, mergeNote(existing, overview));

  return { applications: applications.length, finds: finds.length };
}

/** A sync that records how it went, for Settings → Your data. */
export async function syncVaultNow(now = new Date()): Promise<VaultResult | null> {
  const dir = vaultDir();
  if (!dir) return null;
  try {
    const result = await syncVault(dir, now);
    await saveSettings({ vaultSyncedAt: now.toISOString(), vaultProblem: null });
    return result;
  } catch (error) {
    logServerError("vault sync", error);
    await saveSettings({ vaultProblem: error instanceof Error ? error.message : "The notes couldn't be written." }).catch(() => {});
    throw error;
  }
}

const globalForVault = globalThis as unknown as { vaultTimer?: ReturnType<typeof setInterval> };

/** Syncs every quarter of an hour, once per process, while a vault is set. */
export function startVaultSchedule(): void {
  if (globalForVault.vaultTimer || !vaultDir()) return;
  const run = () => void syncVaultNow().catch(() => {});
  globalForVault.vaultTimer = setInterval(run, EVERY_MS);
  globalForVault.vaultTimer.unref?.();
  // A first sync shortly after start.
  setTimeout(run, 30_000).unref?.();
}
