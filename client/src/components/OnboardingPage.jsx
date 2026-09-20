import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { speechSupported } from '../lib/speech';
import { saveProfile, loadProfile, clearInterview } from '../lib/session';
import { useToast } from '../lib/context';

const STEPS = [
  { id: 1, eyebrow: 'Step one', title: 'Who is answering.', sub: 'So the interviewer can use your name.' },
  { id: 2, eyebrow: 'Step two', title: 'What you are after.', sub: 'This shapes every question you get.' },
  { id: 3, eyebrow: 'Step three', title: 'How it should run.', sub: 'Format, length and difficulty.' },
  { id: 4, eyebrow: 'Step four', title: 'Speak or type.', sub: 'Optional — typing works just as well.' },
];

function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between gap-4">
        <span className="t-reduced font-semibold text-ink">{label}</span>
        {hint && <span className="t-foot">{hint}</span>}
      </span>
      {children}
      {error && <span className="t-foot mt-2 block text-burgundy">{error}</span>}
    </label>
  );
}

function Choice({ options, value, onChange, columns = 3 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
      {options.map(([val, label, sub]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`rounded-[var(--radius-media)] border px-4 py-3.5 text-left transition-[border-color,background-color] duration-[.32s] ${
            value === val
              ? 'border-accent bg-[var(--accent-wash)]'
              : 'border-rule-strong bg-ground hover:border-ink-mute'
          }`}
        >
          <span className="block text-[15px] font-medium tracking-[-.014em] text-ink">{label}</span>
          {sub && <span className="t-foot mt-0.5 block">{sub}</span>}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const prefill = location.state?.prefill;
  const saved = loadProfile();

  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const [formData, setFormData] = useState({
    name: prefill?.name || saved?.name || '',
    age: saved?.age || '',
    targetRole: prefill?.targetRole || saved?.targetRole || '',
    experience: prefill?.experience ?? saved?.experience ?? '',
    industry: prefill?.industry || saved?.industry || '',
    englishProficiency: saved?.englishProficiency || 'Intermediate',
    interviewType: saved?.interviewType || 'Behavioral',
    questionCount: saved?.questionCount || 5,
    voiceSampleChecked: false,
  });

  useEffect(() => {
    if (prefill) {
      toast({
        title: 'Filled in from your resume',
        description: 'Check it over, then start.',
        variant: 'success',
      });
    }
    return () => recognitionRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch) => setFormData((f) => ({ ...f, ...patch }));
  const handleChange = (e) => update({ [e.target.name]: e.target.value });

  const roleError = touched && !formData.targetRole.trim() ? 'A target role is required.' : null;

  const goNext = () => {
    if (step === 2 && !formData.targetRole.trim()) {
      setTouched(true);
      return;
    }
    setTouched(false);
    setStep((s) => Math.min(s + 1, 4));
  };

  const handleVoiceTest = () => {
    if (!speechSupported()) {
      update({ voiceSampleChecked: true });
      toast({
        title: 'No speech recognition here',
        description: 'This browser cannot transcribe. You can still type your answers.',
        variant: 'info',
      });
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = () => {
      update({ voiceSampleChecked: true });
      setIsRecording(false);
      toast({ title: 'Microphone works', variant: 'success', duration: 3000 });
    };
    recognition.onerror = (event) => {
      setIsRecording(false);
      toast({
        title: 'Microphone check failed',
        description:
          event.error === 'not-allowed'
            ? 'Permission denied. Allow the microphone, or type instead.'
            : `Speech recognition error: ${event.error}`,
        variant: 'error',
      });
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const submit = () => {
    if (!formData.targetRole.trim()) {
      setTouched(true);
      setStep(2);
      return;
    }
    clearInterview();
    saveProfile(formData);
    navigate('/interview', { state: { profile: formData } });
  };

  const active = STEPS[step - 1];

  return (
    <div className="mx-auto max-w-[46rem] pb-16">
      {/* Progress: four rules, filled left to right. */}
      <div className="mb-10 flex gap-2">
        {STEPS.map((s) => (
          <span
            key={s.id}
            className="h-px flex-1 transition-colors duration-[.32s]"
            style={{ background: s.id <= step ? 'var(--accent)' : 'var(--rule)' }}
          />
        ))}
      </div>

      <div key={step} className="rise">
        <p className="eyebrow">{active.eyebrow}</p>
        <h1 className="t-lg mt-4">{active.title}</h1>
        <p className="t-body mt-3 text-ink-soft">{active.sub}</p>

        <div className="mt-10 space-y-7">
          {step === 1 && (
            <>
              <Field label="Full name" hint="optional">
                <input
                  name="name" value={formData.name} onChange={handleChange}
                  className="field" placeholder="Aman Dixit" autoComplete="name"
                />
              </Field>
              <Field label="Age" hint="optional">
                <input
                  name="age" type="number" min="14" max="99"
                  value={formData.age} onChange={handleChange}
                  className="field" placeholder="21"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Target role" hint="required" error={roleError}>
                <input
                  name="targetRole" value={formData.targetRole} onChange={handleChange}
                  onBlur={() => setTouched(true)} aria-invalid={Boolean(roleError)}
                  className="field" placeholder="Frontend Developer"
                />
              </Field>
              <Field label="Industry" hint="optional">
                <input
                  name="industry" value={formData.industry} onChange={handleChange}
                  className="field" placeholder="Tech, Finance, Healthcare"
                />
              </Field>
              <Field label="Years of experience">
                <input
                  name="experience" type="number" min="0" max="50"
                  value={formData.experience} onChange={handleChange}
                  className="field" placeholder="0 if you are a fresher"
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Interview type">
                <Choice
                  options={[
                    ['Behavioral', 'Behavioural', 'Soft skills'],
                    ['Technical', 'Technical', 'Role depth'],
                    ['HR', 'HR screen', 'First call'],
                  ]}
                  value={formData.interviewType}
                  onChange={(v) => update({ interviewType: v })}
                />
              </Field>
              <Field label="Questions">
                <Choice
                  options={[
                    [3, 'Three', 'About 5 min'],
                    [5, 'Five', 'About 10 min'],
                    [8, 'Eight', 'About 18 min'],
                  ]}
                  value={formData.questionCount}
                  onChange={(v) => update({ questionCount: v })}
                />
              </Field>
              <Field label="English proficiency">
                <select
                  name="englishProficiency" value={formData.englishProficiency}
                  onChange={handleChange} className="field"
                >
                  <option value="Basic">Basic</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Fluent">Fluent / Native</option>
                </select>
              </Field>
            </>
          )}

          {step === 4 && (
            <div className="py-2">
              <p className="t-body max-w-[46ch] text-ink-soft">
                Speaking lets HireUS measure your pace and filler words. Skip it and type —
                the interview runs either way.
              </p>

              <button
                onClick={handleVoiceTest}
                className={`mt-9 grid h-24 w-24 place-items-center rounded-full transition-[background-color,transform] duration-[.32s] ${
                  isRecording
                    ? 'scale-105 bg-burgundy text-ground'
                    : formData.voiceSampleChecked
                      ? 'bg-accent text-white'
                      : 'border border-rule-strong bg-ground text-ink hover:bg-ground-alt'
                }`}
                aria-label="Test microphone"
              >
                {formData.voiceSampleChecked && !isRecording ? (
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5 5L20 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                )}
              </button>

              <p className="t-reduced mt-5 text-ink-soft" role="status" aria-live="polite">
                {isRecording
                  ? 'Listening — say anything'
                  : formData.voiceSampleChecked
                    ? 'Microphone verified'
                    : 'Tap to test your microphone'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="ruled-top mt-12 flex items-center justify-between gap-4 pt-7">
        {step > 1 ? (
          <button onClick={() => setStep((s) => s - 1)} className="btn btn-quiet">
            Back
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-4">
          {step === 4 && !formData.voiceSampleChecked && (
            <button onClick={submit} className="btn-text">
              Skip and type
            </button>
          )}
          <button onClick={step < 4 ? goNext : submit} className="btn btn-fill">
            {step < 4 ? 'Continue' : 'Start interview'}
          </button>
        </div>
      </div>
    </div>
  );
}
