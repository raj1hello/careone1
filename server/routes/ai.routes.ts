import { Router } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { z } from 'zod';
import {
  requireFirebaseOrAppAuth,
  type FirebaseAuthenticatedRequest,
} from '../middleware/firebaseAuth.ts';

const router = Router();

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const patientContextSchema = z
  .object({
    fullName: z.string().max(120).optional(),
    bloodGroup: z.string().max(16).optional(),
    allergies: z.string().max(400).optional(),
    chronicConditions: z.string().max(400).optional(),
    specializations: z.array(z.string().max(120)).max(40).optional(),
    recentRecords: z
      .array(
        z.object({
          title: z.string().max(200),
          recordType: z.string().max(60),
          recordDate: z.string().max(30),
          summary: z.string().max(600).optional(),
        })
      )
      .max(6)
      .optional(),
  })
  .optional();

const assistantRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
  patientContext: patientContextSchema,
});

const consultationSummarySchema = z.object({
  consentGranted: z.boolean(),
  patientName: z.string().max(120).optional(),
  doctorName: z.string().max(120).optional(),
  specialization: z.string().max(120).optional(),
  chiefComplaint: z.string().max(1000).optional(),
  clinicalNotes: z.string().max(4000).optional(),
  transcriptText: z.string().max(6000).optional(),
  vitals: z
    .object({
      bp: z.string().max(30).optional(),
      hr: z.string().max(30).optional(),
      spo2: z.string().max(30).optional(),
      temp: z.string().max(30).optional(),
    })
    .optional(),
  followUpNotes: z.string().max(1000).optional(),
});

let cachedAiKey: string | null = null;
let cachedAiClient: GoogleGenAI | null = null;

function getConfiguredGeminiKey(): string | null {
  const raw = (process.env.GEMINI_API_KEY || '').trim();
  if (!raw || raw === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return raw;
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!cachedAiClient || cachedAiKey !== apiKey) {
    cachedAiKey = apiKey;
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

function formatPatientContextBlock(
  req: FirebaseAuthenticatedRequest,
  ctx?: z.infer<typeof patientContextSchema>
): string {
  const lines: string[] = [];
  const name = ctx?.fullName || req.firebaseUser?.name || req.user?.full_name || 'Patient';
  lines.push(
    `Patient profile: Name=${name}, BloodGroup=${ctx?.bloodGroup || 'Unknown'}, Allergies=${ctx?.allergies || 'None reported'}, ChronicConditions=${ctx?.chronicConditions || 'None reported'}.`
  );
  if (ctx?.specializations && ctx.specializations.length > 0) {
    lines.push(`Verified CareOne specialist departments: ${ctx.specializations.join(', ')}.`);
  }
  if (ctx?.recentRecords && ctx.recentRecords.length > 0) {
    lines.push(
      `Patient's uploaded medical records:\n${ctx.recentRecords
        .map((r) => `- ${r.title} (${r.recordType}, ${r.recordDate}): ${r.summary || 'Uploaded document'}`)
        .join('\n')}`
    );
  }
  return lines.join('\n\n');
}

const CAREONE_TRIAGE_SYSTEM_INSTRUCTION = `You are CareOne AI Health Assistant, a fast, empathetic clinical intake and care-navigation assistant.

Rules:
1. Keep replies concise (1-3 sentences) and warm.
2. During intake, ask ONLY ONE clear follow-up question at a time (duration, severity, location, or associated symptoms).
3. If urgent red-flag symptoms appear (chest pain/tightness, shortness of breath, sudden weakness/numbness, slurred speech, severe bleeding, confusion with high fever, severe allergic reaction), immediately set stage="emergency" and populate summary.
4. After 1-2 follow-up turns—or immediately if the patient asks to find/book a doctor, asks to understand their medical report (using their uploaded records above), or gives clear duration/severity—set stage="summary" and populate summary with a suggested_specialist matching one of the verified CareOne specialist departments (or standard specialty like General Medicine, Cardiology, Neurology, Dermatology, Pediatrics, Orthopedics).
5. Never claim to give a confirmed diagnosis, replace a doctor, or prescribe medication.`;

const CAREONE_STREAM_INSTRUCTION = `${CAREONE_TRIAGE_SYSTEM_INSTRUCTION}

Formatting for streaming:
- Write ONLY your natural conversational reply first (1-3 sentences, plain text, no JSON).
- ONLY if you have reached stage="summary" or stage="emergency" (or the patient asked to find a doctor, understand a medical report, or reported red-flag symptoms), append on a NEW line at the very end a single marker in this exact format:
<<TRIAGE:{"stage":"summary","suggested_specialist":"Cardiology","concern_overview":"Short plain-language summary","symptoms_mentioned":["symptom1"],"duration_and_severity":"e.g. 3 days, mild","consultation_advised":true,"emergency_warning":"","next_steps":["Step 1"],"recommended_actions":["book_appointment","video_consultation"]}>>
- If still asking a follow-up question (intake stage), do NOT append any <<TRIAGE:...>> marker.`;

const CONSULTATION_SUMMARY_SYSTEM_INSTRUCTION = `You are CareOne Clinical Documentation Assistant helping a physician draft an accurate post-consultation summary from their consented consultation notes, vitals, and discussion transcript.

Strict Rules:
1. Summarize ONLY the facts, symptoms, observations, and advice present in the provided doctor/patient consultation context.
2. Do NOT fabricate clinical findings, lab values, or unmentioned symptoms.
3. Do NOT invent a confirmed diagnosis if the doctor has not stated one, and do NOT prescribe or invent medication dosages.
4. Keep language clear, structured, and understandable for both the doctor's clinical record and the patient's post-consultation summary (which the doctor will review and edit before saving).`;

/**
 * GET /api/ai/status
 * Reports whether server-side Gemini credentials are configured (never returns the key).
 */
router.get('/status', requireFirebaseOrAppAuth, (req: FirebaseAuthenticatedRequest, res) => {
  if (req.user && req.user.role !== 'patient') {
    res.status(403).json({ error: 'Access denied. Required role: patient' });
    return;
  }
  const configured = Boolean(getConfiguredGeminiKey());
  res.json({
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
    configured,
    endpoint: '/api/ai/assistant',
  });
});

/**
 * POST /api/ai/assistant/stream
 * Streams Gemini reply text live via SSE for instant patient intake UX.
 */
router.post('/assistant/stream', requireFirebaseOrAppAuth, async (req: FirebaseAuthenticatedRequest, res) => {
  if (req.user && req.user.role !== 'patient') {
    res.status(403).json({ error: 'Access denied. Required role: patient' });
    return;
  }

  const parsed = assistantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid conversation payload', details: parsed.error.flatten() });
    return;
  }

  const apiKey = getConfiguredGeminiKey();
  if (!apiKey) {
    res.status(503).json({
      configured: false,
      endpoint: '/api/ai/assistant/stream',
      error:
        'Gemini backend credentials are not configured on the server yet. Add GEMINI_API_KEY in Settings > Secrets to activate live AI responses.',
    });
    return;
  }

  const contextBlock = formatPatientContextBlock(req, parsed.data.patientContext);
  const contents = parsed.data.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const ai = getGeminiClient(apiKey);
    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.1-flash-lite',
      contents,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        systemInstruction: `${CAREONE_STREAM_INSTRUCTION}\n\n${contextBlock}`,
        maxOutputTokens: 550,
      },
    });

    let fullText = '';
    let sentLength = 0;
    const marker = '<<TRIAGE:';

    for await (const chunk of stream) {
      const piece = chunk.text || '';
      if (!piece) continue;
      fullText += piece;

      const markerIdx = fullText.indexOf(marker);
      const safeEnd =
        markerIdx !== -1
          ? markerIdx
          : Math.max(sentLength, fullText.length - marker.length);

      if (safeEnd > sentLength) {
        const delta = fullText.slice(sentLength, safeEnd);
        sentLength = safeEnd;
        sendEvent({ type: 'delta', text: delta });
      }
    }

    const markerIdx = fullText.indexOf(marker);
    let cleanReply = fullText;
    let stage: 'intake' | 'summary' | 'emergency' = 'intake';
    let summary: Record<string, any> | null = null;

    if (markerIdx !== -1) {
      cleanReply = fullText.slice(0, markerIdx).trim();
      const tail = fullText.slice(markerIdx + marker.length);
      const endIdx = tail.lastIndexOf('>>');
      const jsonStr = (endIdx !== -1 ? tail.slice(0, endIdx) : tail).trim();
      try {
        const meta = JSON.parse(jsonStr);
        if (meta.stage === 'summary' || meta.stage === 'emergency' || meta.stage === 'intake') {
          stage = meta.stage;
        } else {
          stage = 'summary';
        }
        summary = {
          concern_overview: meta.concern_overview || '',
          symptoms_mentioned: Array.isArray(meta.symptoms_mentioned) ? meta.symptoms_mentioned : [],
          duration_and_severity: meta.duration_and_severity || '',
          suggested_specialist: meta.suggested_specialist || '',
          consultation_advised: meta.consultation_advised !== false,
          emergency_warning: meta.emergency_warning || '',
          next_steps: Array.isArray(meta.next_steps) ? meta.next_steps : [],
          recommended_actions: Array.isArray(meta.recommended_actions)
            ? meta.recommended_actions
            : ['find_doctor', 'book_appointment'],
        };
      } catch {
        // Keep cleanReply intact if marker JSON was partial
      }
    } else if (fullText.length > sentLength) {
      const remaining = fullText.slice(sentLength);
      sentLength = fullText.length;
      sendEvent({ type: 'delta', text: remaining });
    }

    sendEvent({
      type: 'final',
      configured: true,
      model: 'gemini-3.1-flash-lite',
      reply: cleanReply.trim(),
      stage,
      summary,
    });
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini request failed';
    console.error('[CareOne AI Stream] Gemini API error:', msg);
    sendEvent({
      type: 'error',
      configured: true,
      error: `Gemini service error: ${msg}`,
    });
    res.end();
  }
});

/**
 * POST /api/ai/assistant
 * Synchronous JSON endpoint using @google/genai on the server.
 */
router.post('/assistant', requireFirebaseOrAppAuth, async (req: FirebaseAuthenticatedRequest, res) => {
  if (req.user && req.user.role !== 'patient') {
    res.status(403).json({ error: 'Access denied. Required role: patient' });
    return;
  }

  const parsed = assistantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid conversation payload', details: parsed.error.flatten() });
    return;
  }

  const apiKey = getConfiguredGeminiKey();
  if (!apiKey) {
    res.status(503).json({
      configured: false,
      endpoint: '/api/ai/assistant',
      error:
        'Gemini backend credentials are not configured on the server yet. Add GEMINI_API_KEY in Settings > Secrets to activate live AI responses.',
    });
    return;
  }

  const contextBlock = formatPatientContextBlock(req, parsed.data.patientContext);
  const contents = parsed.data.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const ai = getGeminiClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        systemInstruction: `${CAREONE_TRIAGE_SYSTEM_INSTRUCTION}\n\n${contextBlock}`,
        maxOutputTokens: 450,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'Brief, warm conversational reply. Ask only one question during intake.',
            },
            stage: {
              type: Type.STRING,
              description: 'One of: intake, summary, emergency',
            },
            summary: {
              type: Type.OBJECT,
              properties: {
                concern_overview: { type: Type.STRING },
                symptoms_mentioned: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                duration_and_severity: { type: Type.STRING },
                suggested_specialist: { type: Type.STRING },
                consultation_advised: { type: Type.BOOLEAN },
                emergency_warning: { type: Type.STRING },
                next_steps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recommended_actions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
          },
          required: ['reply', 'stage'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    const structured = JSON.parse(rawText);

    res.json({
      configured: true,
      model: 'gemini-3.1-flash-lite',
      reply: structured.reply,
      stage: structured.stage || 'intake',
      summary: structured.summary || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini request failed';
    console.error('[CareOne AI] Gemini API error:', msg);
    res.status(502).json({
      configured: true,
      error: `Gemini service error: ${msg}`,
    });
  }
});

/**
 * POST /api/ai/consultation-summary
 * Consent-gated AI consultation summary generator for doctors inside VidDoc.
 */
router.post(
  '/consultation-summary',
  requireFirebaseOrAppAuth,
  async (req: FirebaseAuthenticatedRequest, res) => {
    if (req.user && req.user.role !== 'doctor') {
      res.status(403).json({ error: 'Only doctors can generate consultation summaries.' });
      return;
    }

    const parsed = consultationSummarySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid consultation summary payload', details: parsed.error.flatten() });
      return;
    }

    if (!parsed.data.consentGranted) {
      res.status(400).json({
        error: 'Explicit participant consent is required before generating an AI consultation summary.',
      });
      return;
    }

    const {
      patientName,
      doctorName,
      specialization,
      chiefComplaint,
      clinicalNotes,
      transcriptText,
      vitals,
      followUpNotes,
    } = parsed.data;

    if (!chiefComplaint?.trim() && !clinicalNotes?.trim() && !transcriptText?.trim()) {
      res.status(400).json({
        error: 'Enter chief complaint, clinical notes, or discussion transcript before generating an AI summary.',
      });
      return;
    }

    const apiKey = getConfiguredGeminiKey();
    if (!apiKey) {
      res.status(503).json({
        configured: false,
        endpoint: '/api/ai/consultation-summary',
        error: 'GEMINI_API_KEY is not configured on the server yet.',
      });
      return;
    }

    const vitalsStr = vitals
      ? `BP: ${vitals.bp || 'N/A'}, HR: ${vitals.hr || 'N/A'}, SpO2: ${vitals.spo2 || 'N/A'}, Temp: ${vitals.temp || 'N/A'}`
      : 'Not recorded';

    const prompt = [
      `Patient: ${patientName || 'Patient'}`,
      `Doctor: ${doctorName || 'Attending Physician'} (${specialization || 'General Medicine'})`,
      `Chief Complaint: ${chiefComplaint || 'Not specified'}`,
      `Vitals: ${vitalsStr}`,
      `Doctor Clinical Notes:\n${clinicalNotes || 'None provided'}`,
      transcriptText ? `Consented Consultation Transcript / Discussion:\n${transcriptText}` : '',
      followUpNotes ? `Follow-up Context: ${followUpNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const ai = getGeminiClient(apiKey);
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          systemInstruction: CONSULTATION_SUMMARY_SYSTEM_INSTRUCTION,
          maxOutputTokens: 700,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              complaintSummary: { type: Type.STRING },
              symptomsDiscussed: { type: Type.ARRAY, items: { type: Type.STRING } },
              symptomDuration: { type: Type.STRING },
              doctorObservations: { type: Type.STRING },
              keyDiscussionPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              precautions: { type: Type.ARRAY, items: { type: Type.STRING } },
              followUpInstructions: { type: Type.STRING },
              suggestedFollowUpDate: { type: Type.STRING },
            },
            required: [
              'complaintSummary',
              'symptomsDiscussed',
              'symptomDuration',
              'doctorObservations',
              'keyDiscussionPoints',
              'recommendations',
              'precautions',
              'followUpInstructions',
              'suggestedFollowUpDate',
            ],
          },
        },
      });

      const summary = JSON.parse((response.text ?? '').trim());
      res.json({
        configured: true,
        model: 'gemini-3.1-flash-lite',
        summary,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini summary generation failed';
      console.error('[CareOne AI Summary] Gemini error:', msg);
      res.status(502).json({
        configured: true,
        error: `Gemini summary error: ${msg}`,
      });
    }
  }
);

export default router;
