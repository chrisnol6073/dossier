The commands on this page are for Docker Compose: run them from your Jobs Ireland folder (`~/dossier`). For the other ways of running Jobs Ireland, the **Back up** step under Day to day in its [installation guide](Home) has them.

- **Export:** **Settings → Your data → Export** downloads everything (profile, themes, settings, applications with their documents, chat, notes and history) as one JSON file. Your API key is left out unless you tick the box.
- **Import:** importing such a file replaces all data in one step, after saving a backup of what was there to the data directory's `backups` folder.
- **Nightly backups** (on by default) write the same export to `/data/backups` in the app's volume at 03:00 server time, keeping `DOSSIER_BACKUP_RETENTION_DAYS` days of them. Copy them off the server now and then: `docker compose cp app:/data/backups ./backups`.
- **Database dumps:** back up PostgreSQL itself too:

  ```bash
  docker compose exec -T db pg_dump -U dossier -Fc dossier > dossier.dump
  ```

  To restore a dump, stop Jobs Ireland, load the dump, and start Jobs Ireland again:

  ```bash
  docker compose stop app
  docker compose exec -T db pg_restore --clean --if-exists -U dossier -d dossier < dossier.dump
  docker compose start app
  ```

Keep a copy of `.env` with your backups: saved API keys can't be read without its `DOSSIER_SECRET` (an export with the key included carries it in plain text instead).


---

_Adapted from the [Dossier wiki](https://github.com/AienTech/dossier/wiki), the AGPL-3.0 project Jobs Ireland is based on._
