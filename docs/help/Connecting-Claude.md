This is optional. With the MCP connector on, you can use Jobs Ireland from Claude: in chats on claude.ai, in the Desktop and mobile apps, and in Claude's command-line app, on your own Claude plan. Other apps that speak MCP, such as n8n, can use it too (see [Other apps](#other-apps)). Ask things like "find product designer jobs in Berlin", "which of these fit me best?", "write an application for number 3" or "what's the status of my applications?".

Claude can:

- search for jobs with the source in Settings → Job search, and show more of a search;
- score postings against your profile, with reasons and red flags, and save the scores for Find jobs;
- read your profile (without contact details, links or references), postings, and your applications with their resume and cover letter;
- save a resume and cover letter it wrote as a **Draft** application, checked like Jobs Ireland's own: only your profile's roles, projects, degrees and skills, your certifications and publications word for word, and with **Never invent experience** on, names and numbers your profile and the posting don't back marked "check this";
- have Jobs Ireland's own AI model draft an application, when one is set up;
- change an application's status, e.g. to Sent once you've applied.

It never sends an application or an email, and never deletes or archives anything. Drafts wait in Jobs Ireland for you to review, edit and download as PDFs.

## Turn it on

1. In **Settings → MCP connector**, turn on **Let apps connect**. The section shows the address to add, ending in `/api/mcp`.
2. In Claude, open **Settings → Connectors** and choose **Add custom connector**. Name it **Jobs Ireland**, paste the address, press **Add**, then **Connect**.
3. Claude opens Jobs Ireland's sign-in. Sign in if it asks, check what Claude may do, and press **Allow**. Allow it only when you've just added the connector yourself.

In Claude's command-line app, run `claude mcp add --transport http dossier https://<your Jobs Ireland address>/api/mcp`, then `/mcp` to sign in.

Claude on the web, Desktop and mobile reach Jobs Ireland from Anthropic's servers, so Jobs Ireland needs a public HTTPS address, as in the [server guides](Home#self-host-on-a-server). Claude's command-line app on the computer Jobs Ireland runs on can use `http://localhost:3000/api/mcp`. If your reverse proxy doesn't pass on the host and protocol, set `DOSSIER_PUBLIC_URL` (see [Environment variables](Environment-variables.md)).

## Other apps

An app other than Claude needs its callback address added first: after you press **Allow**, Jobs Ireland only sends you back to an address it knows. Claude's are known already.

1. Turn on the connector as above, and give the app the address ending in `/api/mcp`.
2. Copy the callback address the app shows you. n8n shows it as **OAuth Redirect URL** in its MCP credential.
3. In **Settings → MCP connector → Other apps**, paste it under **Callback address** and press **Add**. It has to match exactly, and be `https://`, or `http://` on this computer or a private network.
4. Connect from the app, sign in to Jobs Ireland if it asks, check the app's name, and press **Allow**.

The app gets the same tools as Claude, and whoever uses it can read and change your Jobs Ireland through it. Add only apps you run or trust. The addresses belong to this server: exports leave them out, and an import keeps this server's.

## Without an AI model of Jobs Ireland's own

With the connector on and no AI model chosen in Settings → AI provider, Jobs Ireland hands the work to Claude instead:

- **New application** shows **Write it with Claude →**. It keeps the posting you pasted for 14 days and opens a new chat on claude.ai that asks Claude to read it and your profile, write the resume and cover letter, and save them. The application then shows up under Applications as a Draft.
- **Score** in Find jobs opens a chat that scores the posting and saves the score. Reload Find jobs to see it.

## Signing apps out

**Disconnect all apps** in Settings → MCP connector signs Claude and every other app out; they have to connect again. Turning the connector off does too, and closes its addresses, which then answer as if they didn't exist. A new `DOSSIER_PASSWORD` or `DOSSIER_SECRET` signs them out as it does every browser. To stop one app from connecting again, remove its callback address. Jobs Ireland keeps no tokens: they're signed with `DOSSIER_SECRET`.

## Privacy

What Claude reads through the connector goes to Anthropic under your Claude account and its terms, as anything you put in a chat does. What another app reads goes to whoever runs it. Your private notes and a letter's sender and signature stay out. [PRIVACY.md](https://github.com/chrisnol6073/dossier/blob/main/PRIVACY.md#mcp-connector) has the details.


---

_Adapted from the [Dossier wiki](https://github.com/AienTech/dossier/wiki), the AGPL-3.0 project Jobs Ireland is based on._
