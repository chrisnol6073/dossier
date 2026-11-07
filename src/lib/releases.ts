// Where Jobs Ireland's releases are published, for the update check and its
// notice (update-check.ts, the sidebar). Safe to use in the browser.

export const RELEASES_REPOSITORY = "chrisnol6073/dossier";
/** The repository's page, for credits and support (the sidebar). */
export const REPOSITORY_URL = `https://github.com/${RELEASES_REPOSITORY}`;
/** How to update: docs/help/Upgrading.md. */
export const UPGRADE_GUIDE_URL = `${REPOSITORY_URL}/blob/main/docs/help/Upgrading.md`;

/** A published release: its version, without the "v", and its page on GitHub. */
export type Release = { version: string; url: string };

/** Who to write to about this install. */
export const CONTACT_EMAIL = "chrisnol6073@gmail.com";

/** The open-source project Jobs Ireland is based on (AGPL-3.0), credited in Settings → About. */
export const UPSTREAM_URL = "https://github.com/AienTech/dossier";

/** A help page in docs/help, on GitHub: helpPage("Connecting-Claude"). */
export const helpPage = (name: string) => `${REPOSITORY_URL}/blob/main/docs/help/${name}.md`;
