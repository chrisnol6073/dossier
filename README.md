<p align="center">
  <img src="src/app/icon.svg" alt="" width="80" height="80">
</p>

<h1 align="center">Jobs Ireland</h1>

<p align="center">
  A personal job search app for QA roles in Ireland, the UK and Europe: one profile, a tailored CV and cover letter for every job, and every application tracked from draft to offer.
</p>

Jobs Ireland keeps your career history in one profile and turns it into a clean CV. It finds postings straight from company job boards (Greenhouse, Lever, Ashby) and from Jooble, scores them against your profile, and drafts a tailored CV and cover letter that only use facts from your profile. You refine them in a chat, download them as PDFs, and track each application from draft to offer.

It runs on your own computer or server: one password, your data in your own database, and an AI model of your choice (Anthropic, any OpenAI-compatible API, or a local model through LM Studio or Ollama).

## Features

- **Find jobs in Europe:** company job boards for about 100 employers hiring in Ireland, the UK and Europe, plus Jooble for Ireland, Bulgaria, Sweden and more, and JSearch, Adzuna and FreeHire if you want them.
- **Daily job agent:** runs several searches a day across countries, leaves out titles you don't want (for example Java or C#), scores what's new against your profile, and keeps the best for you. It never applies or sends anything.
- **Tailored applications:** paste or pick a posting; it matches the requirements against your profile and writes a CV and cover letter in the tone you choose. Gaps are shown, never invented.
- **Track everything:** a board and a table of every application, a dashboard, and Gmail and Calendar if you connect them.
- **Your data:** export and import everything, nightly backups, and Delete everything.

## Run it

See [docs/EUROPE.md](docs/EUROPE.md) for the step-by-step setup with Docker Desktop on Windows. The [help pages](docs/help) cover AI providers, job sources, Gmail and Calendar, connecting Claude, backups, upgrading and troubleshooting.

## Contact

Christopher Nolan, chrisnol6073@gmail.com.

## Licence and credit

Jobs Ireland is free software under the [GNU AGPL-3.0](LICENSE). It is based on [Dossier](https://github.com/AienTech/dossier), also under the AGPL-3.0. What it keeps and what leaves your server is described in [PRIVACY.md](PRIVACY.md); security notes are in [SECURITY.md](SECURITY.md).
