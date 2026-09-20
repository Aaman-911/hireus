import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../lib/context';
import { useAudioLevel } from '../lib/useAudioLevel';
import {
  speak, stopSpeaking, analyseFillers, countWords, paceLabel, speechSupported,
} from '../lib/speech';
import {
  saveInterview, loadInterview, clearInterview, saveResults, loadProfile,
} from '../lib/session';

/* The one structural hint worth giving, and only for the interview types where
   it applies. Shown as a quiet scaffold, not a form to fill in. */
const STAR = [
  ['Situation', 'where and when'],
  ['Task', 'what was on you'],
  ['Action', 'what you personally did'],
  ['Result', 'the number it moved'],
];

function Waveform({ levels, active }) {
  return (
    <div className="flex h-12 items-center justify-center gap-[3px]" aria-hidden="true">
      {levels.map((level, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full transition-[height] duration-75"
          style={{
            height: `${Math.max(3, level * 44)}px`,
            background: active ? 'var(--accent)' : 'var(--rule-strong)',
          }}
        />
      ))}
    </div>
  );
}

function Meter({ label, value, tone }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="t-foot">{label}</span>
      <span
        className="mono text-[13px] font-medium"
        style={{
          color:
            tone === 'caution' || tone === 'critical'
              ? 'var(--burgundy)'
              : tone === 'positive'
                ? 'var(--accent-ink)'
                : 'var(--ink)',
        }}
      >
        {value}
      </span>
    </span>
  );
}

export default function InterviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const profile = location.state?.profile || loadProfile();
  const totalQuestions = Math.min(10, Math.max(3, Number(profile?.questionCount) || 5));
  const showStar = (profile?.interviewType || 'Behavioral') !== 'Technical';

  const [turn, setTurn] = useState(1);
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState('');
  const [aiReaction, setAiReaction] = useState('');

  const [answer, setAnswer] = useState('');
  const [inputMode, setInputMode] = useState('text');
  const [showTranscript, setShowTranscript] = useState(false);

  const [isGenerating, setIsGenerating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  const [recordingStart, setRecordingStart] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [questionStart, setQuestionStart] = useState(Date.now());

  const recognitionRef = useRef(null);
  const startedRef = useRef(false);
  const { levels } = useAudioLevel(isRecording);

  const words = countWords(answer);
  const fillers = analyseFillers(answer);
  const wpm = (() => {
    if (inputMode !== 'voice' || !recordingStart || !words) return 0;
    const minutes = (Date.now() - recordingStart) / 60000;
    return minutes > 0.02 ? Math.round(words / minutes) : 0;
  })();
  const pace = paceLabel(wpm);

  const say = useCallback(
    (text) => {
      if (muted || !text) return;
      speak(text, { onStart: () => setIsSpeaking(true), onEnd: () => setIsSpeaking(false) });
    },
    [muted]
  );

  /* ---------------------------- start / restore --------------------------- */
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const saved = loadInterview();
    if (saved?.question && saved.turn <= totalQuestions) {
      setTurn(saved.turn);
      setHistory(saved.history || []);
      setQuestion(saved.question);
      setAiReaction(saved.aiReaction || '');
      setAnswer(saved.answer || '');
      setIsGenerating(false);
      toast({ title: 'Session restored', description: `Back at question ${saved.turn}.`, variant: 'info' });
      return;
    }

    // No abort flag: startedRef already guarantees one run, and StrictMode's
    // dev-only remount would otherwise cancel the only request in flight.
    (async () => {
      try {
        const { data } = await api.post('/start-interview', { profile: profile || {} });
        setQuestion(data.question);
        setQuestionStart(Date.now());
        say(data.question);
      } catch (err) {
        setQuestion('Let us get started. Tell me about your background.');
        toast({ title: 'Could not reach the interviewer', description: errorMessage(err), variant: 'error' });
      } finally {
        setIsGenerating(false);
      }
    })();

    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!question) return;
    saveInterview({ turn, history, question, aiReaction, answer, totalQuestions });
  }, [turn, history, question, aiReaction, answer, totalQuestions]);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - questionStart) / 1000)), 1000);
    return () => clearInterval(id);
  }, [questionStart]);

  /* ---------------------------- dictation --------------------------- */
  useEffect(() => {
    if (!speechSupported()) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      setRecordingStart((prev) => prev ?? Date.now());
    };
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          setAnswer((prev) => `${prev}${event.results[i][0].transcript} `);
        }
      }
    };
    recognition.onerror = (event) => {
      setIsRecording(false);
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast({
          title: 'Microphone problem',
          description:
            event.error === 'not-allowed'
              ? 'Permission denied. Switch to typing, or allow the microphone.'
              : `Speech recognition error: ${event.error}`,
          variant: 'error',
        });
      }
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.onend = null;
      recognition.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    stopSpeaking();
    setIsSpeaking(false);
    try {
      recognitionRef.current?.start();
    } catch {
      // start() throws if already running; onend resyncs the flag
    }
  };

  /* ------------------------------ advance ------------------------------ */
  const advance = async (skipped = false) => {
    const text = skipped ? '(The candidate skipped this question.)' : answer.trim();
    if (!skipped && !text) return;

    if (isRecording) recognitionRef.current?.stop();
    stopSpeaking();
    setIsSubmitting(true);

    const completedTurn = {
      q: question,
      a: text,
      mode: inputMode,
      wpm,
      fillerCount: fillers.total,
      seconds: Math.floor((Date.now() - questionStart) / 1000),
      skipped,
    };
    const updatedHistory = [...history, completedTurn];

    try {
      if (turn < totalQuestions) {
        const { data } = await api.post('/next-question', {
          profile,
          history: updatedHistory,
          currentAnswer: text,
          wpm,
          isVoice: inputMode === 'voice',
          fillerCount: fillers.total,
        });

        setHistory(updatedHistory);
        setAiReaction(data.reaction || '');
        setQuestion(data.question);
        setAnswer('');
        setTurn((t) => t + 1);
        setRecordingStart(null);
        setQuestionStart(Date.now());
        say(`${data.reaction ?? ''} ${data.question}`);
      } else {
        setIsAnalysing(true);
        const { data } = await api.post('/analyze-interview', { profile, history: updatedHistory });
        clearInterview();
        saveResults({ results: data, profile, history: updatedHistory });
        navigate('/results', { state: { results: data, profile, history: updatedHistory } });
      }
    } catch (err) {
      setIsAnalysing(false);
      toast({
        title: turn < totalQuestions ? 'Could not get the next question' : 'Analysis failed',
        description: errorMessage(err),
        variant: 'error',
        action: { label: 'Try again', onClick: () => advance(skipped) },
        duration: 12000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------------------- loading views ---------------------------- */
  if (isAnalysing) {
    return (
      <div className="band mx-auto max-w-[40ch] text-center">
        <p className="eyebrow">Interview complete</p>
        <h1 className="t-lg mt-4">Reading it back.</h1>
        <p className="t-body mt-4 text-ink-soft">
          Scoring all {totalQuestions} answers and rewriting each one in your own words.
        </p>
        <div className="mx-auto mt-10 h-px w-40 overflow-hidden bg-rule">
          <div className="h-px w-1/3 bg-accent" style={{ animation: 'slide 1.4s ease-in-out infinite' }} />
        </div>
        <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="band mx-auto max-w-[40ch] text-center">
        <p className="eyebrow">Preparing</p>
        <h1 className="t-lg mt-4">Writing your first question.</h1>
        <p className="t-body mt-4 text-ink-soft">
          Tailored to {profile?.targetRole || 'your profile'}.
        </p>
      </div>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="mx-auto max-w-[52rem] pb-24">
      {/* Progress */}
      <div className="mb-8 flex items-center justify-between gap-6">
        <div className="flex flex-1 items-center gap-4">
          <span className="mono t-foot shrink-0">
            {String(turn).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
          </span>
          <div className="flex flex-1 gap-1">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <span
                key={i}
                className="h-px flex-1 transition-colors duration-[.32s]"
                style={{
                  background:
                    i < turn - 1 ? 'var(--accent)' : i === turn - 1 ? 'var(--ink-mute)' : 'var(--rule)',
                }}
              />
            ))}
          </div>
        </div>
        <span className="mono t-foot shrink-0">{mm}:{ss}</span>
      </div>

      {/* Reaction — the interviewer's own voice, set apart */}
      {aiReaction && (
        <p key={aiReaction} className="rise warn t-body mb-7 max-w-[54ch] text-ink-soft">
          {aiReaction}
        </p>
      )}

      {/* Question */}
      <div className="flex items-start gap-5">
        <h1 key={question} className="rise t-xl flex-1 max-w-[24ch]">
          {question}
        </h1>
        <div className="flex shrink-0 gap-1 pt-2">
          <button
            onClick={() => { if (!muted) stopSpeaking(); setMuted((m) => !m); }}
            aria-label={muted ? 'Unmute interviewer' : 'Mute interviewer'}
            className={`grid h-9 w-9 place-items-center rounded-[var(--radius-compact)] transition-colors duration-[.32s] ${muted ? 'text-ink-mute' : 'text-ink'}`}
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 7.5h2.5L10 4.5v11L6.5 12.5H4z" />
              {muted ? <path d="M13 8l4 4M17 8l-4 4" /> : <path d="M13 7.5a3.5 3.5 0 0 1 0 5" className={isSpeaking ? 'animate-pulse' : ''} />}
            </svg>
          </button>
          <button
            onClick={() => say(`${aiReaction ? `${aiReaction} ` : ''}${question}`)}
            disabled={muted}
            aria-label="Read the question aloud"
            className="grid h-9 w-9 place-items-center rounded-[var(--radius-compact)] text-ink-mute transition-colors duration-[.32s] hover:text-ink disabled:opacity-30"
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 7v6M10 4.5v11M14 8v4" />
            </svg>
          </button>
        </div>
      </div>

      {showStar && (
        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2">
          {STAR.map(([k, v]) => (
            <span key={k} className="t-foot">
              <span className="font-semibold text-ink-soft">{k}</span> — {v}
            </span>
          ))}
        </div>
      )}

      {/* Mode */}
      <div className="mt-9 flex gap-2">
        {[['text', 'Type'], ['voice', 'Speak']].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => {
              if (mode === 'text' && isRecording) recognitionRef.current?.stop();
              setInputMode(mode);
            }}
            className={`chip ${inputMode === mode ? 'chip-on' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Answer */}
      <div className="mt-4">
        {inputMode === 'text' ? (
          <textarea
            className="field h-56 resize-none"
            placeholder="Where were you, what was on you, what you did, what it moved."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={isSubmitting}
            aria-label="Your answer"
          />
        ) : (
          <div className="rounded-[var(--radius-media)] border border-rule-strong px-6 py-8 text-center">
            <button
              onClick={toggleRecording}
              disabled={isSubmitting}
              className={`grid h-20 w-20 place-items-center rounded-full transition-[background-color,transform] duration-[.32s] ${
                isRecording ? 'scale-105 bg-burgundy text-ground' : 'bg-accent text-white'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? (
                <span className="h-5 w-5 rounded-[3px] bg-current" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              )}
            </button>

            <div className="mt-6"><Waveform levels={levels} active={isRecording} /></div>

            <p className="t-reduced mt-2 text-ink-mute" role="status" aria-live="polite">
              {isRecording ? 'Listening — tap to stop' : answer ? 'Tap to continue' : 'Tap to answer'}
            </p>

            {answer && (
              <p className="t-body mt-6 max-h-28 overflow-y-auto text-left text-ink-soft">{answer}</p>
            )}
          </div>
        )}
      </div>

      {/* Live meters */}
      <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-2">
        <Meter label="Words" value={words} />
        {inputMode === 'voice' && (
          <Meter label="Pace" value={wpm ? `${wpm} · ${pace.label}` : '—'} tone={pace.tone} />
        )}
        <Meter
          label="Fillers"
          value={fillers.total}
          tone={fillers.total > 4 ? 'caution' : fillers.total > 0 ? 'muted' : 'positive'}
        />
        {fillers.breakdown.length > 0 && (
          <span className="t-foot">mostly “{fillers.breakdown[0].word}”</span>
        )}
        {answer && (
          <button
            onClick={() => { recognitionRef.current?.stop(); setAnswer(''); setRecordingStart(null); }}
            className="t-foot ml-auto underline underline-offset-2 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="ruled-top mt-9 flex items-center justify-between gap-4 pt-7">
        <button onClick={() => advance(true)} disabled={isSubmitting} className="t-reduced text-ink-mute underline underline-offset-2 hover:text-ink disabled:opacity-30">
          Skip this one
        </button>
        <button
          onClick={() => advance(false)}
          disabled={!answer.trim() || isSubmitting || isRecording}
          className="btn btn-fill"
        >
          {isSubmitting
            ? 'Thinking…'
            : turn < totalQuestions
              ? 'Submit answer'
              : 'Finish and score'}
        </button>
      </div>

      {/* What has been asked so far — collapsed, so the page stays one question */}
      {history.length > 0 && (
        <div className="ruled-top mt-10 pt-6">
          <button
            onClick={() => setShowTranscript((s) => !s)}
            className="t-foot underline underline-offset-2 hover:text-ink"
            aria-expanded={showTranscript}
          >
            {showTranscript ? 'Hide' : 'Show'} the {history.length} answer{history.length > 1 ? 's' : ''} so far
          </button>

          {showTranscript && (
            <div className="mt-6 space-y-7">
              {history.map((h, i) => (
                <div key={i} className="grid gap-x-8 gap-y-2 md:grid-cols-[2.5rem_1fr]">
                  <span className="mono t-foot">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="t-reduced font-semibold text-ink">{h.q}</p>
                    <p className="t-reduced mt-2 text-ink-mute">{h.a}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
