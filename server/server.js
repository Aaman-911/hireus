require('dotenv').config();
const express = require('express');
const cors = require('cors');

const interviewRoutes = require('./routes/interview');
const jobRoutes = require('./routes/jobs');
const networkRoutes = require('./routes/network');
const clientRoutes = require('./routes/clients');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

// Final safety net so an unexpected throw returns JSON instead of an HTML page.
app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
    console.log(`HireUS API listening on port ${PORT}`);
});
