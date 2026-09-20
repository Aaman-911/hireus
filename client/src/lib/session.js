/**
 * Interview state used to live only in react-router `location.state`, so a
 * refresh mid-interview threw the whole session away. These helpers mirror it
 * into sessionStorage so a reload can pick up where the candidate left off.
 *
 * Every access is wrapped: sessionStorage throws in private mode and can be
 * blocked entirely, and losing the mirror must never break the interview.
 */

const KEYS = {
  interview: 'hireus:interview',
  results: 'hireus:results',
  profile: 'hireus:profile',
};

function read(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked or full — in-memory state still drives the UI
  }
}

function drop(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* no-op */
  }
}

export const saveInterview = (state) => write(KEYS.interview, state);
export const loadInterview = () => read(KEYS.interview);
export const clearInterview = () => drop(KEYS.interview);

export const saveResults = (state) => write(KEYS.results, state);
export const loadResults = () => read(KEYS.results);

export const saveProfile = (profile) => write(KEYS.profile, profile);
export const loadProfile = () => read(KEYS.profile);
