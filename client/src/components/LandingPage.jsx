import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useReveal } from '../lib/useReveal';
import ProductShot from './ui/ProductShot';
import {
  InterviewFigure, ReportFigure, FollowThroughFigure,
} from './ui/ChapterFigure';

/* Three chapters, not nine. Each names one thing this does that a mock
   interviewer alone does not. Eyebrow → headline → one paragraph → link. */
const CHAPTERS = [
  {
    n: '01',
    eyebrow: 'The interview',
    headline: 'It listens back.',
    body: 'Questions are built from your role and your years, and each one follows from what you just said. Claim you improved something and it will ask by how much. Pace and filler words are counted while you speak.',
    to: '/onboarding',
    cta: 'Start an interview',
    Figure: InterviewFigure,
  },
  {
    n: '02',
    eyebrow: 'The report',
    headline: 'Your answer, rewritten.',
    body: 'Four scored dimensions, and for every question the thing that actually helps — your own answer handed back stronger, keeping your example, with brackets where a number should go.',
    to: '/onboarding',
    cta: 'See how it scores',
    Figure: ReportFigure,
  },
  {
    n: '03',
    eyebrow: 'The follow-through',
    headline: 'Someone to send it to.',
    body: 'Five job boards in one search, stale and untranslated listings dropped, ranked against your profile. Then the addresses employers published this month so that candidates would write to them.',
    to: '/jobs',
    cta: 'Browse openings',
    Figure: FollowThroughFigure,
  },
];

const STATS = [
  ['5', 'job boards, one search'],
  ['20%', 'of hiring posts carry a direct address'],
  ['0', 'accounts, sign-ups or sends'],
];

export default function LandingPage() {
  const chaptersRef = useReveal();
  const statsRef = useReveal({ stagger: 0.12 });
  const [pillVisible, setPillVisible] = useState(false);

  // The pill stays out of the way until you have left the hero.
  useEffect(() => {
    const onScroll = () => setPillVisible(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ═══════════════════ STAGE — the marquee ═══════════════════ */}
      <section className="stage relative overflow-hidden">
        <div className="wrap-wide flex min-h-[clamp(620px,100svh,900px)] flex-col justify-center pb-[clamp(56px,7vw,88px)] pt-[clamp(88px,12vw,140px)]">
          <div className="mx-auto max-w-[62rem] text-center">
            <p className="eyebrow rise">Mock interviewer</p>

            <h1 className="t-marquee rise d1 mx-auto mt-6 max-w-[13ch]">
              Practice out loud.
            </h1>

            <p className="t-intro on-stage-soft rise d2 mx-auto mt-7 max-w-[44ch]">
              HireUS interviews you for the role you want, scores how you actually
              delivered it, then finds the people hiring.
            </p>

            <div className="rise d3 mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
              <Link to="/onboarding" className="btn btn-fill btn-on-stage">
                Start an interview
              </Link>
              <Link to="/jobs" className="btn-text btn-text-on-stage">
                Just browse jobs
              </Link>
            </div>

            <p className="mono on-stage-mute rise d4 mt-7 text-[12px]">
              No account · Speech works best in Chrome
            </p>
          </div>

          {/* The product, lit against nothing. */}
          <div className="rise d5 mx-auto mt-[clamp(48px,6vw,80px)] w-full max-w-[72rem]">
            <ProductShot />
          </div>
        </div>
      </section>

      {/* ═════════ RAISED — one step up, so the seam is visible ═════════ */}
      <section className="stage-raised">
        <div className="wrap band">
          <div ref={statsRef} className="grid gap-x-16 gap-y-12 sm:grid-cols-3">
            {STATS.map(([figure, label]) => (
              <div key={label}>
                <p className="mono text-[clamp(40px,5vw,60px)] font-semibold leading-none tracking-[-.028em] text-[#f5f5f7]">
                  {figure}
                </p>
                <p className="on-stage-mute mt-4 max-w-[22ch] text-[14px] leading-relaxed">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE CUT — the film is over, the explaining starts here ═══ */}
      {/* Marks where the dark bands stop, so the nav knows to stop inverting. */}
      <div data-stage-end aria-hidden="true" />

      <div ref={chaptersRef} className="bg-ground">
        {CHAPTERS.map(({ Figure, ...c }, i) => (
          <section key={c.n} className="ruled-bottom band">
            <div className="wrap grid items-center gap-x-16 gap-y-12 lg:grid-cols-2">
              {/* Alternating sides, so three chapters do not read as a list. */}
              <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                <div className="grid gap-x-10 md:grid-cols-[4rem_1fr]">
                  <span className="mono t-foot hidden pt-2 md:block">{c.n}</span>
                  <div>
                    <p className="eyebrow">{c.eyebrow}</p>
                    <h2 className="t-lg mt-5">{c.headline}</h2>
                    <p className="t-body mt-6 max-w-[42ch] text-ink-soft">{c.body}</p>
                    <Link to={c.to} className="btn-text mt-4">
                      {c.cta}
                    </Link>
                  </div>
                </div>
              </div>

              <div className={i % 2 === 1 ? 'lg:order-1' : ''} aria-hidden="true">
                <Figure />
              </div>
            </div>
          </section>
        ))}

        {/* The honest note about contact data */}
        <section className="ruled-bottom band">
          <div className="wrap grid gap-x-12 gap-y-6 md:grid-cols-[4rem_1fr]">
            <span className="mono t-foot pt-2">04</span>
            <div className="max-w-[46rem]">
              <p className="eyebrow">Contact data</p>
              <h2 className="t-lg mt-5">Published, not scraped.</h2>
              <p className="t-body mt-6 max-w-[56ch] text-ink-soft">
                Every address here was put somewhere public so that it would be used —
                an employer posting in a hiring thread, a developer filling in their own
                profile. Nothing is guessed from a name pattern, bought from a broker, or
                taken from LinkedIn. It is a shorter list than the paid tools return, and
                you can write to all of it.
              </p>
              <Link to="/network" className="btn-text mt-4">
                See the sources
              </Link>
            </div>
          </div>
        </section>

        {/* Close */}
        <section className="band">
          <div className="wrap">
            <h2 className="t-xl max-w-[15ch]">Find out how you sound.</h2>
            <p className="t-intro mt-6 max-w-[40ch]">
              Five questions. Ten minutes. A report you can act on.
            </p>
            <Link to="/onboarding" className="btn btn-fill mt-9">
              Start an interview
            </Link>
          </div>
        </section>

        <footer className="wrap ruled-top band-tight">
          <p className="t-foot">Aman Dixit · CSE 3rd Year · MITS Gwalior</p>
        </footer>
      </div>

      {/* The commercial spine. Everything above is allowed to be a film
          because this never leaves. */}
      <div
        className={`sticky-pill no-print ${pillVisible ? '' : 'sticky-pill-hidden'}`}
        aria-hidden={!pillVisible}
      >
        <span className="hidden sm:inline">Free · 5 questions · about 10 minutes</span>
        <span className="sm:hidden">Free · 10 minutes</span>
        <Link
          to="/onboarding"
          tabIndex={pillVisible ? 0 : -1}
          className="rounded-[var(--radius-compact)] px-4 py-2 text-[14px] text-white transition-[background-color] duration-[.32s]"
          style={{ background: 'var(--color-accent)' }}
        >
          Start
        </Link>
      </div>
    </>
  );
}
