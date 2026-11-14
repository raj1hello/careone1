import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const assistantRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
});

function getConfiguredGeminiKey(): string | null {
  const raw = (process.env.GEMINI_API_KEY || '').trim();
  if (!raw || raw === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return raw;
}

const CAREONE_TRIAGE_SYSTEM_INSTRUCTION = `You are CareOne AI Health Assistant, a supportive, empathetic clinical intake and care-navigation assistant.

Your purpose:
1. Understand the patient's symptoms, duration, severity, location, and associated symptoms through natural conversation.
2. Ask ONLY ONE clear, relevant follow-up question at a time so the patient is never overwhelmed.
3. Recognize potentially urgent red-flag symptoms (e.g., chest pain, severe shortness of breath, sudden weakness/numbness, slurred speech, severe bleeding, high persistent fever with confusion/stiff neck, severe allergic reaction) and immediately prioritize emergency guidance (stage = "emergency").
4. Once you have collected enough information (typically after 2-4 exchanges, or immediately if the patient asks to find a doctor or understand a report or shows urgent symptoms), set stage to "summary" (or "emergency") and populate the structured summary object.
5. Suggest an appropriate medical specialist when relevant, explain general health information in plain language, and help the patient decide whether a consultation is advisable.

Strict safety boundaries:
- NEVER claim to provide a confirmed medical diagnosis.
- NEVER claim to replace a licensed doctor.
- NEVER independently prescribe medications or dosages.
- Keep language calm, warm, concise, and easy to understand.`;

/**
 * GET /api/ai/status
 * Reports whether server-side Gemini credentials are configured (never returns the key).
 */
router.get('/status', requireAuth, requireRole('patient'), (_req, res) => {
  const configured = Boolean(getConfiguredGeminiKey());
  res.json({
    provider: 'gemini',
    model: 'gemini-4-hydrogen',
    configured,
    endpoint: '/api/ai/assistant',
  });
});

/**
 * POST /api/ai/assistant
 * Integration point for the Gemini-powered CareOne Patient AI Health Assistant.
 * Uses process.env.GEMINI_API_KEY on the server via @google/genai.
 */
router.post('/assistant', requireAuth, requireRole('patient'), async (req: AuthenticatedRequest, res) => {
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
        'Gemini backend credentials are not configured on the server yet. Connect your GEMINI_API_KEY in the server environment to activate live responses.',
    });
    return;
  }

  const db = getDb();
  const patient = db
    .prepare(
      `SELECT p.blood_group, p.allergies, p.chronic_conditions, u.full_name
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?`
    )
    .get(req.user!.id) as
    | { blood_group: string; allergies: string; chronic_conditions: string; full_name: string }
    | undefined;

  const specializations = db
    .prepare(`SELECT DISTINCT specialization FROM doctors WHERE verification_status = 'verified'`)
    .all() as Array<{ specialization: string }>;

  const contextBlock = [
    patient
      ? `Patient profile context: Name=${patient.full_name}, BloodGroup=${patient.blood_group || 'Unknown'}, Allergies=${patient.allergies || 'None reported'}, ChronicConditions=${patient.chronic_conditions || 'None reported'}.`
      : '',
    specializations.length > 0
      ? `Available verified CareOne specialist departments: ${specializations.map((s) => s.specialization).join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const contents = parsed.data.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config: {
        systemInstruction: `${CAREONE_TRIAGE_SYSTEM_INSTRUCTION}\n\n${contextBlock}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description:
                'Warm, clear conversational reply. During intake, ask only one relevant follow-up question.',
            },
            stage: {
              type: Type.STRING,
              description: 'One of: intake, summary, emergency',
            },
            summary: {
              type: Type.OBJECT,
              nullable: true,
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
                  description:
                    'Subset of: find_doctor, book_appointment, video_consultation, view_hospitals, emergency',
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
      model: 'gemini-4-hydrogen',
      reply: structured.reply,
      stage: structured.stage || 'intake',
      summary: structured.summary || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini request failed';
    res.status(502).json({
      configured: true,
      error: `Gemini service error: ${msg}`,
    });
  }
});

export default router;
