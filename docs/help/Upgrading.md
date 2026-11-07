# Upgrading

Jobs Ireland is built on your own computer from the code in this repository, so upgrading means getting the new code and building it again. Your data stays in Docker's volumes throughout.

1. Back up first, in **Settings → Your data → Export** (see [Backups and restore](Backups-and-restore.md)).
2. In PowerShell, in the `dossier` folder, get the new code:
   ```powershell
   git pull
   ```
3. Rebuild and restart:
   ```powershell
   docker compose up -d --build
   ```
   The database is updated on its own when the app starts.

If it doesn't start, run `docker compose logs app --tail 50` and see [Troubleshooting](Troubleshooting.md).

---

_Adapted from the [Dossier wiki](https://github.com/AienTech/dossier/wiki), the AGPL-3.0 project Jobs Ireland is based on._
