# Jobs Ireland for a European QA job search

This fork adds two job sources and a multi-search job agent, aimed at QA roles in Ireland, the UK, Bulgaria and the rest of Europe.

## What's new

- **Company job boards** (Settings → Job search). Reads the public Greenhouse, Lever and Ashby boards of about 100 companies hiring in Europe, straight from the employer: no reposts and no key. A search keeps postings whose title has your keywords (commas separate alternatives: `QA Engineer, SDET, Test Automation`), in your country or remote across Europe/EMEA. QA and Quality, and Test and Tester, count as the same word. You can replace the list with your own, one `greenhouse:slug Name` / `lever:slug Name` / `ashby:slug Name` per line. The slug is in the careers address, for example `boards.greenhouse.io/intercom` or `jobs.ashbyhq.com/wayflyer`.
- **Jooble** (Settings → Job search). Covers Ireland, Bulgaria, Sweden and Belgium, which Adzuna doesn't. Each Jooble key only searches the country it was made for, and allows **500 searches in total** (a lifetime limit, not a monthly one). Ask for a key on each country's API page, for example `ie.jooble.org/api/about` and `bg.jooble.org/api/about`. Then enter them together: `ie=KEY1, bg=KEY2`.
- **Job agent → More searches.** Each run now makes up to 12 more searches, each through its own source, on top of the main one. **Add the European QA set** fills in QA searches on company boards for Ireland, the UK, Bulgaria, Sweden, Belgium and the Netherlands, Jooble searches for Ireland and Sofia, and **Leave out titles with** `Java, C#, .NET`. These are matched as whole words, so `JavaScript` stays in.

## Running it on Windows with Docker Desktop

In PowerShell, from this folder (`source\repos\dossier`):

1. **Build and hash your password.** This builds the image the first time, which takes a few minutes:
   ```powershell
   docker compose build app
   docker run --rm -it dossier-europe:local hash-password
   ```
   Type your password twice. Copy the line it prints (it starts with `argon2id:`) into `.env`, replacing `paste-the-argon2id-hash-here` in `JOBS_IRELAND_PASSWORD=`.
2. **Start it:**
   ```powershell
   docker compose up -d
   ```
   Open http://localhost:3000 and sign in.
3. **Set it up in Settings:**
   - **AI provider:** Anthropic with your API key, or LM Studio / Ollama on this PC at `http://host.docker.internal:1234` or `:11434`.
   - **Job search:** Company job boards (already the default in `.env`).
   - **Job agent:** set the main search (for example `QA Engineer, SDET, Test Automation` in Ireland), click **Add the European QA set**, then turn the agent on.
   - **Profile:** import your master CV (Christopher_Nolan_CV.docx) so scoring and drafts have your experience.

After you pull new changes, run `docker compose up -d --build`. `docker compose stop` stops it, and your data stays in Docker volumes.

## Obsidian vault

Set `JOBS_IRELAND_VAULT_PATH` in `.env` to your vault folder, for example:

```
JOBS_IRELAND_VAULT_PATH=C:/Users/user1/Documents/Obsidian Vault
```

then run `docker compose up -d`. Every 15 minutes, and after each job agent run, Jobs Ireland writes into a **Jobs Ireland** folder in the vault:

- `Applications/` – one note per application: status, dates, how you match, your notes and the posting.
- `Job finds/` – one note per job the agent scored at or above your minimum score.
- `Jobs Ireland.md` – an overview with links to all of them.

Jobs Ireland only rewrites the part of each note above its `jobs-ireland:end` line; write your own notes below it and they're kept. **Settings → Your data → Obsidian vault** shows when the notes were last written and has a **Write notes now** button.

## Claude and the ai-job-search workspace

Claude Code can use Jobs Ireland through its MCP connector (Settings → MCP connector): `claude mcp add --transport http jobs-ireland http://localhost:3001/api/mcp`, then `/mcp` to sign in. The ai-job-search workspace already has this in its `.mcp.json`; see its `docs/JOBS-IRELAND.md`.
