import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../lib/context';
import { loadProfile } from '../lib/session';

function Copy({ value, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          // clipboard blocked — the value is on screen and selectable
        }
      }}
      aria-label={`Copy ${value}`}
      className="t-foot underline underline-offset-2 hover:text-ink"
    >
      {done ? 'Copied' : label}
    </button>
  );
}

function mailtoLink(contact, name) {
  const subject = encodeURIComponent(
    `Application — ${contact.role || 'open role'}${name ? ` — ${name}` : ''}`
  );
  const body = encodeURIComponent(
    `Hello,\n\nI saw your post in the Hacker News "Who is hiring?" thread about ${
      contact.role || 'the open role'
    } at ${contact.company}.\n\n[Two sentences on why you are a fit.]\n\nMy resume is attached. I would welcome the chance to talk.\n\nBest regards,\n${name || ''}`
  );
  return `mailto:${contact.email}?subject=${subject}&body=${body}`;
}

function Contact({ contact, index, name }) {
  return (
    <article className="ruled-bottom grid gap-x-8 gap-y-4 py-7 md:grid-cols-[2.5rem_1fr_auto]">
      <span className="mono t-foot pt-1">{String(index + 1).padStart(2, '0')}</span>

      <div className="min-w-0">
        <h3 className="t-sm">{contact.company}</h3>
        {contact.role && <p className="t-reduced mt-1.5 text-ink-soft">{contact.role}</p>}
        {contact.location && <p className="t-foot mt-1">{contact.location}</p>}

        <p className="t-reduced mt-4 max-w-[58ch] text-ink-mute">{contact.blurb}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {contact.email ? (
            <>
              <span className="mono t-foot" style={{ color: 'var(--accent-ink)' }}>
                {contact.email}
              </span>
              <Copy value={contact.email} />
            </>
          ) : (
            <span className="t-foot">Linked an application page rather than an address</span>
          )}
          <a href={contact.discussionUrl} target="_blank" rel="noopener noreferrer" className="t-foot underline underline-offset-2 hover:text-ink">
            Original post
          </a>
          {contact.links?.[0] && (
            <a href={contact.links[0]} target="_blank" rel="noopener noreferrer" className="t-foot underline underline-offset-2 hover:text-ink">
              Company site
            </a>
          )}
        </div>
      </div>

      <div className="shrink-0 md:pt-1">
        {contact.email && (
          <a href={mailtoLink(contact, name)} className="btn btn-fill btn-sm">
            Draft email
          </a>
        )}
      </div>
    </article>
  );
}

export default function NetworkPage() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const profile = loadProfile();

  const [field, setField] = useState(params.get('field') || profile?.targetRole || '');
  const [company, setCompany] = useState(params.get('company') || '');

  const [hiring, setHiring] = useState(null);
  const [loadingHiring, setLoadingHiring] = useState(false);
  const [companyData, setCompanyData] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(false);

  const searchHiring = useCallback(
    async (value) => {
      const q = (value ?? field).trim();
      if (!q) {
        toast({ title: 'Type a field first', variant: 'error' });
        return;
      }
      setLoadingHiring(true);
      setParams((prev) => { prev.set('field', q); return prev; }, { replace: true });
      try {
        const { data } = await api.get('/hiring-contacts', { params: { field: q, limit: 12 } });
        setHiring(data);
        if (!data.contacts?.length) {
          toast({
            title: 'No posts matched',
            description: 'Try something broader, like "engineer" or "design".',
            variant: 'info',
          });
        }
      } catch (err) {
        toast({
          title: 'Could not load contacts',
          description: errorMessage(err),
          variant: 'error',
          action: { label: 'Retry', onClick: () => searchHiring(q) },
        });
      } finally {
        setLoadingHiring(false);
      }
    },
    [field, setParams, toast]
  );

  const searchCompany = useCallback(
    async (value) => {
      const q = (value ?? company).trim();
      if (!q) return;
      setLoadingCompany(true);
      setParams((prev) => { prev.set('company', q); return prev; }, { replace: true });
      try {
        const { data } = await api.get('/company-contacts', { params: { company: q } });
        setCompanyData(data);
      } catch (err) {
        toast({ title: 'Could not load company', description: errorMessage(err), variant: 'error' });
      } finally {
        setLoadingCompany(false);
      }
    },
    [company, setParams, toast]
  );

  useEffect(() => {
    const c = params.get('company');
    const f = params.get('field');
    if (c) searchCompany(c);
    if (f) searchHiring(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pb-16">
      <section className="ruled-bottom pb-[clamp(40px,6vw,72px)]">
        <p className="eyebrow">Direct outreach</p>
        <h1 className="t-xl mt-4 max-w-[14ch]">Write to a person.</h1>
        <p className="t-intro mt-5 max-w-[46ch]">
          Applications through a portal disappear. These are addresses employers
          published this month so that candidates would write to them.
        </p>
      </section>

      <section className="ruled-bottom band-tight">
        <p className="warn t-reduced max-w-[62ch] text-ink-soft">
          <span className="font-semibold text-ink">Published, not scraped.</span> Every
          address was posted by the employer to receive applications, or put on a public
          profile by its owner. Nothing is guessed from a name pattern or taken from LinkedIn.
        </p>
      </section>

      {/* Hiring threads */}
      <section className="ruled-bottom band-tight">
        <p className="eyebrow">Hiring in your field</p>
        <h2 className="t-lg mt-4 max-w-[20ch]">This month&rsquo;s thread.</h2>
        {hiring?.thread?.title && <p className="mono t-foot mt-3">{hiring.thread.title}</p>}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <input
            className="field flex-1"
            placeholder="react, python, design, devops"
            value={field}
            onChange={(e) => setField(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchHiring()}
            aria-label="Field to search"
          />
          <button onClick={() => searchHiring()} disabled={loadingHiring} className="btn btn-fill">
            {loadingHiring ? 'Reading…' : 'Find contacts'}
          </button>
        </div>

        {loadingHiring && (
          <div className="mt-9 space-y-7">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ruled-bottom space-y-3 pb-7">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-3 w-1/4" />
              </div>
            ))}
          </div>
        )}

        {!loadingHiring && hiring?.contacts?.length > 0 && (
          <>
            <p className="t-reduced mt-9 text-ink-mute">
              <span className="text-ink">{hiring.contacts.filter((c) => c.email).length}</span>{' '}
              published a direct address
            </p>
            <div className="mt-6 border-t border-rule">
              {hiring.contacts.map((c, i) => (
                <Contact key={c.discussionUrl} contact={c} index={i} name={profile?.name} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Company lookup */}
      <section className="band-tight">
        <p className="eyebrow">One company</p>
        <h2 className="t-lg mt-4 max-w-[20ch]">Its real front door.</h2>
        <p className="t-body mt-4 max-w-[52ch] text-ink-soft">
          Resolves the actual domain, its careers page, and engineers there who publish
          contact details on their own profile.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <input
            className="field flex-1"
            placeholder="Zoho, Razorpay, Vercel"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchCompany()}
            aria-label="Company to look up"
          />
          <button onClick={() => searchCompany()} disabled={loadingCompany} className="btn btn-fill">
            {loadingCompany ? 'Looking…' : 'Look up'}
          </button>
        </div>

        {loadingCompany && (
          <div className="mt-9 space-y-3">
            <div className="skeleton h-5 w-1/4" />
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-24 w-full !rounded-[var(--radius-tile)]" />
          </div>
        )}

        {!loadingCompany && companyData && (
          <div className="rise mt-10">
            <div className="ruled-bottom flex flex-wrap items-baseline gap-x-5 gap-y-2 pb-6">
              <h3 className="t-md">{companyData.company}</h3>
              {companyData.domain && (
                <a
                  href={`https://${companyData.domain}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mono t-foot underline underline-offset-2"
                  style={{ color: 'var(--accent-ink)' }}
                >
                  {companyData.domain}
                </a>
              )}
            </div>

            <div className="grid gap-x-16 gap-y-10 py-8 md:grid-cols-2">
              <div>
                <p className="eyebrow">Public inboxes</p>
                {companyData.outreach?.publicInboxes?.length ? (
                  <ul className="mt-5 space-y-3">
                    {companyData.outreach.publicInboxes.map((inbox) => (
                      <li key={inbox} className="flex items-baseline justify-between gap-4">
                        <span className="mono t-reduced text-ink-soft">{inbox}</span>
                        <Copy value={inbox} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="t-reduced mt-5 text-ink-mute">No domain resolved.</p>
                )}
                <p className="t-foot mt-5">Common addresses worth trying — not verified.</p>
              </div>

              <div>
                <p className="eyebrow">Find the right person</p>
                <ul className="mt-5 space-y-3">
                  {[
                    ['Careers page', companyData.outreach?.careersPage],
                    ['Recruiters on LinkedIn', companyData.outreach?.searchLinks?.linkedinRecruiters],
                    ['Company on LinkedIn', companyData.outreach?.searchLinks?.linkedinCompany],
                    ['Hiring posts on X', companyData.outreach?.searchLinks?.twitter],
                  ]
                    .filter(([, href]) => href)
                    .map(([label, href]) => (
                      <li key={label}>
                        <a
                          href={href} target="_blank" rel="noopener noreferrer"
                          className="t-reduced underline underline-offset-2 hover:text-ink"
                        >
                          {label}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            {companyData.people?.length > 0 && (
              <div className="ruled-top py-8">
                <p className="eyebrow">
                  Engineers there with public contact details ({companyData.people.length})
                </p>
                <div className="mt-6 grid gap-x-12 gap-y-6 sm:grid-cols-2">
                  {companyData.people.map((p) => (
                    <div key={p.handle} className="flex items-start gap-4">
                      <img src={p.avatar} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full" />
                      <div className="min-w-0">
                        <p className="t-reduced font-semibold text-ink">{p.name}</p>
                        {p.bio && <p className="t-foot mt-1 line-clamp-2">{p.bio}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                          {p.email && (
                            <>
                              <span className="mono t-foot" style={{ color: 'var(--accent-ink)' }}>{p.email}</span>
                              <Copy value={p.email} />
                            </>
                          )}
                          <a href={p.profileUrl} target="_blank" rel="noopener noreferrer" className="t-foot underline underline-offset-2 hover:text-ink">
                            GitHub
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="t-foot mt-7 max-w-[62ch]">{companyData.disclaimer}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
