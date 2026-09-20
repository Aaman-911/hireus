import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import JobCard from './ui/JobCard';

/**
 * The post-interview shortlist. The full search lives on /jobs — this is the
 * few that matter, weighted by how the interview actually went.
 */
export default function JobRecommendations({ profile, results, skills = [] }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!profile?.targetRole) {
        setError('No target role on file, so there is nothing to match against.');
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/job-search', {
          params: {
            targetRole: profile.targetRole,
            experience: profile.experience || '0',
            industry: profile.industry || '',
            skills: skills.length ? skills.join(', ') : profile.targetRole,
            score: results?.overallScore || '',
            limit: 5,
          },
        });
        if (cancelled) return;
        setJobs(data.jobs || []);
        setQuery(data.query || profile.targetRole);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile, results, skills]);

  return (
    <section className="band-tight">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <div>
          <p className="eyebrow">Matched to this interview</p>
          <h2 className="t-lg mt-4 max-w-[18ch]">Worth your time.</h2>
        </div>
        <Link to={`/jobs?role=${encodeURIComponent(profile?.targetRole || '')}`} className="btn-text">
          See all openings
        </Link>
      </div>

      {query && !loading && (
        <p className="mono t-foot mt-4">searched “{query}” across five boards</p>
      )}

      {loading && (
        <div className="mt-8 space-y-7">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ruled-bottom space-y-3 pb-7">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-3 w-1/4" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <p className="warn t-body mt-8 text-ink-soft">{error}</p>}

      {!loading && !error && jobs.length === 0 && (
        <p className="t-body mt-8 text-ink-soft">
          Nothing matched right now. Try the full search with a broader title.
        </p>
      )}

      {!loading && jobs.length > 0 && (
        <div className="mt-8 border-t border-rule">
          {jobs.map((job, i) => (
            <JobCard key={`${job.source}-${i}`} job={job} mySkills={skills} />
          ))}
        </div>
      )}
    </section>
  );
}
