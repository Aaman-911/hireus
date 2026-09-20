const express = require('express');
const { findLeads } = require('../lib/leads');
const { resolveBrand } = require('../lib/directories');
const { analysisModel, generateJson, hasGemini } = require('../lib/gemini');

const router = express.Router();

const cache = new Map();
const TTL = 15 * 60 * 1000;
const cacheGet = (k) => {
    const e = cache.get(k);
    if (!e) return null;
    if (Date.now() - e.at > TTL) { cache.delete(k); return null; }
    return e.value;
};
const cacheSet = (k, v) => {
    cache.set(k, { at: Date.now(), value: v });
    if (cache.size > 40) cache.delete(cache.keys().next().value);
};

/**
 * Turns "I make AI ads" + "product companies" into the search terms that
 * actually appear in a launch post, plus a short profile of who to target.
 */
async function buildBrief({ service, targetClient, region }) {
    const STOPWORDS = new Set(['and', 'the', 'for', 'with', 'that', 'just', 'are', 'who', 'want']);
    const terms = `${service} ${targetClient}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t));

    // Without the model, guess the world from obvious keywords rather than
    // defaulting to Hacker News and returning nothing for a soap company.
    const has = (...w) => w.some((x) => terms.includes(x));
    const audiences = [];
    if (has('perfume', 'perfumes', 'soap', 'soaps', 'cosmetic', 'cosmetics', 'skincare', 'beauty', 'fragrance')) {
        audiences.push('beauty', 'local');
    }
    if (has('food', 'snack', 'snacks', 'beverage', 'drink', 'restaurant', 'cafe', 'bakery')) {
        audiences.push('food', 'local');
    }
    if (has('saas', 'startup', 'startups', 'app', 'apps', 'software', 'developer', 'api', 'tech')) {
        audiences.push('tech');
    }
    if (audiences.length === 0) audiences.push('tech', 'local');

    const fallback = {
        audiences: [...new Set(audiences)],
        // A wide default: the point of the search is reach, so without the
        // model it still sweeps every common category and several markets.
        productCategories: audiences.includes('beauty')
            ? ['soaps', 'perfumes', 'shampoos', 'deodorants', 'skin-care', 'hair-care', 'body-care']
            : audiences.includes('food')
              ? ['snacks', 'beverages', 'chocolates', 'biscuits', 'dairies']
              : [],
        osmTags: [],
        countryCodes: ['in', 'us', 'gb', 'de'],
        searchTerms: terms.slice(0, 6),
        icp: targetClient,
        valueLine: `Helps with ${service}`,
    };
    if (!hasGemini()) return fallback;

    try {
        return await generateJson(
            analysisModel,
            `A freelancer wants to find clients. Work out who to look for and what words their posts would contain.

FREELANCER OFFERS: ${service}
WANTS TO REACH: ${targetClient}
REGION PREFERENCE: ${region || 'Anywhere'}

Several different databases are available, and picking the wrong one returns nothing:
- "tech" — Hacker News launches, hiring posts and freelance requests. Software, SaaS, apps, developer tools, startups. Useless for anything physical.
- "beauty" — an open database of cosmetics, soap, skincare, haircare and fragrance BRANDS.
- "food" — an open database of food and drink BRANDS.
- "local" — physical businesses on OpenStreetMap that published a contact address: shops, salons, studios, workshops, agencies.

Choose every database that fits. A perfume or soap company is "beauty" and often "local", never "tech". A SaaS startup is "tech". A restaurant chain is "food" and "local".

Return ONLY valid JSON:
{
  "audiences": [<one or more of "tech","beauty","food","local">],
  "productCategories": [<for beauty/food only: 4-8 category terms in the open product database, lowercase, hyphenated, e.g. "soaps","perfumes","shampoos","deodorants","skin-care","hair-care","body-care","make-up" or "snacks","beverages","chocolates","biscuits". Use MANY so the search is wide. Empty array if not applicable>],
  "osmTags": [<for local only: 3-8 OpenStreetMap shop/craft values for this kind of business, e.g. "perfumery","cosmetics","beauty","hairdresser","chemist". Lowercase, underscores not spaces. Empty array if not applicable>],
  "countryCodes": [<markets to search, from: in, us, gb, de, ca, au, ae, sg. Include SEVERAL unless the user named one country — international reach is the default. Use ["in","us","gb"] when nothing was said>],
  "searchTerms": [<for tech only: 5-8 single words that would literally appear in a post by this kind of company. Use the words the company uses about ITSELF. Good: "launch","app","saas","product","startup". Bad: "ad creative","videographer". Empty array if tech is not among the audiences>],
  "icp": "<one sentence describing the ideal client>",
  "valueLine": "<one sentence, max 16 words, saying what the freelancer does for that client. Concrete, no adjectives like 'stunning' or 'cutting-edge'>",
  "proofNeeded": "<the single piece of evidence this buyer would want to see in a cold email>",
  "avoid": "<one thing that would make this cold email get deleted>"
}`
        );
    } catch (error) {
        // Deliberately not rethrown, including on a quota error: the search
        // itself is plain HTTP against open databases and works perfectly
        // without the model. Only ranking and drafting are lost.
        console.warn('[clients] brief generation failed, using keyword routing:', error.message);
        return { ...fallback, degraded: true, degradedReason: error.message };
    }
}

/**
 * Broad search terms inevitably drag in hobby projects and side experiments
 * that are never going to buy anything. This scores each candidate on whether
 * it is a real prospect before any drafting effort is spent on it.
 */
async function rankFit(leads, brief, { service, targetClient }) {
    if (!hasGemini() || leads.length === 0) return leads;

    try {
        const list = leads
            .map((l, i) => `[${i}] ${l.company} — ${l.headline}. ${(l.blurb || '').slice(0, 130)}`)
            .join('\n');

        const scored = await generateJson(
            analysisModel,
            `A freelancer offering "${service}" wants clients matching: "${targetClient}".
Ideal client profile: ${brief.icp || targetClient}

Score each candidate 0-100 on whether it is a REAL prospect.

Score LOW (under 35):
- hobby projects, games, demos, art pieces, personal weekend builds
- free/open-source tools with no company and no revenue
- developer libraries whose only users are developers, when the freelancer sells to consumer or business buyers
- anything with no plausible budget for this service

Score HIGH (70+):
- a company with a product, a website, and customers to win
- someone whose stated problem is the one this freelancer solves
- a team visibly trying to grow usage right now

CANDIDATES:
${list}

Return ONLY a JSON array: [{ "id": <index>, "fit": <0-100>, "why": "<max 10 words on why they would or would not buy>" }]`
        );

        const byId = new Map((Array.isArray(scored) ? scored : []).map((s) => [s.id, s]));

        return leads
            .map((lead, i) => {
                const s = byId.get(i);
                return {
                    ...lead,
                    fit: s ? Math.max(0, Math.min(100, Number(s.fit) || 0)) : 50,
                    fitReason: s?.why || '',
                };
            })
            .filter((l) => l.fit >= 40)
            // A lead worth writing to is both a plausible buyer and someone who
            // actually replies; neither signal is useful on its own.
            .sort((a, b) => b.fit * 0.6 + b.responsiveness * 0.4 - (a.fit * 0.6 + a.responsiveness * 0.4));
    } catch (error) {
        console.warn('[clients] fit ranking failed:', error.message);
        return leads;
    }
}

/**
 * Drafts one short cold email per lead, each referencing that lead's own post.
 * Nothing is sent from here — the client opens the user's mail app with the
 * draft so a person reads every message before it goes out.
 */
async function draftEmails(leads, brief, sender) {
    if (!hasGemini() || leads.length === 0) return leads;

    try {
        const list = leads
            .map(
                (l, i) =>
                    `[${i}] ${l.company} — ${l.headline}. Signal: ${l.signal}. Their words: "${(l.blurb || '').slice(0, 170)}"`
            )
            .join('\n');

        const drafts = await generateJson(
            analysisModel,
            `Write one cold email per prospect. These are real people who posted publicly this month.

SENDER: ${sender.name || 'A freelancer'}
SENDER OFFERS: ${sender.service}
${sender.portfolio ? `PORTFOLIO: ${sender.portfolio}` : ''}
VALUE LINE: ${brief.valueLine || ''}
${brief.proofNeeded ? `WHAT THESE BUYERS WANT TO SEE: ${brief.proofNeeded}` : ''}
${brief.avoid ? `WHAT GETS THIS DELETED: ${brief.avoid}` : ''}

PROSPECTS:
${list}

RULES — a cold email that gets a reply:
- Under 90 words. Four sentences at most.
- The first sentence must prove you looked at THEIR specific thing. Name it. No "I came across your company".
- One clear offer, one clear ask. The ask should be small — a reply, not a 30-minute call.
- BANNED OPENERS. Never begin with congratulation, praise or excitement. Specifically never start with: "Congrats", "Congratulations", "Love what you're building", "Impressive", "I was excited to see", "Hope this finds you well", "Quick question". Open with the observation itself: "Saw you launched X" or "You built X to do Y" — a neutral statement of what they made.
- No buzzwords ("leverage", "seamless", "cutting-edge", "game-changing", "synergy").
- Plain sentences. Write like a person emailing one other person.
- Do not invent results, client names, or numbers the sender did not give.
- Subject line: under 6 words, lowercase, specific to them, not clickbait.

Return ONLY a JSON array, one object per prospect, in the same order:
[{ "id": <index>, "subject": "...", "body": "...", "angle": "<5-8 words naming the hook you used>" }]`
        );

        const byId = new Map((Array.isArray(drafts) ? drafts : []).map((d) => [d.id, d]));
        return leads.map((lead, i) => {
            const d = byId.get(i);
            return d ? { ...lead, draft: { subject: d.subject, body: d.body, angle: d.angle } } : lead;
        });
    } catch (error) {
        console.warn('[clients] draft generation failed:', error.message);
        return leads;
    }
}

/**
 * Finds prospective clients for a freelancer and drafts a first message to each.
 */
router.post('/find-clients', async (req, res) => {
    const { service, targetClient, region = '', name = '', portfolio = '', limit = 9 } = req.body;

    if (!service || !String(service).trim()) {
        return res.status(400).json({ error: 'Describe what you do (service) first.' });
    }
    if (!targetClient || !String(targetClient).trim()) {
        return res.status(400).json({ error: 'Describe who you want to reach (targetClient).' });
    }

    const max = Math.min(18, Math.max(3, Number(limit) || 9));
    const key = JSON.stringify([service, targetClient, region, max]);

    const cached = cacheGet(key);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const brief = await buildBrief({ service, targetClient, region });
        const terms = (brief.searchTerms || []).map(String);

        console.log(`[clients] searching for terms: ${terms.join(', ')}`);

        /*
         * Discovery is deliberately wide — the product databases return
         * hundreds of brands across a hundred-odd countries. Only the front of
         * that list is scored and drafted, because both cost a model call;
         * the rest is returned for browsing and drafted on demand through
         * /draft-email.
         */
        const { leads, sources, totalFound } = await findLeads(terms, { limit: 240, brief });

        if (leads.length === 0) {
            return res.json({
                leads: [],
                brief,
                sources,
                message: 'No matching prospects this cycle. Try describing the client more broadly.',
            });
        }

        const RANK_WINDOW = 40;
        const scored = await rankFit(leads.slice(0, RANK_WINDOW), brief, { service, targetClient });
        const rest = leads.slice(RANK_WINDOW);
        const ranked = scored.slice(0, max);

        if (scored.length === 0 && rest.length === 0) {
            return res.json({
                leads: [],
                brief,
                sources,
                message:
                    'Found posts, but none looked like real buyers for this service. Try describing the client differently.',
            });
        }

        const withDrafts = await draftEmails(ranked, brief, { name, service, portfolio });

        const payload = {
            // The drafted few first, then everything else the search found.
            leads: [...withDrafts, ...scored.slice(max), ...rest],
            drafted: withDrafts.filter((l) => l.draft).length,
            degraded: brief.degraded || false,
            degradedReason: brief.degradedReason || null,
            totalFound,
            brief,
            sources,
            disclaimer:
                'Each of these people posted publicly within the last few weeks in a place that invites replies. Drafts open in your own mail app so you read and edit every message before it is sent — HireUS never sends mail on your behalf.',
        };

        cacheSet(key, payload);
        res.json(payload);
    } catch (error) {
        console.error('[clients] search failed:', error.message);
        res.status(502).json({ error: 'Could not find client leads.', details: error.message });
    }
});

/**
 * Drafts an email for one lead on demand.
 *
 * Discovery returns hundreds of prospects but drafts only the first few,
 * because each draft costs a model call. This covers the rest: the user picks
 * a lead out of the list and gets a message written for that one.
 */
router.post('/draft-email', async (req, res) => {
    const { lead, service, name = '', portfolio = '', valueLine = '' } = req.body;

    if (!lead?.company) return res.status(400).json({ error: 'lead is required' });
    if (!service) return res.status(400).json({ error: 'service is required' });
    if (!hasGemini()) return res.status(503).json({ error: 'Drafting requires GEMINI_API_KEY.' });

    try {
        // The brand databases give a name, not a domain. Resolve it now so the
        // draft can point somewhere real, rather than resolving all of them.
        let resolved = null;
        if (lead.kind === 'brand' && !lead.domain) {
            resolved = await resolveBrand(lead.company);
        }

        const [draft] = await draftEmails(
            [{ ...lead, domain: lead.domain || resolved?.domain || null }],
            { valueLine },
            { name, service, portfolio }
        );

        res.json({
            draft: draft?.draft || null,
            domain: lead.domain || resolved?.domain || null,
            logo: resolved?.logo || null,
        });
    } catch (error) {
        if (error.code === 'GEMINI_QUOTA') {
            return res.status(429).json({ error: error.message });
        }
        console.error('[clients] draft failed:', error.message);
        res.status(502).json({ error: 'Could not draft that email.' });
    }
});

/** Rewrites a single draft in a different register. */
router.post('/rewrite-email', async (req, res) => {
    const { subject, body, tone = 'shorter', context = '' } = req.body;

    if (!body) return res.status(400).json({ error: 'body is required' });
    if (!hasGemini()) return res.status(503).json({ error: 'Rewriting requires GEMINI_API_KEY.' });

    const instruction =
        {
            shorter: 'Cut it to under 50 words without losing the specific detail about them.',
            warmer: 'Make it read more human and less transactional, but do not add flattery.',
            direct: 'Make the ask more direct and lead with the offer.',
            formal: 'Raise the register slightly for a corporate recipient. Still no buzzwords.',
        }[tone] || 'Improve it.';

    try {
        const result = await generateJson(
            analysisModel,
            `Rewrite this cold email. ${instruction}

${context ? `RECIPIENT CONTEXT: ${context}` : ''}
CURRENT SUBJECT: ${subject || ''}
CURRENT BODY:
${body}

Keep: the specific reference to the recipient, one offer, one small ask.
Remove: flattery, buzzwords, "quick question", "hope this finds you well".

Return ONLY valid JSON: { "subject": "...", "body": "..." }`
        );
        res.json(result);
    } catch (error) {
        console.error('[clients] rewrite failed:', error.message);
        res.status(502).json({ error: 'Could not rewrite the email.' });
    }
});

module.exports = router;
