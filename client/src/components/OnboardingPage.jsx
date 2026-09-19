import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    targetRole: '',
    experience: '',
    industry: '',
    englishProficiency: 'Intermediate',
    interviewType: 'Behavioral',
    voiceSampleChecked: false
  });
  
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleVoiceTest = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Your browser doesn't support speech recognition.");
      setFormData({ ...formData, voiceSampleChecked: true }); // bypass for unsupported browsers
      return;
    }
    
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => setIsRecording(true);
    recognitionRef.current.onresult = () => {
        setFormData({ ...formData, voiceSampleChecked: true });
        setIsRecording(false);
    };
    recognitionRef.current.onerror = () => setIsRecording(false);
    recognitionRef.current.onend = () => setIsRecording(false);

    recognitionRef.current.start();
  };

  const submitOnboarding = () => {
      // In a real app we'd save this to global state or context. 
      // For now, we will pass it strictly to the interview page via location state.
      navigate('/interview', { state: { profile: formData } });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in zoom-in-95 duration-500">
      
      <div className="max-w-2xl w-full glass-card rounded-[2rem] p-10 md:p-14 shadow-2xl relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
            <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${(step / 4) * 100}%` }}
            ></div>
        </div>

        <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">
                {step === 1 && "Let's Get Started"}
                {step === 2 && "Your Career Goals"}
                {step === 3 && "Interview Preferences"}
                {step === 4 && "Voice Capabilities Check"}
            </h2>
            <p className="text-gray-500 font-medium">Step {step} of 4</p>
        </div>

        <div className="space-y-6">
            {step === 1 && (
                <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-purple-400 outline-none transition-all shadow-sm" placeholder="John Doe" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Age (Optional)</label>
                        <input name="age" type="number" value={formData.age} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-purple-400 outline-none transition-all shadow-sm" placeholder="25" />
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Target Role</label>
                        <input name="targetRole" value={formData.targetRole} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-purple-400 outline-none transition-all shadow-sm" placeholder="Frontend Developer, Product Manager..." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Industry</label>
                        <input name="industry" value={formData.industry} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-purple-400 outline-none transition-all shadow-sm" placeholder="Tech, Finance, Healthcare..." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Years of Experience</label>
                        <input name="experience" type="number" value={formData.experience} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-purple-400 outline-none transition-all shadow-sm" placeholder="e.g. 3" />
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">English Proficiency</label>
                        <select name="englishProficiency" value={formData.englishProficiency} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-purple-400 outline-none transition-all shadow-sm">
                            <option value="Basic">Basic</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Fluent">Fluent / Native</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Interview Type</label>
                        <select name="interviewType" value={formData.interviewType} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-purple-400 outline-none transition-all shadow-sm">
                            <option value="Behavioral">Behavioral (Soft Skills)</option>
                            <option value="Technical">Technical</option>
                            <option value="HR">HR Screen</option>
                        </select>
                    </div>
                </div>
            )}

            {step === 4 && (
                <div className="text-center space-y-8 animate-in slide-in-from-right-8 duration-300 py-6">
                    <p className="text-gray-600 font-medium text-lg leading-relaxed">
                        HireUS works best when evaluating your actual speaking style. Let's do a quick microphone verify.
                    </p>
                    
                    <button 
                        onClick={handleVoiceTest}
                        className={`inline-flex items-center gap-3 px-8 py-4 rounded-full font-bold text-white transition-all shadow-xl ${isRecording ? 'bg-red-500 animate-pulse scale-105' : formData.voiceSampleChecked ? 'bg-emerald-500' : 'bg-slate-900 hover:scale-105 hover:bg-black'}`}
                    >
                        {isRecording ? <Mic className="w-6 h-6" /> : formData.voiceSampleChecked ? <CheckCircle className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                        {isRecording ? "Listening... say something" : formData.voiceSampleChecked ? "Mic Verified!" : "Test Microphone"}
                    </button>
                    {!formData.voiceSampleChecked && !isRecording && (
                         <p className="text-sm text-gray-400 mt-2">Click and say "Hello HireUS"</p>
                    )}
                </div>
            )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-gray-100">
            {step > 1 ? (
                <button onClick={handlePrev} className="inline-flex items-center gap-2 text-gray-600 font-bold hover:text-black transition-colors px-4 py-2">
                    <ArrowLeft className="w-5 h-5" /> Back
                </button>
            ) : <div></div>}

            {step < 4 ? (
                <button onClick={handleNext} className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all">
                    Next Step <ArrowRight className="w-5 h-5" />
                </button>
            ) : (
                <button 
                    onClick={submitOnboarding} 
                    disabled={!formData.voiceSampleChecked && !formData.targetRole}
                    className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Start Interview
                </button>
            )}
        </div>
      </div>
    </div>
  );
}
