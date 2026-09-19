// Groq (OpenAI-compatible) chat completion wrapper for PRAHARI Copilot.
//
// The model only ever sees: (1) a system prompt that forbids stating
// anything not present in the supplied context, and (2) a rendering of the
// real RetrievalResult produced by retrieval.ts. It is the *narrator* of
// already-retrieved facts, never the source of them — every number the UI
// displays comes directly from RetrievalResult, not from the model's prose.

import Groq from 'groq-sdk';
import type { RetrievalResult } from './types';

const apiKey = process.env.GROQ_API_KEY;
const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

let client: Groq | null = null;
function getClient(): Groq {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured on the server');
  }
  if (!client) client = new Groq({ apiKey });
  return client;
}

const SYSTEM_PROMPT = `You are PRAHARI Copilot, an AI Intelligence Officer for the Indian Ministry of Coal, embedded in the PRAHARI mining compliance platform.

You answer questions from mine officials, corporate admins, field inspectors, and regulators about real coal mine compliance data.

STRICT GROUNDING RULES:
- You will be given a JSON block called RETRIEVED_DATA. This is the ONLY source of factual information you may use — every mine name, score, date, count, and record you mention MUST come from it.
- Never invent a mine, a number, a date, a name, or a regulation that is not present in RETRIEVED_DATA.
- If RETRIEVED_DATA is empty, or a "notes" or "deniedReason" field explains why, say so plainly and do not guess.
- Do not perform arithmetic beyond what is trivially visible in the data (e.g. don't estimate percentages that aren't given).

STYLE:
- Write like a senior DGMS officer briefing a colleague: precise, calm, no fluff, no chatbot filler ("I'd be happy to help!").
- Structure your answer with short sections using markdown headings when there is more than one part to say: **Summary**, **Evidence**, **Recommendations**. Skip a section if it doesn't apply.
- Reference specific records by the labels given in RETRIEVED_DATA's evidence list (e.g. "Inspection #a1b2c3") so the officer can trace your claim.
- Recommendations must be concrete actions plainly implied by the data (e.g. an overdue inspection implies scheduling one) — never generic safety platitudes.
- Keep it tight: a few sentences per section, not an essay.`;

export function renderContext(retrieval: RetrievalResult): string {
  // JSON is a fine context format for the model and keeps this from
  // re-deriving its own prose summary of the data (a second place facts
  // could drift from the source of truth).
  return JSON.stringify(retrieval, null, 2);
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export async function* streamCopilotAnswer(params: {
  message: string;
  history: ChatTurn[];
  retrieval: RetrievalResult;
}): AsyncGenerator<string> {
  const groq = getClient();
  const contextBlock = `RETRIEVED_DATA (the only facts you may use):\n${renderContext(params.retrieval)}`;

  const stream = await groq.chat.completions.create({
    model,
    stream: true,
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...params.history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: `${contextBlock}\n\nQuestion: ${params.message}` },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
