import "server-only";

import path from "node:path";

import { z } from "zod";

import { isPasswordHash } from "@/lib/auth/password-hash";

const SECRET_MIN_LENGTH = 32;
const GENERATE_SECRET = "for example the output of `openssl rand -base64 32`";
const HASH_PASSWORD = "Make one with `docker run --rm -it dossier-europe:local hash-password`";

export const AI_PROVIDERS = ["local", "openai", "anthropic", "mistral", "lmstudio"] as const;
export const JOB_SOURCE_NAMES = ["jsearch", "adzuna", "arbeitsagentur", "freehire", "jooble", "company-boards", "off"] as const;
export const SCORER_NAMES = ["ai", "jev"] as const;

// An empty value (`JOBS_IRELAND_AI_KEY=` in .env) counts as unset.
const unsetIfEmpty = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const required = (name: string, fix: string) =>
  z.preprocess(
    unsetIfEmpty,
    z.string({ error: `${name} is not set. ${fix}` }),
  );

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(unsetIfEmpty, schema.optional());

const schema = z.object({
  // Never echo the value: it may be the password itself, set by mistake.
  JOBS_IRELAND_PASSWORD: required(
    "JOBS_IRELAND_PASSWORD",
    `Set it to a hash of the password you want to sign in with. ${HASH_PASSWORD}.`,
  ).pipe(
    z.string().trim().refine(isPasswordHash, {
      error: `JOBS_IRELAND_PASSWORD must be a hash of your password, not the password itself. ${HASH_PASSWORD} and set JOBS_IRELAND_PASSWORD to what it prints.`,
    }),
  ),
  JOBS_IRELAND_SECRET: required(
    "JOBS_IRELAND_SECRET",
    `Set it to a random string of at least ${SECRET_MIN_LENGTH} characters, ${GENERATE_SECRET}.`,
  ).pipe(
    z.string().min(SECRET_MIN_LENGTH, {
      error: (issue) =>
        `JOBS_IRELAND_SECRET is too short (${String(issue.input).length} characters). Use at least ${SECRET_MIN_LENGTH} random characters, ${GENERATE_SECRET}.`,
    }),
  ),
  DATABASE_URL: required(
    "DATABASE_URL",
    "Set it to your PostgreSQL connection string, e.g. postgresql://user:password@host:5432/dossier, or to an SQLite file, e.g. file:/data/dossier.db.",
  ).pipe(
    // Never echo the value: it contains the database password.
    z
      .string()
      .regex(/^(postgres(ql)?:\/\/|file:)/, {
        error:
          "DATABASE_URL must be a PostgreSQL connection string starting with postgresql://, or an SQLite file starting with file:.",
      })
      // A relative path would mean another file to the migrations, which run in another folder.
      .refine((url) => !url.startsWith("file:") || path.isAbsolute(url.slice("file:".length)), {
        error: "DATABASE_URL must give the SQLite file's full path, e.g. file:/data/dossier.db.",
      }),
  ),
  JOBS_IRELAND_DATA_DIR: z
    .preprocess(unsetIfEmpty, z.string().default("/data"))
    .transform((dir) => path.resolve(dir)),
  JOBS_IRELAND_BACKUP_RETENTION_DAYS: z
    .preprocess(unsetIfEmpty, z.string().trim().default("14"))
    .pipe(
      z.string().regex(/^\d+$/, {
        error: (issue) =>
          `JOBS_IRELAND_BACKUP_RETENTION_DAYS must be a whole number of days (got "${String(issue.input)}").`,
      }),
    )
    .transform(Number)
    .pipe(
      z.number().min(1, {
        error: "JOBS_IRELAND_BACKUP_RETENTION_DAYS must be at least 1.",
      }),
    ),
  // The daily usage ping (usage-ping.ts): unset, Jobs Ireland asks after
  // sign-in and sends nothing before a yes; on or off answers for good.
  JOBS_IRELAND_TELEMETRY: optional(
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(["on", "off"], { error: (issue) => `JOBS_IRELAND_TELEMETRY must be on or off (got "${String(issue.input)}").` })),
  ),
  JOBS_IRELAND_AI_PROVIDER: optional(
    z.enum(AI_PROVIDERS, {
      error: (issue) =>
        `JOBS_IRELAND_AI_PROVIDER must be one of ${AI_PROVIDERS.join(", ")} (got "${String(issue.input)}").`,
    }),
  ),
  JOBS_IRELAND_AI_URL: optional(
    z.url({
      protocol: /^https?$/,
      error: "JOBS_IRELAND_AI_URL must be an http:// or https:// URL.",
    }),
  ),
  JOBS_IRELAND_AI_MODEL: optional(z.string()),
  // Never echo the value: it's an API key.
  JOBS_IRELAND_AI_KEY: optional(z.string()),
  JOBS_IRELAND_AI_TIMEOUT_SECONDS: optional(
    z
      .string()
      .trim()
      .regex(/^\d+$/, {
        error: (issue) =>
          `JOBS_IRELAND_AI_TIMEOUT_SECONDS must be a whole number of seconds (got "${String(issue.input)}").`,
      })
      .transform(Number)
      .pipe(z.number().min(5, { error: "JOBS_IRELAND_AI_TIMEOUT_SECONDS must be at least 5." })),
  ),
  // Defaults for Settings → Job search (E14-4), until a choice is saved there.
  JOBS_IRELAND_JOBS_SOURCE: optional(
    z.enum(JOB_SOURCE_NAMES, {
      error: (issue) => `JOBS_IRELAND_JOBS_SOURCE must be one of ${JOB_SOURCE_NAMES.join(", ")} (got "${String(issue.input)}").`,
    }),
  ),
  // Never echo the values: they're API keys.
  JOBS_IRELAND_JSEARCH_KEY: optional(z.string()),
  JOBS_IRELAND_JSEARCH_HOST: optional(
    z.enum(["openwebninja", "rapidapi"], {
      error: (issue) => `JOBS_IRELAND_JSEARCH_HOST must be openwebninja or rapidapi (got "${String(issue.input)}").`,
    }),
  ),
  JOBS_IRELAND_ADZUNA_APP_ID: optional(z.string()),
  JOBS_IRELAND_ADZUNA_KEY: optional(z.string()),
  // FreeHire origin; unset uses https://freehire.me. Point at a self-hosted
  // FreeHire, or leave unset for the public catalogue.
  JOBS_IRELAND_FREEHIRE_URL: optional(
    z.url({ protocol: /^https?$/, error: "JOBS_IRELAND_FREEHIRE_URL must be an http:// or https:// URL." }).transform((url) => url.replace(/\/+$/, "")),
  ),
  // Jooble keys, one per country site: "ie=KEY,bg=KEY", or a single key for any country.
  // Never echo the value: they're API keys.
  JOBS_IRELAND_JOOBLE_KEY: optional(z.string()),
  // Company job boards to read, "greenhouse:intercom Intercom" one a line or
  // comma-separated; unset uses the built-in European list.
  JOBS_IRELAND_COMPANY_BOARDS: optional(z.string()),
  // Off takes the Bundesagentur für Arbeit out everywhere (#223): it isn't an
  // official API, so a server can choose not to offer it. Unset means on.
  JOBS_IRELAND_JOBS_ARBEITSAGENTUR: optional(
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(["on", "off"], { error: (issue) => `JOBS_IRELAND_JOBS_ARBEITSAGENTUR must be on or off (got "${String(issue.input)}").` })),
  ),
  // Defaults for Settings → Scoring (#274), until a choice is saved there:
  // ai scores postings with the AI provider, jev with TypeSafe's Jev.
  JOBS_IRELAND_SCORER: optional(
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(SCORER_NAMES, { error: (issue) => `JOBS_IRELAND_SCORER must be one of ${SCORER_NAMES.join(", ")} (got "${String(issue.input)}").` })),
  ),
  // Never echo the value: it's an API key.
  JOBS_IRELAND_TYPESAFE_KEY: optional(z.string().trim()),
  // Google sign-in for Gmail and Calendar (E15-1): an OAuth client of type
  // "Web application". Settings → Google can save one instead, which wins.
  // Never echo the secret.
  JOBS_IRELAND_GOOGLE_CLIENT_ID: optional(z.string().trim()),
  JOBS_IRELAND_GOOGLE_CLIENT_SECRET: optional(z.string().trim()),
  // The address Jobs Ireland is reached at, e.g. https://dossier.example.com, for
  // Google's redirect. Defaults to the address of the request that connects.
  JOBS_IRELAND_PUBLIC_URL: optional(
    z.url({ protocol: /^https?$/, error: "JOBS_IRELAND_PUBLIC_URL must be an http:// or https:// URL." }).transform((url) => url.replace(/\/+$/, "")),
  ),
  // For the end-to-end tests only: sends every job source's requests to
  // <url>/<source> instead, where a fake source answers (e2e/fake-jobs.mts).
  JOBS_IRELAND_JOBS_TEST_BASE_URL: optional(
    z.url({ protocol: /^https?$/, error: "JOBS_IRELAND_JOBS_TEST_BASE_URL must be an http:// or https:// URL." }),
  ),
  // For the end-to-end tests only: sends Google's sign-in, Gmail and Calendar
  // requests to <url>/<host> instead, where a fake Google answers
  // (e2e/fake-google.mts).
  JOBS_IRELAND_GOOGLE_TEST_BASE_URL: optional(
    z.url({ protocol: /^https?$/, error: "JOBS_IRELAND_GOOGLE_TEST_BASE_URL must be an http:// or https:// URL." }),
  ),
  // For the end-to-end tests only: sends the usage ping to <url> instead of
  // the project's receiver (e2e/fake-jobs.mts answers).
  JOBS_IRELAND_USAGE_PING_TEST_URL: optional(
    z.url({ protocol: /^https?$/, error: "JOBS_IRELAND_USAGE_PING_TEST_URL must be an http:// or https:// URL." }),
  ),
  // For the end-to-end tests only: asks <url> for the latest release instead
  // of GitHub's API (e2e/fake-jobs.mts answers).
  JOBS_IRELAND_UPDATES_TEST_BASE_URL: optional(
    z.url({ protocol: /^https?$/, error: "JOBS_IRELAND_UPDATES_TEST_BASE_URL must be an http:// or https:// URL." }),
  ),
  // For the end-to-end tests only: sends Jev's requests to <url> instead of
  // TypeSafe's API (e2e/fake-jobs.mts answers).
  JOBS_IRELAND_TYPESAFE_TEST_BASE_URL: optional(
    z.url({ protocol: /^https?$/, error: "JOBS_IRELAND_TYPESAFE_TEST_BASE_URL must be an http:// or https:// URL." }),
  ),
}).check((context) => {
  if (context.value.JOBS_IRELAND_JOBS_SOURCE === "arbeitsagentur" && context.value.JOBS_IRELAND_JOBS_ARBEITSAGENTUR === "off") {
    context.issues.push({
      code: "custom",
      input: context.value,
      message: "JOBS_IRELAND_JOBS_SOURCE is arbeitsagentur, but JOBS_IRELAND_JOBS_ARBEITSAGENTUR is off. Choose another source, or remove one of the two.",
    });
  }
});

export type Env = z.infer<typeof schema>;

/** Thrown when the environment is invalid; `problems` has one message per variable. */
export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment:\n${problems.join("\n")}`);
    this.name = "EnvError";
  }
}

/** Validates the environment. Messages name the variable and how to fix it, never its value. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((issue) => issue.message));
  }
  return result.data;
}

let cached: Env | undefined;

function load(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/**
 * The validated environment. It's parsed on first use rather than on import,
 * so `next build` works without the secrets; `checkEnvOnStartup()` makes sure
 * a running server has them.
 */
export const env: Readonly<Env> = new Proxy({} as Env, {
  get: (_, key) => load()[key as keyof Env],
});

/** Called once from `register()` in instrumentation.ts: stops the server if the environment is invalid. */
export function checkEnvOnStartup(): void {
  try {
    load();
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    for (const problem of error.problems) {
      console.error(`Jobs Ireland can't start: ${problem}`);
    }
    process.exit(1);
  }
}
