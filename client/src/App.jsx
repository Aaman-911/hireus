import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import OnboardingPage from './components/OnboardingPage';
import InterviewPage from './components/InterviewPage';
import ResultsDashboard from './components/ResultsDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen text-gray-800 font-sans antialiased selection:bg-purple-300 selection:text-purple-900">
        {/* Abstract background blobs for modern look */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-40 -left-40 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-40 left-40 w-96 h-96 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>
        
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <nav className="flex items-center justify-between mb-16 relative z-50">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl leading-none">H</span>
              </div>
              <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500 tracking-tight">
                HireUS
              </span>
            </Link>
          </nav>

          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/interview" element={<InterviewPage />} />
            <Route path="/results" element={<ResultsDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
