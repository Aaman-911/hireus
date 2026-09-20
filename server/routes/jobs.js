const express = require('express');
const { aggregateJobs, ADZUNA_MARKETS } = require('../lib/jobSources');
const { generationModel, analysisModel, generateJson, hasGemini } = require('../lib/gemini');

const router = express.Router();

/** Short-lived cache so repeat searches do not re-hit five APIs. */
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const cacheGet = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return entry.value;
};

const cacheSet = (key, value) => {
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 50) cache.delete(cache.keys().next().value);
};

/** Turns the profile into a tighter board query. Falls back to the raw role. */
async function refineQuery({ targetRole, experience, industry, skills }) {
    if (!hasGemini()) return targetRole;
    try {
        const prompt = `You are a job search optimization expert. Generate a SINGLE concise job board search query (2-5 words).

- Target Role: ${targetRole}
- Experience: ${experience || 'Not specified'} years
- Industry: ${industry || 'Not specified'}
- Key Skills: ${skills || 'Not specified'}

Rules:
- Return ONLY the query string. No quotes, no explanation, no JSON.
- Adjust seniority wording to the experience (Junior for <2 years, Senior for 5+).
- Keep it short and broad enough to return results.`;

        const result = await generationModel.generateContent(prompt);
        const refined = result.response.text().trim().replace(/^["']|["']$/g, '');
        return refined && refined.length < 60 ? refined : targetRole;
    } catch (error) {
        console.warn('[jobs] query refinement failed:', error.message);
        return targetRole;
    }
}

/** Scores and explains the shortlist. Degrades to positional scores. */
async function rankJobs(jobs, candidate, limit) {
    const shortlist = jobs.slice(0, 25);
    const positional = (list) =>
        list.slice(0, limit).map((j, i) => ({
            ...j,
            matchScore: Math.max(52, 88 - i * 5),
            matchReason: '',
        }));

    if (!hasGemini() || shortlist.length === 0) return positional(shortlist);

    try {
        const listStr = shortlist
            .map(
                (j, i) =>
                    `[${i}] "${j.title}" at ${j.company} (${j.location}) — ${j.description.slice(0, 140)}`
            )
            .join('\n');

        const prompt = `You are a career matching expert. Rank these jobs for the candidate and score each 0-100.

CANDIDATE:
- Target Role: ${candidate.targetRole}
- Experience: ${candidate.experience || 'Not specified'} years
- Industry: ${candidate.industry || 'Not specified'}
- Key Skills: ${candidate.skills || 'Not specified'}
${candidate.score ? `- Interview Performance: ${candidate.score}/100` : ''}

JOBS:
${listStr}

Return ONLY a JSON array of the TOP ${limit} most relevant jobs, best first:
[{ "id": <index>, "matchScore": <0-100>, "reason": "<one-line reason>" }]`;

        const rankings = await generateJson(analysisModel, prompt);

        const ranked = (Array.isArray(rankings) ? rankings : [])
            .filter((r) => shortlist[r.id])
            .map((r) => ({
                ...shortlist[r.id],
                matchScore: Math.min(100, Math.max(0, Number(r.matchScore) || 50)),
                matchReason: r.reason || '',
            }))
            .slice(0, limit);

        return ranked.length ? ranked : positional(shortlist);
    } catch (error) {
        console.warn('[jobs] ranking failed:', error.message);
        return positional(shortlist);
    }
}

/**
 * Standalone job search — no interview required. Used by the /jobs page and,
 * with a score attached, by the post-interview recommendations.
 */
const searchHandler = async (req, res) => {
    const {
        targetRole,
        experience = '',
        industry = '',
        skills = '',
        score = '',
        country = process.env.ADZUNA_COUNTRY || 'in',
        remoteOnly = 'false',
        limit = '9',
        refine = 'true',
    } = req.query;

    if (!targetRole || !String(targetRole).trim()) {
        return res.status(400).json({ error: 'targetRole is required' });
    }

    const max = Math.min(24, Math.max(3, Number(limit) || 9));
    const wantRemoteOnly = remoteOnly === 'true';

    // Validated here as well as in fetchAdzuna, so the value that gets logged
    // and cached is the one actually used rather than raw user input.
    const market = ADZUNA_MARKETS.has(String(country).toLowerCase())
        ? String(country).toLowerCase()
        : process.env.ADZUNA_COUNTRY || 'in';

    const cacheKey = JSON.stringify([targetRole, experience, industry, skills, market, wantRemoteOnly, max]);

    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const query =
            refine === 'true'
                ? await refineQuery({ targetRole, experience, industry, skills })
                : targetRole;

        console.log(`[jobs] aggregating for "${query}" (market=${market}, remoteOnly=${wantRemoteOnly})`);

        const { jobs, sources } = await aggregateJobs(query, { country: market, remoteOnly: wantRemoteOnly });

        if (jobs.length === 0) {
            return res.json({
                jobs: [],
                query,
                sources,
                message: 'No openings matched. Try a broader role title or turn off "remote only".',
            });
        }

        const ranked = await rankJobs(jobs, { targetRole, experience, industry, skills, score }, max);
        const payload = { jobs: ranked, query, sources, totalFound: jobs.length };

        cacheSet(cacheKey, payload);
        res.json(payload);
    } catch (error) {
        console.error('[jobs] search failed:', error.message);
        res.status(502).json({ error: 'Failed to fetch job listings.' });
    }
};

router.get('/job-search', searchHandler);
// Backwards-compatible alias for the endpoint the original client called.
router.get('/job-recommendations', searchHandler);

module.exports = router;
