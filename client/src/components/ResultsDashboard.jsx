import { useLocation, useNavigate, Link } from 'react-router-dom';
import { RefreshCw, CheckCircle, AlertTriangle, Lightbulb, Target, Brain, Activity, UserCheck, MessageSquare } from 'lucide-react';
import JobRecommendations from './JobRecommendations';

export default function ResultsDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { results, profile, history } = location.state || {};

  if (!results) {
    return (
      <div className="text-center mt-20">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">No results found</h2>
        <button onClick={() => navigate('/onboarding')} className="text-purple-600 hover:underline font-bold text-lg">
          Start a new interview session
        </button>
      </div>
    );
  }

  const { overallScore, performanceSummary, metrics, strengths = [], weaknesses = [], improvements = [], behavioralInsight, detailedQnA = [] } = results;

  const MetricBar = ({ label, value, icon, colorClass }) => (
      <div className="mb-5 last:mb-0">
          <div className="flex justify-between items-center mb-2">
              <span className="flex items-center gap-2 font-bold text-gray-700 text-sm uppercase tracking-wide">
                  {icon} {label}
              </span>
              <span className="font-black text-gray-900">{value}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
              <div 
                  className={`h-3 rounded-full transition-all duration-1000 ease-out ${colorClass}`}
                  style={{ width: `${value}%` }}
              ></div>
          </div>
      </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between shadow-xl p-10 glass-card rounded-[2.5rem] bg-gradient-to-br from-white/90 to-purple-50/50">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-4">Deep Behavioral Report</h1>
          <p className="text-gray-600 font-medium leading-relaxed text-lg">{performanceSummary}</p>
        </div>
        <Link 
          to="/onboarding"
          className="mt-6 md:mt-0 shrink-0 inline-flex items-center gap-3 px-8 py-4 bg-slate-900 shadow-xl hover:shadow-2xl hover:scale-105 text-white font-bold rounded-2xl transition-all"
        >
          <RefreshCw className="w-5 h-5" />
          Start New Session
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Overall Score */}
        <div className="glass-card p-10 rounded-[2.5rem] flex flex-col items-center justify-center text-center relative overflow-hidden bg-white shadow-lg lg:col-span-1">
          <p className="text-gray-500 font-black mb-6 uppercase tracking-widest text-sm z-10">Overall Competency</p>
          <div className="relative z-10">
            <svg className="w-48 h-48 transform -rotate-90">
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100" />
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" 
                        strokeDasharray={553} 
                        strokeDashoffset={553 - (553 * overallScore) / 100} 
                        className="text-purple-600 transition-all duration-1500 ease-out" 
                        strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col shadow-inner rounded-full m-4 bg-white/50 backdrop-blur-sm">
                <span className="text-6xl font-black text-gray-900 bg-clip-text text-transparent bg-gradient-to-br from-purple-800 to-pink-600">{overallScore}</span>
                <span className="text-sm text-gray-400 font-black mt-1 uppercase tracking-widest">Score</span>
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="glass-card p-10 rounded-[2.5rem] bg-white shadow-lg lg:col-span-2 flex flex-col justify-center">
            <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
                <Activity className="w-6 h-6 text-purple-600" /> Performance Dimensions
            </h3>
            
            <MetricBar label="Communication Clarity" value={metrics?.communicationClarity || 0} icon={<MessageSquare className="w-4 h-4" />} colorClass="bg-blue-500" />
            <MetricBar label="Inferred Confidence" value={metrics?.confidence || 0} icon={<UserCheck className="w-4 h-4" />} colorClass="bg-emerald-500" />
            <MetricBar label="Role & Domain Knowledge" value={metrics?.roleKnowledge || 0} icon={<Brain className="w-4 h-4" />} colorClass="bg-purple-500" />
            <MetricBar label="Fluency & Articulation" value={metrics?.fluency || 0} icon={<Activity className="w-4 h-4" />} colorClass="bg-pink-500" />
            
        </div>
      </div>

      {/* Behavioral Insights */}
      <div className="glass-card p-10 rounded-[2.5rem] bg-gradient-to-r from-indigo-50 to-purple-50 shadow-lg border border-indigo-100">
          <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                 <Brain className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-black text-indigo-900 tracking-tight">Psychological & Behavioral Insight</h3>
          </div>
          <p className="text-indigo-800/80 font-medium text-lg leading-relaxed pl-16">
              "{behavioralInsight}"
          </p>
      </div>

      {/* Strengths / Weaknesses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-4">
          
          <div className="glass-card p-8 md:p-10 rounded-[2.5rem] bg-white shadow-lg">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600">
                    <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-gray-900">Key Strengths</h3>
              </div>
              <ul className="space-y-4">
                  {strengths.map((str, i) => (
                      <li key={i} className="flex items-start gap-4 text-gray-700 font-medium text-lg leading-relaxed bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0"></span>
                          <span>{str}</span>
                      </li>
                  ))}
                  {strengths.length === 0 && <p className="text-gray-500 italic">No specific strengths highlighted.</p>}
              </ul>
          </div>

          <div className="glass-card p-8 md:p-10 rounded-[2.5rem] bg-white shadow-lg">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-rose-100 text-rose-600">
                    <Target className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-gray-900">Areas to Improve</h3>
              </div>
              <ul className="space-y-4">
                  {weaknesses.map((weak, i) => (
                      <li key={i} className="flex items-start gap-4 text-gray-700 font-medium text-lg leading-relaxed bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50">
                          <span className="w-2 h-2 rounded-full bg-rose-400 mt-2 shrink-0"></span>
                          <span>{weak}</span>
                      </li>
                  ))}
                  {weaknesses.length === 0 && <p className="text-gray-500 italic">No major weaknesses detected.</p>}
              </ul>
          </div>
      </div>

      {/* Actionable Suggestions */}
      <div className="glass-card p-10 rounded-[2.5rem] bg-white shadow-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-blue-100 text-blue-600">
                <Lightbulb className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-gray-900">Action Plan</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {improvements.map((sug, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-blue-50 border border-blue-100 text-gray-800 font-medium leading-relaxed relative overflow-hidden shadow-sm">
                      <div className="absolute top-0 right-0 text-9xl font-black text-blue-500/5 -mt-8 -mr-4 select-none pointer-events-none">{i + 1}</div>
                      <span className="relative z-10 block text-lg">{sug}</span>
                  </div>
              ))}
              {improvements.length === 0 && <p className="text-gray-500 italic">Keep doing what you're doing!</p>}
          </div>
      </div>

      {/* Transcript & Ideal Answers Archive */}
      <div className="mt-12 space-y-6">
        <h3 className="text-3xl font-black text-gray-900 mb-8 text-center tracking-tight">Transcript & Expert Examples</h3>
        {detailedQnA.map((qa, index) => (
             <div key={index} className="glass-card p-8 md:p-10 rounded-[2.5rem] bg-white shadow-md hover:shadow-lg transition-shadow border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 font-black rounded-lg text-sm tracking-widest uppercase">Question {index + 1}</span>
                </div>
                <h4 className="text-2xl font-bold text-gray-900 mb-6 leading-relaxed">"{qa.question}"</h4>
                
                <div className="relative pl-6 border-l-4 border-emerald-300 bg-emerald-50/50 p-6 rounded-r-2xl">
                    <h5 className="text-sm font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Ideal Expert Answer
                    </h5>
                    <p className="text-gray-700 font-medium leading-relaxed text-lg">{qa.idealAnswer}</p>
                </div>
             </div>
        ))}
      </div>

      {/* Job Recommendations Section */}
      <JobRecommendations profile={profile} results={results} />

    </div>
  );
}
