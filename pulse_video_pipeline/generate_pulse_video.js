require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const prisma = new PrismaClient();
const workDir = __dirname;
const ELEVENLABS_API_KEY = 'sk_aacd9b4aea77f8fcf050661d33b7a2337eec8bacd80608fb';
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - highly professional
const ffmpegExe = path.join('D:', 'video_build', 'ffmpeg', 'bin', 'ffmpeg.exe');

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

    // 1. Get Top 3 Highest Impact articles
    const predictions = await prisma.narrativePrediction.findMany({
        orderBy: [
            { probability: 'desc' },
            { createdAt: 'desc' }
        ],
        take: 3,
        include: { article: true }
    });

    if (predictions.length < 3) {
        console.log('Not enough predictions found.');
        process.exit(1);
    }

    const eventsText = predictions.map((p, i) => `Event ${i+1}: ${p.article.coreEvent} (Axiom Pulse Algorithmic Impact Probability: ${(p.probability * 100).toFixed(1)}%)`).join('\n');
    console.log('Gathered Events:\n' + eventsText);

    // 2. Generate Script via Gemini 2.5 Flash
    const prompt = `You are the Axiom Deterministic Engine. Write a fast-paced, 60-second verbal market prediction based on these breaking events:
${eventsText}

You MUST make direct, specific crypto asset predictions (e.g., 'BTC liquidity absorption likely', 'SOL oversold, expect immediate downtrend').
CRITICAL: You MUST explicitly state the algorithmic probability percentages provided in the prompt for each prediction (e.g., 'SOL downtrend next three days likely, 85% algorithmic likelihood').
Act as a stoic, algorithmic influencer. Remain completely devoid of emotion, bias, or spin.
Write exactly the spoken script, with no formatting, no intro text, and no scene directions.
End with a financial disclaimer that this is algorithmic analysis and not financial advice.`;

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

    // 4. Generate Visuals (Pollinations)
    console.log('\n🖼️ Generating Images...');
    const imagePaths = [];
    for (let i = 0; i < predictions.length; i++) {
        const keyword = predictions[i].article.imageKeyword || 'abstract data graph';
        const imgPrompt = `Photorealistic, grounded news photography of ${keyword}. No logos, no watermarks, no text other than "Axiom News" or "Pulse". No cyberpunk, no futuristic, no sci-fi, no dystopian. High quality, realistic lighting.`;
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt)}?width=1920&height=1080&nologo=true&seed=${Date.now()}`;
        const dest = path.join(workDir, `scene_${i+1}.png`);
        console.log(`Downloading Scene ${i+1}: ${keyword}`);
        await downloadImage(url, dest);
        imagePaths.push(dest);
    }
    console.log('✅ Images saved.');

    // 5. Render Video (FFMPEG)
    console.log('\n🎬 Rendering Video...');
    // We will estimate the duration based on average speaking rate (~150 words / 60s).
    // Better yet, ffmpeg can just use the audio length if we map it, but we need per-scene durations.
    // Let's allocate 12 seconds per scene (60s total).
    
    const FPS = 30;
    const W = 1920;
    const H = 1080;
    const SCENE_DURATION = 14; 
    const TRANSITION = 1.0;
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
    await runFFmpeg([
        '-y', ...inputs, '-filter_complex', filterParts.join(';'), '-map', '[vout]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', mergedPath
    ], 'Merge');

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

    console.log(`\n🎉 SUCCESS! Video generated at:\n${finalPath}`);
}

run().catch(e => { console.error('ERROR:', e); process.exit(1); });
