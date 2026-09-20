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
      {/* A sun and a moon drawn as one mark, so the swap is a fill change
          rather than two icons crossfading. */}
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
        <circle
          cx="10" cy="10" r={isDark ? 4.2 : 3.6}
          fill="currentColor"
          style={{ transition: 'r .32s cubic-bezier(.4,0,.6,1)' }}
        />
        <g
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(35deg) scale(.6)' : 'none',
            transformOrigin: 'center',
            transition: 'opacity .32s cubic-bezier(.4,0,.6,1), transform .3s cubic-bezier(0,0,.5,1)',
          }}
        >
          <path d="M10 1.4v1.7M10 16.9v1.7M18.6 10h-1.7M3.1 10H1.4M16.1 3.9l-1.2 1.2M5.1 14.9l-1.2 1.2M16.1 16.1l-1.2-1.2M5.1 5.1L3.9 3.9" />
        </g>
        <path
          d="M14.5 11.2A5.2 5.2 0 0 1 8.8 5.5a5.4 5.4 0 1 0 5.7 5.7Z"
          fill={onStage ? '#000' : 'var(--ground)'}
          style={{
            opacity: isDark ? 1 : 0,
            transition: 'opacity .32s cubic-bezier(.4,0,.6,1)',
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
