const axios = require('axios');

const TIMEOUT = 15000;

/**
 * ---------------------------------------------------------------------------
 * Scope note — read before extending this file.
 *
 * Every contact here is data the person deliberately published so that
 * candidates would contact them:
 *   - Hacker News "Who is hiring?" posts, where the whole point of the post is
 *     to receive applications at the address given.
 *   - GitHub profiles whose owner filled in the public `email` field.
 *   - Company careers pages and public company domains.
 *
 * What this file must never do: guess or permute email addresses, call an
 * enrichment/scraping vendor, or scrape LinkedIn. Those harvest addresses the
 * owner never published, breach platform terms, and fall foul of the DPDP Act.
 * Networking links below are ordinary search URLs the user clicks themselves.
 * ---------------------------------------------------------------------------
 */

// Must begin with an alphanumeric: posts glue addresses onto punctuation, and a
// leading "+", "-" or "." would otherwise be captured as part of the mailbox.
const EMAIL_RE = /[A-Za-z0-9][\w.+-]*@[\w-]+\.[\w.-]*[A-Za-z]/g;

const decodeEntities = (s = '') =>
    s
        .replace(/&#x2F;/g, '/')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

const stripHtml = (s = '') =>
    decodeEntities(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Finds the most recent "Ask HN: Who is hiring?" story id. */
async function latestHiringThread() {
    const { data } = await axios.get('https://hn.algolia.com/api/v1/search_by_date', {
        params: {
            query: '"Ask HN: Who is hiring?"',
            tags: 'story,author_whoishiring',
            hitsPerPage: 1,
        },
        timeout: TIMEOUT,
    });

    const hit = data?.hits?.[0];
    return hit ? { id: hit.objectID, title: hit.title, postedAt: hit.created_at } : null;
}

/**
 * Pulls hiring posts from the current HN thread and keeps the ones that both
 * match the candidate's field and carry a contact address the poster published.
 */
async function fetchHiringContacts(query, { limit = 12 } = {}) {
    const thread = await latestHiringThread();
    if (!thread) return { thread: null, contacts: [] };

    const { data } = await axios.get(`https://hn.algolia.com/api/v1/items/${thread.id}`, {
        timeout: 25000,
    });

    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2);

    const contacts = [];

    for (const post of data?.children || []) {
        const text = stripHtml(post.text || '');
        if (!text) continue;

        const haystack = text.toLowerCase();
        const matched = terms.filter((t) => haystack.includes(t));
        if (terms.length && matched.length === 0) continue;

        const emails = [...new Set(text.match(EMAIL_RE) || [])].filter(
            (e) => !e.endsWith('.png') && !e.endsWith('.jpg')
        );
        const urls = [...new Set(text.match(/https?:\/\/[^\s)<>"']+/g) || [])];

        if (emails.length === 0 && urls.length === 0) continue;

        // The HN convention is "Company | Role | Location | …" on the first line.
        const headline = text.split('|').map((p) => p.trim());
        // Posters often append their URL to the company segment — trim it off.
        const company =
            headline[0]?.replace(/https?:\/\/\S+/g, '').replace(/[\s,–-]+$/, '').slice(0, 60) ||
            'Unlisted company';
        const role = headline[1]?.slice(0, 80) || null;
        const location = headline.slice(2).find((p) => /remote|onsite|hybrid|,/i.test(p)) || null;

        contacts.push({
            company,
            role,
            location: location?.slice(0, 60) || null,
            email: emails[0] || null,
            allEmails: emails.slice(0, 3),
            links: urls.slice(0, 3),
            blurb: text.slice(0, 260),
            postedBy: post.author || null,
            discussionUrl: `https://news.ycombinator.com/item?id=${post.id}`,
            matchedOn: matched.slice(0, 4),
            source: 'Hacker News — Who is hiring',
        });
    }

    // A published email is the whole point of this feature, so surface those
    // posts first; link-only posts fill the remainder.
    contacts.sort((a, b) => Number(Boolean(b.email)) - Number(Boolean(a.email)));

    return { thread, contacts: contacts.slice(0, limit) };
}

/**
 * Resolves a company name to its real domain and logo via Clearbit's free,
 * keyless autocomplete endpoint, so the UI can link to the actual site instead
 * of a search guess.
 */
async function resolveCompany(name) {
    try {
        const { data } = await axios.get(
            'https://autocomplete.clearbit.com/v1/companies/suggest',
            { params: { query: name }, timeout: 8000 }
        );
        const hit = data?.[0];
        if (!hit) return null;
        return { name: hit.name, domain: hit.domain, logo: hit.logo };
    } catch {
        return null;
    }
}

/**
 * Finds engineers who list the target company and have chosen to publish an
 * email or a personal site on their GitHub profile. Unauthenticated GitHub
 * allows 60 requests/hour; a GITHUB_TOKEN in .env raises that to 5,000.
 */
async function fetchPeopleAtCompany(company, { limit = 6 } = {}) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'HireUS' };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    try {
        const { data } = await axios.get('https://api.github.com/search/users', {
            params: { q: `${company} in:company type:user`, per_page: limit },
            headers,
            timeout: TIMEOUT,
        });

        const profiles = await Promise.allSettled(
            (data?.items || []).map((u) =>
                axios.get(u.url, { headers, timeout: 8000 }).then((r) => r.data)
            )
        );

        return profiles
            .filter((p) => p.status === 'fulfilled')
            .map((p) => p.value)
            .map((u) => ({
                name: u.name || u.login,
                handle: u.login,
                avatar: u.avatar_url,
                bio: u.bio || null,
                company: u.company || null,
                location: u.location || null,
                // only present when the user made it public themselves
                email: u.email || null,
                website: u.blog || null,
                profileUrl: u.html_url,
                followers: u.followers,
                source: 'GitHub (public profile)',
            }))
            .filter((u) => u.email || u.website);
    } catch (error) {
        console.warn('[contacts] GitHub lookup failed:', error.message);
        return [];
    }
}

/**
 * Builds the outreach routes for a company: its careers page, the standard
 * public hiring inboxes, and one-click search links. Nothing here is scraped —
 * the search links open in the user's own browser session.
 */
function buildOutreach(company, domain) {
    const encoded = encodeURIComponent(company);
    return {
        careersPage: domain ? `https://${domain}/careers` : null,
        website: domain ? `https://${domain}` : null,
        // Published role inboxes, shown as suggestions to try — not claimed as verified.
        publicInboxes: domain ? [`careers@${domain}`, `jobs@${domain}`, `hr@${domain}`] : [],
        searchLinks: {
            linkedinCompany: `https://www.linkedin.com/search/results/companies/?keywords=${encoded}`,
            linkedinRecruiters: `https://www.linkedin.com/search/results/people/?keywords=${encoded}%20recruiter`,
            twitter: `https://x.com/search?q=${encoded}%20hiring&f=live`,
            googleCareers: `https://www.google.com/search?q=${encoded}+careers`,
        },
    };
}

module.exports = {
    fetchHiringContacts,
    resolveCompany,
    fetchPeopleAtCompany,
    buildOutreach,
    latestHiringThread,
};
