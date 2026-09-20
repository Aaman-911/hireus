const axios = require('axios');
const {
    searchBeautyBrands, searchFoodBrands, searchLocalBusinesses,
} = require('./directories');

/**
 * ---------------------------------------------------------------------------
 * Client leads for freelancers.
 *
 * The same rule as lib/contacts.js applies and is the reason this feature can
 * exist at all: every lead is someone who published something public and
 * recent that invites a reply — a product they just launched and are actively
 * promoting, a role they are hiring for, or an explicit "seeking freelancer"
 * post. Reaching them is a cold email, not a scrape.
 *
 * This module finds and ranks leads and drafts one message each. It does not
 * send anything: the UI opens the user's own mail client with the draft, one
 * lead at a time, so a human reads every message before it goes. No bulk send,
 * no tracking pixels, no list upload.
 * ---------------------------------------------------------------------------
 */

const ALGOLIA = 'https://hn.algolia.com/api/v1';
const TIMEOUT = 15000;

const EMAIL_RE = /[A-Za-z0-9][\w.+-]*@[\w-]+\.[\w.-]*[A-Za-z]/g;

const decode = (s = '') =>
    s
        .replace(/&#x2F;/g, '/')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

const clean = (s = '') => decode(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const daysAgo = (unix) => Math.floor((Date.now() / 1000 - unix) / 86400);

const domainOf = (url = '') => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
};

/** Domains that are a person's project host, not a company of their own. */
const PLATFORM_HOSTS = new Set([
    'github.com', 'gitlab.com', 'news.ycombinator.com', 'medium.com',
    'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'reddit.com',
    'producthunt.com', 'notion.site', 'substack.com',
]);

/**
 * Recently launched products. A team that shipped in the last few weeks is
 * actively looking for attention, which is exactly when an ad, a landing page
 * or a design service is worth a message.
 */
async function searchShowHN(terms, { days = 45, perTerm = 25 } = {}) {
    const since = Math.floor(Date.now() / 1000) - days * 86400;

    // Algolia ANDs the words in a single query, so joining every term returns
    // almost nothing. Fan out one query per term and merge instead.
    const queries = terms.slice(0, 6);
    if (queries.length === 0) queries.push('');

    const settled = await Promise.allSettled(
        queries.map((query) =>
            axios.get(`${ALGOLIA}/search`, {
                params: {
                    query,
                    tags: 'show_hn',
                    numericFilters: `created_at_i>${since}`,
                    hitsPerPage: perTerm,
                },
                timeout: TIMEOUT,
            })
        )
    );

    const hits = [];
    const seen = new Set();
    for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const hit of result.value.data?.hits || []) {
            if (seen.has(hit.objectID)) continue;
            seen.add(hit.objectID);
            hits.push(hit);
        }
    }

    return hits.map((h) => ({
        kind: 'launch',
        company: (h.title || '').replace(/^Show HN:\s*/i, '').split(/[–—|:]/)[0].trim().slice(0, 60),
        headline: (h.title || '').replace(/^Show HN:\s*/i, '').trim(),
        blurb: clean(h.story_text || '').slice(0, 320),
        website: h.url || null,
        domain: domainOf(h.url || ''),
        author: h.author,
        points: h.points || 0,
        comments: h.num_comments || 0,
        postedDaysAgo: daysAgo(h.created_at_i),
        threadUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
        emails: [...new Set(clean(h.story_text || '').match(EMAIL_RE) || [])].slice(0, 2),
        signal: 'Launched publicly and is promoting it now',
        source: 'Show HN',
    }));
}

/**
 * The monthly "Ask HN: Freelancer? Seeking freelancer?" thread. The SEEKING
 * FREELANCER half is the highest-intent source there is — these people are
 * explicitly asking to be contacted by freelancers.
 */
async function searchFreelanceThread(terms, { limit = 20 } = {}) {
    const { data: search } = await axios.get(`${ALGOLIA}/search_by_date`, {
        params: {
            query: '"Freelancer? Seeking freelancer?"',
            tags: 'story',
            hitsPerPage: 2,
        },
        timeout: TIMEOUT,
    });

    const story = search?.hits?.[0];
    if (!story) return [];

    const { data } = await axios.get(`${ALGOLIA}/items/${story.objectID}`, { timeout: 25000 });

    const leads = [];
    for (const post of data?.children || []) {
        const text = clean(post.text || '');
        if (!text) continue;
        if (!/SEEKING\s+FREELANCER/i.test(text)) continue;

        const haystack = text.toLowerCase();
        const matched = terms.filter((t) => haystack.includes(t));

        const emails = [...new Set(text.match(EMAIL_RE) || [])].slice(0, 2);
        const urls = [...new Set(clean(post.text || '').match(/https?:\/\/[^\s)<>"']+/g) || [])];

        const header = text.split('|').map((p) => p.trim());
        leads.push({
            kind: 'seeking',
            company:
                header[1]?.replace(/https?:\/\/\S+/g, '').trim().slice(0, 60) ||
                post.author ||
                'Unlisted',
            headline: text.slice(0, 90),
            blurb: text.slice(0, 320),
            website: urls[0] || null,
            domain: domainOf(urls[0] || ''),
            author: post.author,
            points: 0,
            comments: 0,
            postedDaysAgo: daysAgo(post.created_at_i),
            threadUrl: `https://news.ycombinator.com/item?id=${post.id}`,
            emails,
            matchedOn: matched.slice(0, 4),
            signal: 'Explicitly asking freelancers to get in touch',
            source: 'HN Freelancer thread',
        });
        if (leads.length >= limit) break;
    }
    return leads;
}

/**
 * Companies hiring for a role adjacent to the service. If a company is paying
 * to hire a marketer, it has a marketing budget — and often takes a contractor
 * while the search runs.
 */
async function searchHiring(terms, { limit = 25 } = {}) {
    const { data: search } = await axios.get(`${ALGOLIA}/search_by_date`, {
        params: {
            query: '"Ask HN: Who is hiring?"',
            tags: 'story,author_whoishiring',
            hitsPerPage: 1,
        },
        timeout: TIMEOUT,
    });

    const story = search?.hits?.[0];
    if (!story) return [];

    const { data } = await axios.get(`${ALGOLIA}/items/${story.objectID}`, { timeout: 25000 });

    const leads = [];
    for (const post of data?.children || []) {
        const text = clean(post.text || '');
        if (!text) continue;

        const haystack = text.toLowerCase();
        const matched = terms.filter((t) => haystack.includes(t));
        if (matched.length === 0) continue;

        const emails = [...new Set(text.match(EMAIL_RE) || [])].slice(0, 2);
        const urls = [...new Set(clean(post.text || '').match(/https?:\/\/[^\s)<>"']+/g) || [])];
        const header = text.split('|').map((p) => p.trim());

        leads.push({
            kind: 'hiring',
            company:
                header[0]?.replace(/https?:\/\/\S+/g, '').replace(/[\s,–-]+$/, '').slice(0, 60) ||
                'Unlisted',
            headline: header.slice(0, 2).join(' · ').slice(0, 90),
            blurb: text.slice(0, 320),
            website: urls[0] || null,
            domain: domainOf(urls[0] || ''),
            author: post.author,
            points: 0,
            comments: 0,
            postedDaysAgo: daysAgo(post.created_at_i),
            threadUrl: `https://news.ycombinator.com/item?id=${post.id}`,
            emails,
            matchedOn: matched.slice(0, 4),
            signal: 'Hiring in this area, so the budget exists',
            source: 'HN Who is hiring',
        });
        if (leads.length >= limit) break;
    }
    return leads;
}

/**
 * An HN user's public profile. People put an email in the `about` field
 * precisely so strangers can reach them; roughly one founder in ten does.
 */
async function profileEmail(username) {
    // The name comes from an external API, so it is restricted to the
    // characters HN actually allows before being put into a URL path.
    if (!username || !/^[A-Za-z0-9_-]{1,32}$/.test(String(username))) return null;
    try {
        const { data } = await axios.get(
            `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`,
            { timeout: 8000 }
        );
        const about = clean(data?.about || '');
        const match = about.match(EMAIL_RE);
        return match ? { email: match[0], about: about.slice(0, 160) } : null;
    } catch {
        return null;
    }
}

/**
 * How likely this lead is to actually reply, scored from observable signals
 * rather than a guess. Returned alongside the reasons so the UI can show its
 * working instead of an unexplained number.
 */
function scoreResponsiveness(lead) {
    let score = 30;
    const reasons = [];

    if (lead.kind === 'seeking') {
        score += 38;
        reasons.push('Asked to be contacted by freelancers');
    } else if (lead.kind === 'launch') {
        score += 16;
        reasons.push('Just launched and is seeking attention');
    } else if (lead.kind === 'local') {
        // A small business that put its own address on the map answers it.
        score += 26;
        reasons.push('Published its own contact address');
    } else if (lead.kind === 'brand') {
        // A brand is a real buyer but reached through a company inbox, which
        // is slower and less certain than a person who just posted.
        score += 6;
        reasons.push('Sells a product that needs marketing');
    } else {
        score += 8;
        reasons.push('Actively spending on this function');
    }

    if (lead.directEmail) {
        score += 20;
        reasons.push('Published a direct address');
    } else if (lead.domain) {
        score += 4;
    }

    const dated = lead.kind === 'launch' || lead.kind === 'seeking' || lead.kind === 'hiring';
    if (dated && lead.postedDaysAgo <= 7) {
        score += 14;
        reasons.push('Posted within the last week');
    } else if (dated && lead.postedDaysAgo <= 21) {
        score += 7;
        reasons.push('Posted this month');
    }

    // A founder-run project replies; a 500-person company routes you to a form.
    if (lead.domain && !PLATFORM_HOSTS.has(lead.domain)) {
        score += 6;
        reasons.push('Small team, founder-led');
    }

    // Lots of attention already means a full inbox.
    if (lead.points > 250) {
        score -= 10;
        reasons.push('High-profile post, inbox likely crowded');
    }

    if (lead.comments > 0 && lead.comments < 40) {
        score += 4;
        reasons.push('Founder is answering replies in the thread');
    }

    return {
        responsiveness: Math.max(5, Math.min(97, score)),
        reasons: reasons.slice(0, 3),
    };
}

/** Routes to reach a lead, best first. Nothing here is a guessed personal address. */
function outreachFor(lead) {
    const routes = [];

    if (lead.directEmail) {
        routes.push({ type: 'email', label: 'Published address', value: lead.directEmail, verified: true });
    }
    if (lead.domain && !PLATFORM_HOSTS.has(lead.domain)) {
        routes.push({ type: 'email-guess', label: 'Common inbox', value: `hello@${lead.domain}`, verified: false });
    }
    routes.push({ type: 'thread', label: 'Reply on the thread', value: lead.threadUrl, verified: true });
    if (lead.website) {
        routes.push({ type: 'site', label: 'Website', value: lead.website, verified: true });
    }
    return routes;
}

/**
 * Runs every source in parallel, enriches the most promising leads with a
 * published profile address, scores them, and returns them best-first.
 */
/** Caps how long a slow source may hold up the whole search. */
function withBudget(promise, ms, fallback = []) {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
}

/**
 * Finds prospects across every source that can contain this kind of client.
 *
 * Volume comes from the open product databases, which page in parallel and
 * return brands from more than a hundred countries in a few seconds. Hacker
 * News and OpenStreetMap are narrower and slower, so OSM runs under a time
 * budget and can never hold up the response.
 *
 * Nothing here is enriched with a resolved domain — that costs one HTTP call
 * per brand and is done lazily, for the handful actually being written to.
 */
async function findLeads(terms, { limit = 200, includeHiring = true, brief = {} } = {}) {
    const searchTerms = terms.map((t) => t.toLowerCase()).filter((t) => t.length > 2);

    const audiences = brief.audiences?.length ? brief.audiences : ['tech'];
    const markets = brief.countryCodes?.length
        ? brief.countryCodes
        : [brief.countryCode || 'in'];

    const tasks = [];

    // Hacker News only carries software. Running it for a soap company is what
    // made the first version return nothing, so it is opt-in per audience.
    if (audiences.includes('tech')) {
        tasks.push({ name: 'Show HN', run: () => searchShowHN(searchTerms) });
        tasks.push({ name: 'Freelancer thread', run: () => searchFreelanceThread(searchTerms) });
        if (includeHiring) {
            tasks.push({ name: 'Who is hiring', run: () => searchHiring(searchTerms) });
        }
    }

    if (audiences.includes('beauty')) {
        tasks.push({
            name: 'Beauty brands',
            run: () =>
                searchBeautyBrands({
                    categories: brief.productCategories?.length
                        ? brief.productCategories
                        : [brief.productCategory].filter(Boolean),
                    pages: 10,
                    limit: 2500,
                }),
        });
    }

    if (audiences.includes('food')) {
        tasks.push({
            name: 'Food brands',
            run: () =>
                searchFoodBrands({
                    categories: brief.productCategories?.length
                        ? brief.productCategories
                        : [brief.productCategory].filter(Boolean),
                    pages: 10,
                    limit: 2500,
                }),
        });
    }

    if (audiences.includes('local')) {
        tasks.push({
            name: 'Local businesses',
            // Overpass is the slowest source by an order of magnitude; it gets
            // 45 seconds and whatever it has returned by then is used.
            run: () =>
                withBudget(
                    searchLocalBusinesses({
                        tags: brief.osmTags || [],
                        regions: markets,
                        limit: 120,
                    }),
                    45000
                ),
        });
    }

    const settled = await Promise.allSettled(tasks.map((t) => t.run()));

    const pool = [];
    const sources = [];
    settled.forEach((result, i) => {
        const name = tasks[i].name;
        if (result.status === 'fulfilled') {
            sources.push({ name, count: result.value.length, ok: true });
            pool.push(...result.value);
        } else {
            console.warn(`[leads] ${name} failed: ${result.reason?.message}`);
            sources.push({ name, count: 0, ok: false });
        }
    });

    // dedupe by company
    const seen = new Set();
    const unique = pool.filter((l) => {
        const key = (l.company || l.author || '').toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    unique.forEach((l) => {
        l.directEmail = l.emails?.[0] || null;
        Object.assign(l, scoreResponsiveness(l));
    });

    /*
     * Sorting the pooled leads by score alone lets one source take every slot:
     * a local business always outscores a brand, so a search for soap
     * companies surfaced twelve salons and not one of the twelve soap brands
     * behind them. Rank within each source, then round-robin across them, so
     * every source that found something is represented.
     */
    const bySource = new Map();
    for (const lead of unique) {
        if (!bySource.has(lead.source)) bySource.set(lead.source, []);
        bySource.get(lead.source).push(lead);
    }
    for (const list of bySource.values()) {
        list.sort((a, b) => b.responsiveness - a.responsiveness);
    }

    const queues = [...bySource.values()];
    const interleaved = [];
    for (let round = 0; interleaved.length < unique.length; round++) {
        let added = false;
        for (const queue of queues) {
            if (queue[round]) {
                interleaved.push(queue[round]);
                added = true;
            }
        }
        if (!added) break;
    }

    const leads = interleaved.slice(0, limit).map((l) => ({
        ...l,
        outreach: outreachFor(l),
    }));

    return { leads, sources, totalFound: unique.length };
}

module.exports = { findLeads, scoreResponsiveness, clean };
