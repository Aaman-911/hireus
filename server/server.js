require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const interviewRoutes = require('./routes/interview');
const jobRoutes = require('./routes/jobs');
const networkRoutes = require('./routes/network');
const clientRoutes = require('./routes/clients');

const app = express();
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Render and most other hosts sit behind a proxy, so the client IP arrives in
 * X-Forwarded-For. Without this every request looks like it comes from the
 * proxy and the rate limiter would throttle all users as one.
 * Trusting exactly one hop, rather than `true`, stops a client from spoofing
 * the header to dodge the limit.
 */
app.set('trust proxy', 1);

app.use(helmet());

/**
 * The API is open to the deployed client only. CORS_ORIGIN takes a
 * comma-separated list; in development any localhost port is allowed so the
 * Vite dev server works whichever port it lands on.
 */
const allowed = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            // No Origin header: curl, health checks, same-origin. Allowed.
            if (!origin) return callback(null, true);

            if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
                return callback(null, true);
            }
            if (allowed.includes(origin)) return callback(null, true);

            // Reject by refusing the CORS headers, not by throwing: an error
            // here becomes a 500 and hides the real reason from the browser.
            return callback(null, false);
        },
        methods: ['GET', 'POST'],
    })
);

app.use(express.json({ limit: '256kb' }));

/**
 * Rate limits. These matter more than usual here: the Gemini free tier allows
 * 20 requests a day in total, so a handful of unthrottled visitors — or one
 * script — exhausts the whole service for everyone.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    // Local development is not rate limited; throttling your own machine while
    // building only wastes time.
    skip: () => !isProduction,
    message: { error: 'Too many requests. Please wait a few minutes.' },
});

// Anything that calls the model is scarce and gets a much tighter budget.
const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
    message: {
        error:
            'You have used this hour’s allowance of AI requests. ' +
            'The free Gemini tier is 20 requests a day in total, so it is shared carefully.',
    },
});

app.use(generalLimiter);
app.use(
    [
        '/start-interview',
        '/next-question',
        '/analyze-interview',
        '/parse-resume',
        '/find-clients',
        '/draft-email',
        '/rewrite-email',
    ],
    aiLimiter
);

app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        gemini: Boolean(process.env.GEMINI_API_KEY),
        adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
        github: Boolean(process.env.GITHUB_TOKEN),
        uptime: Math.round(process.uptime()),
    });
});

app.use(interviewRoutes);
app.use(jobRoutes);
app.use(networkRoutes);
app.use(clientRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

/**
 * Final safety net. The underlying message can name internal paths, upstream
 * URLs and occasionally a key fragment, so it is logged and not returned.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        ...(isProduction ? {} : { details: err.message }),
    });
});

app.listen(PORT, () => {
    console.log(`HireUS API listening on port ${PORT} (${isProduction ? 'production' : 'development'})`);
    if (isProduction && allowed.length === 0) {
        console.warn('CORS_ORIGIN is not set — browser requests from the deployed client will be blocked.');
    }
});
