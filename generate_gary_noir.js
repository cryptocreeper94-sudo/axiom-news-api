require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');

const prisma = new PrismaClient();
const publicDir = path.join('D:', 'axiom-news', 'public');

const ELEVENLABS_API_KEY = 'sk_aacd9b4aea77f8fcf050661d33b7a2337eec8bacd80608fb';
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Using Sarah voice for now since we don't have Gary's ID

async function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => file.close(resolve));
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => file.close(resolve));
            }
        }).on('error', reject);
    });
}

async function run() {
    console.log('🕵️‍♂️ Starting Gary Noir Generator...');

    // 1. Get the most spun article from today
    const topSpin = await prisma.article.findFirst({
        where: { biasScore: { gt: 30 } },
        orderBy: { biasScore: 'desc' }
    });

    if (!topSpin) {
        console.log('No heavily spun articles found today to satirize.');
        process.exit(1);
    }

    console.log(`\n🎯 Target Acquired: ${topSpin.source} (${topSpin.biasScore}% Spin)`);
    console.log(`Headline: ${topSpin.coreEvent}`);
    console.log(`Original Spin: ${topSpin.originalText}`);

    // 2. Generate Script via Gemini 2.5 Flash
    const prompt = `You are writing an episode for "Gary's Noir", an absurdist, cynical comic strip.
The style is a mashup of Gary Larson's "The Far Side" (surreal, deadpan, absurd) and hardboiled 1940s Noir Detective inner-monologues.

Write a 4-part short script satirizing this heavily spun news event:
Headline: ${topSpin.coreEvent}
Original Spin: ${topSpin.originalText}

The tone should expose the ridiculousness or hidden agenda of the media's spin.
Gary is the protagonist. The events should be slightly surreal.
Return exactly a JSON array of 4 objects. No markdown formatting.
Schema:
[
  {
    "text": "The spoken monologue for this slide",
    "imagePrompt": "A highly specific, 1-sentence prompt for the visual. MUST include 'black and white noir comic style, Gary Larson The Far Side style'"
  }
]`;

    console.log('\n🧠 Requesting Noir Script from Gemini...');
    const geminiRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        contents: [{ parts: [{ text: prompt }] }]
    }, { headers: { 'Content-Type': 'application/json' } });
    
    let resultText = geminiRes.data.candidates[0].content.parts[0].text.trim();
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    const slides = JSON.parse(resultText);
    
    console.log('\n📜 Script Generated:');
    slides.forEach((s, i) => console.log(`Slide ${i+3}: ${s.text}`));

    // Determine starting index based on existing files in public dir
    // We assume 1 and 2 exist. Let's find the max index.
    let startIndex = 3;
    while(fs.existsSync(path.join(publicDir, `gary_${startIndex}.png`))) {
        startIndex++;
    }

    const reactSlides = [];

    // 3. Generate Audio & Images
    for (let i = 0; i < slides.length; i++) {
        const index = startIndex + i;
        const slide = slides[i];
        
        console.log(`\n🎙️ Generating Audio for Slide ${index}...`);
        const audioPath = path.join(publicDir, `gary_audio_${index}.mp3`);
        const body = JSON.stringify({
            text: slide.text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: 0.85, similarity_boost: 0.80, style: 0.20, use_speaker_boost: true }
        });

        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.elevenlabs.io',
                path: `/v1/text-to-speech/${VOICE_ID}`,
                method: 'POST',
                headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            }, (res) => {
                if (res.statusCode !== 200) return reject(new Error('ElevenLabs Error ' + res.statusCode));
                const out = fs.createWriteStream(audioPath);
                res.pipe(out);
                out.on('finish', resolve);
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });

        console.log(`🖼️ Generating Image for Slide ${index}...`);
        const imgPath = path.join(publicDir, `gary_${index}.png`);
        const fullPrompt = `${slide.imagePrompt}. No text, no logos.`;
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=768&nologo=true&seed=${Date.now()}`;
        await downloadImage(url, imgPath);

        reactSlides.push(`    {
      image: '/gary_${index}.png',
      audio: '/gary_audio_${index}.mp3',
      text: "${slide.text.replace(/"/g, '\\"')}"
    }`);
    }

    console.log('\n✅ Episode Generation Complete!');
    console.log('\n--- Paste this into ComicPlayer.jsx slides array ---');
    console.log(reactSlides.join(',\n'));
    console.log('--------------------------------------------------');
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
