const fs = require('fs');
const path = require('path');

const workDir = __dirname;

console.log('🧹 Cleaning up intermediate Pulse Video files...');

const files = fs.readdirSync(workDir);

let deletedCount = 0;

for (const file of files) {
    // Delete ALL intermediate/generated files so the next run generates fresh content:
    // 1. Scene images (scene_X.png) — the overlay screenshots
    // 2. Background downloads (bg_X.jpg, pulse_bg_X.png)
    // 3. Individual rendered clips (clip_X.mp4)
    // 4. The raw merged video before audio (merged_video.mp4)
    // 5. The raw elevenlabs audio (pulse_narration.mp3)
    // 6. The daily script cache (daily_script.json)
    // 7. The predictions cache (predictions.json)
    // 8. The pulse_final.mp4 intermediate
    
    if (
        (file.startsWith('scene_') && file.endsWith('.png')) ||
        (file.startsWith('bg_') && file.endsWith('.jpg')) ||
        (file.startsWith('pulse_bg_') && file.endsWith('.png')) ||
        (file.startsWith('clip_') && file.endsWith('.mp4')) ||
        file === 'merged_video.mp4' ||
        file === 'pulse_final.mp4' ||
        file === 'pulse_narration.mp3' ||
        file === 'daily_script.json' ||
        file === 'predictions.json' ||
        file === 'daily_topics.txt'
    ) {
        fs.unlinkSync(path.join(workDir, file));
        console.log(`  Deleted: ${file}`);
        deletedCount++;
    }
}

if (deletedCount === 0) {
    console.log('No intermediate files found to clean up.');
} else {
    console.log(`✅ Successfully cleaned up ${deletedCount} intermediate files.`);
}
