require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');

const prisma = new PrismaClient();

async function run() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const articles = await prisma.article.findMany({
        where: {
            timestamp: { gte: yesterday },
            category: { in: ['World', 'Politics'] },
            isSatire: false
        },
        orderBy: { timestamp: 'desc' },
        take: 5
    });

    if (articles.length === 0) {
        console.log('NO_ARTICLES');
        process.exit(0);
    }

    const eventsText = articles.map((a, i) => `Headline ${i+1}: ${a.coreEvent}`).join('\n');
    
    // Save topics
    fs.writeFileSync('morning_topics.txt', eventsText);

    const prompt = `You are the lead anchor for the "Axiom News Morning Brief", a professional, authoritative, yet approachable global news broadcast.
Write a concise morning briefing script based on these breaking global events:
${eventsText}

Your task is to:
1. Provide a quick rundown of the top stories.
2. Generate a "Chain-Reaction Forecast": predict BOTH the geopolitical/diplomatic outcomes AND the global market/economic impacts of these events combined. Use specific percentage likelihoods for your predictions (e.g. "There is an 80% probability that this will lead to...").
3. Deliver the news in a professional broadcast tone (not cyberpunk, not overly hyped, just high-quality global news).

Keep it engaging and clear. Start with a strong broadcast intro: "Good morning, I'm [Anchor Name], and this is your Axiom News Morning Brief." (Pick a realistic sounding anchor name).
CRITICAL RULE: The entire script MUST be concise. Keep it strictly between 150 and 200 words total (around 60 to 90 seconds of spoken audio). Do NOT write a massive essay.
Write exactly the spoken script, with no formatting, no intro text, and no scene directions.
End with a professional broadcast sign-off.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const geminiRes = await axios.post(geminiUrl, {
        contents: [{ parts: [{ text: prompt }] }]
    }, { headers: { 'Content-Type': 'application/json' } });
    
    const scriptText = geminiRes.data.candidates[0].content.parts[0].text.trim();
    fs.writeFileSync('morning_script.txt', scriptText);
    console.log('SUCCESS');
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
