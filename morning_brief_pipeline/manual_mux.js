const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const workDir = __dirname;
const ffmpegExe = path.join('D:', 'video_build', 'ffmpeg', 'bin', 'ffmpeg.exe');
const ffprobeExe = path.join('D:', 'video_build', 'ffmpeg', 'bin', 'ffprobe.exe');

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
    console.log('Starting manual mux using existing assets...');
    const narrPath = path.join(workDir, 'pulse_narration.mp3');
    const imagePaths = [
        path.join(workDir, 'scene_1.png'),
        path.join(workDir, 'scene_2.png'),
        path.join(workDir, 'scene_3.png')
    ];

    const { execSync } = require('child_process');
    const durationRaw = execSync(`"${ffprobeExe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${narrPath}"`).toString().trim();
    const audioDuration = parseFloat(durationRaw);
    
    const FPS = 30;
    const W = 1920;
    const H = 1080;
    const TRANSITION = 1.0;
    
    const targetVideoLength = audioDuration + 0.5;
    const targetSceneLen = 10;
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
    const mergedPath = path.join(workDir, 'merged_video.mp4');
    let filterParts = [];
    let offset = 0;
    let prevLabel = '[0:v]';
    for (let i = 1; i < clipPaths.length; i++) {
        offset += SCENE_DURATION - TRANSITION;
        const outLabel = i < clipPaths.length - 1 ? `[v${i}]` : '[vout]';
        filterParts.push(`${prevLabel}[${i}:v]xfade=transition=fade:duration=${TRANSITION}:offset=${offset.toFixed(3)}${outLabel}`);
        prevLabel = outLabel;
    }

    const mergeArgs = ['-y'];
    for (const cp of clipPaths) {
        mergeArgs.push('-i', cp);
    }
    mergeArgs.push('-filter_complex', filterParts.join(';'), '-map', '[vout]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', mergedPath);
    await runFFmpeg(mergeArgs, 'Merge');

    console.log('\n🔊 Muxing Audio...');
    const finalPath = path.join(workDir, `pulse_video_2026-06-14.mp4`);
    await runFFmpeg([
        '-y', '-i', mergedPath, '-i', narrPath,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        finalPath
    ], 'Final Mux');
    
    console.log('\nApplying faststart...');
    const fixedPath = path.join(workDir, `pulse_video_2026-06-14_fixed.mp4`);
    require('child_process').execSync(`"${ffmpegExe}" -y -i "${finalPath}" -c copy -movflags +faststart "${fixedPath}"`);
    fs.renameSync(fixedPath, finalPath);

    console.log(`\n🎉 SUCCESS! Video generated at:\n${finalPath}`);
}

run().catch(console.error);
