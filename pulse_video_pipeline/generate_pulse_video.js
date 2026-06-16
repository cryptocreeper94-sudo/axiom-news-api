require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();
const workDir = __dirname;
const ELEVENLABS_API_KEY = 'sk_aacd9b4aea77f8fcf050661d33b7a2337eec8bacd80608fb';
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - highly professional
const ffmpegExe = path.join('D:', 'video_build', 'ffmpeg', 'bin', 'ffmpeg.exe');

async function generateHtmlImage(prediction, bgPath, dest) {
    const probPercent = (prediction.probability * 100).toFixed(1) + '%';
    const eventText = prediction.article.coreEvent.replace(/"/g, '&quot;');
    
    // Pass background as base64
    const bgBase64 = fs.readFileSync(bgPath).toString('base64');
    const mime = bgPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const bgDataUrl = `data:${mime};base64,${bgBase64}`;

    const html = `
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;500;700&display=swap" rel="stylesheet">
        <style>
            body {
                margin: 0; padding: 0; width: 1920px; height: 1080px;
                background-image: url('${bgDataUrl}');
                background-size: cover; background-position: center;
                font-family: 'Inter', sans-serif;
                color: white;
                display: flex; flex-direction: column; justify-content: center; align-items: center;
            }
            .overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%);
                z-index: 1;
            }
            .header {
                position: absolute; top: 80px; left: 100px; z-index: 2;
                display: flex; align-items: center; gap: 20px;
            }
            .logo-box {
                width: 60px; height: 60px; background: #ffffff; color: #0f172a;
                display: flex; justify-content: center; align-items: center;
                font-weight: 700; font-size: 32px; border-radius: 4px;
            }
            .brand { font-size: 36px; font-weight: 500; letter-spacing: 6px; text-transform: uppercase; color: #ffffff; }
            .card {
                z-index: 2; background: rgba(255, 255, 255, 0.96);
                border-top: 8px solid #2563eb;
                border-radius: 8px;
                padding: 80px; max-width: 1400px; text-align: left;
                box-shadow: 0 20px 50px rgba(0,0,0,0.4);
            }
            .event-text { font-size: 48px; font-weight: 500; line-height: 1.4; margin-bottom: 60px; color: #0f172a; }
            .metric-box {
                display: inline-block; padding: 40px 60px;
                background: #f1f5f9; border-left: 8px solid #2563eb;
                border-radius: 4px;
            }
            .prob-value { font-size: 110px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1; letter-spacing: -2px; }
            .prob-label { font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #475569; margin-top: 20px; }
            .footer { position: absolute; bottom: 80px; left: 100px; z-index: 2; font-size: 18px; font-weight: 500; letter-spacing: 3px; color: rgba(255,255,255,0.9); text-transform: uppercase; }
        </style>
    </head>
    <body>
        <div class="overlay"></div>
        <div class="header">
            <div class="logo-box">A</div>
            <div class="brand">Axiom Daily Pulse</div>
        </div>
        <div class="card">
            <div class="event-text">"${eventText}"</div>
            <div class="metric-box">
                <div class="prob-value">${probPercent}</div>
                <div class="prob-label">Algorithmic Market Impact Likelihood</div>
            </div>
        </div>
        <div class="footer">Axiom Financial Data Intelligence • darkwavepulse.com</div>
    </body>
    </html>
    `;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.screenshot({ path: dest });
    await browser.close();
}

function runFFmpeg(args, label) {
    return new Promise((resolve, reject) => {
        console.log(`\n▶ [${label}]`);
        const proc = spawn(ffmpegExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderrChunks = [];
        proc.stderr?.on('data', (d) => { 
            stderrChunks.push(d.toString());
            if (stderrChunks.length > 50) stderrChunks.shift(); 
        });
        proc.on('close', (code) => {
            if (code === 0) return resolve();
            reject(new Error(`[${label}] code ${code}:\n${stderrChunks.join('').slice(-500)}`));
        });
        proc.on('error', (e) => reject(new Error('Cannot start ffmpeg: ' + e.message)));
    });
}

async function run() {
    console.log('🎬 Starting Pulse Video Generator...');

    // 1. Get Top 3 Highest Impact articles from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let predictions = [];
    if (fs.existsSync('predictions.json')) {
        console.log('\n🔒 Loading locked predictions from predictions.json...');
        predictions = JSON.parse(fs.readFileSync('predictions.json', 'utf8'));
    } else {
        predictions = await prisma.narrativePrediction.findMany({
            where: {
                createdAt: { gte: yesterday },
                probability: { gte: 0.50 },
                article: {
                    category: { in: ['Finance', 'Technology', 'Economy', 'Business', 'Crypto'] }
                }
            },
            orderBy: { probability: 'desc' },
            take: 3,
            include: { article: true }
        });
    }

    if (predictions.length === 0) {
        console.log('No high-impact predictions found in the last 24 hours.');
        process.exit(1);
    }

    const eventsText = predictions.map((p, i) => `Event ${i+1}: ${p.article.coreEvent} (Axiom Pulse Algorithmic Impact Probability: ${(p.probability * 100).toFixed(1)}%)`).join('\n');
    console.log('Gathered Events:\n' + eventsText);

    // 2. Generate Script via Gemini 2.5 Flash
    const prompt = `You are a professional but easy-to-understand macro-economic analyst. Write a fast-paced verbal market prediction based on these breaking events:
${eventsText}

Your task is to act as a hardcore Quantitative Analyst for a premium financial product. You are providing a strict, 3-part daily market briefing based on these breaking events. You must adhere EXACTLY to this 3-part structure, speaking in a highly professional, data-driven tone.

**PART 1: The Catalyst (Macro News)**
Briefly explain the top 1 or 2 events from the data above. Explain *what* happened and *why* it creates friction or opportunity in the global market.

**PART 2: Equities Quant Breakdown**
Translate the catalyst into traditional market impact. Act like a quant engine: explain *how* the catalyst will mathematically affect specific sectors and state the exact percentage likelihoods provided in the prompt (e.g., 'Our models show a 63% probability of downward pressure on Commercial Real Estate...'). 
CRITICAL VOICE RULE: Use the full spoken names of assets (e.g., "The S and P 500", "The Nasdaq", "Commercial Real Estate ETFs"). Do NOT use ticker abbreviations like SPY, QQQ, or XLRE.

**PART 3: Crypto & Digital Assets Breakdown**
Translate the catalyst into digital asset impact. Act like a quant engine: you MUST provide specific numerical probabilities of directional movement for the digital asset space.
You MUST specifically track and predict the impact on "Bitcoin", AND you MUST specifically track and predict the impact on at least one of the major "ISO 20022" utility assets (e.g., "X R P", "Stellar", or "Algorand"). State their exact probability of upward or downward pressure based on the macroeconomic catalyst.
CRITICAL VOICE RULE: Always use the full spoken names. Do NOT use abbreviations like BTC, ETH, or XLM. For XRP, write it exactly as "X R P" so the AI voice pronounces the letters correctly.

CRITICAL RULES: 
- The entire script MUST be extremely concise. Keep it strictly between 160 and 200 words total (around 70 to 100 seconds of spoken audio). 
- Do NOT write a massive essay. 
- Do not mention specific time durations.
- Write exactly the spoken script, with no formatting (no bolding, no bullet points, no asterisks), no intro text, and no scene directions. Do NOT include headings like "PART 1" in the output text. Just write the natural spoken words.
- End with a quick disclaimer that this is an algorithmic prediction and not financial advice.`;

    let scriptText = '';
    if (fs.existsSync('daily_script.txt')) {
        console.log('\n🧠 Loading script from daily_script.txt...');
        scriptText = fs.readFileSync('daily_script.txt', 'utf8').trim();
    } else {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        console.log('\n🧠 Requesting Script from Gemini...');
        const geminiRes = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        }, { headers: { 'Content-Type': 'application/json' } });
        
        scriptText = geminiRes.data.candidates[0].content.parts[0].text.trim();
    }
    console.log('\n📜 Script:\n' + scriptText);

    // 3. Generate Narration (ElevenLabs)
    console.log('\n🎙️ Generating ElevenLabs Narration...');
    const cleanScriptText = scriptText.replace(/[*_#]/g, ''); // Strip markdown
    const narrPath = path.join(workDir, 'pulse_narration.mp3');
    const body = JSON.stringify({
        text: cleanScriptText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.90, similarity_boost: 0.80, style: 0.0, use_speaker_boost: true }, // Stoic config
    });

    await new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.elevenlabs.io',
            path: `/v1/text-to-speech/${VOICE_ID}`,
            method: 'POST',
            headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            if (res.statusCode !== 200) return reject(new Error('ElevenLabs API Error ' + res.statusCode));
            const out = fs.createWriteStream(narrPath);
            res.pipe(out);
            out.on('finish', resolve);
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
    console.log('✅ Audio saved.');

    // 4. Gather Visuals (Dynamic High-Quality Assets)
    console.log('\n🖼️ Generating Branded HTML Images...');
    const imagePaths = [];
    const localAssets = ['pulse_bg_1.png', 'pulse_bg_2.png', 'pulse_bg_3.png'];
    for (let i = 0; i < predictions.length; i++) {
        const bgAsset = localAssets[i % localAssets.length];
        const srcPath = path.join(workDir, 'assets', bgAsset);
        const dest = path.join(workDir, `scene_${i+1}.png`);
        console.log(`Using Scene ${i+1} background: ${bgAsset} and generating metric overlay...`);
        await generateHtmlImage(predictions[i], srcPath, dest);
        imagePaths.push(dest);
    }
    console.log('✅ Backgrounds ready.');

    // 5. Render Video (FFMPEG)
    console.log('\n🎬 Rendering Video...');
    
    // Dynamically calculate SCENE_DURATION based on the generated audio length
    const { execSync } = require('child_process');
    const ffprobeExe = path.join('D:', 'video_build', 'ffmpeg', 'bin', 'ffprobe.exe');
    const durationRaw = execSync(`"${ffprobeExe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${narrPath}"`).toString().trim();
    const audioDuration = parseFloat(durationRaw);
    
    const FPS = 30;
    const W = 1920;
    const H = 1080;
    const TRANSITION = 1.0;
    // We want the total video length to be exactly audioDuration + 0.5s buffer
    const targetVideoLength = audioDuration + 0.5;
    const targetSceneLen = 10; // 10 seconds per image
    const requiredScenes = Math.max(imagePaths.length, Math.ceil(targetVideoLength / targetSceneLen));
    
    const finalImagePaths = [];
    for (let i = 0; i < requiredScenes; i++) {
        finalImagePaths.push(imagePaths[i % imagePaths.length]);
    }
    
    const numScenes = finalImagePaths.length;
    const SCENE_DURATION = (targetVideoLength + (numScenes - 1) * TRANSITION) / numScenes;
    
    const clipPaths = [];

    for (let i = 0; i < finalImagePaths.length; i++) {
        const clipOut = path.join(workDir, `clip_${i}.mp4`);
        clipPaths.push(clipOut);
        const totalFrames = SCENE_DURATION * FPS;
        const fadeInEnd = Math.round(0.5 * FPS);
        const fadeOutStart = Math.round((SCENE_DURATION - 0.8) * FPS);
        const fadeOutFrames = Math.round(0.8 * FPS);
        
        const fc = [
            `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black[scaled]`,
            `[scaled]fade=t=in:st=0:nb_frames=${fadeInEnd}[fadein]`,
            `[fadein]fade=t=out:st=${fadeOutStart}:nb_frames=${fadeOutFrames}[out]`
        ].join(';');

        await runFFmpeg([
            '-y', '-loop', '1', '-framerate', String(FPS), '-i', finalImagePaths[i],
            '-filter_complex', fc, '-map', '[out]', '-t', String(SCENE_DURATION),
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-an', clipOut
        ], `Scene ${i+1} Clip`);
    }

    console.log('\n🔗 Merging clips...');
    const inputs = [];
    clipPaths.forEach(p => { inputs.push('-i', p); });

    const filterParts = [];
    let offset = 0;
    let prevLabel = '[0:v]';
    for (let i = 1; i < clipPaths.length; i++) {
        offset += SCENE_DURATION - TRANSITION;
        const outLabel = i < clipPaths.length - 1 ? `[v${i}]` : '[vout]';
        filterParts.push(`${prevLabel}[${i}:v]xfade=transition=fade:duration=${TRANSITION}:offset=${offset.toFixed(3)}${outLabel}`);
        prevLabel = outLabel;
    }

    const mergedPath = path.join(workDir, 'merged_video.mp4');
    if (clipPaths.length === 1) {
        console.log('[Merge] Only 1 scene, skipping xfade transition.');
        const fs = require('fs');
        fs.copyFileSync(clipPaths[0], mergedPath);
    } else {
        await runFFmpeg([
            '-y', ...inputs, '-filter_complex', filterParts.join(';'), '-map', '[vout]',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', mergedPath
        ], 'Merge');
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const finalPath = path.join(workDir, `pulse_video_${dateStr}.mp4`);
    console.log('\n🔊 Muxing Audio...');
    await runFFmpeg([
        '-y', '-i', mergedPath, '-i', narrPath,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        finalPath
    ], 'Final Mux');

    // Cleanup is now manual so the user can review the video before deleting intermediate files.

    // Save to database for Axiom Daily Pulse native UI
    const videoFileName = path.basename(finalPath);
    await prisma.pulseVideo.create({
        data: {
            videoUrl: `https://api.axiom42news.com/videos/${videoFileName}`,
            transcript: scriptText,
            marketImpact: predictions[0] ? predictions[0].probability : 0.0
        }
    });

    console.log(`\n🎉 SUCCESS! Video generated at:\n${finalPath}`);
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
