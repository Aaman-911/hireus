function relativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return null;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function JobCard({ job, onFindContacts, mySkills = [] }) {
  const posted = relativeTime(job.postedAt);
  const have = new Set(mySkills.map((s) => s.toLowerCase()));

  // Split the posting's own skills into what the candidate has and what they
  // do not — a gap is more actionable than a match percentage on its own.
  const skills = job.skills || [];
  const matched = skills.filter((s) => have.has(s.toLowerCase()));
  const missing = skills.filter((s) => !have.has(s.toLowerCase()));

  return (
    <article className="ruled-bottom grid gap-x-8 gap-y-4 py-7 md:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="t-sm">{job.title}</h3>
          {job.matchScore != null && (
            <span className="mono t-foot" style={{ color: 'var(--accent-ink)' }}>
              {job.matchScore}% match
            </span>
          )}
        </div>

        <p className="t-reduced mt-1.5 text-ink-soft">
          {job.company}
          <span className="text-ink-mute"> · {job.location}</span>
          {job.remote && <span className="text-ink-mute"> · Remote</span>}
        </p>

        {job.matchReason && (
          <p className="t-reduced mt-3 max-w-[56ch] text-ink-soft">{job.matchReason}</p>
        )}

        {skills.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {matched.length > 0 && (
              <span className="t-foot">
                <span style={{ color: 'var(--accent-ink)' }}>You have</span>{' '}
                <span className="mono">{matched.join(', ')}</span>
              </span>
            )}
            {missing.length > 0 && (
              <span className="t-foot">
                <span className="text-ink-mute">They also want</span>{' '}
                <span className="mono">{missing.slice(0, 5).join(', ')}</span>
              </span>
            )}
          </div>
        )}

        <p className="t-foot mono mt-4 flex flex-wrap gap-x-4">
          <span>{job.source}</span>
          {posted && <span>{posted}</span>}
          {job.salary && <span className="text-ink-soft">{job.salary}</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-start gap-4 md:pt-1">
        {onFindContacts && (
          <button onClick={() => onFindContacts(job.company)} className="btn-text !min-h-0 text-[14px]">
            Contacts
          </button>
        )}
        <a
          href={job.applyLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-fill btn-sm"
        >
          Apply
        </a>
      </div>
    </article>
  );
}
