require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');

const prisma = new PrismaClient();

async function run() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const predictions = await prisma.narrativePrediction.findMany({
        where: {
            createdAt: { gte: yesterday },
            article: {
                category: { in: ['Finance', 'Technology', 'Economy', 'Business', 'Crypto'] }
            }
        },
        orderBy: { probability: 'desc' },
        skip: 3, // Skip the first 3 since they were used yesterday/earlier today
        take: 3,
        include: { article: true }
    });

    if (predictions.length === 0) {
        console.log('NO_PREDICTIONS');
        process.exit(0);
    }

    const eventsText = predictions.map((p, i) => `Event ${i+1}: ${p.article.coreEvent} (Axiom Pulse Algorithmic Impact Probability: ${(p.probability * 100).toFixed(1)}%)`).join('\n');
    
    // Save topics
    fs.writeFileSync('daily_topics.txt', eventsText);

    const prompt = `You are a professional but easy-to-understand macro-economic analyst. Write a fast-paced verbal market prediction based on these breaking events:
${eventsText}

Your task is to provide a dual-market forecast. First, quickly touch on these specific events. Then, provide an **overall market snapshot** synthesizing this Pulse information into a broader outlook for BOTH:
1. Standard Financials / Traditional Equities (like the S&P 500 or broader market trends)
2. Crypto / Digital Assets (like Bitcoin, Ethereum, or Solana)

Explain these impacts in plain, simple English. Avoid overly complex algorithmic jargon, but you MUST still include the exact percentage likelihoods provided in the prompt (e.g., 'There is an 85% algorithmic chance that...').
Keep it engaging, clear, and direct. Start with a high-energy personality-driven intro (for example, "Alright, buckle up, this is your daily market lightning round!"). 
CRITICAL RULE: The entire script MUST be extremely concise. Keep it strictly between 130 and 160 words total (around 60 to 90 seconds of spoken audio). Do NOT write a massive essay. Do not mention specific time durations in the script.
Write exactly the spoken script, with no formatting, no intro text, and no scene directions.
End with a quick disclaimer that this is an algorithmic prediction and not financial advice.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const geminiRes = await axios.post(geminiUrl, {
        contents: [{ parts: [{ text: prompt }] }]
    }, { headers: { 'Content-Type': 'application/json' } });
    
    const scriptText = geminiRes.data.candidates[0].content.parts[0].text.trim();
    fs.writeFileSync('daily_script.txt', scriptText);
    console.log('SUCCESS');
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
