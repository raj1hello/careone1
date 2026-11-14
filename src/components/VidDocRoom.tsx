import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff, Save } from 'lucide-react';
import { api, getApiErrorMessage } from '../services/api.ts';

interface VidDocRoomProps {
  consultation: {
    id: number;
    room_code: string;
    patient_name?: string;
    doctor_name?: string;
    chief_complaint?: string;
    clinical_notes?: string;
    vitals_json?: string;
    follow_up_date?: string;
    follow_up_notes?: string;
  };
  userRole: 'patient' | 'doctor';
  onClose: () => void;
  onSaved?: () => void;
}

export function VidDocRoom({ consultation, userRole, onClose, onSaved }: VidDocRoomProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [peerState, setPeerState] = useState<'connecting' | 'waiting' | 'connected' | 'local-only'>('connecting');
  const [mediaNotice, setMediaNotice] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState(0);

  const initialVitals = (() => {
    try {
      return JSON.parse(consultation.vitals_json || '{}');
    } catch {
      return {};
    }
  })();

  const [clinicalNotes, setClinicalNotes] = useState(consultation.clinical_notes || '');
  const [bp, setBp] = useState(initialVitals.bp || '');
  const [hr, setHr] = useState(initialVitals.hr || '');
  const [spo2, setSpo2] = useState(initialVitals.spo2 || '');
  const [temp, setTemp] = useState(initialVitals.temp || '');
  const [followUpDate, setFollowUpDate] = useState(consultation.follow_up_date || '');
  const [followUpNotes, setFollowUpNotes] = useState(consultation.follow_up_notes || '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    async function setupWebRtc() {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } else {
          setMediaNotice('Camera/microphone unavailable; signaling active.');
        }
      } catch {
        setMediaNotice('Media permission not granted; clinical workspace active.');
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => pc.addTrack(track, streamRef.current!));
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setPeerState('connected');
        }
      };

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/signaling`);
      wsRef.current = ws;

      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'ice-candidate',
              roomCode: consultation.room_code,
              payload: event.candidate,
            })
          );
        }
      };

      ws.onopen = () => {
        setPeerState('waiting');
        ws.send(
          JSON.stringify({
            type: 'join',
            roomCode: consultation.room_code,
            senderRole: userRole,
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'peer-joined') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(
              JSON.stringify({
                type: 'offer',
                roomCode: consultation.room_code,
                payload: offer,
              })
            );
          } else if (msg.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(
              JSON.stringify({
                type: 'answer',
                roomCode: consultation.room_code,
                payload: answer,
              })
            );
            setPeerState('connected');
          } else if (msg.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            setPeerState('connected');
          } else if (msg.type === 'ice-candidate' && msg.payload) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
          } else if (msg.type === 'peer-left') {
            setPeerState('waiting');
          }
        } catch {
          // Ignore signaling transient errors
        }
      };

      ws.onerror = () => {
        setPeerState('local-only');
      };
    }

    setupWebRtc();

    return () => {
      active = false;
      wsRef.current?.close();
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [consultation.room_code, userRole]);

  const toggleAudio = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !audioEnabled;
      });
    }
    setAudioEnabled((v) => !v);
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !videoEnabled;
      });
    }
    setVideoEnabled((v) => !v);
  };

  const handleSaveNotes = async (endCall = false) => {
    if (userRole !== 'doctor') return;
    setSaving(true);
    setSaveMessage('');
    try {
      await api.patch(`/consultations/${consultation.id}`, {
        status: endCall ? 'ended' : 'active',
        clinical_notes: clinicalNotes,
        vitals: { bp, hr, spo2, temp },
        follow_up_date: followUpDate,
        follow_up_notes: followUpNotes,
      });
      setSaveMessage(endCall ? 'Saved & ended' : 'Saved');
      onSaved?.();
      if (endCall) {
        onClose();
      }
    } catch (err) {
      setSaveMessage(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f5f7] flex flex-col">
      <div className="px-6 py-3.5 border-b border-black/[0.07] flex flex-wrap items-center justify-between gap-4 bg-white/85 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-semibold text-[#1d1d1f]">VidDoc Consultation</h2>
          <span className="text-[12px] text-[#6e6e73] font-mono-tabular">
            {consultation.room_code} · {consultation.patient_name || consultation.doctor_name} · {formatDuration(elapsedSec)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-medium text-[#0071e3]">
            {peerState === 'connected' ? 'Connected' : peerState === 'waiting' ? 'Waiting for Peer' : 'Connecting'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="mac-btn-danger inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1200px] w-full mx-auto">
        <div className={userRole === 'doctor' ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative aspect-video rounded-[20px] border border-black/[0.08] bg-[#1d1d1f] overflow-hidden flex items-center justify-center shadow-sm">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {peerState !== 'connected' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <p className="text-[14px] font-medium text-white">
                    Waiting for {userRole === 'doctor' ? consultation.patient_name || 'Patient' : consultation.doctor_name || 'Doctor'}
                  </p>
                  <p className="text-[12px] font-mono-tabular text-white/65 mt-1">{consultation.room_code}</p>
                </div>
              )}
              <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-md text-[11px] text-white">
                Remote
              </span>
            </div>

            <div className="relative aspect-video rounded-[20px] border border-black/[0.08] bg-[#1d1d1f] overflow-hidden flex items-center justify-center shadow-sm">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-md text-[11px] text-white">
                You ({userRole})
              </span>
            </div>
          </div>

          {mediaNotice && (
            <p className="text-[12px] text-[#6e6e73] glass-surface-inset px-4 py-2.5">{mediaNotice}</p>
          )}

          <div className="glass-card py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={toggleAudio}
                className={`inline-flex items-center gap-2 px-4 py-2 text-[13px] ${
                  audioEnabled ? 'mac-btn-secondary' : 'mac-btn-danger'
                }`}
              >
                {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                <span>{audioEnabled ? 'Mute' : 'Unmute'}</span>
              </button>

              <button
                type="button"
                onClick={toggleVideo}
                className={`inline-flex items-center gap-2 px-4 py-2 text-[13px] ${
                  videoEnabled ? 'mac-btn-secondary' : 'mac-btn-danger'
                }`}
              >
                {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                <span>{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
              </button>
            </div>

            {consultation.chief_complaint && (
              <p className="text-[13px] text-[#6e6e73]">
                Reason: <span className="text-[#1d1d1f] font-medium">{consultation.chief_complaint}</span>
              </p>
            )}
          </div>
        </div>

        {userRole === 'doctor' && (
          <div className="lg:col-span-5 glass-card space-y-4">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Consultation Notes</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">BP</label>
                <input
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                  placeholder="120/80"
                  className="w-full px-3 py-2 glass-input text-[13px] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">Heart Rate</label>
                <input
                  value={hr}
                  onChange={(e) => setHr(e.target.value)}
                  placeholder="72 bpm"
                  className="w-full px-3 py-2 glass-input text-[13px] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">SpO2</label>
                <input
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  placeholder="98%"
                  className="w-full px-3 py-2 glass-input text-[13px] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">Temp</label>
                <input
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  placeholder="98.6 F"
                  className="w-full px-3 py-2 glass-input text-[13px] font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] text-[#6e6e73] mb-1">Clinical Notes</label>
              <textarea
                rows={4}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Assessment and plan..."
                className="w-full px-3 py-2 glass-input text-[13px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 glass-input text-[13px] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">Follow-up Note</label>
                <input
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Repeat labs"
                  className="w-full px-3 py-2 glass-input text-[13px]"
                />
              </div>
            </div>

            {saveMessage && <p className="text-[12px] font-medium text-[#15803d]">{saveMessage}</p>}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveNotes(false)}
                className="mac-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Notes'}</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveNotes(true)}
                className="mac-btn-primary px-4 py-2 text-[13px] disabled:opacity-50"
              >
                Complete Call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
