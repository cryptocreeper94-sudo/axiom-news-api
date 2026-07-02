// Axiom News Deterministic Engine — Gemini 2.0 Flash Lite (FREE TIER)
// Replaces OpenAI gpt-4o-mini to eliminate API costs entirely.
// Free tier: 30 RPM / 1,500 RPD — more than enough for 2x daily pipeline.
import axios from 'axios';

async function process_article(rawText, source) {
  const prompt = `You are the Axiom Deterministic News Engine (Lume-V Protocol).
Your job is to read the following raw news article snippet from ${source}, strip all subjective, emotional, and biased adjectives/framing, and return a pure deterministic extraction of the facts.
CRITICAL RULE: Do NOT penalize or strip sensational language if it is a direct quote attributed to a primary source or official entity (e.g. Europol, Police). Quoting an official is factual reporting, not publisher spin. Retain primary source quotes in the timeline.

Raw Text:
"${rawText}"

You must return a JSON object exactly matching this schema:
{
    "coreEvent": "NORMALIZED EVENT KEY — This MUST be a short, standardized, all-caps slug that identifies the underlying event. Format: VERB + PRIMARY_SUBJECT + KEY_QUALIFIER. Remove all publisher-specific framing, adjectives, and editorial language. Examples: 'SENATE PASSES BUDGET RESOLUTION', 'TRUMP SIGNS EXECUTIVE ORDER ON TARIFFS', 'FED HOLDS INTEREST RATE STEADY', 'WILDFIRE DESTROYS 500 HOMES IN CALIFORNIA', 'APPLE REPORTS Q2 EARNINGS BEAT'. The SAME real-world event from ANY publisher MUST produce the SAME coreEvent string. Use present tense. No articles (a/an/the). Max 8 words.",
    "category": "Must be exactly one of: 'Politics', 'Finance', 'Technology', 'World', or 'Science'",
    "imageKeyword": "A highly specific 1-2 word visual noun related to the event (e.g. 'rocket', 'senate', 'bank', 'protest'). Must be a highly aesthetic noun. Return null if the event is boring.",
    "processTimeline": [
        "Factual event step 1",
        "Factual event step 2",
        "Factual event step 3"
    ],
    "biasScore": 0-100,
    "strippedTerms": ["list", "of", "biased", "terms", "you", "removed"],
    "deterministicRewrite": "A full paragraph synthesized strictly from verified facts. No editorial language.",
    "author": "Extract the author's full name if stated. If none, return 'Staff'.",
    "isEconomicallyRelevant": true/false // Set true ONLY if this event has tangible macro-economic, stock market, or crypto market impact. False for pure cultural, social, or local news.
}

Return ONLY valid JSON. No markdown, no code fences, no explanation.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in environment');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    try {
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }]
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');

      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(clean);
      } catch (parseError) {
        console.error('[Gemini] JSON Parse Error on raw text:', text);
        throw parseError;
      }
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        console.error(`[Gemini] Failed after ${maxRetries} retries:`, error.response?.data?.error?.message || error.message);
        throw error;
      }
      const delay = 2000 * Math.pow(2, retries - 1);
      console.warn(`[Gemini] Retry ${retries}/${maxRetries} in ${delay}ms: ${error.response?.status || error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export { process_article };
