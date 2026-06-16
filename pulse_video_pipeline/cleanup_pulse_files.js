const fs = require('fs');
const path = require('path');

const workDir = __dirname;

console.log('🧹 Cleaning up intermediate Pulse Video files...');

const files = fs.readdirSync(workDir);

let deletedCount = 0;

for (const file of files) {
    // We want to delete:
    // 1. Temporary HTML screenshot backgrounds (pulse_bg_X.png)
    // 2. Individual rendered scene clips (scene_X.mp4)
    // 3. The raw merged video before audio (merged_video.mp4)
    // 4. The raw elevenlabs audio (pulse_narration.mp3)
    
    if (
        (file.startsWith('pulse_bg_') && file.endsWith('.png')) ||
        (file.startsWith('scene_') && file.endsWith('.mp4')) ||
        file === 'merged_video.mp4' ||
        file === 'pulse_narration.mp3'
    ) {
        fs.unlinkSync(path.join(workDir, file));
        console.log(`Deleted: ${file}`);
        deletedCount++;
    }
}

if (deletedCount === 0) {
    console.log('No intermediate files found to clean up.');
} else {
    console.log(`✅ Successfully cleaned up ${deletedCount} intermediate files.`);
}
