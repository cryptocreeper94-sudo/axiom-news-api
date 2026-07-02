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
const VOICE_ID = '5Q0t7uMcjvnagumLfvZi'; // Paul - professional news anchor
const ffmpegExe = path.join('D:', 'video_build', 'ffmpeg', 'bin', 'ffmpeg.exe');

async function generateHtmlImage(headlineText, subText, brandText, forecastText, bgPath, dest) {
    const headline = headlineText.replace(/"/g, '&quot;');
    const sub = subText.replace(/"/g, '&quot;');
    const forecast = (forecastText || '').replace(/"/g, '&quot;');
    
    // Pass background as base64
    const bgBase64 = fs.readFileSync(bgPath).toString('base64');
    const mime = bgPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const bgDataUrl = `data:${mime};base64,${bgBase64}`;

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
                flex: 1; max-width: 900px;
                display: flex; flex-direction: column;
                background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(20px);
                padding: 50px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);
                box-shadow: 0 30px 60px rgba(0,0,0,0.6);
            }
            .right-col { 
                width: 500px; 
                display: flex; flex-direction: column; justify-content: center;
                background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(20px);
                padding: 50px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);
                box-shadow: 0 30px 60px rgba(0,0,0,0.6);
            }
            
            .header { display: flex; align-items: center; gap: 20px; margin-bottom: 40px; }
            .logo-box { width: 60px; height: 60px; background: #3b82f6; color: white; display: flex; justify-content: center; align-items: center; font-weight: 800; font-size: 32px; border-radius: 4px; }
            .brand { font-size: 32px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; color: #f8fafc; }
            .terminal-id { margin-left: auto; font-family: 'Roboto Mono', monospace; font-size: 18px; color: #94a3b8; }
            
            .story-label { font-size: 20px; color: #3b82f6; font-weight: 700; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 24px; }
            .headline-text { font-size: 48px; font-weight: 700; line-height: 1.25; color: #f1f5f9; margin-bottom: 20px; }
            .sub-text { font-family: 'Roboto Mono', monospace; font-size: 22px; color: #94a3b8; font-weight: 600; line-height: 1.5; }
            
            .forecast-label { font-size: 20px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 30px; }
            .forecast-card {
                background: rgba(30, 41, 59, 0.7);
                border: 1px solid rgba(255,255,255,0.05);
                border-left: 6px solid #3b82f6;
                padding: 30px 30px; margin-bottom: 20px;
                border-radius: 4px;
            }
            .forecast-title { font-size: 28px; font-weight: 700; color: #f8fafc; margin-bottom: 12px; }
            .forecast-desc { font-family: 'Roboto Mono', monospace; font-size: 20px; color: #94a3b8; line-height: 1.5; }
            
            .live-badge {
                display: inline-flex; align-items: center; gap: 8px;
                background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4);
                padding: 6px 16px; border-radius: 4px; margin-bottom: 20px;
            }
            .live-dot { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; }
            .live-text { font-family: 'Roboto Mono', monospace; font-size: 16px; font-weight: 700; color: #ef4444; letter-spacing: 2px; }
            
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
                    <div class="brand">${brandText}</div>
                    <div class="terminal-id">${new Date().toISOString().split('T')[0]}</div>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                    <div class="live-badge">
                        <div class="live-dot"></div>
                        <div class="live-text">LIVE BRIEFING</div>
                    </div>
                    <div class="story-label">${sub}</div>
                    <div class="headline-text">${headline}</div>
                </div>
                <div style="font-family: 'Roboto Mono'; color: #64748b; font-size: 18px;">GLOBAL INTELLIGENCE BRIEFING • AXIOM42NEWS.COM</div>
            </div>
            <div class="right-col">
                <div class="forecast-label">Chain-Reaction Forecast</div>
                <div class="forecast-card">
                    <div class="forecast-title">Projected Impact</div>
                    <div class="forecast-desc">${forecast || 'Analysis in progress...'}</div>
                </div>
                <div class="forecast-card" style="border-left-color: #10b981;">
                    <div class="forecast-title" style="color: #10b981;">Signal Intelligence</div>
                    <div class="forecast-desc">Monitoring geopolitical cascade effects and cross-market correlations in real-time.</div>
                </div>
                <div class="forecast-card" style="border-left-color: #f59e0b;">
                    <div class="forecast-title" style="color: #f59e0b;">Advisory Status</div>
                    <div class="forecast-desc">Stay informed. Verify independently before making decisions.</div>
                </div>
            </div>
        </div>
        <div class="watermarks-bar">
            <span>AXIOM42NEWS.COM</span>
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
    console.log('🎬 Starting Morning Brief Video Generator...');

    // 0. Auto-cleanup: delete stale files from previous runs so every day gets fresh visuals
    console.log('\n🧹 Cleaning up stale files from previous runs...');
    const staleFiles = fs.readdirSync(workDir).filter(f =>
        (f.startsWith('scene_') && f.endsWith('.png')) ||
        (f.startsWith('bg_') && f.endsWith('.jpg')) ||
        (f.startsWith('clip_') && f.endsWith('.mp4')) ||
        f === 'merged_video.mp4' ||
        f === 'morning_brief_final.mp4' ||
        f === 'morning_narration.mp3' ||
        f === 'morning_script.json' ||
        f === 'morning_topics.txt'
    );
    for (const f of staleFiles) {
        fs.unlinkSync(path.join(workDir, f));
        console.log(`  Deleted stale: ${f}`);
    }
    console.log(`  Cleaned ${staleFiles.length} stale files.`);


    // 1. Get Top 5 World/Politics articles from the last 24 hours
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
        console.log('No world news articles found in the last 24 hours.');
        process.exit(1);
    }

    const eventsText = articles.map((a, i) => `Headline ${i+1}: ${a.coreEvent}`).join('\n');
    console.log('Gathered Events:\n' + eventsText);

    // 2. Generate Script via Gemini 2.5 Flash
    const prompt = `You are a professional global news anchor for "Axiom News Morning Brief". Write a concise morning briefing script based on these breaking global events:
${eventsText}

**PART 1: The Rundown**
Give a professional, fast-paced broadcast rundown of the key headlines. Explicitly state the major players and countries involved.

**PART 2: Chain-Reaction Forecast**
Analyze the combination of these events and predict BOTH the geopolitical/diplomatic outcomes AND the global market/economic impacts. 
Provide specific numerical percentage likelihoods for your predictions (e.g. "There is an 80% probability that this will lead to a supply chain disruption...").

CRITICAL RULES:
- Script MUST be between 260 and 320 words. Write with professional broadcast energy — authoritative, clear, and objective. No cyberpunk or hyper-aggressive tone.
- CHRONOLOGICAL CONTEXT: The current year is 2026. Donald Trump is the CURRENT President of the United States. Joe Biden is the FORMER President. NEVER refer to Trump as "former" president.
- End with the disclaimer exactly: "This has been your Axiom News Morning Brief. I'm [Anchor Name]. Stay informed."
- You MUST output your response EXACTLY as a raw JSON object with NO MARKDOWN, NO \`\`\`json block. Just the raw JSON.
- Provide a short 3-7 word "forecastText" to be displayed on the screen's lower-third graphic summarizing the main prediction.
- PHONETIC TTS RULE: In the "script" field ONLY, you MUST spell out all numbers, decimals, and percentages phonetically as words so the voice engine reads them correctly. (Example: write "sixty-three percent" instead of "63%").

JSON SCHEMA:
{
  "script": "Good morning, I'm Paul, and this is your Axiom News Morning Brief...",
  "forecastText": "Supply Chain Disruption Expected in EU"
}
`;

    let scriptData;
    if (fs.existsSync('morning_script.json')) {
        console.log('\n🧠 Loading script from morning_script.json...');
        scriptData = JSON.parse(fs.readFileSync('morning_script.json', 'utf8'));
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
            console.log('✅ Anthropic Claude responded successfully.');
        }
        // Strip markdown code fence if present
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        scriptData = JSON.parse(rawContent);
        fs.writeFileSync('morning_script.json', JSON.stringify(scriptData, null, 2));
    }
    console.log('\n📜 Script:\n' + scriptData.script);
    console.log('\n🔮 Forecast extracted:\n', scriptData.forecastText);

    // 3. Generate Narration (ElevenLabs)
    console.log('\n🎙️ Generating ElevenLabs Narration...');
    const cleanScriptText = scriptData.script.replace(/[*_#]/g, ''); // Strip markdown
    const narrPath = path.join(workDir, 'morning_narration.mp3');
    
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
        "professional global news broadcast studio modern desk daylight",
        "united nations general assembly room wide shot professional",
        "modern newsroom with glass walls and professional lighting",
        "global map digital projection professional news background blue tone",
        "international summit flags professional political meeting room",
        "modern broadcast news anchor desk cinematic lighting",
        "professional white house press briefing room realistic",
        "global news network studio backdrop clean modern",
        "geopolitical map professional newsroom screen realistic",
        "modern government building interior cinematic lighting",
        "professional news studio with cityscape window view realistic"
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

            
            // Use scene center for lookahead to fix "behind the narration" delay
            const sceneCenter = (i + 0.5) / requiredScenes;
            const scriptText = scriptData.script.toLowerCase();
            
            // Build topic list: articles + forecast sections
            const allTopics = [
                ...articles.map(a => ({ headline: a.coreEvent, sub: "TOP STORY", brand: "Axiom News Morning Brief" })),
                { headline: "Chain-Reaction Forecast", sub: "Projected Impact", brand: "Axiom Predictive Engine" },
                { headline: "Signal Intelligence", sub: "Market Correlations", brand: "Axiom Predictive Engine" },
                { headline: "Advisory Status", sub: "Actionable Intelligence", brand: "Axiom Predictive Engine" }
            ];
            
            // Find where each topic's keywords first appear in the script (as %)
            const rawPositions = allTopics.map((t, idx) => {
                if (idx === articles.length) return 0.65; // Forecast
                if (idx === articles.length + 1) return 0.75; // Signal Intel
                if (idx === articles.length + 2) return 0.85; // Advisory
                
                const keywords = t.headline.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4).slice(0, 3);
                let earliest = scriptText.length;
                for (const kw of keywords) {
                    const pos = scriptText.indexOf(kw);
                    if (pos >= 0 && pos < earliest) earliest = pos;
                }
                let pos = earliest / scriptText.length;
                return pos === 1.0 ? (idx * 0.1) : pos; // Fallback if not found
            });
            
            // Force monotonic increasing positions ONLY for articles
            const topicPositions = [...rawPositions];
            for (let t = 1; t < articles.length; t++) {
                if (topicPositions[t] <= topicPositions[t-1]) {
                    topicPositions[t] = topicPositions[t-1] + 0.05;
                }
            }
            
            // Cap article positions so they don't bleed into the forecast sections
            let maxAllowed = 0.60;
            for (let t = articles.length - 1; t >= 0; t--) {
                if (topicPositions[t] > maxAllowed) {
                    topicPositions[t] = maxAllowed;
                }
                maxAllowed = topicPositions[t] - 0.05; // Ensure at least 0.05 gap going backwards
            }
            
            // Explicitly set the forecast sections at fixed intervals
            topicPositions[articles.length] = 0.65;
            topicPositions[articles.length + 1] = 0.75;
            topicPositions[articles.length + 2] = 0.85;
            
            // Determine topic index based on video progress vs topic positions
            let topicIndex = 0;
            for (let t = allTopics.length - 1; t >= 0; t--) {
                if (sceneCenter >= topicPositions[t] - 0.02) {
                    topicIndex = t;
                    break;
                }
            }

            let currentHeadline = allTopics[topicIndex].headline;
            let currentSub = allTopics[topicIndex].sub;
            let brandTitle = allTopics[topicIndex].brand;

            await generateHtmlImage(currentHeadline, currentSub, brandTitle, scriptData.forecastText || '', bgDest, dest);
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
    const finalPath = path.join(workDir, `morning_brief_${dateStr}.mp4`);
    console.log('\n🔊 Muxing Audio...');
    await runFFmpeg([
        '-y', '-i', mergedPath, '-i', narrPath,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        finalPath
    ], 'Final Mux');

    const videoFileName = path.basename(finalPath);
    // You could save this to the DB if needed.

    const catalystText = articles[0] ? articles[0].coreEvent : scriptData.forecastText;
    const titleCatalyst = catalystText.length > 50 ? catalystText.substring(0, 47) + '...' : catalystText;
    const ytDesc = `Axiom News Morning Brief | ${titleCatalyst}\n\nWelcome to the Axiom News Morning Brief, your professional rundown of today's most critical global events and geopolitical forecasts.\n\nIn today's briefing, we cover:\n${articles.map(a => `• ${a.coreEvent}`).join('\n')}\n\n🌐 Stay Informed:\n• Axiom42 News: https://axiom42news.com\n• The Trust Layer: https://dwtl.io\n\n#AxiomNews #MorningBrief #Geopolitics #WorldNews #GlobalEconomy`;

    fs.writeFileSync(path.join(workDir, `youtube_metadata_${dateStr}.txt`), ytDesc);

    // Auto-copy to organized daily folder
    const dailyFolder = path.join('D:', 'Axiom_Morning_Brief');
    if (!fs.existsSync(dailyFolder)) fs.mkdirSync(dailyFolder, { recursive: true });
    const dailyCopy = path.join(dailyFolder, path.basename(finalPath));
    fs.copyFileSync(finalPath, dailyCopy);
    // Copy thumbnail too
    const thumbSrc = path.join('D:', 'axiom-marketing-videos', 'Final_Renders_With_Intro', 'thumbnails', `Axiom_Morning_Brief_${dateStr}.png`);
    if (fs.existsSync(thumbSrc)) {
        fs.copyFileSync(thumbSrc, path.join(dailyFolder, `Axiom_Morning_Brief_${dateStr}.png`));
    }
    console.log(`📁 Copied to: ${dailyCopy}`);

    console.log(`\n🎉 SUCCESS! Morning Brief generated at:\n${finalPath}`);
    console.log(`YouTube Metadata generated at: youtube_metadata_${dateStr}.txt`);
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
