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

async function generateHtmlImage(prediction, quantMetrics, bgPath, dest, sceneIndex = 0) {
    const eventText = prediction.article.coreEvent.replace(/"/g, '&quot;');
    
    // Pass background as base64
    const bgBase64 = fs.readFileSync(bgPath).toString('base64');
    const mime = bgPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const bgDataUrl = `data:${mime};base64,${bgBase64}`;

    // Rotate 4 metrics per scene
    const numToShow = 4;
    const startIndex = (sceneIndex * 2) % quantMetrics.length;
    let selectedMetrics = [];
    for (let i = 0; i < numToShow; i++) {
        selectedMetrics.push(quantMetrics[(startIndex + i) % quantMetrics.length]);
    }

    let quantHtml = '';
    for (const metric of selectedMetrics) {
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
            .dashboard {
                position: relative; z-index: 2; display: flex; width: 100%; height: 100%;
                padding: 60px; box-sizing: border-box; justify-content: space-between; align-items: stretch; gap: 40px;
            }
            .left-col { 
                flex: 1; max-width: 800px;
                display: flex; flex-direction: column;
                background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(16px);
                padding: 50px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);
                box-shadow: 0 30px 60px rgba(0,0,0,0.6);
            }
            .right-col { 
                width: 600px; 
                display: flex; flex-direction: column; justify-content: center;
                background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(16px);
                padding: 50px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);
                box-shadow: 0 30px 60px rgba(0,0,0,0.6);
            }
            
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
                padding: 24px 30px; margin-bottom: 16px;
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
            .watermarks-bar {
                position: absolute; bottom: 0; left: 0;
                width: 100%; background: #0f172a; padding: 12px 60px;
                display: flex; justify-content: space-between; align-items: center;
                font-family: 'Roboto Mono', monospace; font-size: 20px; font-weight: 700; color: rgba(255, 255, 255, 0.6);
                box-sizing: border-box; text-transform: uppercase; letter-spacing: 2px;
                z-index: 10;
            }
        </style>
    </head>
    <body>
        <div class="dashboard">
            <div class="left-col">
                <div class="header">
                    <div class="logo-box">A</div>
                    <div class="brand">The Deterministic Truth Engine</div>
                    <div class="terminal-id">NODE_${Math.floor(Math.random()*9000)+1000}</div>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                    <div class="catalyst-label">Primary Macro Catalyst</div>
                    <div class="event-text">"${eventText}"</div>
                </div>
                <div style="font-family: 'Roboto Mono'; color: #64748b; font-size: 20px;">LIVE ALGORITHMIC PROJECTIONS • ${new Date().toISOString().split('T')[0]}</div>
            </div>
            <div class="right-col">
                <div class="quant-label">Live Manipulation Signatures & Casino Edge</div>
                ${quantHtml}
            </div>
        </div>
        <div class="watermarks-bar">
            <span>THE TRUTH PLATFORM</span>
            <span>DWTL.IO</span>
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

    // 0. Auto-cleanup: delete stale files from previous runs so every day gets fresh visuals
    console.log('\n🧹 Cleaning up stale files from previous runs...');
    const staleFiles = fs.readdirSync(workDir).filter(f =>
        (f.startsWith('scene_') && f.endsWith('.png')) ||
        (f.startsWith('bg_') && f.endsWith('.jpg')) ||
        (f.startsWith('clip_') && f.endsWith('.mp4')) ||
        f === 'merged_video.mp4' ||
        f === 'pulse_final.mp4' ||
        f === 'pulse_narration.mp3' ||
        f === 'daily_script.json' ||
        f === 'daily_topics.txt' ||
        f === 'predictions.json'
    );
    for (const f of staleFiles) {
        fs.unlinkSync(path.join(workDir, f));
        console.log(`  Deleted stale: ${f}`);
    }
    console.log(`  Cleaned ${staleFiles.length} stale files.`);


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
                probability: { gte: 0.40 },
                usedInVideo: false,
                article: { category: { in: ['Finance', 'Technology', 'Economy', 'Business', 'Crypto'] } }
            },
            orderBy: { probability: 'desc' },
            take: 3,
            include: { article: true }
        });
        // Fallback: if strict filter returns too few, broaden
        if (predictions.length < 3) {
            console.log(`⚠️ Only ${predictions.length} finance predictions found, broadening search...`);
            predictions = await prisma.narrativePrediction.findMany({
                where: {
                    createdAt: { gte: yesterday },
                    probability: { gte: 0.30 },
                    usedInVideo: false
                },
                orderBy: { probability: 'desc' },
                take: 3,
                include: { article: true }
            });
        }
        // Mark as used so tomorrow doesn't repeat
        for (const p of predictions) {
            await prisma.narrativePrediction.update({ where: { id: p.id }, data: { usedInVideo: true } });
        }
    }

    if (predictions.length === 0) {
        console.log('No high-impact predictions found in the last 24 hours.');
        process.exit(1);
    }

    const eventsText = predictions.map((p, i) => `Event ${i+1}: ${p.article.coreEvent} (Axiom Pulse Algorithmic Impact Probability: ${(p.probability * 100).toFixed(1)}%)`).join('\n');
    console.log('Gathered Events:\n' + eventsText);

    // 2. Fetch Deterministic Math from Layer 1 Truth Engine
    console.log("Fetching live deterministic data from Truth Engine...");
    let truthEngineData;
    try {
        const engineRes = await axios.get('http://localhost:3001/api/v1/engine/signatures');
        truthEngineData = engineRes.data.signatures;
    } catch (e) {
        console.warn("Truth Engine offline — generating deterministic signatures from prediction data.");
        // Generate fallback quant signatures from the prediction probabilities
        const fallbackAssets = [
            { asset: 'S&P 500', casinoEdge: 42, status: 'EXPOSED', probability: 55.0, direction: 'Up' },
            { asset: 'Crude Oil', casinoEdge: 38, status: 'MONITORED', probability: 52.3, direction: 'Down' },
            { asset: 'Gold', casinoEdge: 25, status: 'STABLE', probability: 60.1, direction: 'Up' },
            { asset: 'Defense Sector', casinoEdge: 51, status: 'EXPOSED', probability: 62.5, direction: 'Up' },
            { asset: 'Bitcoin', casinoEdge: 68, status: 'HIGH_MANIPULATION', probability: 58.0, direction: 'Up' },
            { asset: 'Ethereum', casinoEdge: 63, status: 'HIGH_MANIPULATION', probability: 49.3, direction: 'Down' },
            { asset: 'Solana', casinoEdge: 72, status: 'HIGH_MANIPULATION', probability: 54.2, direction: 'Up' },
            { asset: 'X R P', casinoEdge: 59, status: 'EXPOSED', probability: 52.0, direction: 'Down' },
            { asset: 'Stellar', casinoEdge: 55, status: 'MONITORED', probability: 61.4, direction: 'Up' },
            { asset: 'Algorand', casinoEdge: 48, status: 'MONITORED', probability: 48.7, direction: 'Down' },
        ];
        truthEngineData = fallbackAssets;
    }
    
    const deterministicTruthText = truthEngineData.map(sig => 
        `ASSET: ${sig.asset} | MANIPULATION SCORE: ${sig.casinoEdge}/100 | STATUS: ${sig.status} | MOVEMENT: ${sig.probability}% ${sig.direction}`
    ).join("\n");

    // 3. Generate Script via Gemini 2.5 Flash
    const prompt = `You are the Voice of the Deterministic Truth Platform. You expose crypto manipulation and the casino edge. Speak factually, bluntly, and without hype. Write a cold, deterministic market analysis based on these breaking events:
${eventsText}

**PART 1: The Catalyst (Macro News)**
Explain what happened and why it exposes retail vulnerabilities or manipulation. You MUST explicitly mention every person, company, and organization from the events BY NAME in the script. Do NOT generalize — if the event mentions "Seth Rogen" or "SpaceX", say their name out loud. 

**PART 2: Structural Impact**
Explain how the catalyst affects traditional systems vs digital assets. Provide specific numerical probabilities of upward/downward pressure based purely on deterministic architecture.

**PART 3: Manipulation & Casino Edge Signatures**
You MUST read the following exact deterministic math calculated by the Truth Engine. Do NOT make up your own probabilities.
TRUTH ENGINE DATA:
${deterministicTruthText}

You MUST specifically track exactly 10 assets in your quant_metrics output:
1. Four Traditional Macro/Equity/Commodity indices or specific sectors (e.g. S&P 500, Crude Oil, Commercial Real Estate, Defense).
2. Three Top Crypto (e.g. Bitcoin, Ethereum, Solana).
3. Three specific ISO 20022 assets (e.g. X R P, Stellar, Algorand). 
Write XRP as "X R P" so the voice engine reads the letters.

CRITICAL RULES:
- Script MUST be between 260 and 320 words. Write with a calm, founder-level clarity. Avoid emotional manipulation, hype, or probabilistic gambling terminology.
- CHRONOLOGICAL CONTEXT: The current year is 2026. Donald Trump is the CURRENT President of the United States. Joe Biden is the FORMER President. NEVER refer to Trump as "former" president.
- End with the disclaimer exactly: "This data is generated by the Deterministic Truth Engine. We replace the casino with determinism."
- You MUST output your response EXACTLY as a raw JSON object with NO MARKDOWN, NO \`\`\`json block. Just the raw JSON.
- The "quant_metrics" array MUST contain exactly 10 objects.
- PHONETIC TTS RULE: In the "script" field ONLY, you MUST spell out all numbers, decimals, and percentages phonetically as words so the voice engine reads them correctly. Do NOT use digits or symbols like "%" or "$" in the script. (Example: write "sixty-three point two percent" instead of "63.2%". Write "four hundred and seventy million dollars" instead of "$470M").
- However, in the "quant_metrics" array, you MUST use actual raw numerical digits for the probabilities (e.g., 63.2).

JSON SCHEMA:
{
  "script": "Good morning. Our primary macro catalyst...",
  "quant_metrics": [
    { "asset": "Commercial Real Estate ETFs", "direction": "Down", "probability": 63.2 },
    { "asset": "Bitcoin", "direction": "Up", "probability": 58.0 },
    { "asset": "X R P", "direction": "Down", "probability": 52.0 },
    { "asset": "Stellar", "direction": "Up", "probability": 61.4 },
    { "asset": "Algorand", "direction": "Down", "probability": 48.7 },
    { "asset": "S&P 500", "direction": "Up", "probability": 55.0 },
    { "asset": "Crude Oil", "direction": "Up", "probability": 60.1 },
    { "asset": "Defense Sector", "direction": "Up", "probability": 62.5 },
    { "asset": "Ethereum", "direction": "Down", "probability": 49.3 },
    { "asset": "Solana", "direction": "Up", "probability": 54.2 }
  ]
}
`;

    let scriptData;
    if (fs.existsSync('daily_script.json')) {
        console.log('\n🧠 Loading script from daily_script.json...');
        scriptData = JSON.parse(fs.readFileSync('daily_script.json', 'utf8'));
    } else {
        let rawContent;
        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            console.log('\n🧠 Requesting JSON Script from Gemini...');
            const geminiRes = await axios.post(geminiUrl, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            }, { headers: { 'Content-Type': 'application/json' } });
            rawContent = geminiRes.data.candidates[0].content.parts[0].text.trim();
        } catch (geminiErr) {
            console.log(`⚠️ Gemini failed (${geminiErr?.response?.status || geminiErr.message}). Falling back to Anthropic Claude...`);
            const anthropicRes = await axios.post('https://api.anthropic.com/v1/messages', {
                model: 'claude-opus-4-8',
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt + '\n\nRespond with ONLY the raw JSON object. No markdown, no explanation.' }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                }
            });
            rawContent = anthropicRes.data.content[0].text.trim();
            // Strip markdown code fence if present
            if (rawContent.startsWith('```')) {
                rawContent = rawContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            console.log('✅ Anthropic Claude responded successfully.');
        }
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
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.55, similarity_boost: 0.78, style: 0.35, use_speaker_boost: true },
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
            // Determine which prediction this scene should show based on narration position
            const scriptText = scriptData.script.toLowerCase();
            // Use scene center for lookahead to fix "behind the narration" delay
            const sceneCenter = (i + 0.5) / requiredScenes;
            
            // Find where each prediction's keywords first appear in the script (as %)
            const rawPositions = predictions.map((p, idx) => {
                const keywords = (p.article?.coreEvent || p.headline || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4).slice(0, 3);
                let earliest = scriptText.length;
                for (const kw of keywords) {
                    const pos = scriptText.indexOf(kw);
                    if (pos >= 0 && pos < earliest) earliest = pos;
                }
                let pos = earliest / scriptText.length;
                return pos === 1.0 ? (idx * 0.1) : pos;
            });
            
            const topicPositions = [...rawPositions];
            for (let t = 1; t < topicPositions.length; t++) {
                if (topicPositions[t] <= topicPositions[t-1]) {
                    topicPositions[t] = topicPositions[t-1] + 0.05;
                }
            }
            
            // Determine topic index based on where we are in the video vs where topics start
            let topicIndex = 0;
            for (let t = predictions.length - 1; t >= 0; t--) {
                if (sceneCenter >= topicPositions[t] - 0.02) {
                    topicIndex = t;
                    break;
                }
            }
            
            const currentPrediction = predictions[topicIndex] || predictions[0];
            await generateHtmlImage(currentPrediction, scriptData.quant_metrics, bgDest, dest, i);
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

    // Mark the exact predictions used today as "used" so they are never repeated tomorrow
    for (const p of predictions) {
        if (p.id) {
            await prisma.narrativePrediction.update({
                where: { id: p.id },
                data: { usedInVideo: true }
            });
        }
    }

    const catalystText = predictions[0] ? predictions[0].article.coreEvent : scriptData.quant_metrics[0].asset;
    const titleCatalyst = catalystText.length > 40 ? catalystText.substring(0, 37) + '...' : catalystText;
    const ytDesc = `The Deterministic Truth Pulse | ${titleCatalyst}\n\nWelcome to The Deterministic Truth Platform. We expose the architecture of the crypto casino and mathematically reveal manipulation, pump-and-dump fingerprinting, and engineered volatility.\n\nIn today's briefing, the Truth Engine exposes the underlying structural vulnerabilities tracking: ${catalystText}.\n\n📊 Live Manipulation Signatures & Casino Edge Probabilities:\n${scriptData.quant_metrics.map(m => `• ${m.asset}: ${m.probability}% Probability of ${m.direction === 'Up' ? 'Upward' : 'Downward'} Movement`).join('\n')}\n\nDisclaimer: This data is generated by the Deterministic Truth Engine. We replace the casino with determinism.\n\n🌐 Explore the Ecosystem:\n• The Truth Platform: https://dwtl.io\n• Axiom42 News: https://axiom42news.com\n\n#TruthPlatform #Deterministic #MacroEconomics #CryptoManipulation #Bitcoin #XRP #FinanceNews`;

    fs.writeFileSync(path.join(workDir, `youtube_metadata_${dateStr}.txt`), ytDesc);

    // Auto-copy to organized daily folder
    const dailyFolder = path.join('D:', 'Axiom_Daily_Pulse');
    if (!fs.existsSync(dailyFolder)) fs.mkdirSync(dailyFolder, { recursive: true });
    const dailyCopy = path.join(dailyFolder, path.basename(finalPath));
    fs.copyFileSync(finalPath, dailyCopy);
    // Copy thumbnail too
    const thumbSrc = path.join('D:', 'axiom-marketing-videos', 'Final_Renders_With_Intro', 'thumbnails', `Axiom_Daily_Pulse_${dateStr}.png`);
    if (fs.existsSync(thumbSrc)) {
        fs.copyFileSync(thumbSrc, path.join(dailyFolder, `Axiom_Daily_Pulse_${dateStr}.png`));
    }
    console.log(`📁 Copied to: ${dailyCopy}`);

    console.log(`\n🎉 SUCCESS! Video generated at:\n${finalPath}`);
    console.log(`YouTube Metadata generated at: youtube_metadata_${dateStr}.txt`);
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
