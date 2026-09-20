import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Shell from './components/ui/Shell';
import ErrorBoundary from './components/ui/ErrorBoundary';
import LandingPage from './components/LandingPage';
import OnboardingPage from './components/OnboardingPage';
import InterviewPage from './components/InterviewPage';
import ResultsDashboard from './components/ResultsDashboard';
import JobsPage from './components/JobsPage';
import NetworkPage from './components/NetworkPage';
import ClientsPage from './components/ClientsPage';
import { primeVoices } from './lib/speech';

/** Fades and lifts each page in on navigation; keyed so it replays per route. */
function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/results" element={<ResultsDashboard />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/clients" element={<ClientsPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    primeVoices();
  }, []);

  return (
    <Router>
      <Shell>
        <ErrorBoundary>
          <AnimatedRoutes />
        </ErrorBoundary>
      </Shell>
    </Router>
  );
}
