Find jobs is off until you pick a source in **Settings → Job search**. LinkedIn and Indeed don't let other apps read their job listings, so Jobs Ireland searches one of these instead:

| Source | What it covers | Key and cost |
|---|---|---|
| **JSearch** | Google for Jobs: postings from LinkedIn, Indeed, Glassdoor, Stepstone and company sites, in most countries, with their whole text. | A key from [OpenWeb Ninja's developer portal](https://app.openwebninja.com) or [RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch). OpenWeb Ninja's free plan needs no card and allows a few searches a month (its pages give 100 and 200); RapidAPI may ask for a card even for a free plan. Each page of results is one search. |
| **Adzuna** | Adzuna's own index in 19 countries. It only shares the start of each posting; Jobs Ireland fetches the rest from the posting's page. | A free app ID and key from [Adzuna's developer site](https://developer.adzuna.com/signup), with no card; your account shows its limits. The sign-up form asks for an organisation and a website: choose **Personal job search** and give a page of your own, such as your LinkedIn profile. |
| **FreeHire** | [FreeHire](https://freehire.me)'s open catalogue: mostly tech postings read straight from companies' own career pages (Greenhouse, Lever, Workday and many more), in most countries, with their whole text. It has no distance filter; see [below](#freehire). | None: no key and no account. Free for your own job search. |

Germany's Bundesagentur für Arbeit is there too, as an [unofficial source](#bundesagentur-für-arbeit-unofficial) you choose on your own responsibility.

The search starts from your profile's city, country and current role; change the place, radius (10 to 200 km, except on FreeHire), how recent and Remote only as you like. Every search is kept with what it found until you remove it, under **Past searches**, so going back to one, or reloading, doesn't spend another search.

You can also set the source and its keys with the `DOSSIER_JOBS_SOURCE`, `DOSSIER_JSEARCH_*` and `DOSSIER_ADZUNA_*` [environment variables](Environment-variables.md); a choice saved in Settings wins.

## FreeHire

[FreeHire](https://freehire.me) is an open-source catalogue that reads postings from companies' own career pages and leaves out reposts of the same job. Jobs Ireland uses its public search, which needs no key and gives each posting's whole text, so a posting is ready to score or start an application from at once.

- It has no distance filter. The place you enter puts postings there first, and the rest of the country follows, so **Within** is off while FreeHire is chosen.
- The job agent can search it.
- Its free use, without a key, is for your own job search: a Jobs Ireland you run for yourself. If you host Jobs Ireland for other people, FreeHire's [terms](https://freehire.me/terms) ask for one of its API plans.
- If you run your own FreeHire, set `DOSSIER_FREEHIRE_URL` to its address, such as `https://jobs.example.com`, and Jobs Ireland searches it instead of freehire.me.

## Bundesagentur für Arbeit (unofficial)

Germany's federal job board, with whole postings, free and without a key. It has no official API: Jobs Ireland searches it through the access the agency's own job search uses, without the agency's permission, and the agency's [terms of use](https://www.arbeitsagentur.de/datei/nutzungsbedingungen_ba036575.pdf) don't allow automated access. It can also change or stop working without notice.

So it's your own choice, made knowingly:

- When you pick it in **Settings → Job search**, Jobs Ireland shows that note, and saves the choice only once you tick **I understand, and choose this source myself**. If you chose it before Jobs Ireland 1.9.0, or with `DOSSIER_JOBS_SOURCE=arbeitsagentur`, it isn't searched until you tick the note, in Settings or on Find jobs. With the environment variable, the note is also written to the log when Jobs Ireland starts.
- The [job agent](#job-agent) never searches it, since it searches on its own. Choose JSearch, Adzuna or FreeHire for the agent.
- Each posting links to its ad on arbeitsagentur.de, next to the employer's own link when it has one.
- `DOSSIER_JOBS_ARBEITSAGENTUR=off` takes it out of Jobs Ireland altogether: Settings doesn't offer it, a saved choice counts as Off, and saved postings from it don't fetch their text any more.

## Job agent

The job agent is off until you turn it on in **Settings → Job agent**. Give it one search (the same fields as Find jobs), the hour it runs, and a minimum score. Once a day after that hour, in your time zone, it asks your job source for the first page of results, drops the postings you saved, dismissed or applied for and the ones it has seen before, and scores the newest of the rest against your profile with your AI provider. The ones at or above your minimum score wait on the **Agent** screen with why they fit and what gives pause.

From there, **Prepare draft** writes a tailored resume and cover letter the way New application does. With **Prepare drafts on its own** on (it's off by default), a run does that for its best postings. A draft waits on the Agent screen, out of Applications, until you **Approve** it; it's then an ordinary Draft application. **Dismiss** deletes the draft, if there is one, and the posting never comes back. Nothing is ever sent.

It searches JSearch, Adzuna or FreeHire, never the [Bundesagentur für Arbeit](#bundesagentur-für-arbeit-unofficial). It stays within the limits of a free plan: one source request a run, never a second page, at most three runs in any 24 hours (**Run now** goes at most once an hour), and at most 15 postings scored and 3 drafts a run by default (up to 30 and 10). On JSearch's free plan, that's at most about 90 of your 200 searches a month. It runs in the app's process, so run one instance of Jobs Ireland.


---

_Adapted from the [Dossier wiki](https://github.com/AienTech/dossier/wiki), the AGPL-3.0 project Jobs Ireland is based on._
