import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Stethoscope,
  Video,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.ts';
import type {
  DoctorProfileDoc,
  MedicalRecordDoc,
  PatientProfileDoc,
} from '../services/careoneDb.ts';

export interface AISummary {
  concern_overview?: string;
  symptoms_mentioned?: string[];
  duration_and_severity?: string;
  suggested_specialist?: string;
  consultation_advised?: boolean;
  emergency_warning?: string;
  next_steps?: string[];
  recommended_actions?: string[];
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant' | 'integration_notice';
  content: string;
  streaming?: boolean;
  stage?: 'intake' | 'summary' | 'emergency';
  summary?: AISummary | null;
  recommended_doctors?: DoctorProfileDoc[];
}

export interface NavigateOptions {
  specialization?: string;
  videoOnly?: boolean;
  focusHospitals?: boolean;
}

interface AIHealthAssistantProps {
  patientName: string;
  patientProfile?: PatientProfileDoc | null;
  verifiedDoctors: DoctorProfileDoc[];
  medicalRecords: MedicalRecordDoc[];
  onNavigate: (tab: string, options?: NavigateOptions) => void;
  onBookDoctor?: (doc: DoctorProfileDoc, summary?: AISummary | null) => void;
}

const STARTER_PROMPTS = [
  'I have a headache.',
  'I am experiencing fever.',
  'I need help finding a doctor.',
  'I want to understand my medical report.',
];

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function matchDoctorsBySpecialist(
  doctors: DoctorProfileDoc[],
  suggestedSpecialist?: string
): DoctorProfileDoc[] {
  const verified = doctors.filter((d) => d.verificationStatus === 'verified');
  const norm = (suggestedSpecialist || '').trim().toLowerCase();
  if (!norm) return verified.slice(0, 4);

  const matched = verified.filter((d) => {
    const docSpec = (d.specialization || '').toLowerCase();
    return (
      docSpec.includes(norm) ||
      norm.includes(docSpec) ||
      (norm.includes('general') && (docSpec.includes('internal') || docSpec.includes('general'))) ||
      (norm.includes('physician') && (docSpec.includes('internal') || docSpec.includes('general'))) ||
      (norm.includes('cardio') && docSpec.includes('cardio')) ||
      (norm.includes('neuro') && docSpec.includes('neuro')) ||
      (norm.includes('pulmo') && docSpec.includes('pulmo')) ||
      (norm.includes('derm') && docSpec.includes('derm')) ||
      (norm.includes('ortho') && docSpec.includes('ortho'))
    );
  });

  return (matched.length > 0 ? matched : verified).slice(0, 4);
}

export function AIHealthAssistant({
  patientName,
  patientProfile,
  verifiedDoctors,
  medicalRecords,
  onNavigate,
  onBookDoctor,
}: AIHealthAssistantProps) {
  const { getIdToken } = useAuthStore();
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const speechSupported = Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch('/api/ai/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (active && res.ok) {
          setGeminiConfigured(Boolean(data.configured));
        }
      } catch {
        if (active) setGeminiConfigured(null);
      }
    })();
    return () => {
      active = false;
      recognitionRef.current?.stop();
    };
  }, [getIdToken]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const toggleVoiceInput = () => {
    setVoiceFeedback(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceFeedback('Voice input is not supported in this browser.');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      const baseText = input.trim();

      recognition.onresult = (event) => {
        const parts: string[] = [];
        for (let i = 0; i < event.results.length; i += 1) {
          parts.push(event.results[i][0]?.transcript || '');
        }
        const transcript = parts.join(' ').trim();
        setInput(baseText ? `${baseText} ${transcript}`.trim() : transcript);
      };

      recognition.onerror = () => {
        setListening(false);
        setVoiceFeedback('Microphone capture could not be completed. Please type your concern.');
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setVoiceFeedback('Unable to start microphone input.');
    }
  };

  const buildPatientContextPayload = () => ({
    fullName: patientProfile?.fullName || patientName,
    bloodGroup: patientProfile?.bloodGroup || '',
    allergies: patientProfile?.allergies || '',
    chronicConditions: patientProfile?.chronicConditions || '',
    specializations: Array.from(
      new Set(verifiedDoctors.map((d) => d.specialization).filter(Boolean))
    ).slice(0, 30),
    recentRecords: medicalRecords.slice(0, 5).map((r) => ({
      title: r.title,
      recordType: r.recordType,
      recordDate: r.recordDate,
      summary: r.summary || '',
    })),
  });

  const sendMessage = async (textOverride?: string) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || sending) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const assistantId = `a-${Date.now() + 1}`;
    const placeholderAssistant: ChatTurn = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };

    const nextHistory = [...messages, userTurn];
    setMessages([...nextHistory, placeholderAssistant]);
    if (!textOverride) setInput('');
    setVoiceFeedback(null);
    setSending(true);

    const payloadMessages = nextHistory
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const patientContext = buildPatientContextPayload();

    const removePlaceholder = () => {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    };

    try {
      const token = await getIdToken();
      if (!token) {
        removePlaceholder();
        setMessages((prev) => [
          ...prev,
          {
            id: `n-${Date.now()}`,
            role: 'integration_notice',
            content: 'Please sign in again to access CareOne AI Health Assistant.',
          },
        ]);
        return;
      }

      const response = await fetch('/api/ai/assistant/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: payloadMessages, patientContext }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        removePlaceholder();
        if (response.status === 503 && errData?.configured === false) {
          setGeminiConfigured(false);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `n-${Date.now()}`,
            role: 'integration_notice',
            content: errData?.error || 'Unable to reach CareOne AI assistant.',
          },
        ]);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream') || !response.body) {
        const jsonRes = await fetch('/api/ai/assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages: payloadMessages, patientContext }),
        });
        const data = await jsonRes.json().catch(() => ({}));
        if (!jsonRes.ok) {
          removePlaceholder();
          setMessages((prev) => [
            ...prev,
            {
              id: `e-${Date.now()}`,
              role: 'integration_notice',
              content: data?.error || 'Unable to reach CareOne AI assistant.',
            },
          ]);
          return;
        }
        setGeminiConfigured(true);
        const docs =
          data.stage === 'summary' || data.stage === 'emergency' || data.summary?.suggested_specialist
            ? matchDoctorsBySpecialist(verifiedDoctors, data.summary?.suggested_specialist)
            : [];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: data.reply,
                  streaming: false,
                  stage: data.stage || 'intake',
                  summary: data.summary || null,
                  recommended_doctors: docs,
                }
              : m
          )
        );
        return;
      }

      setGeminiConfigured(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const jsonText = line.slice(5).trim();
          if (!jsonText) continue;

          try {
            const evt = JSON.parse(jsonText);
            if (evt.type === 'delta' && typeof evt.text === 'string') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + evt.text } : m
                )
              );
            } else if (evt.type === 'final') {
              streamDone = true;
              const docs =
                evt.stage === 'summary' || evt.stage === 'emergency' || evt.summary?.suggested_specialist
                  ? matchDoctorsBySpecialist(verifiedDoctors, evt.summary?.suggested_specialist)
                  : [];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: evt.reply || m.content,
                        streaming: false,
                        stage: evt.stage || 'intake',
                        summary: evt.summary || null,
                        recommended_doctors: docs,
                      }
                    : m
                )
              );
            } else if (evt.type === 'error') {
              streamDone = true;
              removePlaceholder();
              setMessages((prev) => [
                ...prev,
                {
                  id: `e-${Date.now()}`,
                  role: 'integration_notice',
                  content: evt.error || 'Unable to reach the CareOne Gemini assistant.',
                },
              ]);
            }
          } catch {
            // Ignore partial SSE JSON chunk
          }
        }
      }
    } catch (err) {
      removePlaceholder();
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'integration_notice',
          content: err instanceof Error ? err.message : 'Unable to reach the CareOne assistant.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleReset = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setMessages([]);
    setInput('');
    setVoiceFeedback(null);
  };

  const firstName = (patientName || 'Patient').trim();
  const hasConversation = messages.length > 0;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-white border border-black/[0.07] shadow-2xs">
          <span className="w-5 h-5 rounded-md bg-[#1d1d1f] flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </span>
          <span className="text-[13px] font-semibold text-[#1d1d1f]">CareOne Health Assistant</span>
          {geminiConfigured !== null && (
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                geminiConfigured ? 'bg-[#ECFDF3] text-[#067647]' : 'bg-[#FEF3C7] text-[#B45309]'
              }`}
            >
              {geminiConfigured ? 'Live AI Ready' : 'AI Setup Pending'}
            </span>
          )}
        </div>

        {hasConversation && (
          <button
            type="button"
            onClick={handleReset}
            className="mac-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>New Conversation</span>
          </button>
        )}
      </div>

      {!hasConversation && (
        <div className="glass-card p-7 sm:p-9 space-y-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-[14px] font-medium text-[#0071e3]">Hello, {firstName}</p>
            <h1 className="text-[28px] sm:text-[34px] font-semibold leading-[1.15] text-[#1d1d1f]">
              How can we help you today?
            </h1>
            <p className="text-[15px] text-[#6e6e73] leading-relaxed">
              Tell us what you&apos;re experiencing. Let&apos;s understand your concern together and connect you with verified CareOne doctors.
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              Suggested conversation starters
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STARTER_PROMPTS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void sendMessage(starter)}
                  className="text-left px-4 py-3 rounded-xl bg-[#f5f5f7]/80 border border-black/[0.07] hover:border-[#0071e3]/45 hover:bg-white transition-all flex items-center justify-between gap-3 group"
                >
                  <span className="text-[14px] font-medium text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">
                    {starter}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#86868b] group-hover:text-[#0071e3] shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasConversation && (
        <div className="space-y-4">
          {messages.map((turn) => {
            if (turn.role === 'user') {
              return (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-[#0071e3] px-4 py-3 text-white shadow-xs">
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{turn.content}</p>
                  </div>
                </div>
              );
            }

            if (turn.role === 'integration_notice') {
              return (
                <div key={turn.id} className="flex justify-start">
                  <div className="w-full max-w-2xl glass-card !p-5 space-y-3 border-amber-200">
                    <div className="flex items-center gap-2 text-[#b45309]">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span className="text-[13px] font-semibold">Assistant Temporarily Unavailable</span>
                    </div>
                    <p className="text-[13px] text-[#6e6e73] leading-relaxed">{turn.content}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('doctors')}
                        className="mac-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>Find a Doctor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('doctors', { focusHospitals: true })}
                        className="mac-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#0071e3]" />
                        <span>View Hospitals</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('emergency')}
                        className="mac-btn-danger inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Ambulance className="w-3.5 h-3.5" />
                        <span>Emergency Assistance</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const isEmergency = turn.stage === 'emergency' || Boolean(turn.summary?.emergency_warning);

            return (
              <div key={turn.id} className="flex flex-col items-start gap-3">
                <div className="max-w-[90%] sm:max-w-[82%] glass-card !p-4 sm:!p-5 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className={`w-3.5 h-3.5 text-[#0071e3] ${turn.streaming ? 'animate-pulse' : ''}`} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0071e3]">
                      CareOne Assistant
                    </span>
                  </div>
                  {turn.content ? (
                    <p className="text-[14px] leading-relaxed text-[#1d1d1f] whitespace-pre-wrap">
                      {turn.content}
                      {turn.streaming && (
                        <span className="inline-block w-1.5 h-4 ml-1 bg-[#0071e3] align-middle animate-pulse" />
                      )}
                    </p>
                  ) : (
                    <p className="text-[13px] text-[#6e6e73]">Thinking...</p>
                  )}
                </div>

                {isEmergency && (
                  <div className="w-full max-w-2xl rounded-2xl bg-red-50 border border-red-200 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13px] font-semibold text-[#991b1b]">Urgent Medical Attention Recommended</p>
                        <p className="text-[12px] text-[#7f1d1d] mt-0.5">
                          {turn.summary?.emergency_warning ||
                            'Some symptoms you described may require prompt emergency evaluation.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('emergency')}
                      className="mac-btn-danger inline-flex items-center gap-1.5 px-4 py-2 text-[12px] shrink-0"
                    >
                      <Ambulance className="w-3.5 h-3.5" />
                      <span>Emergency Assistance</span>
                    </button>
                  </div>
                )}

                {turn.summary && (
                  <div className="w-full max-w-2xl glass-card !p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#15803d]" />
                        <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Summary of Your Concern</h3>
                      </div>
                      {turn.summary.suggested_specialist && (
                        <span className="text-[12px] font-medium px-2.5 py-1 rounded-lg bg-[#0071e3]/10 text-[#0071e3]">
                          Suggested Specialist: {turn.summary.suggested_specialist}
                        </span>
                      )}
                    </div>

                    {turn.summary.concern_overview && (
                      <p className="text-[13px] text-[#1d1d1f] leading-relaxed">{turn.summary.concern_overview}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                      {turn.summary.symptoms_mentioned && turn.summary.symptoms_mentioned.length > 0 && (
                        <div className="glass-surface-inset p-3.5 space-y-1.5">
                          <p className="font-semibold text-[#1d1d1f]">Symptoms Mentioned</p>
                          <ul className="space-y-1 text-[#6e6e73]">
                            {turn.summary.symptoms_mentioned.map((sym, idx) => (
                              <li key={idx}>• {sym}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="glass-surface-inset p-3.5 space-y-1.5">
                        <p className="font-semibold text-[#1d1d1f]">Assessment & Next Steps</p>
                        {turn.summary.duration_and_severity && (
                          <p className="text-[#6e6e73]">
                            <span className="font-medium text-[#1d1d1f]">Timeline/Severity:</span>{' '}
                            {turn.summary.duration_and_severity}
                          </p>
                        )}
                        <p className="text-[#15803d] font-medium">
                          {turn.summary.consultation_advised
                            ? 'Doctor consultation is advisable.'
                            : 'Monitor closely; consult a doctor if symptoms worsen.'}
                        </p>
                        {turn.summary.next_steps && turn.summary.next_steps.length > 0 && (
                          <ul className="space-y-1 text-[#6e6e73] pt-0.5">
                            {turn.summary.next_steps.map((step, idx) => (
                              <li key={idx}>• {step}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {turn.recommended_doctors && turn.recommended_doctors.length > 0 ? (
                      <div className="pt-3 border-t border-black/[0.07] space-y-3">
                        <p className="text-[13px] font-semibold text-[#1d1d1f]">
                          Verified CareOne Specialists Available to Book
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {turn.recommended_doctors.map((doc) => (
                            <div
                              key={doc.uid}
                              className="glass-surface-inset p-3.5 space-y-2 flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[14px] font-semibold text-[#1d1d1f]">{doc.fullName}</p>
                                  <span className="text-[12px] font-mono-tabular font-medium text-[#0071e3]">
                                    INR {doc.consultationFee}
                                  </span>
                                </div>
                                <p className="text-[12px] font-medium text-[#15803d] mt-0.5">{doc.specialization}</p>
                                <p className="text-[11px] text-[#6e6e73] truncate mt-1">
                                  {doc.hospitalName || 'Independent Practice'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onBookDoctor?.(doc, turn.summary)}
                                className="mac-btn-primary w-full py-1.5 text-[12px] mt-1"
                              >
                                Book Appointment
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-black/[0.07] text-[12px] text-[#6e6e73]">
                        No verified doctors matching &ldquo;{turn.summary.suggested_specialist || 'this specialty'}&rdquo; are currently active on the directory. Check &ldquo;Find a Doctor&rdquo; as verified doctors join.
                      </div>
                    )}

                    <div className="pt-2 border-t border-black/[0.07] flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('doctors', {
                            specialization: turn.summary?.suggested_specialist,
                          })
                        }
                        className="mac-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>Find a Doctor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('doctors', {
                            specialization: turn.summary?.suggested_specialist,
                          })
                        }
                        className="mac-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <CalendarClock className="w-3.5 h-3.5 text-[#0071e3]" />
                        <span>Browse Slots</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('viddoc', {
                            specialization: turn.summary?.suggested_specialist,
                            videoOnly: true,
                          })
                        }
                        className="mac-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Video className="w-3.5 h-3.5 text-[#0071e3]" />
                        <span>Video Consultation</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('doctors', { focusHospitals: true })}
                        className="mac-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#0071e3]" />
                        <span>View Hospitals</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div ref={threadEndRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card !p-4 sm:!p-5 space-y-3">
        <label htmlFor="careone-symptom-input" className="sr-only">
          Describe your health problem or symptoms
        </label>
        <textarea
          id="careone-symptom-input"
          rows={hasConversation ? 2 : 3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your health problem or symptoms..."
          className="w-full px-4 py-3 glass-input text-[15px] leading-relaxed resize-none"
        />

        {voiceFeedback && <p className="text-[12px] text-[#0071e3]">{voiceFeedback}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleVoiceInput}
            title={speechSupported ? 'Voice input' : 'Voice input unsupported in this browser'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] rounded-xl border transition-colors ${
              listening
                ? 'bg-[#0071e3]/10 border-[#0071e3] text-[#0071e3] font-medium'
                : 'mac-btn-secondary text-[#6e6e73]'
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#0071e3]" />}
            <span>{listening ? 'Stop Listening' : 'Voice Input'}</span>
          </button>

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="mac-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-[13px] disabled:opacity-45"
          >
            <span>{sending ? 'Replying...' : 'Send'}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      <p className="text-center text-[12px] text-[#86868b]">
        CareOne AI provides general health guidance only and does not provide a confirmed diagnosis, replace a doctor, or prescribe medication. For emergencies, use{' '}
        <button
          type="button"
          onClick={() => onNavigate('emergency')}
          className="text-[#0071e3] hover:underline font-medium"
        >
          Emergency Assistance
        </button>
        .
      </p>
    </div>
  );
}
