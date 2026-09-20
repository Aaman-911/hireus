const express = require('express');
const {
    fetchHiringContacts,
    resolveCompany,
    fetchPeopleAtCompany,
    buildOutreach,
    latestHiringThread,
} = require('../lib/contacts');

const router = express.Router();

const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

const cacheGet = (k) => {
    const e = cache.get(k);
    if (!e) return null;
    if (Date.now() - e.at > CACHE_TTL) {
        cache.delete(k);
        return null;
    }
    return e.value;
};
const cacheSet = (k, v) => {
    cache.set(k, { at: Date.now(), value: v });
    if (cache.size > 40) cache.delete(cache.keys().next().value);
};

/**
 * Hiring contacts for a field, drawn from the current Hacker News
 * "Who is hiring?" thread. Every address returned was published by the poster
 * specifically to receive applications.
 */
router.get('/hiring-contacts', async (req, res) => {
    const { field, limit = '12' } = req.query;

    if (!field || !String(field).trim()) {
        return res.status(400).json({ error: 'field is required (e.g. "react developer")' });
    }

    const max = Math.min(30, Math.max(3, Number(limit) || 12));
    const key = `hiring:${field}:${max}`;
    const cached = cacheGet(key);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const { thread, contacts } = await fetchHiringContacts(field, { limit: max });

        // enrich the first handful with a resolved domain + logo
        const enriched = await Promise.all(
            contacts.map(async (c, i) => {
                if (i >= 8) return c;
                const company = await resolveCompany(c.company);
                return {
                    ...c,
                    domain: company?.domain || null,
                    logo: company?.logo || null,
                    outreach: buildOutreach(c.company, company?.domain),
                };
            })
        );

        const payload = {
            thread,
            contacts: enriched,
            disclaimer:
                'These addresses were published by the employers themselves in the Hacker News "Who is hiring?" thread so that candidates could contact them directly.',
        };

        cacheSet(key, payload);
        res.json(payload);
    } catch (error) {
        console.error('[network] hiring contacts failed:', error.message);
        res.status(502).json({ error: 'Could not load hiring contacts.' });
    }
});

/**
 * Everything we can legitimately assemble about one company: its real domain,
 * its careers page, public role inboxes to try, engineers whose GitHub profile
 * carries a public email, and one-click search links.
 */
router.get('/company-contacts', async (req, res) => {
    const { company } = req.query;

    if (!company || !String(company).trim()) {
        return res.status(400).json({ error: 'company is required' });
    }

    const key = `company:${company}`;
    const cached = cacheGet(key);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const [resolved, people] = await Promise.all([
            resolveCompany(company),
            fetchPeopleAtCompany(company),
        ]);

        const payload = {
            company: resolved?.name || company,
            domain: resolved?.domain || null,
            logo: resolved?.logo || null,
            outreach: buildOutreach(resolved?.name || company, resolved?.domain),
            people,
            disclaimer:
                'Profiles come from the public GitHub API and only appear when the person chose to publish an email or website. Role inboxes are common public addresses to try, not verified ones.',
        };

        cacheSet(key, payload);
        res.json(payload);
    } catch (error) {
        console.error('[network] company contacts failed:', error.message);
        res.status(502).json({ error: 'Could not load company contacts.' });
    }
});

/** Lets the UI show which HN thread is currently being read. */
router.get('/hiring-thread', async (_req, res) => {
    try {
        res.json((await latestHiringThread()) || {});
    } catch (error) {
        console.error('[network] hiring thread lookup failed:', error.message);
        res.status(502).json({ error: 'Could not read the hiring thread.' });
    }
});

module.exports = router;
