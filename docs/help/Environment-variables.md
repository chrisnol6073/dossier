Jobs Ireland is configured with environment variables; everything else is set in the app. With Docker Compose, put them in `.env` next to `compose.yml`, then run `docker compose up -d` to apply them (a plain restart keeps the old values). For the other ways of running Jobs Ireland, its [installation guide](Home) says where they go. The server doesn't start while a required variable is missing or invalid, and its log says which one and how to fix it.

## Required

| Variable | What it's for |
|---|---|
| `POSTGRES_PASSWORD` | The database's password. `compose.yml` builds the app's `DATABASE_URL` from it. |
| `JOBS_IRELAND_PASSWORD` | A hash of the password you sign in with, made with `hash-password` (`docker run --rm -it dossier-europe:local hash-password`); the password itself isn't accepted. It's only read from here, never stored. Changing it signs every session out. |
| `JOBS_IRELAND_SECRET` | At least 32 random characters. Signs sessions and encrypts saved API keys; changing it signs everyone out, and API keys have to be entered again. |

## Optional

| Variable | Default | What it's for |
|---|---|---|
| `TZ` | `UTC` | The server's time zone, e.g. `Europe/Berlin`. Nightly backups run at 03:00 in it, and dates the server writes (a letter's date, "today") follow it. |
| `JOBS_IRELAND_BACKUP_RETENTION_DAYS` | `14` | How many days of nightly backups to keep. |
| `JOBS_IRELAND_TELEMETRY` | (unset) | Whether to send the usage ping, a random install ID and the version number once on each day Jobs Ireland is used (see [Privacy](Privacy.md)). Unset, Jobs Ireland asks after you sign in and sends nothing until you agree. `on` or `off` answers in advance and hides the question; while it's set, it decides. |
| `JOBS_IRELAND_AI_PROVIDER` | none | `local` (Ollama or llama.cpp), `lmstudio`, `openai` (any OpenAI-compatible API), `anthropic` or `mistral`. A default for Settings → AI provider; a choice saved there wins. |
| `JOBS_IRELAND_AI_URL` | per provider | The AI server's address, e.g. `http://ollama:11434`. |
| `JOBS_IRELAND_AI_MODEL` | per provider | The model to use, e.g. `qwen2.5:7b` or `claude-sonnet-5`. |
| `JOBS_IRELAND_AI_KEY` | none | The API key for a hosted provider. |
| `JOBS_IRELAND_AI_TIMEOUT_SECONDS` | `300` local, `120` hosted | How long one AI request may take. |
| `JOBS_IRELAND_JOBS_SOURCE` | off | `jsearch`, `adzuna`, `freehire`, `arbeitsagentur` or `off`. A default for Settings → Job search; a choice saved there wins. |
| `JOBS_IRELAND_JSEARCH_KEY` | none | A JSearch key, from OpenWeb Ninja or RapidAPI. |
| `JOBS_IRELAND_JSEARCH_HOST` | `openwebninja` | Where that key is from: `openwebninja` or `rapidapi`. |
| `JOBS_IRELAND_ADZUNA_APP_ID`, `JOBS_IRELAND_ADZUNA_KEY` | none | Adzuna's app ID and key. |
| `JOBS_IRELAND_FREEHIRE_URL` | `https://freehire.me` | The address of a self-hosted [FreeHire](Choosing-a-job-source.md#freehire) to search instead of freehire.me. |
| `JOBS_IRELAND_JOBS_ARBEITSAGENTUR` | on | `off` takes the unofficial [Bundesagentur für Arbeit](Choosing-a-job-source.md#bundesagentur-für-arbeit-unofficial) source out of Jobs Ireland altogether. It can't be `off` while `JOBS_IRELAND_JOBS_SOURCE` is `arbeitsagentur`. |
| `JOBS_IRELAND_SCORER` | `ai` | `ai` (your AI provider) or `jev` ([Jev by TypeSafe](Choosing-an-AI-provider.md#scoring-with-jev)): what Score in Find jobs and the job agent use. A default for Settings → Scoring; a choice saved there wins. |
| `JOBS_IRELAND_TYPESAFE_KEY` | none | A TypeSafe key for Jev, from [TypeSafe's console](https://console.typesafe.ai/keys). A key saved in Settings → Scoring wins. |
| `JOBS_IRELAND_GOOGLE_CLIENT_ID`, `JOBS_IRELAND_GOOGLE_CLIENT_SECRET` | none | A Google OAuth client, for Gmail and Calendar (see [Connecting Gmail and Calendar](Connecting-Gmail-and-Calendar.md)). A client saved in Settings → Google wins. |
| `JOBS_IRELAND_PUBLIC_URL` | the address in use | The address Jobs Ireland is reached at, e.g. `https://dossier.example.com`, for Google's redirect after you sign in and the [MCP connector](Connecting-Claude.md)'s addresses. Only needed when your proxy doesn't pass on the host and protocol. |
| `JOBS_IRELAND_IMAGE` | `dossier-europe:local:latest` | The image to run. Set a version, e.g. `dossier-europe:local:v1.4.1`, to upgrade only when you choose. |
| `JOBS_IRELAND_PORT` | `3000` | The port on the server (`127.0.0.1`) that Jobs Ireland listens on, for the reverse proxy. |
| `COMPOSE_PROFILES` | none | `ai` runs Ollama as well (see [Local model with Ollama](Choosing-an-AI-provider.md#local-model-with-ollama)). |

## Without the Compose file

Set `DATABASE_URL` (`postgresql://user:password@host:5432/database`) instead of `POSTGRES_PASSWORD`. `JOBS_IRELAND_IMAGE`, `JOBS_IRELAND_PORT` and `COMPOSE_PROFILES` are read by the Compose file, so they don't apply.

Running the image, mount a volume at `/data`, where nightly backups and zipped PDFs go. Without Docker, set `JOBS_IRELAND_DATA_DIR` to a folder for them, as a whole path, such as `/home/you/dossier-data`.


---

_Adapted from the [Dossier wiki](https://github.com/AienTech/dossier/wiki), the AGPL-3.0 project Jobs Ireland is based on._
