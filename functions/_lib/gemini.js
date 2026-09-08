// Thin client for the Gemini API. Keeps the API key server-side only.

const DEFAULT_MODEL = 'gemini-3.6-flash';
// Verified live against the Gemini API on 2026-09-08: gemini-2.5-flash was
// rejected with a 404 telling new callers to use gemini-3.6-flash. Google
// renames/retires models periodically — if this starts 404ing again, check
// the error body (it names the current model) or aistudio.google.com, and
// override via the GEMINI_MODEL environment variable without touching code.

export async function callGemini(env, systemPrompt, userContent, schema) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on this deployment.');
  }
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.2,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned no analyzable content (possibly blocked by safety filters).');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Gemini response was not valid JSON.');
  }
}
