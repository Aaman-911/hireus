import { useState, useCallback, useMemo } from 'react';
import { api, slowApi, errorMessage } from '../lib/api';
import { useToast } from '../lib/context';
import { loadProfile, saveProfile } from '../lib/session';

const EXAMPLES = [
  {
    label: 'AI ad creator',
    service: 'AI-generated video ads and product demo reels',
    targetClient: 'early-stage product and SaaS companies that just launched',
  },
  {
    label: 'Landing page designer',
    service: 'landing page design and conversion copy',
    targetClient: 'startups that just launched and are driving signups',
  },
  {
    label: 'Freelance developer',
    service: 'contract frontend development in React and TypeScript',
    targetClient: 'small product teams shipping a web app',
  },
  {
    label: 'Technical writer',
    service: 'developer documentation and API guides',
    targetClient: 'developer tool companies with a public API',
  },
];

const TONES = [
  ['shorter', 'Shorter'],
  ['warmer', 'Warmer'],
  ['direct', 'More direct'],
  ['formal', 'More formal'],
];

function mailto(lead, draft) {
  const to = lead.directEmail || '';
  return `mailto:${to}?subject=${encodeURIComponent(draft.subject || '')}&body=${encodeURIComponent(
    draft.body || ''
  )}`;
}

function Lead({ lead, index, onToast, sender }) {
  const [draft, setDraft] = useState(lead.draft || null);
  const [domain, setDomain] = useState(lead.domain || null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only the first few leads arrive with a draft; the rest are written when
  // the user picks one, so a search of several hundred stays affordable.
  const write = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/draft-email', { lead, ...sender });
      if (data.draft) setDraft(data.draft);
      if (data.domain) setDomain(data.domain);
    } catch (err) {
      onToast({ title: 'Could not draft', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const rewrite = async (tone) => {
    if (!draft) return;
    setBusy(true);
    try {
      const { data } = await api.post('/rewrite-email', {
        subject: draft.subject,
        body: draft.body,
        tone,
        context: `${lead.company} — ${lead.headline}`,
      });
      setDraft({ ...draft, ...data });
    } catch (err) {
      onToast({ title: 'Could not rewrite', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the text is on screen and selectable anyway
    }
  };

  return (
    <article className="ruled-bottom grid gap-x-10 gap-y-6 py-9 lg:grid-cols-[1fr_1.1fr]">
      {/* Who they are and why they might reply */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="mono t-foot">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="t-sm min-w-0 flex-1">{lead.company}</h3>
        </div>

        <p className="t-reduced mt-2 max-w-[46ch] text-ink-soft">{lead.headline}</p>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="flex items-baseline gap-2">
            <span className="t-foot">Likely to reply</span>
            <span
              className="mono text-[17px] font-semibold"
              style={{ color: lead.responsiveness >= 70 ? 'var(--accent-ink)' : 'var(--ink)' }}
            >
              {lead.responsiveness}%
            </span>
          </span>
          {lead.fit != null && (
            <span className="flex items-baseline gap-2">
              <span className="t-foot">Fit</span>
              <span className="mono text-[17px] font-semibold text-ink">{lead.fit}%</span>
            </span>
          )}
          {lead.kind !== 'brand' && lead.postedDaysAgo != null && (
            <span className="t-foot mono">{lead.postedDaysAgo}d ago</span>
          )}
        </div>

        {lead.fitReason && <p className="t-foot mt-3 max-w-[44ch]">{lead.fitReason}</p>}

        {lead.reasons?.length > 0 && (
          <ul className="mt-4 space-y-1">
            {lead.reasons.map((r) => (
              <li key={r} className="t-foot">— {r}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {lead.directEmail ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="mono t-foot" style={{ color: 'var(--accent-ink)' }}>
                {lead.directEmail}
              </span>
              <span className="t-foot">
                {lead.kind === 'brand' ? 'company inbox, unverified' : 'published by them'}
              </span>
            </span>
          ) : domain ? (
            <span className="mono t-foot" style={{ color: 'var(--accent-ink)' }}>
              hello@{domain}
            </span>
          ) : (
            <span className="t-foot">No published address yet</span>
          )}
          {lead.threadUrl && lead.kind !== 'brand' && (
            <a href={lead.threadUrl} target="_blank" rel="noopener noreferrer" className="t-foot underline underline-offset-2 hover:text-ink">
              Their post
            </a>
          )}
          {lead.kind === 'brand' && domain && (
            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="t-foot underline underline-offset-2 hover:text-ink">
              {domain}
            </a>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="t-foot underline underline-offset-2 hover:text-ink">
              Website
            </a>
          )}
        </div>
      </div>

      {/* The draft */}
      {draft ? (
        <div className="tile p-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="eyebrow">Draft</p>
            {draft.angle && <p className="t-foot">{draft.angle}</p>}
          </div>

          {editing ? (
            <div className="mt-4 space-y-3">
              <input
                className="field !bg-ground"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                aria-label="Email subject"
              />
              <textarea
                className="field !bg-ground h-44 resize-none"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                aria-label="Email body"
              />
            </div>
          ) : (
            <>
              <p className="t-reduced mt-4 font-semibold text-ink">{draft.subject}</p>
              <p className="t-body mt-3 whitespace-pre-line text-ink-soft">{draft.body}</p>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {TONES.map(([tone, label]) => (
              <button key={tone} onClick={() => rewrite(tone)} disabled={busy} className="chip disabled:opacity-40">
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-rule pt-5">
            <a
              href={mailto(lead, draft)}
              className="btn btn-fill btn-sm"
              onClick={() =>
                onToast({
                  title: 'Opening your mail app',
                  description: 'Read it over before you send.',
                  variant: 'info',
                  duration: 4000,
                })
              }
            >
              {lead.directEmail ? 'Open in mail' : 'Copy into a reply'}
            </a>
            <button onClick={copy} className="btn-text !min-h-0 text-[14px]">
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={() => setEditing((e) => !e)} className="btn-text !min-h-0 text-[14px]">
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="t-reduced text-ink-mute">
            No draft yet — written on request so a wide search stays cheap.
          </p>
          <button onClick={write} disabled={busy} className="btn btn-quiet btn-sm">
            {busy ? 'Writing…' : 'Write an email for this one'}
          </button>
        </div>
      )}
    </article>
  );
}

export default function ClientsPage() {
  const { toast } = useToast();
  const saved = loadProfile();

  const [form, setForm] = useState({
    service: saved?.service || '',
    targetClient: saved?.targetClient || '',
    region: saved?.region || '',
    name: saved?.name || '',
    portfolio: saved?.portfolio || '',
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shown, setShown] = useState(12);
  const [onlyEmail, setOnlyEmail] = useState(false);
  const [place, setPlace] = useState(null);

  // Filtering happens here rather than on the server, so narrowing a result
  // set of several hundred never costs another search.
  const allLeads = useMemo(() => result?.leads || [], [result]);

  const places = useMemo(() => {
    const counts = new Map();
    for (const l of allLeads) {
      const p = l.location;
      if (p) counts.set(p, (counts.get(p) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
  }, [allLeads]);

  const visibleLeads = useMemo(
    () =>
      allLeads.filter(
        (l) => (!onlyEmail || l.directEmail) && (!place || l.location === place)
      ),
    [allLeads, onlyEmail, place]
  );

  const find = useCallback(async () => {
    if (!form.service.trim() || !form.targetClient.trim()) {
      toast({ title: 'Fill in both fields', description: 'What you do, and who you want to reach.', variant: 'error' });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data } = await slowApi.post('/find-clients', { ...form, limit: 8 });
      setResult(data);
      setShown(12);
      setOnlyEmail(false);
      setPlace(null);
      saveProfile({ ...loadProfile(), ...form });
      if (!data.leads?.length) {
        toast({ title: 'No prospects this cycle', description: data.message, variant: 'info' });
      }
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast({
        title: 'Search failed',
        description: message,
        variant: 'error',
        action: { label: 'Retry', onClick: find },
      });
    } finally {
      setLoading(false);
    }
  }, [form, toast]);

  return (
    <div className="pb-16">
      <section className="ruled-bottom pb-[clamp(40px,6vw,72px)]">
        <p className="eyebrow">Cold outreach</p>
        <h1 className="t-xl mt-4 max-w-[15ch]">Find who needs you.</h1>
        <p className="t-intro mt-5 max-w-[48ch]">
          Describe what you sell and who buys it. HireUS finds companies that posted
          publicly in the last few weeks, ranks them by how likely they are to reply,
          and drafts a first message referencing their own work.
        </p>
      </section>

      {/* The honest boundary. This feature only works if it stays on the right
          side of it, so it is stated before the form, not buried after. */}
      <section className="ruled-bottom band-tight">
        <p className="warn t-reduced max-w-[62ch] text-ink-soft">
          <span className="font-semibold text-ink">Drafts, never sends.</span> Every
          prospect posted something public and recent that invites a reply. Messages open
          in your own mail app, one at a time, so you read and edit each one. HireUS has
          no send button, no mailing list, and no tracking pixel.
        </p>
      </section>

      {/* Brief */}
      <section className="ruled-bottom band-tight">
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="block">
            <span className="t-reduced mb-2 block font-semibold text-ink">What do you do?</span>
            <input
              className="field"
              placeholder="AI-generated video ads for products"
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
              aria-label="Your service"
            />
          </label>
          <label className="block">
            <span className="t-reduced mb-2 block font-semibold text-ink">Who do you want to reach?</span>
            <input
              className="field"
              placeholder="Product companies that just launched"
              value={form.targetClient}
              onChange={(e) => setForm({ ...form, targetClient: e.target.value })}
              aria-label="Your target client"
            />
          </label>
          <label className="block">
            <span className="t-reduced mb-2 block font-semibold text-ink">Your name</span>
            <input
              className="field" placeholder="Aman Dixit"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-label="Your name"
            />
          </label>
          <label className="block">
            <span className="t-reduced mb-2 block font-semibold text-ink">
              Portfolio link <span className="font-normal text-ink-mute">optional</span>
            </span>
            <input
              className="field" placeholder="yoursite.com"
              value={form.portfolio}
              onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
              aria-label="Portfolio link"
            />
          </label>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2">
          <span className="t-foot mr-2">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setForm({ ...form, service: ex.service, targetClient: ex.targetClient })}
              className="chip"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <button onClick={find} disabled={loading} className="btn btn-fill mt-8">
          {loading ? 'Searching…' : 'Find clients'}
        </button>
      </section>

      {loading && (
        <section className="band-tight">
          <p className="t-reduced text-ink-mute">
            Reading recent launches, hiring posts and freelance requests, then writing a draft for each…
          </p>
          <div className="mt-8 space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ruled-bottom grid gap-10 pb-8 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-3 w-3/4" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
                <div className="skeleton h-32 w-full !rounded-[var(--radius-tile)]" />
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && error && (
        <section className="band-tight">
          <p className="warn t-body text-ink-soft">{error}</p>
        </section>
      )}

      {!loading && result?.leads?.length > 0 && (
        <>
          {result.brief?.icp && (
            <section className="ruled-bottom band-tight">
              <p className="eyebrow">Who it looked for</p>
              <p className="t-body mt-4 max-w-[58ch] text-ink-soft">{result.brief.icp}</p>
              {result.brief.searchTerms?.length > 0 && (
                <p className="mono t-foot mt-3">{result.brief.searchTerms.join(' · ')}</p>
              )}
              <p className="mono t-foot mt-3">
                {(result.sources || [])
                  .filter((s) => s.ok)
                  .map((s) => `${s.name} ${s.count}`)
                  .join('  ·  ')}
              </p>
              <p className="t-foot mt-2 max-w-[62ch]">
                Which databases get searched depends on who you are trying to reach.
                Hacker News only carries software companies; physical-product brands
                come from the open product databases, and local businesses from
                OpenStreetMap. Region is approximate — each result shows where it
                actually is.
              </p>
            </section>
          )}

          <section className="band-tight">
            <p className="eyebrow">
              {result.totalFound?.toLocaleString() || result.leads.length} prospects found
            </p>
            <h2 className="t-lg mt-4 max-w-[22ch]">Ranked by who answers.</h2>
            <p className="t-body mt-4 max-w-[54ch] text-ink-soft">
              {result.degraded
                ? 'Search ran without the model, so nothing is ranked or drafted yet — the prospects below are real either way.'
                : `The first ${result.drafted || 0} already have an email written. Every other one is drafted when you pick it.`}
            </p>

            {result.degraded && (
              <p className="warn t-reduced mt-5 max-w-[60ch] text-ink-soft">
                {result.degradedReason}
              </p>
            )}

            {/* Filters over the whole returned list */}
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setOnlyEmail((v) => !v); setShown(12); }}
                className={`chip ${onlyEmail ? 'chip-on' : ''}`}
              >
                Has a published address
              </button>
              {places.slice(0, 8).map((pl) => (
                <button
                  key={pl}
                  onClick={() => { setPlace(place === pl ? null : pl); setShown(12); }}
                  className={`chip ${place === pl ? 'chip-on' : ''}`}
                >
                  {pl}
                </button>
              ))}
              {(onlyEmail || place) && (
                <button
                  onClick={() => { setOnlyEmail(false); setPlace(null); setShown(12); }}
                  className="t-foot underline underline-offset-2 hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>

            <p className="t-foot mono mt-4">
              showing {Math.min(shown, visibleLeads.length)} of {visibleLeads.length}
              {visibleLeads.length !== result.leads.length && ` (${result.leads.length} returned)`}
            </p>

            <div className="mt-6 border-t border-rule">
              {visibleLeads.slice(0, shown).map((lead, i) => (
                <Lead
                  key={lead.threadUrl || `${lead.source}-${lead.company}-${i}`}
                  lead={lead}
                  index={i}
                  onToast={toast}
                  sender={{
                    service: form.service,
                    name: form.name,
                    portfolio: form.portfolio,
                    valueLine: result.brief?.valueLine || '',
                  }}
                />
              ))}
            </div>

            {shown < visibleLeads.length && (
              <button onClick={() => setShown((n) => n + 24)} className="btn btn-quiet mt-8">
                Show 24 more
              </button>
            )}

            {result.disclaimer && (
              <p className="t-foot mt-8 max-w-[64ch]">{result.disclaimer}</p>
            )}
          </section>
        </>
      )}

      {!loading && result && result.leads?.length === 0 && (
        <section className="band-tight">
          <p className="t-body max-w-[52ch] text-ink-soft">{result.message}</p>
        </section>
      )}
    </div>
  );
}
