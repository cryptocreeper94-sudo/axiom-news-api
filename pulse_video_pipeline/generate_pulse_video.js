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

async function generateHtmlImage(prediction, quantMetrics, bgPath, dest) {
    const eventText = prediction.article.coreEvent.replace(/"/g, '&quot;');
    
    // Pass background as base64
    const bgBase64 = fs.readFileSync(bgPath).toString('base64');
    const mime = bgPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const bgDataUrl = `data:${mime};base64,${bgBase64}`;

    let quantHtml = '';
    for (const metric of quantMetrics) {
        const isUp = metric.direction.toLowerCase() === 'up';
        const colorClass = isUp ? 'up' : 'down';
        quantHtml += `
            <div class="metric-card ${colorClass}">
                <div class="asset-name">${metric.asset}</div>
                <div class="prob-row">
                    <div class="prob-value ${colorClass}">${metric.probability}%</div>
                    <div class="prob-dir">${metric.direction}WARD PRESSURE</div>
                </div>
            </div>
        `;
    }

    const html = `
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            body {
                margin: 0; padding: 0; width: 1920px; height: 1080px;
                background-image: url('${bgDataUrl}');
                background-size: cover; background-position: center;
                font-family: 'Inter', sans-serif; color: white;
                display: flex;
            }
            .overlay-mask {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(6px);
                z-index: 1;
            }
            .dashboard {
                position: relative; z-index: 2; display: flex; width: 100%; height: 100%;
                padding: 80px; box-sizing: border-box;
            }
            .left-col { flex: 1; border-right: 2px solid rgba(255,255,255,0.1); padding-right: 80px; display: flex; flex-direction: column; }
            .right-col { width: 650px; padding-left: 80px; display: flex; flex-direction: column; justify-content: center; }
            
            .header { display: flex; align-items: center; gap: 20px; margin-bottom: 50px; }
            .logo-box { width: 60px; height: 60px; background: #3b82f6; color: white; display: flex; justify-content: center; align-items: center; font-weight: 800; font-size: 32px; border-radius: 4px; }
            .brand { font-size: 36px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; color: #f8fafc; }
            .terminal-id { margin-left: auto; font-family: 'Roboto Mono', monospace; font-size: 20px; color: #94a3b8; }
            
            .catalyst-label { font-size: 20px; color: #3b82f6; font-weight: 700; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 24px; }
            .event-text { font-size: 52px; font-weight: 600; line-height: 1.3; color: #f1f5f9; }
            
            .quant-label { font-size: 20px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 30px; }
            .metric-card {
                background: rgba(30, 41, 59, 0.7);
                border: 1px solid rgba(255,255,255,0.05);
                border-left: 6px solid #3b82f6;
                padding: 40px; margin-bottom: 24px;
                border-radius: 4px;
            }
            .metric-card.up { border-left-color: #10b981; }
            .metric-card.down { border-left-color: #ef4444; }
            
            .asset-name { font-size: 32px; font-weight: 700; color: #f8fafc; margin-bottom: 16px; }
            .prob-row { display: flex; justify-content: space-between; align-items: flex-end; }
            .prob-value { font-family: 'Roboto Mono', monospace; font-size: 64px; font-weight: 700; line-height: 1; }
            .prob-value.up { color: #10b981; }
            .prob-value.down { color: #ef4444; }
            .prob-dir { font-size: 20px; font-weight: 600; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px;}
        </style>
    </head>
    <body>
        <div class="overlay-mask"></div>
        <div class="dashboard">
            <div class="left-col">
                <div class="header">
                    <div class="logo-box">A</div>
                    <div class="brand">Axiom Quant Engine</div>
                    <div class="terminal-id">NODE_${Math.floor(Math.random()*9000)+1000}</div>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                    <div class="catalyst-label">Primary Macro Catalyst</div>
                    <div class="event-text">"${eventText}"</div>
                </div>
                <div style="font-family: 'Roboto Mono'; color: #64748b; font-size: 20px;">LIVE ALGORITHMIC PROJECTIONS • ${new Date().toISOString().split('T')[0]}</div>
            </div>
            <div class="right-col">
                <div class="quant-label">Asset Impact Vectors</div>
                ${quantHtml}
            </div>
        </div>
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
                article: { category: { in: ['Finance', 'Technology', 'Economy', 'Business', 'Crypto'] } }
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
    const prompt = `You are a professional but easy-to-understand macro-economic quantitative analyst. Write a fast-paced verbal market prediction based on these breaking events:
${eventsText}

**PART 1: The Catalyst (Macro News)**
Explain what happened and why it creates friction or opportunity.

**PART 2: Equities Quant Breakdown**
Explain how the catalyst affects specific sectors (e.g. Commercial Real Estate). Use full spoken names (e.g. "The S and P 500"). Provide specific numerical probabilities of upward or downward pressure.

**PART 3: Crypto & Digital Assets Breakdown**
Provide specific numerical probabilities of directional movement for digital assets.
You MUST specifically track "Bitcoin", AND you MUST specifically track at least one ISO 20022 asset (e.g., "X R P", "Stellar", or "Algorand"). 
Write XRP as "X R P" so the voice engine reads the letters.

CRITICAL RULES:
- Script MUST be between 220 and 280 words.
- End with a disclaimer that this is an algorithmic prediction.
- You MUST output your response EXACTLY as a raw JSON object with NO MARKDOWN, NO \`\`\`json block. Just the raw JSON.

JSON SCHEMA:
{
  "script": "Good morning. Our primary macro catalyst...",
  "quant_metrics": [
    { "asset": "Commercial Real Estate ETFs", "direction": "Down", "probability": 63.2 },
    { "asset": "Bitcoin", "direction": "Up", "probability": 58.0 },
    { "asset": "X R P", "direction": "Down", "probability": 52.0 }
  ]
}
`;

    let scriptData;
    if (fs.existsSync('daily_script.json')) {
        console.log('\n🧠 Loading script from daily_script.json...');
        scriptData = JSON.parse(fs.readFileSync('daily_script.json', 'utf8'));
    } else {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        console.log('\n🧠 Requesting JSON Script from Gemini...');
        const geminiRes = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        }, { headers: { 'Content-Type': 'application/json' } });
        
        let rawContent = geminiRes.data.candidates[0].content.parts[0].text.trim();
        scriptData = JSON.parse(rawContent);
        fs.writeFileSync('daily_script.json', JSON.stringify(scriptData, null, 2));
    }
    console.log('\n📜 Script:\n' + scriptData.script);
    console.log('\n📊 Quant Metrics extracted:\n', scriptData.quant_metrics);

    // 3. Generate Narration (ElevenLabs)
    console.log('\n🎙️ Generating ElevenLabs Narration...');
    const cleanScriptText = scriptData.script.replace(/[*_#]/g, ''); // Strip markdown
    const narrPath = path.join(workDir, 'pulse_narration.mp3');
    
    if (!fs.existsSync(narrPath)) {
        const body = JSON.stringify({
            text: cleanScriptText,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: 0.90, similarity_boost: 0.80, style: 0.0, use_speaker_boost: true },
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
    } else {
        console.log('✅ Audio already exists.');
    }

    // 4. Calculate Duration & Required Scenes
    console.log('\n⏱️ Calculating Timings...');
    const { execSync } = require('child_process');
    const ffprobeExe = path.join('D:', 'video_build', 'ffmpeg', 'bin', 'ffprobe.exe');
    const durationRaw = execSync(`"${ffprobeExe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${narrPath}"`).toString().trim();
    const audioDuration = parseFloat(durationRaw);
    
    const FPS = 30;
    const W = 1920;
    const H = 1080;
    const TRANSITION = 1.0;
    const targetVideoLength = audioDuration + 0.5;
    const targetSceneLen = 8.5; // 8.5 seconds per image
    const requiredScenes = Math.ceil(targetVideoLength / targetSceneLen);
    
    const numScenes = requiredScenes;
    const SCENE_DURATION = (targetVideoLength + (numScenes - 1) * TRANSITION) / numScenes;

    // 5. Gather Visuals (Dynamic API backgrounds)
    console.log(`\n🖼️ Fetching ${requiredScenes} Dynamic AI Backgrounds from Pollinations...`);
    const imagePaths = [];
    
    const aiPrompts = [
        "photorealistic corporate finance stock chart dark theme no purple no cyberpunk",
        "institutional quantitative trading desk screens dark cinematic no cyberpunk",
        "macro economics global logistics nodes abstract dark blue no purple",
        "wall street skyscrapers glowing at night cinematic dark no futuristic",
        "commercial real estate institutional investment abstract dark theme",
        "global currency exchange rates matrix dark mode professional",
        "digital assets blockchain nodes professional dark theme no glowing neon",
        "algorithmic high frequency trading servers dark blue photorealistic",
        "federal reserve bank building night photorealistic dark theme",
        "international shipping containers cargo night cinematic dark theme",
        "silicon valley tech campus night photorealistic dark theme",
        "global commodities oil rig ocean night cinematic dark",
        "corporate boardroom table glass window night city dark theme",
        "fiber optic data cables macro dark theme professional",
        "artificial intelligence neural network professional dark blue"
    ];

    for (let i = 0; i < requiredScenes; i++) {
        const dest = path.join(workDir, `scene_${i+1}.png`);
        const bgDest = path.join(workDir, `bg_${i+1}.jpg`);
        const aiPrompt = aiPrompts[i % aiPrompts.length];
        
        if (!fs.existsSync(dest)) {
            console.log(`Downloading background ${i+1}: ${aiPrompt}`);
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(aiPrompt)}?width=1920&height=1080&nologo=true`;
            
            await new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    const file = fs.createWriteStream(bgDest);
                    res.pipe(file);
                    file.on('finish', resolve);
                }).on('error', reject);
            });

            console.log(`Rendering Bloomberg overlay for scene ${i+1}...`);
            await generateHtmlImage(predictions[0], scriptData.quant_metrics, bgDest, dest);
            fs.unlinkSync(bgDest); // clean up intermediate bg
        }
        imagePaths.push(dest);
    }
    console.log('✅ Backgrounds and overlays ready.');

    // 6. Render Video (FFMPEG)
    console.log('\n🎬 Rendering Video Clips...');
    const clipPaths = [];

    for (let i = 0; i < imagePaths.length; i++) {
        const clipOut = path.join(workDir, `clip_${i}.mp4`);
        clipPaths.push(clipOut);
        
        if (fs.existsSync(clipOut)) continue;

        const fadeInEnd = Math.round(0.5 * FPS);
        const fadeOutStart = Math.round((SCENE_DURATION - 0.8) * FPS);
        const fadeOutFrames = Math.round(0.8 * FPS);
        
        const fc = [
            `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black[scaled]`,
            `[scaled]fade=t=in:st=0:nb_frames=${fadeInEnd}[fadein]`,
            `[fadein]fade=t=out:st=${fadeOutStart}:nb_frames=${fadeOutFrames}[out]`
        ].join(';');

        await runFFmpeg([
            '-y', '-loop', '1', '-framerate', String(FPS), '-i', imagePaths[i],
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

    const videoFileName = path.basename(finalPath);
    await prisma.pulseVideo.create({
        data: {
            videoUrl: `https://api.axiom42news.com/videos/${videoFileName}`,
            transcript: scriptData.script,
            marketImpact: predictions[0] ? predictions[0].probability : 0.0
        }
    });

    console.log(`\n🎉 SUCCESS! Video generated at:\n${finalPath}`);
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
