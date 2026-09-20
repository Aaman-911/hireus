import axios from 'axios';

// Single place the backend URL is configured. Override with VITE_API_URL
// in client/.env when the API is not on localhost.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

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
  timeout: 240000,
});

/** Pull a human-readable message out of whatever axios threw. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.code === 'ECONNABORTED') return 'The AI took too long to respond. Try again.';
  if (err?.message === 'Network Error') {
    return `Cannot reach the API server at ${API_BASE}. Is it running?`;
  }
  return err?.response?.data?.error || err?.message || fallback;
}
