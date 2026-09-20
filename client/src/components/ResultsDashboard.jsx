import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import JobRecommendations from './JobRecommendations';
import { useCountUp } from '../lib/useCountUp';
import { loadResults } from '../lib/session';
import { useReveal } from '../lib/useReveal';

const METRICS = [
  ['communicationClarity', 'Communication clarity'],
  ['confidence', 'Confidence'],
  ['roleKnowledge', 'Role & domain knowledge'],
  ['fluency', 'Fluency & articulation'],
];

function Metric({ label, value, delay }) {
  const n = useCountUp(value, { duration: 1100, delay });
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <span className="t-reduced text-ink-soft">{label}</span>
        <span className="mono text-[13px] font-medium text-ink">{n}</span>
      </div>
      <div className="h-px w-full bg-rule">
        <div className="h-px bg-accent" style={{ width: `${n}%` }} />
      </div>
    </div>
  );
}

/**
 * One question. The rewrite is the point of the whole report — the candidate's
 * own answer returned to them stronger — so it is what opens by default.
 */
function Entry({ qa, turn, index }) {
  const [open, setOpen] = useState(index === 0);
  const score = qa.score ?? null;

  return (
    <article className="ruled-bottom py-7">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full gap-x-8 gap-y-3 text-left md:grid-cols-[2.5rem_1fr_auto]"
      >
        <span className="mono t-foot pt-1">{String(index + 1).padStart(2, '0')}</span>
        <span className="min-w-0">
          <span className="t-sm block">{qa.question}</span>
          {turn && (
            <span className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
              {turn.mode === 'voice' && turn.wpm > 0 && (
                <span className="t-foot mono">{turn.wpm} wpm</span>
              )}
              {turn.seconds > 0 && <span className="t-foot mono">{turn.seconds}s</span>}
              {turn.fillerCount > 0 && <span className="t-foot mono">{turn.fillerCount} fillers</span>}
              {turn.skipped && <span className="t-foot text-burgundy">Skipped</span>}
            </span>
          )}
        </span>
        <span className="mono self-start text-[21px] font-semibold tracking-[-.01em] text-ink md:pt-0.5">
          {score ?? '—'}
        </span>
      </button>

      {open && (
        <div className="rise mt-7 grid gap-x-8 gap-y-8 md:grid-cols-[2.5rem_1fr]">
          <span />
          <div className="space-y-8">
            {qa.verdict && <p className="t-body max-w-[58ch] text-ink-soft">{qa.verdict}</p>}

            {qa.missing?.length > 0 && (
              <div>
                <p className="eyebrow mb-3">What was missing</p>
                <ul className="space-y-1.5">
                  {qa.missing.map((m) => (
                    <li key={m} className="t-reduced text-burgundy">{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="eyebrow mb-3">You said</p>
                <p className="t-reduced leading-relaxed text-ink-mute">
                  {turn?.a || 'Not recorded.'}
                </p>
              </div>

              {qa.rewrite && (
                <div className="tile p-6">
                  <p className="eyebrow mb-3" style={{ color: 'var(--accent-ink)' }}>
                    Say it like this
                  </p>
                  <p className="t-body leading-relaxed text-ink">{qa.rewrite}</p>
                  {qa.idealAnswer && (
                    <p className="t-foot mt-5 border-t border-rule pt-4">{qa.idealAnswer}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ResultsDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const listRef = useReveal({ stagger: 0.1 });

  const state = location.state?.results ? location.state : loadResults() || {};
  const { results, profile, history = [] } = state;

  const score = useCountUp(results?.overallScore ?? 0, { duration: 1500 });

  if (!results) {
    return (
      <div className="band mx-auto max-w-[40ch]">
        <p className="eyebrow">No report</p>
        <h1 className="t-lg mt-4">Nothing to show yet.</h1>
        <p className="t-body mt-4 text-ink-soft">Finish an interview and the report appears here.</p>
        <button onClick={() => navigate('/onboarding')} className="btn btn-fill mt-8">
          Start an interview
        </button>
      </div>
    );
  }

  const {
    headline, performanceSummary, metrics = {},
    strengths = [], weaknesses = [], improvements = [],
    behavioralInsight, detailedQnA = [], inferredSkills = [],
  } = results;

  return (
    <div className="pb-16">
      {/* Marquee — the score is the headline */}
      <section className="ruled-bottom pb-[clamp(48px,7vw,88px)]">
        <p className="eyebrow">
          {profile?.interviewType || 'Behavioural'} interview
          {profile?.targetRole ? ` · ${profile.targetRole}` : ''}
        </p>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <div className="min-w-0 flex-1">
            <h1 className="t-display">{score}</h1>
            <p className="t-foot mono mt-2">out of 100</p>
          </div>
          {headline && (
            <p className="t-xl max-w-[16ch] text-ink-soft">{headline}</p>
          )}
        </div>

        <p className="t-intro mt-9 max-w-[60ch]">{performanceSummary}</p>

        <div className="no-print mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/onboarding" className="btn btn-fill">Run it again</Link>
          <button onClick={() => window.print()} className="btn-text">Save as PDF</button>
        </div>
      </section>

      {/* Dimensions */}
      <section className="ruled-bottom band-tight">
        <div className="grid gap-x-16 gap-y-7 md:grid-cols-2">
          {METRICS.map(([key, label], i) => (
            <Metric key={key} label={label} value={metrics[key] || 0} delay={250 + i * 110} />
          ))}
        </div>
      </section>

      {/* Strengths / weaknesses */}
      <section className="ruled-bottom band-tight grid gap-x-16 gap-y-10 md:grid-cols-2">
        <div>
          <p className="eyebrow">What worked</p>
          <ul className="mt-5 space-y-4">
            {strengths.length ? (
              strengths.map((s, i) => (
                <li key={i} className="t-body max-w-[46ch] text-ink-soft">{s}</li>
              ))
            ) : (
              <li className="t-body text-ink-mute">Nothing specific stood out.</li>
            )}
          </ul>
        </div>
        <div>
          <p className="eyebrow">What cost you</p>
          <ul className="mt-5 space-y-4">
            {weaknesses.length ? (
              weaknesses.map((w, i) => (
                <li key={i} className="warn t-body max-w-[46ch] text-ink-soft">{w}</li>
              ))
            ) : (
              <li className="t-body text-ink-mute">No major weaknesses detected.</li>
            )}
          </ul>
        </div>
      </section>

      {/* Drills */}
      {improvements.length > 0 && (
        <section className="ruled-bottom band-tight">
          <p className="eyebrow">Practise these</p>
          <div ref={listRef} className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-3">
            {improvements.map((s, i) => (
              <div key={i}>
                <span className="mono t-foot">{String(i + 1).padStart(2, '0')}</span>
                <p className="t-body mt-3 text-ink-soft">{s}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {behavioralInsight && (
        <section className="ruled-bottom band-tight">
          <p className="eyebrow">Under pressure</p>
          <p className="t-intro mt-5 max-w-[58ch]">{behavioralInsight}</p>
        </section>
      )}

      {/* Question by question */}
      {detailedQnA.length > 0 && (
        <section className="band-tight">
          <p className="eyebrow">Question by question</p>
          <h2 className="t-lg mt-4 max-w-[18ch]">Your answer, rewritten.</h2>
          <p className="t-body mt-4 max-w-[54ch] text-ink-soft">
            Each rewrite keeps your own example and your own details. Bracketed gaps are
            numbers only you can fill in.
          </p>

          <div className="mt-10 border-t border-rule">
            {detailedQnA.map((qa, i) => (
              <Entry key={i} qa={qa} turn={history[i]} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Next */}
      <section className="ruled-bottom band-tight no-print grid gap-x-16 gap-y-8 md:grid-cols-2">
        <div>
          <p className="eyebrow">Next</p>
          <h3 className="t-sm mt-3">Openings for this role.</h3>
          <Link to={`/jobs?role=${encodeURIComponent(profile?.targetRole || '')}`} className="btn-text mt-2">
            Search five boards
          </Link>
        </div>
        <div>
          <p className="eyebrow">Or</p>
          <h3 className="t-sm mt-3">People hiring right now.</h3>
          <Link to={`/network?field=${encodeURIComponent(profile?.targetRole || '')}`} className="btn-text mt-2">
            Find contacts
          </Link>
        </div>
      </section>

      <div className="no-print">
        <JobRecommendations profile={profile} results={results} skills={inferredSkills} />
      </div>
    </div>
  );
}
