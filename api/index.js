/**
 * Vercel serverless entry point.
 *
 * The Express app is shared with the standalone server; here it is exported as
 * a handler instead of being given a port. Every request under /api is routed
 * to this function by vercel.json, which puts the API on the same origin as
 * the client and removes the need for CORS at all.
 */
module.exports = require('../server/app');
