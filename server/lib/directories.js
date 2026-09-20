const axios = require('axios');

/**
 * ---------------------------------------------------------------------------
 * Sources for clients who are not on Hacker News.
 *
 * The first version of the client finder searched Show HN, the hiring thread
 * and the freelancer thread — all one developer community. That works for a
 * contract React developer and returns literally nothing for "companies with
 * physical products like perfumes and soaps", because no such company posts
 * there. These sources cover the rest:
 *
 *   Open Beauty Facts  — cosmetics, soap and fragrance brands
 *   Open Food Facts    — food and drink brands
 *   OpenStreetMap      — physical businesses that published a contact address
 *
 * All three are free, keyless and global. The first two give a brand name,
 * which is resolved to a real domain before it is shown; OSM gives an address
 * the owner put on the map themselves.
 * ---------------------------------------------------------------------------
 */

const UA = 'HireUS/1.0 (student project; contact via github)';
const TIMEOUT = 25000;

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/search';
const OBF_BASE = 'https://world.openbeautyfacts.org/api/v2/search';
/** Overpass endpoints, tried in order until one answers. */
const OVERPASS_ENDPOINTS = [
    // Measured: the main instance answers the box query in seconds while both
    // mirrors time out on it, so it leads and they are only a safety net.
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
];

/**
 * Region boxes. These are rectangles, so they cross borders — the box for
 * India also covers parts of Pakistan, Bangladesh and Myanmar. Anything
 * explicitly tagged as another country is dropped, and every result carries
 * its own city so the reader can see where it actually is.
 */
const REGION_BBOX = {
    in: [6.5, 68.1, 35.7, 97.4],
    us: [24.5, -125.0, 49.4, -66.9],
    gb: [49.9, -8.2, 58.7, 1.8],
    de: [47.3, 5.9, 55.1, 15.0],
    ca: [41.7, -141.0, 60.0, -52.6],
    au: [-43.6, 113.3, -10.7, 153.6],
    ae: [22.6, 51.5, 26.1, 56.4],
    sg: [1.15, 103.6, 1.48, 104.1],
};

/** Markets that can be searched. */
const REGIONS = {
    in: 'India',
    us: 'United States',
    gb: 'United Kingdom',
    de: 'Germany',
    ca: 'Canada',
    au: 'Australia',
    ae: 'United Arab Emirates',
    sg: 'Singapore',
};

const normalise = (s = '') => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const words = (s = '') =>
    s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/**
 * Clearbit answers "Parle" with "Parler" and "Pure & Basic" with "PureBasic",
 * the programming language. Matching on substrings or edit distance accepts
 * both, so the rule is word-level: every word of the brand has to appear as a
 * whole word in the resolved company name, or the other way round.
 *
 *   Parle          → Parler            rejected  (parler ≠ parle)
 *   Parle          → Parle Products    accepted
 *   Fer à Cheval   → Le Fer à Cheval   accepted
 *   Mama Earth     → MamaEarth         accepted  (spacing only)
 *
 * The remaining hole is a name that is a real collision once spacing is
 * removed — "Pure & Basic" the soap brand against "PureBasic" the programming
 * language. No name-only rule separates those, and rejecting them would also
 * reject the MamaEarth case above, so they are left for the relevance pass in
 * routes/clients.js to score down.
 */
function namesMatch(brand, resolved) {
    const a = normalise(brand);
    const b = normalise(resolved);
    if (!a || !b) return false;
    if (a === b) return true;

    const wa = words(brand);
    const wb = words(resolved);
    if (wa.length === 0 || wb.length === 0) return false;

    const setA = new Set(wa);
    const setB = new Set(wb);

    const covered = (needle, haystack) => needle.every((w) => haystack.has(w));

    // A single-word brand must match a word of the company exactly, which
    // stops a longer word merely starting with it from counting.
    return covered(wa, setB) || covered(wb, setA);
}

async function resolveBrand(name) {
    try {
        const { data } = await axios.get(
            'https://autocomplete.clearbit.com/v1/companies/suggest',
            { params: { query: name }, timeout: 8000 }
        );
        const hit = data?.[0];
        if (!hit || !namesMatch(name, hit.name)) return null;
        return { name: hit.name, domain: hit.domain, logo: hit.logo };
    } catch {
        return null;
    }
}

/** One page of products, collapsed to the distinct brands behind them. */
async function fetchBrandPage(base, params, label) {
    const { data } = await axios.get(base, {
        params: {
            fields: 'brands,brand_owner,product_name,categories_tags_en,countries',
            page_size: 100,
            ...params,
        },
        headers: { 'User-Agent': UA },
        timeout: TIMEOUT,
    });

    const out = [];
    for (const product of data?.products || []) {
        const raw = product.brand_owner || product.brands;
        if (!raw) continue;

        // The brands field is a comma-separated list; the first is the owner.
        const name = String(raw).split(',')[0].trim();
        if (name.length < 2 || name.length > 48) continue;

        const countries = String(product.countries || '')
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);

        out.push({
            kind: 'brand',
            company: name,
            headline: product.product_name
                ? `Makes ${String(product.product_name).slice(0, 70)}`
                : `${label} brand`,
            blurb: `${name} is a ${label.toLowerCase()} brand${
                product.categories_tags_en
                    ? ` in ${String(product.categories_tags_en).split(',')[0]}`
                    : ''
            }${countries.length ? `, sold in ${countries.slice(0, 3).join(', ')}` : ''}.`,
            location: countries[0] || null,
            countries,
            source: label,
            signal: 'Sells a physical product that has to be marketed',
            postedDaysAgo: 0,
            emails: [],
            points: 0,
            comments: 0,
        });
    }
    return out;
}

/**
 * Pages through a product database in parallel and returns the distinct brands
 * behind the results.
 *
 * Volume is the whole point here: one page is ~65 brands, and twenty parallel
 * pages returned 764 brands across 115 countries in under three seconds. The
 * previous version asked for a single page of one category, which is why a
 * search felt like a demo rather than a database.
 */
async function pageBrands(base, label, { categories = [], countries = [], pages = 6, limit = 1200 }) {
    const cats = categories.length ? categories.slice(0, 8) : [undefined];
    const markets = countries.length ? countries.slice(0, 6) : [undefined];

    const jobs = [];
    for (const category of cats) {
        for (const country of markets) {
            for (let page = 1; page <= pages; page++) {
                const params = { page };
                if (category) params.categories_tags_en = category;
                if (country) params.countries_tags_en = country;
                jobs.push(params);
            }
        }
    }

    const settled = await Promise.allSettled(
        jobs.map((params) => fetchBrandPage(base, params, label))
    );

    const brands = new Map();
    for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const brand of result.value) {
            const key = normalise(brand.company);
            if (!key || brands.has(key)) continue;
            brands.set(key, brand);
            if (brands.size >= limit) return [...brands.values()];
        }
    }
    return [...brands.values()];
}

/** Cosmetics, soap, skincare and fragrance brands. */
function searchBeautyBrands(options = {}) {
    return pageBrands(OBF_BASE, 'Open Beauty Facts', options);
}

/** Food and drink brands. */
function searchFoodBrands(options = {}) {
    return pageBrands(OFF_BASE, 'Open Food Facts', options);
}

/** One region's worth of businesses that published a contact address. */
async function fetchRegion(pattern, iso, limit) {
    const box = REGION_BBOX[iso.toLowerCase()];
    if (!box) return [];

    const query = `[out:json][timeout:50];
(
  nwr["shop"~"${pattern}"]["email"](${box.join(',')});
  nwr["craft"~"${pattern}"]["email"](${box.join(',')});
);
out tags center ${limit};`;

    // Only two endpoints are tried: a third attempt costs another 40s and the
    // mirrors have never answered this query faster than the main instance.
    for (const endpoint of OVERPASS_ENDPOINTS.slice(0, 2)) {
        try {
            const { data } = await axios.post(endpoint, new URLSearchParams({ data: query }), {
                headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 30000,
            });
            if (data?.elements) return data.elements.map((el) => ({ el, iso }));
        } catch (error) {
            console.warn(
                `[osm] ${iso} on ${new URL(endpoint).host}: ${error.response?.status || error.code}`
            );
        }
    }
    return [];
}

/**
 * Physical businesses that put an email on the map, across every requested
 * market at once. An unbounded global query times out, so each region is a
 * separate bounded query and they run in parallel.
 */
async function searchLocalBusinesses({ tags = [], regions = ['in'], limit = 60 }) {
    const safe = tags
        .map((t) => String(t).replace(/[^a-z_]/gi, ''))
        .filter(Boolean)
        .slice(0, 12);
    if (safe.length === 0) safe.push('cosmetics', 'perfumery', 'beauty');
    const pattern = `^(${safe.join('|')})$`;

    const markets = (regions.length ? regions : ['in'])
        .map((r) => String(r).toLowerCase())
        .filter((r) => REGION_BBOX[r])
        .slice(0, 8);
    if (markets.length === 0) markets.push('in');

    const perRegion = Math.max(15, Math.ceil(limit / markets.length));

    /*
     * Overpass gives each IP about two concurrent slots. Firing six regions at
     * once made four of them fail and fall through to the slow mirrors, which
     * turned a multi-market search into ninety seconds for half the results.
     * Two at a time is both faster overall and kinder to a free service.
     */
    const batches = [];
    for (let i = 0; i < markets.length; i += 2) {
        batches.push(markets.slice(i, i + 2));
    }

    const settled = [];
    for (const batch of batches) {
        const results = await Promise.allSettled(
            batch.map((iso) => fetchRegion(pattern, iso, perRegion))
        );
        settled.push(...results);
    }

    const out = [];
    for (const result of settled) {
        if (result.status !== 'fulfilled') continue;

        for (const { el, iso } of result.value) {
            const t = el.tags || {};
            const name = t.name || t.operator || t['name:en'];
            if (!name || !t.email) continue;

            // The boxes are rectangles and cross borders; drop anything
            // explicitly tagged as somewhere else.
            const tagged = t['addr:country'];
            if (tagged && String(tagged).toUpperCase() !== iso.toUpperCase()) continue;

            const place = [t['addr:city'], t['addr:state']].filter(Boolean).join(', ');
            const type = t.shop || t.craft || 'business';

            out.push({
                kind: 'local',
                company: String(name).slice(0, 60),
                headline: `${type.replace(/_/g, ' ')}${place ? ` in ${place}` : ''}`,
                blurb: `${name} is a ${type.replace(/_/g, ' ')} business${
                    place ? ` in ${place}` : ''
                } that published a contact address on OpenStreetMap.`,
                website: t.website || t['contact:website'] || null,
                domain: null,
                emails: [String(t.email).split(';')[0].trim()],
                phone: t.phone || t['contact:phone'] || null,
                location: place || REGIONS[iso.toLowerCase()] || null,
                market: iso.toUpperCase(),
                source: 'OpenStreetMap',
                signal: 'Published a contact address publicly',
                postedDaysAgo: 0,
                points: 0,
                comments: 0,
                threadUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
            });
        }
    }
    return out;
}

/**
 * Attaches a real domain to each brand, and drops the ones that cannot be
 * resolved — a brand with no website is not a lead anyone can act on.
 */
async function enrichBrands(brands, { limit = 20 } = {}) {
    const slice = brands.slice(0, limit);
    const resolved = await Promise.all(
        slice.map(async (brand) => {
            const company = await resolveBrand(brand.company);
            if (!company) return null;
            return {
                ...brand,
                company: company.name,
                domain: company.domain,
                logo: company.logo,
                website: `https://${company.domain}`,
                threadUrl: `https://${company.domain}`,
            };
        })
    );
    return resolved.filter(Boolean);
}

module.exports = {
    searchBeautyBrands,
    searchFoodBrands,
    searchLocalBusinesses,
    enrichBrands,
    resolveBrand,
    namesMatch,
    REGIONS,
};
