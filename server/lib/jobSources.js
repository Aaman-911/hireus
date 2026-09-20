const axios = require('axios');

const TIMEOUT = 12000;

/** Markets Adzuna actually serves. Anything else is rejected, not escaped. */
const ADZUNA_MARKETS = new Set([
    'gb', 'us', 'at', 'au', 'be', 'br', 'ca', 'ch', 'de', 'es',
    'fr', 'in', 'it', 'mx', 'nl', 'nz', 'pl', 'sg', 'za',
]);


/**
 * Free boards are multilingual and an Indian or US candidate searching in
 * English cannot act on a German posting. Detects the obvious non-English
 * listings from stopwords rather than pulling in a language-detection library.
 */
const NON_ENGLISH_MARKERS = [
    ' und ', ' der ', ' die ', ' das ', ' mit ', ' für ', ' wir ', ' eine ', ' werden ',
    ' een ', ' het ', ' voor ', ' van ',
    ' les ', ' des ', ' vous ', ' nous ', ' pour ',
    ' que ', ' para ', ' con ', ' una ',
];

function looksEnglish(text = '') {
    const t = ` ${text.toLowerCase()} `;
    if (t.length < 60) return true;
    const hits = NON_ENGLISH_MARKERS.reduce(
        (n, m) => n + (t.split(m).length - 1),
        0
    );
    return hits < 3;
}

/** Postings older than this are usually filled or stale. */
const MAX_AGE_DAYS = 45;

function isFresh(postedAt) {
    if (!postedAt) return true;            // undated sources are kept
    const ts = Date.parse(postedAt);
    if (Number.isNaN(ts)) return true;
    return (Date.now() - ts) / 86400000 <= MAX_AGE_DAYS;
}

/** Pulls the concrete skills a posting asks for, to show against the candidate's own. */
const SKILL_VOCAB = [
    'react','angular','vue','svelte','next.js','node','node.js','typescript','javascript',
    'python','java','golang','go','rust','ruby','php','c++','c#','.net','kotlin','swift',
    'sql','postgres','mysql','mongodb','redis','graphql','rest','django','flask','spring',
    'aws','azure','gcp','docker','kubernetes','terraform','ci/cd','jenkins','git',
    'tailwind','css','html','figma','sass','webpack','vite',
    'pandas','numpy','tensorflow','pytorch','scikit','spark','hadoop','tableau','power bi',
    'excel','salesforce','sap','jira','agile','scrum','seo','analytics',
];

function extractSkills(text = '') {
    const haystack = ` ${text.toLowerCase().replace(/[(),.;:/]/g, ' ')} `;
    return SKILL_VOCAB.filter((s) => haystack.includes(` ${s} `)).slice(0, 10);
}

const stripHtml = (s = '') =>
    s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

const truncate = (s = '', n = 320) => (s.length > n ? `${s.slice(0, n)}…` : s);

const matchesQuery = (text, terms) => {
    const haystack = text.toLowerCase();
    return terms.some((t) => haystack.includes(t));
};

/**
 * Adzuna — the only keyed source. Regional (India by default), so it carries
 * the on-site listings the free remote boards do not.
 */
async function fetchAdzuna(query, { country = 'in', limit = 12 } = {}) {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey || appId === 'your_app_id_here') return [];

    // The country goes into the URL *path*, so it is checked against a fixed
    // list rather than escaped. A value like "gb/../../x" would otherwise
    // redirect a request that carries the API key to another endpoint.
    const market = ADZUNA_MARKETS.has(String(country).toLowerCase())
        ? String(country).toLowerCase()
        : 'in';

    const { data } = await axios.get(
        `https://api.adzuna.com/v1/api/jobs/${market}/search/1`,
        {
            params: { app_id: appId, app_key: appKey, results_per_page: limit, what: query },
            timeout: TIMEOUT,
        }
    );

    return (data?.results || []).map((job) => ({
        title: job.title || 'Untitled Position',
        company: job.company?.display_name || 'Company not listed',
        location: job.location?.display_name || 'Location not specified',
        description: truncate(stripHtml(job.description || '')),
        applyLink: job.redirect_url || '#',
        salary:
            job.salary_min && job.salary_max
                ? `${Math.round(job.salary_min).toLocaleString()} – ${Math.round(job.salary_max).toLocaleString()}`
                : null,
        remote: false,
        postedAt: job.created || null,
        source: 'Adzuna',
    }));
}

/** Arbeitnow — free, no key. Mostly EU, strong on visa-sponsored roles. */
async function fetchArbeitnow(terms) {
    const { data } = await axios.get('https://www.arbeitnow.com/api/job-board-api', {
        timeout: TIMEOUT,
    });

    return (data?.data || [])
        .filter((j) => matchesQuery(`${j.title} ${(j.tags || []).join(' ')}`, terms))
        .map((j) => ({
            title: j.title,
            company: j.company_name || 'Company not listed',
            location: j.location || (j.remote ? 'Remote' : 'Not specified'),
            description: truncate(stripHtml(j.description || '')),
            applyLink: j.url,
            salary: null,
            remote: Boolean(j.remote),
            postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
            source: 'Arbeitnow',
            tags: (j.tags || []).slice(0, 5),
        }));
}

/** Remotive — free, no key. Curated fully-remote roles. */
async function fetchRemotive(query, limit = 20) {
    const { data } = await axios.get('https://remotive.com/api/remote-jobs', {
        params: { search: query, limit },
        timeout: TIMEOUT,
    });

    return (data?.jobs || []).map((j) => ({
        title: j.title,
        company: j.company_name || 'Company not listed',
        location: j.candidate_required_location || 'Remote',
        description: truncate(stripHtml(j.description || '')),
        applyLink: j.url,
        salary: j.salary || null,
        remote: true,
        postedAt: j.publication_date || null,
        source: 'Remotive',
        logo: j.company_logo_url || j.company_logo || null,
        tags: (j.tags || []).slice(0, 5),
    }));
}

/** Jobicy — free, no key. Remote roles with an experience-level field. */
async function fetchJobicy(query, limit = 20) {
    const { data } = await axios.get('https://jobicy.com/api/v2/remote-jobs', {
        params: { count: limit, tag: query },
        timeout: TIMEOUT,
    });

    return (data?.jobs || []).map((j) => ({
        title: j.jobTitle,
        company: j.companyName || 'Company not listed',
        location: j.jobGeo || 'Remote',
        description: truncate(stripHtml(j.jobExcerpt || j.jobDescription || '')),
        applyLink: j.url,
        salary:
            j.annualSalaryMin && j.annualSalaryMax
                ? `${j.salaryCurrency || ''} ${Number(j.annualSalaryMin).toLocaleString()} – ${Number(j.annualSalaryMax).toLocaleString()}`.trim()
                : null,
        remote: true,
        postedAt: j.pubDate || null,
        source: 'Jobicy',
        logo: j.companyLogo || null,
        level: j.jobLevel || null,
    }));
}

/** RemoteOK — free, no key. First array element is metadata, not a job. */
async function fetchRemoteOk(terms) {
    const { data } = await axios.get('https://remoteok.com/api', {
        timeout: TIMEOUT,
        headers: { 'User-Agent': 'HireUS/1.0 (student project)' },
    });

    return (Array.isArray(data) ? data.slice(1) : [])
        .filter((j) => j.position && matchesQuery(`${j.position} ${(j.tags || []).join(' ')}`, terms))
        .map((j) => ({
            title: j.position,
            company: j.company || 'Company not listed',
            location: j.location || 'Remote',
            description: truncate(stripHtml(j.description || '')),
            applyLink: j.url || j.apply_url || '#',
            salary:
                j.salary_min && j.salary_max
                    ? `$${Number(j.salary_min).toLocaleString()} – $${Number(j.salary_max).toLocaleString()}`
                    : null,
            remote: true,
            postedAt: j.date || null,
            source: 'RemoteOK',
            logo: j.company_logo || j.logo || null,
            tags: (j.tags || []).slice(0, 5),
        }));
}

/** Drops repeats of the same role at the same company across sources. */
function dedupe(jobs) {
    const seen = new Set();
    return jobs.filter((job) => {
        const key = `${job.title}|${job.company}`.toLowerCase().replace(/\s+/g, ' ').trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Queries every source in parallel and tolerates individual failures — one
 * dead feed must not take the whole page down.
 */
async function aggregateJobs(query, { country = 'in', remoteOnly = false } = {}) {
    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2);
    const searchTerms = terms.length ? terms : [query.toLowerCase()];

    const tasks = [
        { name: 'Adzuna', run: () => fetchAdzuna(query, { country }) },
        { name: 'Remotive', run: () => fetchRemotive(query) },
        { name: 'Jobicy', run: () => fetchJobicy(terms[0] || query) },
        { name: 'Arbeitnow', run: () => fetchArbeitnow(searchTerms) },
        { name: 'RemoteOK', run: () => fetchRemoteOk(searchTerms) },
    ];

    const settled = await Promise.allSettled(tasks.map((t) => t.run()));

    const jobs = [];
    const sources = [];

    settled.forEach((result, i) => {
        const name = tasks[i].name;
        if (result.status === 'fulfilled') {
            sources.push({ name, count: result.value.length, ok: true });
            jobs.push(...result.value);
        } else {
            console.warn(`[jobs] ${name} failed: ${result.reason?.message}`);
            sources.push({ name, count: 0, ok: false });
        }
    });

    let filtered = remoteOnly ? jobs.filter((j) => j.remote) : jobs;

    // Drop what the candidate cannot act on: stale postings and listings
    // written in a language they did not search in.
    const beforeFilters = filtered.length;
    filtered = filtered.filter(
        (j) => isFresh(j.postedAt) && looksEnglish(`${j.title} ${j.description}`)
    );
    const dropped = beforeFilters - filtered.length;
    if (dropped > 0) console.log(`[jobs] filtered out ${dropped} stale or non-English listings`);

    // Tag each posting with the skills it actually names.
    filtered.forEach((j) => {
        j.skills = extractSkills(`${j.title} ${j.description}`);
    });

    filtered = dedupe(filtered);

    // Sorting the pooled results purely by date lets whichever board posts most
    // often bury the rest — the regional Adzuna listings in particular. So sort
    // within each source, then round-robin across them, which keeps every board
    // represented in the slice that actually reaches the ranker.
    const byDate = (a, b) => {
        const da = a.postedAt ? Date.parse(a.postedAt) : 0;
        const db = b.postedAt ? Date.parse(b.postedAt) : 0;
        return db - da;
    };

    const buckets = new Map();
    for (const job of filtered) {
        if (!buckets.has(job.source)) buckets.set(job.source, []);
        buckets.get(job.source).push(job);
    }
    for (const list of buckets.values()) list.sort(byDate);

    const queues = [...buckets.values()];
    const interleaved = [];
    for (let round = 0; interleaved.length < filtered.length; round++) {
        let added = false;
        for (const queue of queues) {
            if (queue[round]) {
                interleaved.push(queue[round]);
                added = true;
            }
        }
        if (!added) break;
    }

    return { jobs: interleaved, sources };
}

module.exports = { aggregateJobs, stripHtml, truncate, extractSkills, looksEnglish, ADZUNA_MARKETS };
