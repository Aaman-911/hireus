import { useState, useEffect } from 'react';
import { Briefcase, MapPin, Building2, ExternalLink, Sparkles, Loader2, AlertCircle, TrendingUp } from 'lucide-react';
import axios from 'axios';

export default function JobRecommendations({ profile, results }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchJobs = async () => {
      if (!profile?.targetRole) {
        setError("No target role available for job recommendations.");
        setLoading(false);
        return;
      }

      try {
        // Extract skills from interview answers for better matching
        const inferredSkills = profile.targetRole; // base skill

        const params = new URLSearchParams({
          targetRole: profile.targetRole,
          experience: profile.experience || '0',
          industry: profile.industry || '',
          skills: inferredSkills,
          score: results?.overallScore || '50'
        });

        const response = await axios.get(`http://localhost:5001/job-recommendations?${params.toString()}`);
        
        setJobs(response.data.jobs || []);
        setSearchQuery(response.data.query || profile.targetRole);
      } catch (err) {
        console.error("Failed to fetch job recommendations:", err);
        const message = err.response?.data?.error || "Failed to load job recommendations. Please try again later.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [profile, results]);

  const getScoreColor = (score) => {
    if (score >= 80) return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-400/20' };
    if (score >= 60) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-400/20' };
    return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', ring: 'ring-orange-400/20' };
  };

  const getScoreLabel = (score) => {
    if (score >= 85) return 'Excellent Match';
    if (score >= 70) return 'Strong Match';
    if (score >= 55) return 'Good Match';
    return 'Possible Match';
  };

  // --- Loading Skeleton ---
  if (loading) {
    return (
      <div className="mt-16 space-y-6">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-purple-100/80 text-purple-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-bold text-sm uppercase tracking-widest">Finding Your Opportunities</span>
          </div>
          <p className="text-gray-500 font-medium">AI is matching jobs based on your profile and performance...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-[2rem] p-8 animate-pulse">
              <div className="h-4 bg-gray-200 rounded-full w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded-full w-1/2 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded-full w-2/3 mb-6"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-100 rounded-full w-full"></div>
                <div className="h-3 bg-gray-100 rounded-full w-5/6"></div>
                <div className="h-3 bg-gray-100 rounded-full w-4/6"></div>
              </div>
              <div className="h-10 bg-gray-200 rounded-xl w-full mt-6"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="mt-16">
        <div className="glass-card rounded-[2.5rem] p-10 text-center bg-white shadow-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-100 text-rose-500 mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3">Job Recommendations Unavailable</h3>
          <p className="text-gray-500 font-medium max-w-md mx-auto leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // --- Empty State ---
  if (jobs.length === 0) {
    return (
      <div className="mt-16">
        <div className="glass-card rounded-[2.5rem] p-10 text-center bg-white shadow-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-100 text-purple-500 mb-6">
            <Briefcase className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3">No Matching Jobs Found</h3>
          <p className="text-gray-500 font-medium max-w-md mx-auto">We couldn't find job listings matching your profile right now. Check back later for new opportunities!</p>
        </div>
      </div>
    );
  }

  // --- Job Cards ---
  return (
    <div className="mt-16 space-y-8">
      {/* Section Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200/50">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="font-black text-sm uppercase tracking-widest text-purple-700">AI-Powered</span>
        </div>
        <h3 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
          Recommended Jobs for You
        </h3>
        <p className="text-gray-500 font-medium text-lg max-w-2xl mx-auto">
          Based on your profile as a <span className="text-purple-600 font-bold">{profile?.targetRole || 'professional'}</span> and your interview performance, here are the most relevant opportunities.
        </p>
        {searchQuery && (
          <p className="text-sm text-gray-400 font-medium">
            Search refined to: <span className="text-gray-600 font-semibold">"{searchQuery}"</span>
          </p>
        )}
      </div>

      {/* Job Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job, index) => {
          const scoreColors = getScoreColor(job.matchScore);
          return (
            <div
              key={index}
              className="group glass-card rounded-[2rem] p-7 bg-white shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1 border border-gray-100 hover:border-purple-200/50 relative overflow-hidden flex flex-col"
            >
              {/* Match Score Badge */}
              {job.matchScore && (
                <div className="absolute top-5 right-5">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${scoreColors.bg} ${scoreColors.text} ${scoreColors.border} border ring-4 ${scoreColors.ring}`}>
                    <TrendingUp className="w-3 h-3" />
                    {job.matchScore}%
                  </div>
                </div>
              )}

              {/* Decorative gradient orb */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-2xl group-hover:opacity-100 opacity-0 transition-opacity duration-500"></div>

              {/* Job Title */}
              <div className="pr-16 mb-4">
                <h4 className="text-lg font-black text-gray-900 leading-snug group-hover:text-purple-700 transition-colors line-clamp-2">
                  {job.title}
                </h4>
              </div>

              {/* Company & Location */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-semibold text-sm truncate">{job.company}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-medium text-sm truncate">{job.location}</span>
                </div>
              </div>

              {/* Match Reason */}
              {job.matchReason && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-purple-50/50 border border-purple-100/50">
                  <p className="text-xs font-semibold text-purple-600 leading-relaxed">
                    💡 {job.matchReason}
                  </p>
                </div>
              )}

              {/* Description */}
              <p className="text-gray-500 text-sm font-medium leading-relaxed mb-6 line-clamp-3 flex-grow">
                {job.description ? job.description.replace(/<[^>]*>/g, '').substring(0, 180) + '...' : 'No description available.'}
              </p>

              {/* Match Score Label */}
              <div className="mb-4">
                <span className={`text-xs font-black uppercase tracking-widest ${scoreColors.text}`}>
                  {getScoreLabel(job.matchScore)}
                </span>
              </div>

              {/* Apply CTA */}
              <a
                href={job.applyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:shadow-purple-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm"
              >
                Apply Now
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="text-center pt-4 pb-4">
        <p className="text-sm text-gray-400 font-medium">
          Jobs powered by <span className="font-bold text-gray-500">Adzuna</span> • AI matching by <span className="font-bold text-gray-500">Gemini</span>
        </p>
      </div>
    </div>
  );
}
