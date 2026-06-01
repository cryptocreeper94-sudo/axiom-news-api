const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function extractDeterministicFacts(rawText, source) {
    const prompt = `
You are the Axiom Deterministic News Engine (Lume-V Protocol).
Your job is to read the following raw news article snippet from ${source}, strip all subjective, emotional, and biased adjectives/framing, and return a pure deterministic extraction of the facts.

Raw Text:
"${rawText}"

You must return a raw JSON object exactly matching this schema (do not wrap in markdown):
{
    "coreEvent": "A purely factual 1-sentence headline of the event.",
    "category": "Must be exactly one of: 'Politics', 'Finance', 'Technology', or 'World'",
    "imageKeyword": "A highly specific 1-2 word visual noun related to the event (e.g. 'rocket', 'senate', 'bank', 'protest'). Must be a highly aesthetic noun. Return null if the event is boring.",
    "processTimeline": [
        "Factual event step 1",
        "Factual event step 2",
        "Factual event step 3"
    ],
    "biasScore": 0-100 (integer representing how emotionally charged or biased the original text was. 0 = purely factual, 100 = completely unhinged propaganda),
    "strippedTerms": ["list", "of", "exact", "words", "or", "phrases", "you", "stripped", "from", "the", "raw", "text", "because", "they", "were", "biased"]
}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.1
            }
        });

        const textOutput = response.text.trim();
        const cleanJsonStr = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanJsonStr);
        return data;
    } catch (error) {
        console.error('Gemini Extraction Error:', error.message);
        return null;
    }
}

module.exports = { extractDeterministicFacts };
