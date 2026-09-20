/**
 * The source system's first law is that the product is the only image — 183
 * photographs of one object, lit differently. There is no object to photograph
 * here, so the interface itself is the subject: the live interview on the left,
 * the report it produces on the right, rendered at rest against the stage.
 *
 * Deliberately not interactive. It is a photograph of the product, not the
 * product, and it carries no real data.
 */

const BARS = [0.3, 0.55, 0.85, 1, 0.7, 0.45, 0.75, 0.95, 0.6, 0.35, 0.5, 0.8, 1, 0.65, 0.4, 0.28];

const DIMENSIONS = [
  ['Communication clarity', 86],
  ['Confidence', 74],
  ['Role knowledge', 88],
  ['Fluency', 79],
];

export default function ProductShot() {
  return (
    <div className="shot shot-glow grid gap-px overflow-hidden lg:grid-cols-[1.05fr_1fr]"
         style={{ background: 'rgb(255 255 255 / 0.07)' }}>

      {/* ── The interview, mid-answer ─────────────────────────── */}
      <div className="bg-[#141417] p-7 sm:p-9">
        <div className="flex items-center justify-between">
          <span className="mono text-[11px] tracking-[0.04em] text-[rgb(245_245_247/0.45)]">
            03 / 05
          </span>
          <span className="mono text-[11px] text-[rgb(245_245_247/0.45)]">01:24</span>
        </div>

        <div className="mt-3 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-px flex-1"
              style={{
                background:
                  i < 2 ? 'var(--color-accent)'
                    : i === 2 ? 'rgb(245 245 247 / 0.45)'
                      : 'rgb(255 255 255 / 0.14)',
              }}
            />
          ))}
        </div>

        <p
          className="mt-8 border-l-2 pl-4 text-[14px] leading-relaxed text-[rgb(245_245_247/0.52)]"
          style={{ borderColor: 'var(--color-accent)' }}
        >
          You said the dashboard got faster. How much faster, and measured how?
        </p>

        <h3 className="mt-6 text-[clamp(19px,2vw,25px)] font-semibold leading-[1.22] tracking-[-.018em] text-[#f5f5f7]">
          Walk me through the trade-off you made to get there.
        </h3>

        {/* Live waveform — the only moving thing in the shot */}
        <div className="mt-9 flex h-14 items-center justify-center gap-[3px]" aria-hidden="true">
          {BARS.map((h, i) => (
            <span
              key={i}
              className="bar-live w-[3px] rounded-full"
              style={{
                height: `${Math.max(4, h * 48)}px`,
                background: 'var(--color-accent)',
                opacity: 0.35 + h * 0.65,
                animationDelay: `${i * 0.075}s`,
              }}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 border-t border-[rgb(255_255_255/0.10)] pt-5">
          {[['Words', '84'], ['Pace', '138 · Ideal'], ['Fillers', '1']].map(([k, v]) => (
            <span key={k} className="flex items-baseline gap-2">
              <span className="text-[11px] text-[rgb(245_245_247/0.45)]">{k}</span>
              <span className="mono text-[13px] font-medium text-[#f5f5f7]">{v}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── The report it produces ───────────────────────────── */}
      <div className="bg-[#1a1a1e] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(245_245_247/0.45)]">
          Session report
        </p>

        <div className="mt-5 flex items-end gap-4">
          <span className="mono text-[clamp(46px,6vw,68px)] font-semibold leading-[0.9] tracking-[-.03em] text-[#f5f5f7]">
            82
          </span>
          <span className="mono pb-2 text-[11px] text-[rgb(245_245_247/0.45)]">out of 100</span>
        </div>

        <p className="mt-5 text-[14px] leading-relaxed text-[rgb(245_245_247/0.72)]">
          Good stories — none of them have a number in them.
        </p>

        <div className="mt-8 space-y-4">
          {DIMENSIONS.map(([label, value], i) => (
            <div key={label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-[rgb(245_245_247/0.72)]">{label}</span>
                <span className="mono text-[12px] text-[#f5f5f7]">{value}</span>
              </div>
              <div className="h-px w-full bg-[rgb(255_255_255/0.14)]">
                <div
                  className="rule-draw h-px"
                  style={{
                    width: `${value}%`,
                    background: 'var(--color-accent)',
                    animationDelay: `${0.5 + i * 0.13}s`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-[rgb(255_255_255/0.10)] pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]"
             style={{ color: 'var(--color-accent-ink)' }}>
            Say it like this
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-[rgb(245_245_247/0.72)]">
            “We cut dashboard load from 4s to under 1s. I added optimistic
            updates and split the bundle, which took [X]% off first paint…”
          </p>
        </div>
      </div>
    </div>
  );
}
