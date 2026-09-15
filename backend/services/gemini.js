const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Tried in order. If a model name is retired by Google, the next one is used
// instead of the whole feature breaking.
const MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

const REGIONS = [
    'head', 'throat', 'chest', 'abdomen', 'pelvis', 'back',
    'arms', 'hands', 'legs', 'feet', 'skin', 'general'
];

const URGENCY_LEVELS = ['Self-care', 'See a clinician soon', 'Seek urgent care'];
const LIKELIHOODS = ['Low', 'Moderate', 'High'];
const REMEDY_TYPES = ['Self-care', 'Lifestyle', 'Medical'];

// Asking for JSON in the prompt alone is unreliable, so the shape is also
// declared to the API. That removes the need to scrape braces out of prose.
const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        summary: { type: 'STRING' },
        urgency: { type: 'STRING' },
        urgencyReason: { type: 'STRING' },
        physicalScore: { type: 'INTEGER' },
        mentalScore: { type: 'INTEGER' },
        symptoms: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    name: { type: 'STRING' },
                    region: { type: 'STRING' },
                    note: { type: 'STRING' }
                },
                required: ['name', 'region', 'note']
            }
        },
        conditions: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    name: { type: 'STRING' },
                    likelihood: { type: 'STRING' },
                    explanation: { type: 'STRING' },
                    matches: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: ['name', 'likelihood', 'explanation', 'matches']
            }
        },
        remedies: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    type: { type: 'STRING' },
                    title: { type: 'STRING' },
                    detail: { type: 'STRING' }
                },
                required: ['type', 'title', 'detail']
            }
        },
        redFlags: { type: 'ARRAY', items: { type: 'STRING' } },
        questionsForClinician: { type: 'ARRAY', items: { type: 'STRING' } },
        tip: { type: 'STRING' }
    },
    required: [
        'summary', 'urgency', 'urgencyReason', 'physicalScore', 'mentalScore',
        'symptoms', 'conditions', 'remedies', 'redFlags',
        'questionsForClinician', 'tip'
    ]
};

const buildInstruction = (profile) => {
    const p = profile || {};
    const list = (arr) => (Array.isArray(arr) && arr.length ? arr.join(', ') : 'none reported');

    return `You are a careful health information assistant. You are not a doctor and you never
present yourself as one. Your job is to help someone understand what they are
experiencing and decide what to do next.

About the person:
- Age: ${p.age || 'not given'}
- Gender: ${p.gender || 'not given'}
- Height: ${p.height ? p.height + ' cm' : 'not given'}
- Weight: ${p.weight ? p.weight + ' kg' : 'not given'}
- Ongoing conditions: ${list(p.conditions)}
- Allergies: ${list(p.allergies)}

How to answer:
- Write in plain, calm, second-person language. No jargon without a short gloss.
- "summary" is two or three sentences describing what they have told you and what
  it generally points toward. Never state a diagnosis as fact.
- "urgency" is exactly one of: ${URGENCY_LEVELS.join(' | ')}.
  Choose "Seek urgent care" whenever the description includes anything that could
  be an emergency, such as chest pain, trouble breathing, stroke signs, severe
  bleeding, a severe allergic reaction, a very high fever, fainting, a serious
  head injury, thoughts of harming themselves, or a fast-worsening condition.
- "urgencyReason" is one sentence explaining that choice.
- "physicalScore" and "mentalScore" are integers from 1 to 10, where 10 is doing
  well. Base them only on what was described; if nothing points at mood or stress,
  keep the mental score near neutral rather than inventing a problem.
- "symptoms": each entry needs a short "name", a "region" that is exactly one of
  ${REGIONS.join(', ')}, and a one-line "note". Use "general" for whole-body
  symptoms such as fatigue or fever. Give 1 to 6 entries.
- "conditions": 3 to 5 possibilities, ordered most to least likely. "likelihood"
  is exactly one of ${LIKELIHOODS.join(' | ')}. "matches" lists the specific
  things they described that fit that possibility.
- "remedies": 4 to 6 entries. "type" is exactly one of ${REMEDY_TYPES.join(' | ')}.
  Keep advice conservative. Do not give specific prescription drug dosages, and
  respect the allergies listed above.
- "redFlags": specific signs that mean they should stop self-managing and get
  medical help. Give 2 to 4, or an empty array only if truly nothing applies.
- "questionsForClinician": 3 useful questions to bring to an appointment.
- "tip": one short, kind, practical sentence.

If the message does not describe a health concern at all, still return the same
shape: explain in "summary" that you need a description of how they are feeling,
set urgency to "Self-care", and keep the other arrays short.`;
};

const callModel = async (model, instruction, problem, signal) => {
    const response = await fetch(
        `${API_ROOT}/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: instruction }] },
                contents: [{ role: 'user', parts: [{ text: problem }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json',
                    responseSchema: RESPONSE_SCHEMA
                }
            })
        }
    );

    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
};

const extractText = (body) => {
    const candidate = body && body.candidates && body.candidates[0];
    if (!candidate) return null;
    const parts = (candidate.content && candidate.content.parts) || [];
    const text = parts.map((part) => part.text || '').join('').trim();
    return text || null;
};

// --- normalisation -------------------------------------------------------
// Never trust the model's output shape. Everything the page renders is clamped
// to a known range here, so a stray value cannot break the UI.

const pick = (value, allowed, fallback) => {
    if (typeof value !== 'string') return fallback;
    const match = allowed.find((option) => option.toLowerCase() === value.trim().toLowerCase());
    return match || fallback;
};

const text = (value, max = 600) =>
    typeof value === 'string' ? value.trim().slice(0, max) : '';

const score = (value) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return 5;
    return Math.min(10, Math.max(1, n));
};

const stringList = (value, limit, max = 240) =>
    Array.isArray(value)
        ? value.map((item) => text(item, max)).filter(Boolean).slice(0, limit)
        : [];

const normalise = (raw) => ({
    summary: text(raw.summary, 900) || 'No summary was returned. Try describing your symptoms again.',
    urgency: pick(raw.urgency, URGENCY_LEVELS, 'See a clinician soon'),
    urgencyReason: text(raw.urgencyReason, 300),
    physicalScore: score(raw.physicalScore),
    mentalScore: score(raw.mentalScore),
    symptoms: Array.isArray(raw.symptoms)
        ? raw.symptoms
              .map((s) => ({
                  name: text(s && s.name, 60),
                  region: pick(s && s.region, REGIONS, 'general'),
                  note: text(s && s.note, 200)
              }))
              .filter((s) => s.name)
              .slice(0, 6)
        : [],
    conditions: Array.isArray(raw.conditions)
        ? raw.conditions
              .map((c) => ({
                  name: text(c && c.name, 80),
                  likelihood: pick(c && c.likelihood, LIKELIHOODS, 'Low'),
                  explanation: text(c && c.explanation, 500),
                  matches: stringList(c && c.matches, 5, 80)
              }))
              .filter((c) => c.name)
              .slice(0, 5)
        : [],
    remedies: Array.isArray(raw.remedies)
        ? raw.remedies
              .map((r) => ({
                  type: pick(r && r.type, REMEDY_TYPES, 'Self-care'),
                  title: text(r && r.title, 80),
                  detail: text(r && r.detail, 400)
              }))
              .filter((r) => r.title)
              .slice(0, 6)
        : [],
    redFlags: stringList(raw.redFlags, 5),
    questionsForClinician: stringList(raw.questionsForClinician, 4),
    tip: text(raw.tip, 240)
});

class GeminiError extends Error {
    constructor(message, status = 502) {
        super(message);
        this.status = status;
    }
}

exports.analyse = async (problem, profile) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new GeminiError('The server has no Gemini API key configured.', 500);
    }

    const instruction = buildInstruction(profile);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
        let lastMessage = 'The AI service did not respond.';

        for (const model of MODELS) {
            let result;
            try {
                result = await callModel(model, instruction, problem, controller.signal);
            } catch (err) {
                if (err.name === 'AbortError') {
                    throw new GeminiError('The analysis took too long. Please try again.', 504);
                }
                lastMessage = 'Could not reach the AI service.';
                continue;
            }

            if (!result.ok) {
                const apiMessage = (result.body.error && result.body.error.message) || '';
                lastMessage = apiMessage || `The AI service returned ${result.status}.`;

                // A bad key or exhausted quota will not be fixed by another model.
                if (result.status === 400 && /API key/i.test(apiMessage)) {
                    throw new GeminiError('The Gemini API key is invalid.', 500);
                }
                if (result.status === 429) {
                    throw new GeminiError('The Gemini quota is used up for now. Try again shortly.', 429);
                }
                // 404 or 400 on the model name: fall through and try the next one.
                continue;
            }

            const blocked = result.body.promptFeedback && result.body.promptFeedback.blockReason;
            if (blocked) {
                throw new GeminiError(
                    'The AI declined to analyse that message. Try describing your symptoms differently.',
                    422
                );
            }

            const payload = extractText(result.body);
            if (!payload) {
                lastMessage = 'The AI returned an empty response.';
                continue;
            }

            try {
                return { data: normalise(JSON.parse(payload)), model };
            } catch (parseError) {
                lastMessage = 'The AI response could not be read.';
                continue;
            }
        }

        throw new GeminiError(lastMessage);
    } finally {
        clearTimeout(timeout);
    }
};

exports.GeminiError = GeminiError;
exports.REGIONS = REGIONS;
