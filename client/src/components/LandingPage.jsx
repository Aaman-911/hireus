import { Link } from 'react-router-dom';
import { Bot, Mic, BarChart3, Zap } from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: <Bot className="w-6 h-6 text-purple-600" />,
      title: "AI Sentiment Analysis",
      description: "Get real-time feedback on the emotional tone of your answers mapping confidence and clarity."
    },
    {
      icon: <Mic className="w-6 h-6 text-pink-500" />,
      title: "Filler Word Detection",
      description: "Automatically identify 'ums', 'ahs', and 'likes' to help you speak with absolute precision."
    },
    {
      icon: <Zap className="w-6 h-6 text-orange-500" />,
      title: "Keyword Matching",
      description: "Ensure your responses hit the critical industry-specific keywords recruiters are looking for."
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
      title: "Performance Scoring",
      description: "Receive a comprehensive metric-driven score after every session to track your improvement."
    }
  ];

  return (
    <>
      <style>
        {`
          @keyframes calmFadeIn {
            0% { opacity: 0; transform: translateY(15px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .animate-calm {
            animation: calmFadeIn 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            opacity: 0;
          }
        `}
      </style>
      <div 
        className="absolute top-0 left-0 w-full h-screen z-50 overflow-hidden bg-cover bg-center bg-no-repeat bg-[#f0ecfc]"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
      >
        {/* Subtle white glass overlay for readability & premium feel */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>

        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center animate-calm">
          
          <h1 
            className="text-7xl md:text-[8rem] tracking-tight text-gray-900/90 mb-10 select-none drop-shadow-sm" 
            style={{ fontWeight: 400, letterSpacing: '-0.03em' }}
          >
            HireUS
          </h1>
          
          <Link 
            to="/onboarding"
            className="px-10 py-5 text-lg font-medium text-white bg-slate-900/95 rounded-[2rem] shadow-2xl hover:scale-[1.03] hover:shadow-3xl hover:bg-black transition-all duration-300 ease-out select-none border border-white/10 ring-1 ring-white/5"
          >
            Start Interview
          </Link>
        </div>
      </div>

      {/* spacer to push content below the absolute Hero */}
      <div className="relative w-full z-40" style={{ marginTop: '100vh' }}>
        <div className="py-24 max-w-4xl mx-auto flex flex-col items-center animate-calm" style={{animationDelay: '0.4s'}}>
          <h2 className="text-3xl md:text-5xl tracking-tight text-gray-900/90 mb-16 select-none drop-shadow-sm text-center" style={{ fontWeight: 400, letterSpacing: '-0.02em' }}>
            Advanced Coaching Features
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 w-full">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="group relative p-8 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-500 ease-out"
              >
                {/* Soft gradient hover glow inside card */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/60 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative z-10 flex flex-col items-start">
                  <div className="bg-white/60 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-white/50 backdrop-blur-md">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl tracking-tight text-gray-900/90 mb-3" style={{ fontWeight: 500 }}>
                    {feature.title}
                  </h3>
                  <p className="text-gray-600/90 text-lg leading-relaxed font-light">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Developer Credits Footer */}
      <footer 
        className="w-full py-8 mt-16 flex flex-col items-center justify-center text-gray-500/60 font-medium text-sm animate-calm space-y-1 select-none"
        style={{ animationDelay: '0.6s' }}
      >
        <div className="flex flex-col md:flex-row items-center gap-1 md:gap-4">
          <p>Aman Dixit <span className="hidden md:inline text-gray-400">—</span><span className="md:hidden"><br/></span> CSE 3rd Year</p>
        </div>
        <p className="pt-1 text-gray-400/50 text-xs tracking-wider uppercase">MITS Gwalior</p>
      </footer>
    </>
  );
}
