const axios = require('axios');

async function extractDeterministicFacts(rawText, source) {
    const prompt = `
You are the Axiom Deterministic News Engine (Lume-V Protocol).
Your job is to read the following raw news article snippet from ${source}, strip all subjective, emotional, and biased adjectives/framing, and return a pure deterministic extraction of the facts.
CRITICAL RULE: Do NOT penalize or strip sensational language if it is a direct quote attributed to a primary source or official entity (e.g. Europol, Police). Quoting an official is factual reporting, not publisher spin. Retain primary source quotes in the timeline.

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
    "strippedTerms": ["list", "of", "exact", "words", "or", "phrases", "you", "stripped", "from", "the", "raw", "text", "because", "they", "were", "biased", "e.g.", "slammed", "devastating", "reckless"],
    "deterministicRewrite": "A full paragraph synthesized strictly from verified facts. No editorial language, no adjectives of opinion, no attribution of motive.",
    "author": "Extract the author's full name if explicitly stated in the text (e.g. 'By John Doe'). If multiple authors, list them separated by commas. If no author is clearly attributed, return 'Staff'."
}
`;

    let retries = 0;
    const maxRetries = 3;
    const baseDelay = 5000;

    while (retries <= maxRetries) {
        try {
            const response = await axios.post('http://127.0.0.1:11434/api/generate', {
                model: 'phi3', // Defaulting to phi3, can be switched to llama3
                prompt: prompt,
                stream: false,
                format: 'json'
            });

            const resultText = response.data.response;
            
            const clean = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(clean);
        } catch (error) {
            retries++;
            const delay = baseDelay * Math.pow(2, retries - 1);
            console.warn(`Ollama Server Error. Make sure Ollama is running on 11434. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            if (retries > maxRetries) {
                console.error(`Extraction Error [${source}]:`, error.message || error);
                return null;
            }
        }
    }
}

module.exports = { extractDeterministicFacts };
