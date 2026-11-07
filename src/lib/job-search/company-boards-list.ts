// The company job boards the "Company job boards" source reads: public
// Greenhouse, Lever and Ashby boards of companies that hire in Ireland, the
// UK and the rest of Europe. Each was checked to answer, with postings in
// Europe, in November 2026. Settings → Job search can replace the list.

export const COMPANY_ATS = ["greenhouse", "lever", "ashby"] as const;
export type CompanyAts = (typeof COMPANY_ATS)[number];

export type CompanyBoard = { ats: CompanyAts; slug: string; name: string };

/** At most this many boards are read for a search. */
export const MAX_COMPANY_BOARDS = 150;

/** "greenhouse:intercom Intercom", one a line; the name is optional. */
export const DEFAULT_COMPANY_BOARDS_TEXT = `
greenhouse:intercom Intercom
greenhouse:stripe Stripe
greenhouse:gitlab GitLab
greenhouse:datadog Datadog
greenhouse:elastic Elastic
greenhouse:mongodb MongoDB
greenhouse:twilio Twilio
greenhouse:toast Toast
greenhouse:squarespace Squarespace
greenhouse:dropbox Dropbox
greenhouse:coinbase Coinbase
greenhouse:airbnb Airbnb
greenhouse:okta Okta
greenhouse:qualtrics Qualtrics
greenhouse:newrelic New Relic
greenhouse:pagerduty PagerDuty
greenhouse:samsara Samsara
greenhouse:smartsheet Smartsheet
greenhouse:salesloft Salesloft
greenhouse:tripadvisor Tripadvisor
greenhouse:flipdish Flipdish
greenhouse:tines Tines
greenhouse:learnupon LearnUpon
greenhouse:poppulo Poppulo
greenhouse:verifone Verifone
greenhouse:n26 N26
greenhouse:monzo Monzo
greenhouse:gocardless GoCardless
greenhouse:deliveroo Deliveroo
greenhouse:tide Tide
greenhouse:ebury Ebury
greenhouse:sumup SumUp
greenhouse:adyen Adyen
greenhouse:bitpanda Bitpanda
greenhouse:raisin Raisin
greenhouse:moonfare Moonfare
greenhouse:wolt Wolt
greenhouse:hellofresh HelloFresh
greenhouse:getyourguide GetYourGuide
greenhouse:celonis Celonis
greenhouse:contentful Contentful
greenhouse:commercetools commercetools
greenhouse:grafanalabs Grafana Labs
greenhouse:canonical Canonical
greenhouse:veriff Veriff
greenhouse:realtimeboardglobal Miro
greenhouse:proton Proton
greenhouse:typeform Typeform
greenhouse:algolia Algolia
greenhouse:mirakl Mirakl
greenhouse:dataiku Dataiku
greenhouse:truecaller Truecaller
greenhouse:mentimeter Mentimeter
greenhouse:cognite Cognite
greenhouse:trustpilot Trustpilot
greenhouse:relex RELEX Solutions
greenhouse:betsson Betsson Group
lever:spotify Spotify
lever:zopa Zopa
lever:contentsquare Contentsquare
lever:kitmanlabs Kitman Labs
ashby:wayflyer Wayflyer
ashby:evervault Evervault
ashby:nory Nory
ashby:synthesia Synthesia
ashby:elevenlabs ElevenLabs
ashby:cohere Cohere
ashby:lovable Lovable
ashby:supabase Supabase
ashby:posthog PostHog
ashby:linear Linear
ashby:n8n n8n
ashby:perplexity Perplexity
ashby:ramp Ramp
ashby:pleo Pleo
ashby:paddle Paddle
ashby:oyster Oyster
ashby:kestra Kestra
ashby:truelayer TrueLayer
ashby:improbable Improbable
ashby:oaknorth OakNorth
ashby:marshmallow Marshmallow
ashby:farfetch Farfetch
ashby:zilch Zilch
ashby:moneybox Moneybox
ashby:lendable Lendable
ashby:docplanner Docplanner
ashby:doctolib Doctolib
ashby:alan Alan
ashby:backmarket Back Market
ashby:ledger Ledger
ashby:trustly Trustly
ashby:legora Legora
ashby:sanity Sanity
ashby:lunar Lunar
ashby:supercell Supercell
ashby:rohlik Rohlik Group
`.trim();

/**
 * The boards in a list as people write it: "ats:slug Name" on each line (or
 * separated by commas), with lines that aren't a board left out, and each
 * board once. Lines starting with # are comments.
 */
export function parseCompanyBoards(text: string): CompanyBoard[] {
  const boards: CompanyBoard[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\n,]/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(greenhouse|lever|ashby)\s*:\s*([A-Za-z0-9][A-Za-z0-9._-]{0,99})(?:\s+(.+))?$/i.exec(line);
    if (!match) continue;
    const ats = match[1].toLowerCase() as CompanyAts;
    const slug = match[2];
    const key = `${ats}:${slug.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    boards.push({ ats, slug, name: (match[3] ?? "").trim().slice(0, 100) || slug });
    if (boards.length >= MAX_COMPANY_BOARDS) break;
  }
  return boards;
}

export const DEFAULT_COMPANY_BOARDS = parseCompanyBoards(DEFAULT_COMPANY_BOARDS_TEXT);
