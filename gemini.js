const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

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
    "strippedTerms": ["list", "of", "exact", "words", "or", "phrases", "you", "stripped", "from", "the", "raw", "text", "because", "they", "were", "biased", "e.g.", "slammed", "devastating", "reckless"],
    "deterministicRewrite": "A full paragraph synthesized strictly from verified facts. No editorial language, no adjectives of opinion, no attribution of motive.",
    "author": "Extract the author's full name if explicitly stated in the text (e.g. 'By John Doe'). If multiple authors, list them separated by commas. If no author is clearly attributed, return 'Staff'."
}
`;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const resultText = response.data.choices[0].message.content;
        return JSON.parse(resultText);
    } catch (error) {
        console.error('Extraction Error:', error.response?.data || error.message);
        return null;
    }
}

module.exports = { extractDeterministicFacts };
