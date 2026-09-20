import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../lib/context';
import { loadProfile, saveProfile } from '../lib/session';
import JobCard from './ui/JobCard';

const COUNTRIES = [
  ['in', 'India'], ['gb', 'United Kingdom'], ['us', 'United States'],
  ['de', 'Germany'], ['ca', 'Canada'], ['au', 'Australia'],
];

const QUICK = [
  'Frontend Developer', 'Backend Engineer', 'Data Analyst',
  'Product Manager', 'DevOps Engineer', 'UI/UX Designer',
];

const SORTS = [
  ['match', 'Best match'],
  ['recent', 'Most recent'],
  ['skills', 'Fewest gaps'],
];

/** Reads a PDF in the browser via pdfjs, loaded on demand from a CDN. */
async function extractPdfText(file) {
  const pdfjs = await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs'
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let page = 1; page <= Math.min(doc.numPages, 8); page++) {
    const content = await (await doc.getPage(page)).getTextContent();
    text += content.items.map((i) => i.str).join(' ') + '\n';
  }
  return text.trim();
}

export default function JobsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const saved = loadProfile();
  const [form, setForm] = useState({
    targetRole: params.get('role') || saved?.targetRole || '',
    experience: saved?.experience || '',
    industry: saved?.industry || '',
    skills: saved?.skills || '',
    country: 'in',
    remoteOnly: false,
  });

  const [jobs, setJobs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('match');
  const [sourceFilter, setSourceFilter] = useState(null);
  const [resume, setResume] = useState({ busy: false, parsed: null });

  const mySkills = useMemo(
    () => (form.skills || '').split(',').map((s) => s.trim()).filter(Boolean),
    [form.skills]
  );

  const search = useCallback(
    async (override = {}) => {
      const payload = { ...form, ...override };
      if (!payload.targetRole.trim()) {
        toast({ title: 'Type a role first', variant: 'error' });
        return;
      }

      setLoading(true);
      setError(null);
      setSourceFilter(null);
      setParams({ role: payload.targetRole }, { replace: true });

      try {
        const { data } = await api.get('/job-search', {
          params: {
            targetRole: payload.targetRole,
            experience: payload.experience,
            industry: payload.industry,
            skills: payload.skills,
            country: payload.country,
            remoteOnly: payload.remoteOnly,
            limit: 18,
          },
        });
        setJobs(data.jobs || []);
        setMeta({ query: data.query, sources: data.sources, totalFound: data.totalFound });
        saveProfile({ ...loadProfile(), ...payload });
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        toast({
          title: 'Search failed',
          description: message,
          variant: 'error',
          action: { label: 'Retry', onClick: () => search(override) },
        });
      } finally {
        setLoading(false);
      }
    },
    [form, setParams, toast]
  );

  useEffect(() => {
    const role = params.get('role');
    if (role && jobs.length === 0 && !loading) search({ targetRole: role });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResume = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setResume({ busy: true, parsed: null });
    try {
      const text =
        file.type === 'application/pdf' ? await extractPdfText(file) : await file.text();
      if (text.length < 60) throw new Error('Could not read enough text from that file.');

      const { data } = await api.post('/parse-resume', { text });
      const next = {
        ...form,
        targetRole: data.targetRole || form.targetRole,
        experience: data.experience ?? form.experience,
        industry: data.industry || form.industry,
        skills: (data.skills || []).join(', '),
      };
      setForm(next);
      setResume({ busy: false, parsed: data });
      saveProfile({ ...loadProfile(), ...next, name: data.name || loadProfile()?.name });
      toast({
        title: 'Resume read',
        description: `${data.targetRole || 'Role'} · ${(data.skills || []).length} skills.`,
        variant: 'success',
      });
      search(next);
    } catch (err) {
      setResume({ busy: false, parsed: null });
      toast({ title: 'Could not read that file', description: errorMessage(err), variant: 'error' });
    }
  };

  /* Sorting and filtering happen here rather than on the server, so changing
     the order never costs another five-API round trip. */
  const visible = useMemo(() => {
    const have = new Set(mySkills.map((s) => s.toLowerCase()));
    const gaps = (j) => (j.skills || []).filter((s) => !have.has(s.toLowerCase())).length;

    let list = sourceFilter ? jobs.filter((j) => j.source === sourceFilter) : [...jobs];

    if (sort === 'recent') {
      list.sort((a, b) => (Date.parse(b.postedAt) || 0) - (Date.parse(a.postedAt) || 0));
    } else if (sort === 'skills') {
      list.sort((a, b) => gaps(a) - gaps(b) || (b.matchScore || 0) - (a.matchScore || 0));
    } else {
      list.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    }
    return list;
  }, [jobs, sort, sourceFilter, mySkills]);

  const activeSources = (meta?.sources || []).filter((s) => s.ok && s.count > 0);

  return (
    <div className="pb-16">
      <section className="ruled-bottom pb-[clamp(40px,6vw,72px)]">
        <p className="eyebrow">Openings</p>
        <h1 className="t-xl mt-4 max-w-[16ch]">Five boards, one search.</h1>
        <p className="t-intro mt-5 max-w-[46ch]">
          Search by role, or drop in a resume and let it work out what to look for.
          No interview needed.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <input
            className="field flex-1"
            placeholder="Frontend Developer"
            value={form.targetRole}
            onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            aria-label="Role to search for"
          />
          <button onClick={() => search()} disabled={loading} className="btn btn-fill">
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {QUICK.map((role) => (
            <button
              key={role}
              onClick={() => { setForm({ ...form, targetRole: role }); search({ targetRole: role }); }}
              className="chip"
            >
              {role}
            </button>
          ))}
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="number" min="0" className="field" placeholder="Years of experience"
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
            aria-label="Years of experience"
          />
          <input
            className="field" placeholder="Your skills, comma separated"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            aria-label="Your skills"
          />
          <select
            className="field" value={form.country} aria-label="Region"
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          >
            {COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => setForm({ ...form, remoteOnly: !form.remoteOnly })}
            className={`chip !min-h-[44px] justify-center ${form.remoteOnly ? 'chip-on' : ''}`}
          >
            Remote only
          </button>
        </div>
      </section>

      {/* Resume */}
      <section className="ruled-bottom band-tight">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">From your resume</p>
            <h2 className="t-sm mt-3 max-w-[24ch]">Let it read the PDF instead.</h2>
            <p className="t-reduced mt-2 max-w-[52ch] text-ink-mute">
              Parsed in your browser. Only the extracted text is sent for analysis.
            </p>
          </div>
          <label className="btn btn-quiet cursor-pointer">
            {resume.busy ? 'Reading…' : 'Upload resume'}
            <input
              type="file" className="sr-only" accept=".pdf,.txt,.md"
              onChange={handleResume} disabled={resume.busy}
            />
          </label>
        </div>

        {resume.parsed && (
          <div className="rise mt-7 grid gap-x-8 gap-y-3 md:grid-cols-[2.5rem_1fr]">
            <span className="mono t-foot pt-1">→</span>
            <div>
              <p className="t-body max-w-[58ch] text-ink-soft">{resume.parsed.summary}</p>
              <p className="mono t-foot mt-3">
                {resume.parsed.seniority} · {(resume.parsed.skills || []).join(' · ')}
              </p>
              <button
                onClick={() => navigate('/onboarding', { state: { prefill: resume.parsed } })}
                className="btn-text mt-2"
              >
                Practise an interview for this
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Results */}
      {loading && (
        <section className="band-tight">
          <p className="t-reduced text-ink-mute">
            Querying Adzuna, Remotive, Jobicy, Arbeitnow and RemoteOK…
          </p>
          <div className="mt-8 space-y-7">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ruled-bottom space-y-3 pb-7">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-1/4" />
                <div className="skeleton h-3 w-2/3" />
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

      {!loading && !error && jobs.length > 0 && (
        <section className="band-tight">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4">
            <p className="t-reduced text-ink-mute">
              <span className="text-ink">{visible.length}</span> of {meta?.totalFound} openings
              {meta?.query && <> · searched “{meta.query}”</>}
            </p>
            <div className="flex flex-wrap gap-2">
              {SORTS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`chip ${sort === key ? 'chip-on' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeSources.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setSourceFilter(null)}
                className={`chip ${!sourceFilter ? 'chip-on' : ''}`}
              >
                All sources
              </button>
              {activeSources.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSourceFilter(sourceFilter === s.name ? null : s.name)}
                  className={`chip ${sourceFilter === s.name ? 'chip-on' : ''}`}
                >
                  {s.name} <span className="mono">{s.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 border-t border-rule">
            {visible.map((job, i) => (
              <JobCard
                key={`${job.source}-${job.title}-${i}`}
                job={job}
                mySkills={mySkills}
                onFindContacts={(company) =>
                  navigate(`/network?company=${encodeURIComponent(company)}`)
                }
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && jobs.length === 0 && meta && (
        <section className="band-tight">
          <p className="t-body text-ink-soft">
            Nothing matched. Try a broader title, or switch off remote only.
          </p>
        </section>
      )}
    </div>
  );
}
