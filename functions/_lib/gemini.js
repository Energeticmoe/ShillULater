// Thin client for the Gemini API. Keeps the API key server-side only.

const DEFAULT_MODEL = 'gemini-2.5-flash';
// NOTE: verify this is still a current model name in Google AI Studio when you
// set up GEMINI_API_KEY — Google renames/retires models periodically. Override
// with the GEMINI_MODEL environment variable without touching code.

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
