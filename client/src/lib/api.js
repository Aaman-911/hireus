import axios from 'axios';

/*
 * Deployed, the API sits under /api on the same origin as the client, so the
 * default is a relative path and no CORS is involved. Locally the Express
 * server runs separately on 5001. VITE_API_URL overrides both, for a split
 * deployment where the API is its own service.
 */
const isLocalhost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

export const API_BASE =
  import.meta.env.VITE_API_URL || (isLocalhost ? 'http://localhost:5001' : '/api');

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

/**
 * Client discovery fans out across several sources, ranks them and then drafts
 * an email per lead, so it routinely runs past the default minute.
 */
export const slowApi = axios.create({
  baseURL: API_BASE,
  // Serverless hosts cut the request at 60s, so waiting four minutes only
  // hides the failure. A little over the ceiling surfaces it honestly.
  timeout: 75000,
});

/** Pull a human-readable message out of whatever axios threw. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.code === 'ECONNABORTED') return 'The AI took too long to respond. Try again.';
  if (err?.message === 'Network Error') {
    return `Cannot reach the API at ${API_BASE}. Is the server running?`;
  }
  if (err?.response?.status === 429) {
    return err.response.data?.error || 'Too many requests. Please wait a few minutes.';
  }
  return err?.response?.data?.error || err?.message || fallback;
}
