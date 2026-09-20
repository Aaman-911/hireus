/**
 * Speech helpers: voice selection for synthesis and lightweight delivery
 * metrics (pace, filler words) computed on the client so the candidate can
 * see them live rather than only in the final report.
 */

// Ordered by how natural they sound; first match wins.
const PREFERRED_VOICES = [
  'Google UK English Female',
  'Google US English',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Libby Online (Natural) - English (United Kingdom)',
  'Samantha',
  'Karen',
  'Daniel',
];

let cachedVoice;

/**
 * Picks the most natural available English voice instead of letting the OS
 * fall back to its default, which is usually the robotic one.
 */
export function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (!voices.length) return null;

  for (const name of PREFERRED_VOICES) {
    const match = voices.find((v) => v.name === name);
    if (match) {
      cachedVoice = match;
      return match;
    }
  }

  // otherwise: any non-local (usually cloud, usually better) English voice
  cachedVoice =
    voices.find((v) => v.lang?.startsWith('en') && !v.localService) ||
    voices.find((v) => v.lang?.startsWith('en')) ||
    voices[0];
  return cachedVoice;
}

/** Voices load asynchronously in Chrome; warm the cache when they arrive. */
export function primeVoices() {
  if (!window.speechSynthesis) return;
  pickVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = undefined;
    pickVoice();
  };
}

export function speak(text, { onStart, onEnd } = {}) {
  const synth = window.speechSynthesis;
  if (!synth || !text) return;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.98;
  utterance.pitch = 1.02;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  synth.speak(utterance);
}

export const stopSpeaking = () => window.speechSynthesis?.cancel();

const FILLERS = [
  'um', 'uh', 'umm', 'uhh', 'er', 'erm', 'ah', 'hmm',
  'like', 'actually', 'basically', 'literally', 'honestly',
  'sort of', 'kind of', 'you know', 'i mean', 'right',
];

/** Counts filler words and returns the offenders, most frequent first. */
export function analyseFillers(text = '') {
  const lower = ` ${text.toLowerCase().replace(/[.,!?;:]/g, ' ')} `;
  const found = [];
  let total = 0;

  for (const filler of FILLERS) {
    const pattern = new RegExp(`\\s${filler.replace(/ /g, '\\s+')}\\s`, 'g');
    const count = (lower.match(pattern) || []).length;
    if (count > 0) {
      found.push({ word: filler, count });
      total += count;
    }
  }

  found.sort((a, b) => b.count - a.count);
  return { total, breakdown: found };
}

export const countWords = (text = '') =>
  text.trim().split(/\s+/).filter(Boolean).length;

/** 120–150 WPM is the conversational sweet spot for interviews. */
export function paceLabel(wpm) {
  if (!wpm) return { label: '—', tone: 'muted' };
  if (wpm < 100) return { label: 'Slow', tone: 'caution' };
  if (wpm <= 160) return { label: 'Ideal', tone: 'positive' };
  if (wpm <= 190) return { label: 'Brisk', tone: 'caution' };
  return { label: 'Rushed', tone: 'critical' };
}

export const speechSupported = () =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
