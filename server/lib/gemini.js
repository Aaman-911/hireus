const { GoogleGenerativeAI } = require('@google/generative-ai');

let generationModel = null;
let analysisModel = null;

try {
    if (process.env.GEMINI_API_KEY) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        generationModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        analysisModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('Google Gemini AI client initialized successfully.');
    } else {
        console.warn('GEMINI_API_KEY not found in .env. Falling back to mock responses.');
    }
} catch (error) {
    console.error('Failed to initialize Google Gemini AI:', error);
}

/**
 * A daily-quota 429 will never succeed on retry, unlike a per-minute one.
 *
 * Google reports both alike — a daily exhaustion still carries a ~58s
 * `retryDelay` — so the retry hint cannot be used to tell them apart. The
 * quotaId is the only reliable signal: `...PerDayPerProjectPerModel` means the
 * allowance is gone until midnight Pacific, and waiting accomplishes nothing.
 */
const isDailyQuota = (error) => /PerDay/i.test(error?.message || '');

/** Never leave a request hanging on a retry chain longer than this. */
const MAX_RETRY_WAIT_MS = 20000;

class QuotaError extends Error {
    constructor() {
        super(
            "Gemini's free-tier daily quota is used up (20 requests/day on gemini-2.5-flash). " +
            'It resets at midnight Pacific time, or add billing to the API key to lift the cap.'
        );
        this.code = 'GEMINI_QUOTA';
        this.status = 429;
    }
}

/**
 * Retries the transient failures and only those:
 *   429 with a retry delay — per-minute rate limit, waits it out
 *   503                    — model overloaded, backs off exponentially
 * A daily-quota 429 is raised immediately, because waiting cannot fix it.
 */
const generateWithRetry = async (model, prompt, retries = 3) => {
    for (let attempt = 0; ; attempt++) {
        try {
            return await model.generateContent(prompt);
        } catch (error) {
            if (isDailyQuota(error)) throw new QuotaError();

            const retryable = error.status === 429 || error.status === 503;
            if (!retryable || attempt >= retries) throw error;

            const match = /retry in ([\d.]+)s/i.exec(error.message || '');
            const suggested = match
                ? (parseFloat(match[1]) + 1) * 1000
                : 2 ** attempt * 2000;

            // A suggested wait longer than the cap means the limit is not going
            // to clear soon; fail now rather than stalling the request.
            if (suggested > MAX_RETRY_WAIT_MS) throw error;
            const waitMs = suggested;

            console.warn(
                `Gemini ${error.status}, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${retries})`
            );
            await new Promise((r) => setTimeout(r, waitMs));
        }
    }
};

/**
 * Gemini often wraps JSON in prose or markdown fences despite instructions.
 * A bare JSON.parse on that throws and used to surface as a blanket 500, so
 * peel the fences and, failing that, grab the outermost {...} or [...].
 */
const parseJsonResponse = (raw) => {
    if (!raw) throw new Error('Empty model response');

    const withoutFences = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

    try {
        return JSON.parse(withoutFences);
    } catch {
        const first = withoutFences.search(/[[{]/);
        const lastBrace = withoutFences.lastIndexOf('}');
        const lastBracket = withoutFences.lastIndexOf(']');
        const last = Math.max(lastBrace, lastBracket);

        if (first !== -1 && last > first) {
            return JSON.parse(withoutFences.slice(first, last + 1));
        }
        throw new Error('Model did not return parseable JSON');
    }
};

/** Runs a prompt and returns parsed JSON, retrying once on a parse failure. */
const generateJson = async (model, prompt) => {
    const result = await generateWithRetry(model, prompt);
    try {
        return parseJsonResponse(result.response.text());
    } catch (parseError) {
        console.warn('First JSON parse failed, retrying with a stricter prompt:', parseError.message);
        const strict = await generateWithRetry(
            model,
            `${prompt}\n\nCRITICAL: Your previous reply was not valid JSON. Output ONLY the raw JSON value. No prose, no markdown fences.`
        );
        return parseJsonResponse(strict.response.text());
    }
};

const hasGemini = () => Boolean(generationModel);

module.exports = {
    generationModel,
    analysisModel,
    generateWithRetry,
    generateJson,
    parseJsonResponse,
    hasGemini,
    QuotaError,
};
