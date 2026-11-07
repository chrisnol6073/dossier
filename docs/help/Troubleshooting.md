With Docker Compose, `docker compose logs app` shows the app's log (add `-f` to follow it). After changing `.env`, run `docker compose up -d` again. For the other ways of running Jobs Ireland, **Something's wrong** under Day to day in its [installation guide](Home) says where the log is.

- **"Jobs Ireland didn't start: applying the database migrations failed."** The error above that line says why. `P1001` means the database isn't reachable: check that the `db` container is running (`docker compose ps`). If a migration failed halfway, the database needs repairing before the next start: restore the dump you took before upgrading, or ask for help with the log.
- **"… is not set" or "JOBS_IRELAND_SECRET is too short":** set the variable the log names in `.env` (see [Environment variables](Environment-variables.md)).
- **"JOBS_IRELAND_PASSWORD must be a hash of your password":** it's set to the password itself, which Jobs Ireland 1.0 took. Make a hash with `docker run --rm -it dossier-europe:local hash-password` and set `JOBS_IRELAND_PASSWORD` to it.
- **PDFs fail or time out:** Chromium needs memory; give the app at least 768 MB (`compose.yml` gives it 1 GB). Fonts are bundled with Jobs Ireland, so documents look the same everywhere; a custom document language in a script Jobs Ireland has no font for may show empty boxes.
- **The AI times out:** local models on a CPU are slow. Try a smaller model, or raise `JOBS_IRELAND_AI_TIMEOUT_SECONDS`. **Test connection** in Settings shows whether Jobs Ireland reaches the server at all; inside Docker, `localhost` isn't the server (see [Choosing an AI provider](Choosing-an-AI-provider.md)).
- **An import fails with "413" or "Request Entity Too Large":** the reverse proxy's upload limit is below 10 MB. Caddy has none by default; with nginx, set `client_max_body_size 12m;`.
- **"That file is over 10 MB":** imports are capped at 10 MB, roughly 500 applications. Raising the cap means changing two settings in the code (see [Import size limit](https://github.com/chrisnol6073/dossier/blob/main/DEVELOPMENT.md#import-size-limit)).
- **"Too many attempts":** after five wrong passwords in a minute from one address or browser, sign-in pauses there for 30 seconds, then longer each time, up to 15 minutes. The count is kept in the database, so restarting doesn't reset it: wait it out.
- **"New browsers have to wait":** after 30 wrong passwords in ten minutes from anywhere, browsers that never signed in to Jobs Ireland wait up to 15 minutes. A browser you've signed in with before, even if you signed out since, isn't held up. Restarting Jobs Ireland ends the wait too (`docker compose restart app`, or your platform's restart button). If it keeps coming back, someone is guessing: use a long password, and put Jobs Ireland behind a reverse proxy.
- **Forgot the password:** make a hash of a new one with `docker run --rm -it dossier-europe:local hash-password` and set it as `JOBS_IRELAND_PASSWORD` in `.env`.
- **Is it up?** `/api/health` answers `{"status":"ok"}` when the app and its database are fine, and 503 when the database isn't reachable.


---

_Adapted from the [Dossier wiki](https://github.com/AienTech/dossier/wiki), the AGPL-3.0 project Jobs Ireland is based on._
