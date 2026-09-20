/**
 * One rendered detail per chapter, so a chapter is a lockup rather than a
 * paragraph in an empty column. Same principle as the hero: with nothing to
 * photograph, the interface is the subject.
 *
 * These carry no live data and take no input — they are stills.
 */

const WAVE = [0.35, 0.7, 1, 0.55, 0.85, 0.4, 0.95, 0.6, 0.3, 0.75, 1, 0.45];

function Frame({ children, label }) {
  return (
    <figure className="tile overflow-hidden">
      {label && (
        <figcaption className="eyebrow border-b border-rule px-6 py-3.5">{label}</figcaption>
      )}
      <div className="p-6">{children}</div>
    </figure>
  );
}

/** 01 — the interview probing a vague claim. */
export function InterviewFigure() {
  return (
    <Frame label="Question 3 of 5">
      <p
        className="border-l-2 pl-4 text-[13px] leading-relaxed text-ink-mute"
        style={{ borderColor: 'var(--accent)' }}
      >
        You said the dashboard got faster. How much faster, and measured how?
      </p>

      <h4 className="mt-5 text-[19px] font-semibold leading-[1.25] tracking-[-.016em]">
        Walk me through the trade-off you made to get there.
      </h4>

      <div className="mt-7 flex h-10 items-center justify-center gap-[3px]" aria-hidden="true">
        {WAVE.map((h, i) => (
          <span
            key={i}
            className="bar-live w-[3px] rounded-full"
            style={{
              height: `${Math.max(4, h * 36)}px`,
              background: 'var(--accent)',
              opacity: 0.4 + h * 0.6,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-4">
        {[['Words', '84'], ['Pace', '138 · Ideal'], ['Fillers', '1']].map(([k, v]) => (
          <span key={k} className="flex items-baseline gap-2">
            <span className="t-foot">{k}</span>
            <span className="mono text-[13px] font-medium text-ink">{v}</span>
          </span>
        ))}
      </div>
    </Frame>
  );
}

/** 02 — what you said, next to what you should have said. */
export function ReportFigure() {
  return (
    <Frame label="Question 1 · scored 62">
      <p className="eyebrow">You said</p>
      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-mute">
        “I built a React dashboard and made it a lot faster by adding caching
        and splitting the code.”
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {['no measurable outcome', 'no personal contribution'].map((m) => (
          <span key={m} className="t-foot" style={{ color: 'var(--burgundy)' }}>
            — {m}
          </span>
        ))}
      </div>

      <div className="mt-6 border-t border-rule pt-5">
        <p className="eyebrow" style={{ color: 'var(--accent-ink)' }}>
          Say it like this
        </p>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">
          “We cut dashboard load from 4s to under 1s. I added optimistic updates
          so the UI stopped waiting on a slow API, then split the bundle, which
          took [X]% off first paint.”
        </p>
      </div>
    </Frame>
  );
}

/** 03 — a ranked opening and a published address. */
export function FollowThroughFigure() {
  return (
    <Frame label="After the interview">
      <div className="ruled-bottom pb-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold tracking-[-.012em]">Frontend Developer</p>
          <span className="mono text-[12px]" style={{ color: 'var(--accent-ink)' }}>
            95%
          </span>
        </div>
        <p className="t-reduced mt-1 text-ink-soft">
          NCR Voyix <span className="text-ink-mute">· Bangalore · 2d ago</span>
        </p>
        <p className="t-foot mt-3">
          <span style={{ color: 'var(--accent-ink)' }}>You have</span>{' '}
          <span className="mono">react, typescript</span>
          <span className="text-ink-mute"> · They also want </span>
          <span className="mono">graphql</span>
        </p>
      </div>

      <div className="pt-5">
        <p className="text-[15px] font-semibold tracking-[-.012em]">Neuralwatt</p>
        <p className="t-reduced mt-1 text-ink-soft">Senior Frontend · Remote</p>
        <p className="mono mt-3 text-[13px]" style={{ color: 'var(--accent-ink)' }}>
          hiring@neuralwatt.com
        </p>
        <p className="t-foot mt-1.5">Published in this month’s hiring thread</p>
      </div>
    </Frame>
  );
}
