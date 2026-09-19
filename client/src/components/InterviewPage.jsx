import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Send, Mic, Square, Volume2, Type } from 'lucide-react';
import axios from 'axios';

const TOTAL_QUESTIONS = 5;

export default function InterviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = location.state?.profile || null;

  // Session State
  const [turn, setTurn] = useState(1);
  const [history, setHistory] = useState([]); // Array of {q, a, mode, wpm}
  const [question, setQuestion] = useState('');
  const [aiReaction, setAiReaction] = useState('');
  
  // Interaction State
  const [answer, setAnswer] = useState('');
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'voice'
  
  // Loading & Recording Flags
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Voice Metrics Context
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [recordingEndTime, setRecordingEndTime] = useState(null);

  const recognitionRef = useRef(null);
  const synthRef = window.speechSynthesis;

  // 1. Initial Start Interview Call
  useEffect(() => {
    const fetchFirstQuestion = async () => {
      try {
        const response = await axios.post('http://localhost:5001/start-interview', { profile: profile || {} });
        setQuestion(response.data.question);
        speakText(response.data.question);
      } catch (error) {
        console.error("Error starting interview:", error);
        setQuestion("Let's get started. Tell me about your background.");
      } finally {
        setIsGenerating(false);
      }
    };
    
    fetchFirstQuestion();

    // cleanup speech synthesis
    return () => {
        if(synthRef) synthRef.cancel();
    }
  }, []);

  // 2. Setup Web Speech API for Dictation
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onstart = () => {
          setIsRecording(true);
          setRecordingStartTime(Date.now());
      };
      
      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            setAnswer((prev) => prev + event.results[i][0].transcript + ' ');
          } else {
            currentTranscript += event.results[i][0].transcript;
          }
        }
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setRecordingEndTime(Date.now());
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      if(synthRef) synthRef.cancel(); // Stop AI speaking if user starts talking
      recognitionRef.current?.start();
    }
  };

  const speakText = (text) => {
    if (!synthRef) return;
    synthRef.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Add slightly more expressive rate for the new conversational feel
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synthRef.speak(utterance);
  };

  const calculateWPM = () => {
      if (inputMode !== 'voice' || !recordingStartTime) return 0;
      const end = recordingEndTime || Date.now();
      const minutes = (end - recordingStartTime) / 60000;
      if (minutes === 0) return 0;
      const wordCount = answer.trim().split(/\s+/).length;
      return Math.round(wordCount / minutes);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!answer.trim()) return;

    if (isRecording) {
        recognitionRef.current?.stop();
        setRecordingEndTime(Date.now());
    }
    if (synthRef) synthRef.cancel();

    setIsSubmitting(true);
    
    // Calculate Telemetry proxy info
    const wpm = calculateWPM();
    const isVoice = inputMode === 'voice';

    // Store the committed turn history
    const completedTurn = { q: question, a: answer.trim(), mode: inputMode, wpm: wpm };
    const updatedHistory = [...history, completedTurn];
    
    try {
      if (turn < TOTAL_QUESTIONS) {
          // INTERVIEW CONTINUES
          const response = await axios.post('http://localhost:5001/next-question', {
              profile: profile,
              history: updatedHistory,
              currentAnswer: answer,
              wpm: wpm,
              isVoice: isVoice
          });
          
          setHistory(updatedHistory);
          setAiReaction(response.data.reaction);
          setQuestion(response.data.question);
          setAnswer('');
          setTurn(turn + 1);
          setRecordingStartTime(null);
          setRecordingEndTime(null);

          // Speak back the conversational dialogue naturally
          speakText(`${response.data.reaction} ${response.data.question}`);
      } else {
          // INTERVIEW OVER -> RUN DEEP ANALYSIS
          setIsGenerating(true); // show full screen loader
          const response = await axios.post('http://localhost:5001/analyze-interview', {
              profile: profile,
              history: updatedHistory
          });

          // Navigate to dashboard
          navigate('/results', { state: { results: response.data, profile: profile, history: updatedHistory } });
      }
    } catch (error) {
      console.error("Error communicating with AI:", error);
      setIsGenerating(false);
      alert("Something went wrong communicating with the AI. Try submitting again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isGenerating && turn === 5) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Interview Complete</h2>
                <p className="text-gray-500 font-medium mt-2">The AI is generating your comprehensive behavioral report...</p>
            </div>
        </div>
      );
  }

  if (isGenerating) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
            <h2 className="text-xl font-medium text-gray-700">AI is reviewing your profile...</h2>
        </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card rounded-[2rem] p-8 md:p-12 shadow-xl border border-white/40 relative overflow-hidden">
        
        {/* Progress Bar Top */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
            <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-out"
                style={{ width: `${(turn / TOTAL_QUESTIONS) * 100}%` }}
            ></div>
        </div>

        <div className="flex items-center justify-between mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 font-semibold text-sm">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                Question {turn} of {TOTAL_QUESTIONS}
            </div>

            <button 
                onClick={() => speakText(`${aiReaction ? aiReaction + ' ' : ''}${question}`)}
                className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-purple-200 text-purple-700 animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                title="Read AI Question Aloud"
            >
                <Volume2 className="w-5 h-5" />
            </button>
        </div>
        
        <div className="mb-8 p-6 rounded-2xl bg-white/40 border border-white shadow-sm space-y-4">
            {aiReaction && (
                <p className="text-lg md:text-xl font-medium text-slate-500 italic border-l-4 border-purple-300 pl-4 py-1">
                    "{aiReaction}"
                </p>
            )}
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-relaxed">
              {question}
            </h2>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center justify-center gap-4 mb-6">
            <button 
                type="button"
                onClick={() => setInputMode('text')} 
                className={`px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all ${inputMode === 'text' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white/50 text-gray-600 hover:bg-white'}`}
            >
                <Type className="w-4 h-4" /> Type Answer
            </button>
            <button 
                type="button"
                onClick={() => setInputMode('voice')} 
                className={`px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all ${inputMode === 'voice' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white/50 text-gray-600 hover:bg-white'}`}
            >
                <Mic className="w-4 h-4" /> Use Voice
            </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <div className={`absolute -inset-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl blur opacity-25 transition duration-1000 ${isRecording ? 'opacity-70 animate-pulse' : 'group-hover:opacity-50'}`}></div>
            
            {inputMode === 'text' ? (
                <textarea
                className="relative w-full h-64 p-6 rounded-2xl bg-white/80 backdrop-blur-sm border-2 border-transparent focus:border-purple-300 focus:ring-4 focus:ring-purple-500/10 placeholder-gray-400 resize-none outline-none font-medium text-gray-700 transition-all text-lg shadow-inner"
                placeholder="Type your answer here... Take a deep breath and be confident."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isSubmitting}
                />
            ) : (
                <div className="relative w-full h-64 p-6 rounded-2xl bg-white/80 backdrop-blur-sm shadow-inner flex flex-col items-center justify-center">
                    <button 
                        type="button"
                        onClick={toggleRecording}
                        className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 ${isRecording ? 'bg-red-500 scale-110 animate-pulse' : 'bg-gradient-to-b from-purple-500 to-pink-500 hover:scale-105'}`}
                    >
                        {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-10 h-10" />}
                    </button>
                    <p className={`mt-6 font-medium text-lg ${isRecording ? 'text-red-500' : 'text-gray-500'}`}>
                        {isRecording ? "Listening... click to stop" : "Click to start speaking"}
                    </p>

                    {/* Live Dictation Display */}
                    {answer && (
                        <div className="mt-8 p-4 bg-gray-50/80 rounded-xl w-full text-left overflow-y-auto max-h-24 text-gray-700 italic border border-gray-100 relative">
                            {inputMode === 'voice' && isRecording && recordingStartTime && (
                               <div className="absolute top-2 right-2 text-[10px] uppercase font-bold text-red-500 tracking-wider flex items-center gap-1">
                                   <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                   Live
                               </div>
                            )}
                            "{answer}"
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100/50">
            <p className="text-sm font-medium text-gray-500">
              {answer.trim().split(/\s+/).filter(w => w.length > 0).length} words
            </p>
            
            <button
              type="submit"
              disabled={!answer.trim() || isSubmitting || isRecording}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {turn < TOTAL_QUESTIONS ? "Submit & Continue" : "Finish Interview"}
                  <Send className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
