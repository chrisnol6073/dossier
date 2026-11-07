import path from "node:path";

import { describe, expect, it } from "vitest";

import { EnvError, parseEnv } from "./env";

// A hash of "correct horse" (scripts/hash-password.ts).
const PASSWORD_HASH = "argon2id:m=19456,t=2,p=1:CLZW5wQoCjh3Q9CHBp_JWw:Ak2xS7TYlYYrhemlgBkVxFmWXfcMq_rjd0mJGZcZFfA";

const valid = {
  JOBS_IRELAND_PASSWORD: PASSWORD_HASH,
  JOBS_IRELAND_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://postgres:postgres@db:5432/dossier",
};

function problems(source: Record<string, string | undefined>): string[] {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error.problems;
    throw error;
  }
  throw new Error("Expected parseEnv to throw");
}

describe("parseEnv", () => {
  it("accepts the required variables and fills in defaults", () => {
    expect(parseEnv(valid)).toEqual({
      ...valid,
      JOBS_IRELAND_DATA_DIR: "/data",
      JOBS_IRELAND_BACKUP_RETENTION_DAYS: 14,
      JOBS_IRELAND_TELEMETRY: undefined,
    });
  });

  it("reads whether the usage ping is on", () => {
    // Unset or empty: not decided, so Jobs Ireland asks (#172).
    expect(parseEnv({ ...valid, JOBS_IRELAND_TELEMETRY: "" }).JOBS_IRELAND_TELEMETRY).toBeUndefined();
    expect(parseEnv(valid).JOBS_IRELAND_TELEMETRY).toBeUndefined();
    expect(parseEnv({ ...valid, JOBS_IRELAND_TELEMETRY: "ON" }).JOBS_IRELAND_TELEMETRY).toBe("on");
    expect(parseEnv({ ...valid, JOBS_IRELAND_TELEMETRY: " Off " }).JOBS_IRELAND_TELEMETRY).toBe("off");
    expect(problems({ ...valid, JOBS_IRELAND_TELEMETRY: "false" })).toEqual(['JOBS_IRELAND_TELEMETRY must be on or off (got "false").']);
  });

  it("reads the optional variables", () => {
    const env = parseEnv({
      ...valid,
      JOBS_IRELAND_DATA_DIR: "/srv/dossier",
      JOBS_IRELAND_BACKUP_RETENTION_DAYS: "30",
      JOBS_IRELAND_AI_PROVIDER: "local",
      JOBS_IRELAND_AI_URL: "http://ollama:11434",
      JOBS_IRELAND_AI_MODEL: "llama3.1:8b",
      JOBS_IRELAND_AI_KEY: "sk-test",
    });
    expect(env).toMatchObject({
      JOBS_IRELAND_DATA_DIR: "/srv/dossier",
      JOBS_IRELAND_BACKUP_RETENTION_DAYS: 30,
      JOBS_IRELAND_AI_PROVIDER: "local",
      JOBS_IRELAND_AI_URL: "http://ollama:11434",
      JOBS_IRELAND_AI_MODEL: "llama3.1:8b",
      JOBS_IRELAND_AI_KEY: "sk-test",
    });
  });

  it("reads the AI timeout in seconds", () => {
    expect(parseEnv({ ...valid, JOBS_IRELAND_AI_TIMEOUT_SECONDS: " 300 " }).JOBS_IRELAND_AI_TIMEOUT_SECONDS).toBe(300);
    expect(() => parseEnv({ ...valid, JOBS_IRELAND_AI_TIMEOUT_SECONDS: "5m" })).toThrow(/whole number of seconds/);
    expect(() => parseEnv({ ...valid, JOBS_IRELAND_AI_TIMEOUT_SECONDS: "1" })).toThrow(/at least 5/);
  });

  it("resolves a relative data directory", () => {
    const env = parseEnv({ ...valid, JOBS_IRELAND_DATA_DIR: "./data" });
    expect(env.JOBS_IRELAND_DATA_DIR).toBe(path.resolve("data"));
  });

  it("treats empty values as unset", () => {
    const env = parseEnv({ ...valid, JOBS_IRELAND_AI_KEY: "", JOBS_IRELAND_DATA_DIR: " " });
    expect(env.JOBS_IRELAND_AI_KEY).toBeUndefined();
    expect(env.JOBS_IRELAND_DATA_DIR).toBe("/data");
    expect(problems({ ...valid, JOBS_IRELAND_PASSWORD: "" })).toEqual([
      expect.stringMatching(/^JOBS_IRELAND_PASSWORD is not set\./),
    ]);
  });

  it("names every missing required variable", () => {
    expect(problems({})).toEqual([
      expect.stringMatching(/^JOBS_IRELAND_PASSWORD is not set\. Set it to/),
      expect.stringMatching(/^JOBS_IRELAND_SECRET is not set\. .*openssl rand/),
      expect.stringMatching(/^DATABASE_URL is not set\. /),
    ]);
  });

  it("takes an SQLite file as the database, by its full path", () => {
    expect(parseEnv({ ...valid, DATABASE_URL: "file:/data/dossier.db" }).DATABASE_URL).toBe("file:/data/dossier.db");
    expect(problems({ ...valid, DATABASE_URL: "file:./dossier.db" })).toEqual([
      "DATABASE_URL must give the SQLite file's full path, e.g. file:/data/dossier.db.",
    ]);
  });

  it("wants a hash of the password, not the password itself", () => {
    expect(problems({ ...valid, JOBS_IRELAND_PASSWORD: "correct horse" })).toEqual([
      expect.stringMatching(/^JOBS_IRELAND_PASSWORD must be a hash of your password, not the password itself\. .*hash-password/),
    ]);
    expect(parseEnv({ ...valid, JOBS_IRELAND_PASSWORD: ` ${PASSWORD_HASH}\n` }).JOBS_IRELAND_PASSWORD).toBe(PASSWORD_HASH);
  });

  it("rejects a secret shorter than 32 characters", () => {
    expect(problems({ ...valid, JOBS_IRELAND_SECRET: "short" })).toEqual([
      expect.stringMatching(/^JOBS_IRELAND_SECRET is too short \(5 characters\)\./),
    ]);
  });

  it("never echoes secret values", () => {
    const messages = problems({
      JOBS_IRELAND_PASSWORD: "hunter2",
      JOBS_IRELAND_SECRET: "tiny-secret",
      DATABASE_URL: "mysql://root:db-password@db/dossier",
    }).join("\n");
    expect(messages).not.toContain("hunter2");
    expect(messages).not.toContain("tiny-secret");
    expect(messages).not.toContain("db-password");
    expect(messages).toMatch(/DATABASE_URL must be a PostgreSQL connection string/);
  });

  it("rejects invalid optional values", () => {
    expect(
      problems({
        ...valid,
        JOBS_IRELAND_BACKUP_RETENTION_DAYS: "two weeks",
        JOBS_IRELAND_AI_PROVIDER: "gemini",
        JOBS_IRELAND_AI_URL: "ftp://example.com",
      }),
    ).toEqual([
      'JOBS_IRELAND_BACKUP_RETENTION_DAYS must be a whole number of days (got "two weeks").',
      'JOBS_IRELAND_AI_PROVIDER must be one of local, openai, anthropic, mistral, lmstudio (got "gemini").',
      "JOBS_IRELAND_AI_URL must be an http:// or https:// URL.",
    ]);
    expect(problems({ ...valid, JOBS_IRELAND_BACKUP_RETENTION_DAYS: "0" })).toEqual([
      "JOBS_IRELAND_BACKUP_RETENTION_DAYS must be at least 1.",
    ]);
  });
});

describe("job search variables (E14-4)", () => {
  it("reads the source and its keys", () => {
    expect(
      parseEnv({
        ...valid,
        JOBS_IRELAND_JOBS_SOURCE: "jsearch",
        JOBS_IRELAND_JSEARCH_KEY: "ak_test",
        JOBS_IRELAND_JSEARCH_HOST: "rapidapi",
        JOBS_IRELAND_ADZUNA_APP_ID: "app",
        JOBS_IRELAND_ADZUNA_KEY: "adz",
        JOBS_IRELAND_FREEHIRE_URL: "https://jobs.example/",
      }),
    ).toMatchObject({
      JOBS_IRELAND_JOBS_SOURCE: "jsearch",
      JOBS_IRELAND_JSEARCH_KEY: "ak_test",
      JOBS_IRELAND_JSEARCH_HOST: "rapidapi",
      JOBS_IRELAND_ADZUNA_APP_ID: "app",
      JOBS_IRELAND_ADZUNA_KEY: "adz",
      JOBS_IRELAND_FREEHIRE_URL: "https://jobs.example",
    });
    expect(parseEnv({ ...valid, JOBS_IRELAND_JOBS_SOURCE: "freehire" }).JOBS_IRELAND_JOBS_SOURCE).toBe("freehire");
  });

  it("reads whether the Bundesagentur für Arbeit is offered, and refuses choosing it while it's off (#223)", () => {
    expect(parseEnv(valid).JOBS_IRELAND_JOBS_ARBEITSAGENTUR).toBeUndefined();
    expect(parseEnv({ ...valid, JOBS_IRELAND_JOBS_ARBEITSAGENTUR: " OFF " }).JOBS_IRELAND_JOBS_ARBEITSAGENTUR).toBe("off");
    expect(problems({ ...valid, JOBS_IRELAND_JOBS_ARBEITSAGENTUR: "no" })).toEqual(['JOBS_IRELAND_JOBS_ARBEITSAGENTUR must be on or off (got "no").']);
    expect(problems({ ...valid, JOBS_IRELAND_JOBS_SOURCE: "arbeitsagentur", JOBS_IRELAND_JOBS_ARBEITSAGENTUR: "off" })).toEqual([
      "JOBS_IRELAND_JOBS_SOURCE is arbeitsagentur, but JOBS_IRELAND_JOBS_ARBEITSAGENTUR is off. Choose another source, or remove one of the two.",
    ]);
  });

  it("rejects sources and hosts it doesn't know, without echoing keys", () => {
    expect(problems({ ...valid, JOBS_IRELAND_JOBS_SOURCE: "linkedin", JOBS_IRELAND_JSEARCH_HOST: "google", JOBS_IRELAND_JSEARCH_KEY: "ak_secret" })).toEqual([
      'JOBS_IRELAND_JOBS_SOURCE must be one of jsearch, adzuna, arbeitsagentur, freehire, jooble, company-boards, off (got "linkedin").',
      'JOBS_IRELAND_JSEARCH_HOST must be openwebninja or rapidapi (got "google").',
    ]);
  });
});
