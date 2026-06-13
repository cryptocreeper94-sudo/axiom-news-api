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
                width: 60px; height: 60px; background: rgba(255,255,255,0.1); 
                border: 2px solid rgba(255,255,255,0.3); backdrop-filter: blur(10px);
                display: flex; justify-content: center; align-items: center;
                font-weight: 700; font-size: 32px; border-radius: 12px;
            }
            .brand { font-size: 36px; font-weight: 300; letter-spacing: 12px; text-transform: uppercase; }
            .card {
                z-index: 2; background: rgba(10, 15, 30, 0.6);
                border: 1px solid rgba(255,255,255,0.15);
                backdrop-filter: blur(20px); border-radius: 24px;
                padding: 80px; max-width: 1400px; text-align: center;
                box-shadow: 0 30px 60px rgba(0,0,0,0.5);
            }
            .event-text { font-size: 52px; font-weight: 500; line-height: 1.4; margin-bottom: 60px; color: #f1f5f9; }
            .metric-box {
                display: inline-block; padding: 40px 80px;
                background: rgba(0, 255, 200, 0.1); border: 2px solid rgba(0, 255, 200, 0.4);
                border-radius: 20px; box-shadow: 0 0 40px rgba(0,255,200,0.2);
            }
            .prob-value { font-size: 140px; font-weight: 700; color: #00ffcc; letter-spacing: -2px; margin: 0; line-height: 1; text-shadow: 0 0 20px rgba(0,255,200,0.5); }
            .prob-label { font-size: 24px; font-weight: 300; letter-spacing: 8px; text-transform: uppercase; color: #94a3b8; margin-top: 20px; }
            .footer { position: absolute; bottom: 80px; left: 100px; z-index: 2; font-size: 20px; font-weight: 300; letter-spacing: 4px; color: rgba(255,255,255,0.5); }
        </style>
    </head>
    <body>
        <div class="overlay"></div>
        <div class="header">
            <div class="logo-box">A</div>
            <div class="brand">Axiom Pulse</div>
        </div>
        <div class="card">
            <div class="event-text">"${eventText}"</div>
            <div class="metric-box">
                <div class="prob-value">${probPercent}</div>
                <div class="prob-label">Algorithmic Market Impact Likelihood</div>
            </div>
        </div>
        <div class="footer">DETERMINISTIC PREDICTION ENGINE // V2.4</div>
    </body>
    </html>
    `;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
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
    const predictions = await prisma.narrativePrediction.findMany({
        where: {
            createdAt: { gte: yesterday },
            probability: { gte: 0.5 } // Only events with >= 50% algorithmic impact likelihood
        },
        orderBy: { probability: 'desc' },
        take: 3,
        include: { article: true }
    });

    if (predictions.length === 0) {
        console.log('No high-impact predictions found in the last 24 hours.');
        process.exit(1);
    }

    const eventsText = predictions.map((p, i) => `Event ${i+1}: ${p.article.coreEvent} (Axiom Pulse Algorithmic Impact Probability: ${(p.probability * 100).toFixed(1)}%)`).join('\n');
    console.log('Gathered Events:\n' + eventsText);

    // 2. Generate Script via Gemini 2.5 Flash
    const prompt = `You are a professional but easy-to-understand macro-economic analyst. Write a fast-paced, 60-second verbal market prediction based on these breaking events:
${eventsText}

Your task is to provide a dual-market forecast. Explain what these events mean for the average person and how they might impact BOTH:
1. Traditional Equities (like the S&P 500, specific sectors, or tech stocks)
2. Digital Assets (like Bitcoin, Ethereum, or Solana)

Explain these impacts in plain, simple English. Avoid overly complex algorithmic jargon, but you MUST still include the exact percentage likelihoods provided in the prompt (e.g., 'There is an 85% algorithmic chance that...').
Keep it engaging, clear, and direct.
Write exactly the spoken script, with no formatting, no intro text, and no scene directions.
End with a quick disclaimer that this is an algorithmic prediction and not financial advice.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    console.log('\n🧠 Requesting Script from Gemini...');
    const geminiRes = await axios.post(geminiUrl, {
        contents: [{ parts: [{ text: prompt }] }]
    }, { headers: { 'Content-Type': 'application/json' } });
    
    const scriptText = geminiRes.data.candidates[0].content.parts[0].text.trim();
    console.log('\n📜 Script:\n' + scriptText);

    // 3. Generate Narration (ElevenLabs)
    console.log('\n🎙️ Generating ElevenLabs Narration...');
    const narrPath = path.join(workDir, 'pulse_narration.mp3');
    const body = JSON.stringify({
        text: scriptText,
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
        const randAsset = localAssets[Math.floor(Math.random() * localAssets.length)];
        const srcPath = path.join(workDir, 'assets', randAsset);
        const dest = path.join(workDir, `scene_${i+1}.png`);
        console.log(`Using Scene ${i+1} background: ${randAsset} and generating metric overlay...`);
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
    // Total = (scenes * duration) - ((scenes - 1) * transition)
    const targetVideoLength = audioDuration + 0.5;
    const numScenes = imagePaths.length;
    const SCENE_DURATION = (targetVideoLength + (numScenes - 1) * TRANSITION) / numScenes;
    
    const clipPaths = [];

    for (let i = 0; i < imagePaths.length; i++) {
        const clipOut = path.join(workDir, `clip_${i}.mp4`);
        clipPaths.push(clipOut);
        const totalFrames = SCENE_DURATION * FPS;
        const fadeInEnd = Math.round(0.5 * FPS);
        const fadeOutStart = Math.round((SCENE_DURATION - 0.8) * FPS);
        const fadeOutFrames = Math.round(0.8 * FPS);
        
        // slow zoom in
        const zExpr = `1.0+on/${totalFrames}*0.1`;
        const fc = [
            `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black[scaled]`,
            `[scaled]zoompan=z='${zExpr}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=${totalFrames}:s=${W}x${H}:fps=${FPS}[zoomed]`,
            `[zoomed]fade=t=in:st=0:nb_frames=${fadeInEnd}[fadein]`,
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
        console.log('[Merge] Only 1 scene, skipping xfade transition.');
        const fs = require('fs');
        fs.copyFileSync(clipPaths[0], mergedPath);
    } else {
        await runFFmpeg([
            '-y', ...inputs, '-filter_complex', filterParts.join(';'), '-map', '[vout]',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', mergedPath
        ], 'Merge');
    }

    const finalPath = path.join(workDir, `pulse_update_${Date.now()}.mp4`);
    console.log('\n🔊 Muxing Audio...');
    await runFFmpeg([
        '-y', '-i', mergedPath, '-i', narrPath,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest', finalPath
    ], 'Final Mux');

    // Cleanup
    for (const cp of clipPaths) fs.unlinkSync(cp);
    for (const img of imagePaths) fs.unlinkSync(img);
    fs.unlinkSync(mergedPath);

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
