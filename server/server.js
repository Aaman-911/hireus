require('dotenv').config();
const app = require('./app');

/**
 * Standalone entry point, used for local development and for hosts that run a
 * persistent Node process (Render, Fly, Cloud Run). On Vercel the app is
 * imported directly by api/index.js instead and never listens.
 */
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    console.log(`HireUS API listening on port ${PORT} (${mode})`);
    if (mode === 'production' && !process.env.CORS_ORIGIN) {
        console.warn('CORS_ORIGIN is not set. Same-origin deployments do not need it.');
    }
});
