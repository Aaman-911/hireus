import { Link, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTheme } from '../../lib/context';

const NAV = [
  { to: '/onboarding', label: 'Practice' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/network', label: 'Network' },
  { to: '/clients', label: 'Clients' },
];

function ThemeToggle({ onStage }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-compact)] transition-colors duration-[.32s] ${
        onStage
          ? 'text-[rgb(245_245_247/0.55)] hover:text-[#f5f5f7]'
          : 'text-ink-mute hover:text-ink'
      }`}
    >
      {/* Two complete marks that cross-fade.
          The previous version drew one circle and punched a crescent out of it
          with a path filled in the page background colour. That failed twice:
          the cutout was larger than the circle it bit into, so only a thin
          sliver survived, and a background-coloured patch is not a hole — it
          showed as a solid blob over the glass nav and the dark hero. */}
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
        {/* Sun */}
        <g
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(-45deg) scale(.7)' : 'none',
            transformOrigin: 'center',
            transition:
              'opacity .32s cubic-bezier(.4,0,.6,1), transform .3s cubic-bezier(0,0,.5,1)',
          }}
        >
          <circle cx="10" cy="10" r="3.7" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 1.6v1.6M10 16.8v1.6M18.4 10h-1.6M3.2 10H1.6M15.9 4.1l-1.1 1.1M5.2 14.8l-1.1 1.1M15.9 15.9l-1.1-1.1M5.2 5.2L4.1 4.1" />
          </g>
        </g>

        {/* Moon — one filled crescent, so it needs no background colour */}
        <path
          d="M10 2.5a5 5 0 0 0 7.5 7.5 7.5 7.5 0 1 1-7.5-7.5Z"
          fill="currentColor"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark ? 'none' : 'rotate(45deg) scale(.7)',
            transformOrigin: 'center',
            transition:
              'opacity .32s cubic-bezier(.4,0,.6,1), transform .3s cubic-bezier(0,0,.5,1)',
          }}
        />
      </svg>
    </button>
  );
}

export default function Shell({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isLanding = location.pathname === '/';
  // Keyed on the route so a navigation resets it without an effect writing
  // state during render.
  const [overStageByPath, setOverStageByPath] = useState({});
  const overStage = overStageByPath[location.pathname] ?? isLanding;

  // The nav only earns its hairline and blur once you have left the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * A page with dark stage bands marks where they end with
   * `[data-stage-end]`. While that marker is still below the nav, whatever is
   * behind the bar is black, so the bar has to invert — otherwise a white
   * glass strip sits on top of the film.
   */
  useEffect(() => {
    if (!isLanding) return undefined;

    const sentinel = document.querySelector('[data-stage-end]');
    if (!sentinel) return undefined;

    const path = location.pathname;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setOverStageByPath((prev) => ({
          ...prev,
          [path]: entry.boundingClientRect.top > 44,
        })),
      { rootMargin: '-44px 0px 0px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLanding, location.pathname]);

  const onStage = overStage;

  return (
    <div className="min-h-screen">
      <header
        data-on-stage={onStage || undefined}
        className={`sticky top-0 z-50 no-print transition-[background-color,border-color] duration-[.32s] ${
          !scrolled
            ? 'border-b border-transparent bg-transparent'
            : onStage
              ? 'border-b border-[rgb(255_255_255/0.12)] bg-[rgb(0_0_0/0.62)] backdrop-blur-xl backdrop-saturate-150'
              : 'glass border-b border-rule'
        }`}
      >
        <div className="wrap flex h-11 items-center justify-between gap-6">
          <Link
            to="/"
            className={`shrink-0 text-[17px] font-semibold tracking-[-.018em] ${
              onStage ? 'text-[#f5f5f7]' : 'text-ink'
            }`}
          >
            Hire<span style={{ color: onStage ? '#3ddc97' : 'var(--accent-ink)' }}>US</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-[var(--radius-compact)] px-3 py-1.5 text-[13px] tracking-[-.01em] transition-colors duration-[.32s] ${
                    onStage
                      ? isActive
                        ? 'text-[#f5f5f7]'
                        : 'text-[rgb(245_245_247/0.55)] hover:text-[#f5f5f7]'
                      : isActive
                        ? 'text-ink'
                        : 'text-ink-mute hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle onStage={onStage} />
            <Link
              to="/onboarding"
              className={`btn btn-fill btn-sm hidden sm:inline-flex ${onStage ? 'btn-on-stage' : ''}`}
            >
              Start
            </Link>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Navigation"
              aria-expanded={menuOpen}
              className={`grid h-9 w-9 place-items-center rounded-[var(--radius-compact)] md:hidden ${
                onStage ? 'text-[#f5f5f7]' : 'text-ink'
              }`}
            >
              <svg viewBox="0 0 18 18" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {menuOpen ? <path d="M4 4l10 10M14 4L4 14" /> : <path d="M2.5 6h13M2.5 12h13" />}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="wrap border-t border-rule bg-ground py-2 md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-[17px] tracking-[-.014em] text-ink"
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className={isLanding ? '' : 'wrap band-tight'}>{children}</main>

      {!isLanding && (
        <footer className="wrap ruled-top band-tight no-print">
          <p className="t-foot">Aman Dixit · CSE 3rd Year · MITS Gwalior</p>
        </footer>
      )}
    </div>
  );
}
