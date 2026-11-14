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
import axios from 'axios';
import { api, getApiErrorMessage } from '../services/api.ts';

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
  stage?: 'intake' | 'summary' | 'emergency';
  summary?: AISummary | null;
  endpoint?: string;
}

export interface NavigateOptions {
  specialization?: string;
  videoOnly?: boolean;
  focusHospitals?: boolean;
}

interface AIHealthAssistantProps {
  patientName: string;
  onNavigate: (tab: string, options?: NavigateOptions) => void;
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

export function AIHealthAssistant({ patientName, onNavigate }: AIHealthAssistantProps) {
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
    api
      .get('/ai/status')
      .then((res) => {
        if (active) {
          setGeminiConfigured(Boolean(res.data?.configured));
        }
      })
      .catch(() => {
        if (active) setGeminiConfigured(null);
      });
    return () => {
      active = false;
      recognitionRef.current?.stop();
    };
  }, []);

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

    const nextHistory = [...messages, userTurn];
    setMessages(nextHistory);
    if (!textOverride) setInput('');
    setVoiceFeedback(null);
    setSending(true);

    const payloadMessages = nextHistory
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await api.post('/ai/assistant', { messages: payloadMessages });
      setGeminiConfigured(true);
      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.data.reply,
        stage: res.data.stage || 'intake',
        summary: res.data.summary || null,
      };
      setMessages((prev) => [...prev, assistantTurn]);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 503 && err.response?.data?.configured === false) {
        setGeminiConfigured(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `n-${Date.now()}`,
            role: 'integration_notice',
            content:
              err.response?.data?.error ||
              'Gemini backend credentials are not configured on the server yet.',
            endpoint: err.response?.data?.endpoint || '/api/ai/assistant',
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'integration_notice',
            content: getApiErrorMessage(err, 'Unable to reach the CareOne Gemini assistant endpoint.'),
            endpoint: '/api/ai/assistant',
          },
        ]);
      }
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
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Top CareOne AI Branding Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#232269] border border-[#00b1ff]/30">
          <span className="w-5 h-5 rounded-md bg-[#5350cc] flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-[#00ffaa]" />
          </span>
          <span className="text-[12px] font-semibold tracking-wide text-white">CareOne AI Health Assistant</span>
          {geminiConfigured !== null && (
            <span
              className={`text-[11px] font-mono-tabular px-2 py-0.5 rounded-full ${
                geminiConfigured
                  ? 'bg-[#00ffaa]/15 text-[#00ffaa]'
                  : 'bg-[#00b1ff]/15 text-[#00b1ff]'
              }`}
            >
              {geminiConfigured ? 'Gemini Connected' : 'Awaiting Gemini Key'}
            </span>
          )}
        </div>

        {hasConversation && (
          <button
            type="button"
            onClick={handleReset}
            className="obs-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#00b1ff]" />
            <span>New Conversation</span>
          </button>
        )}
      </div>

      {/* Welcoming Hero (First Screen After Login) */}
      {!hasConversation && (
        <div className="obs-card relative overflow-hidden p-7 sm:p-10 space-y-6">
          <div className="space-y-2.5 max-w-2xl">
            <p className="text-[14px] font-medium text-[#00ffaa] tracking-wide">
              Hello, {firstName}
            </p>
            <h1 className="text-[28px] sm:text-[36px] font-semibold leading-[1.15] text-white">
              How can we help you today?
            </h1>
            <p className="text-[15px] sm:text-[16px] text-[#b0b3d6] leading-relaxed">
              Tell us what you're experiencing. Let's understand your concern together.
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="text-[12px] font-medium uppercase tracking-wider text-[#8f93c4]">
              Suggested conversation starters
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STARTER_PROMPTS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void sendMessage(starter)}
                  className="text-left px-4 py-3 rounded-xl bg-[#16165c]/80 border border-white/12 hover:border-[#00b1ff]/60 hover:bg-[#16165c] transition-all flex items-center justify-between gap-3 group"
                >
                  <span className="text-[14px] font-medium text-white group-hover:text-[#00b1ff] transition-colors">
                    {starter}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#8f93c4] group-hover:text-[#00ffaa] shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conversational Thread */}
      {hasConversation && (
        <div className="space-y-4">
          {messages.map((turn) => {
            if (turn.role === 'user') {
              return (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-[#5350cc] border border-[#00b1ff]/35 px-4 py-3 text-white shadow-lg">
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{turn.content}</p>
                  </div>
                </div>
              );
            }

            if (turn.role === 'integration_notice') {
              return (
                <div key={turn.id} className="flex justify-start">
                  <div className="w-full max-w-2xl rounded-2xl bg-[#232269] border border-[#00b1ff]/45 p-5 space-y-3 shadow-lg">
                    <div className="flex items-center gap-2 text-[#00b1ff]">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span className="text-[13px] font-semibold">Backend Gemini Integration Point Ready</span>
                    </div>
                    <p className="text-[13px] text-[#e2e4f6] leading-relaxed">{turn.content}</p>
                    <p className="text-[12px] font-mono-tabular text-[#b0b3d6] bg-[#16165c] px-3 py-2 rounded-lg border border-white/10">
                      Endpoint: POST {turn.endpoint || '/api/ai/assistant'} (server/routes/ai.routes.ts)
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('doctors')}
                        className="obs-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>Find a Doctor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('doctors', { focusHospitals: true })}
                        className="obs-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#00b1ff]" />
                        <span>View Nearby Hospitals</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('emergency')}
                        className="obs-btn-danger inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
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
                <div className="max-w-[90%] sm:max-w-[82%] rounded-2xl rounded-bl-sm bg-[#232269] border border-white/12 px-5 py-3.5 text-white shadow-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00ffaa]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#00b1ff]">
                      CareOne Assistant
                    </span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-[#f3f4ff] whitespace-pre-wrap">{turn.content}</p>
                </div>

                {isEmergency && (
                  <div className="w-full max-w-2xl rounded-2xl bg-[#3d172e] border border-[#ff6b6b]/60 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-[#ff6b6b] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13px] font-semibold text-white">Urgent Medical Attention Recommended</p>
                        <p className="text-[12px] text-[#ffd6d6] mt-0.5">
                          {turn.summary?.emergency_warning ||
                            'Some symptoms you described may require prompt emergency evaluation.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('emergency')}
                      className="obs-btn-danger inline-flex items-center gap-1.5 px-4 py-2 text-[12px] shrink-0"
                    >
                      <Ambulance className="w-3.5 h-3.5" />
                      <span>Emergency Assistance</span>
                    </button>
                  </div>
                )}

                {turn.summary && (
                  <div className="w-full max-w-2xl obs-card p-5 space-y-4 border-[#00b1ff]/35">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#00ffaa]" />
                        <h3 className="text-[15px] font-semibold text-white">Summary of Your Concern</h3>
                      </div>
                      {turn.summary.suggested_specialist && (
                        <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#5350cc]/50 border border-[#00b1ff]/40 text-[#00ffaa]">
                          Suggested Specialist: {turn.summary.suggested_specialist}
                        </span>
                      )}
                    </div>

                    {turn.summary.concern_overview && (
                      <p className="text-[13px] text-[#e2e4f6] leading-relaxed">{turn.summary.concern_overview}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                      {turn.summary.symptoms_mentioned && turn.summary.symptoms_mentioned.length > 0 && (
                        <div className="obs-card-inset p-3 space-y-1.5">
                          <p className="font-semibold text-[#00b1ff]">Symptoms Mentioned</p>
                          <ul className="space-y-1 text-[#d7d9f2]">
                            {turn.summary.symptoms_mentioned.map((sym, idx) => (
                              <li key={idx}>• {sym}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="obs-card-inset p-3 space-y-1.5">
                        <p className="font-semibold text-[#00b1ff]">Assessment & Next Steps</p>
                        {turn.summary.duration_and_severity && (
                          <p className="text-[#d7d9f2]">
                            <span className="text-[#8f93c4]">Timeline/Severity:</span>{' '}
                            {turn.summary.duration_and_severity}
                          </p>
                        )}
                        <p className="text-[#00ffaa] font-medium">
                          {turn.summary.consultation_advised
                            ? 'Doctor consultation is advisable.'
                            : 'Monitor closely; consult a doctor if symptoms worsen.'}
                        </p>
                        {turn.summary.next_steps && turn.summary.next_steps.length > 0 && (
                          <ul className="space-y-1 text-[#d7d9f2] pt-0.5">
                            {turn.summary.next_steps.map((step, idx) => (
                              <li key={idx}>• {step}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('doctors', {
                            specialization: turn.summary?.suggested_specialist,
                          })
                        }
                        className="obs-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
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
                        className="obs-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <CalendarClock className="w-3.5 h-3.5 text-[#00ffaa]" />
                        <span>Book an Appointment</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('viddoc', {
                            specialization: turn.summary?.suggested_specialist,
                            videoOnly: true,
                          })
                        }
                        className="obs-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Video className="w-3.5 h-3.5 text-[#00b1ff]" />
                        <span>Start Video Consultation</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('doctors', { focusHospitals: true })}
                        className="obs-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#00b1ff]" />
                        <span>View Nearby Hospitals</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-[#232269] border border-white/12 px-4 py-3 text-[13px] text-[#b0b3d6] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00b1ff] animate-pulse" />
                <span>Understanding your concern...</span>
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>
      )}

      {/* Large Conversational Input Box */}
      <form onSubmit={handleSubmit} className="obs-card p-4 sm:p-5 space-y-3 border-[#5350cc]/50">
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
          className="w-full px-4 py-3 obs-input text-[15px] leading-relaxed resize-none"
        />

        {voiceFeedback && (
          <p className="text-[12px] text-[#00b1ff]">{voiceFeedback}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={speechSupported ? 'Voice input' : 'Voice input unsupported in this browser'}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] rounded-xl border transition-colors ${
                listening
                  ? 'bg-[#00b1ff]/20 border-[#00b1ff] text-[#00ffaa]'
                  : 'obs-btn-secondary text-[#b0b3d6]'
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#00b1ff]" />}
              <span>{listening ? 'Stop Listening' : 'Voice Input'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="obs-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-[13px] disabled:opacity-45"
          >
            <span>{sending ? 'Sending...' : 'Send'}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Safety Notice */}
      <p className="text-center text-[12px] text-[#8f93c4]">
        CareOne AI provides general health guidance only and does not provide a confirmed diagnosis, replace a doctor, or prescribe medication. For emergencies, use{' '}
        <button
          type="button"
          onClick={() => onNavigate('emergency')}
          className="text-[#00b1ff] hover:text-[#00ffaa] underline font-medium"
        >
          Emergency Assistance
        </button>
        .
      </p>
    </div>
  );
}
