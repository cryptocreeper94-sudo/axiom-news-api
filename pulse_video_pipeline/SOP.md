# Axiom Daily Pulse Video Generation - Standard Operating Procedure (SOP)

This document serves as the absolute source of truth for future agents tasked with generating the Axiom Daily Pulse video. The pipeline has been highly customized to adhere to specific styling, pacing, and formatting rules.

## 1. Triggering the Pipeline
The generator script lives at `D:\axiom-news-api\pulse_video_pipeline\generate_pulse_video.js`.

> [!WARNING]
> Before running the script, verify that the Render Postgres database connection has not timed out. Run `npx prisma db push` or quickly ping the database to wake it up. If you skip this, the script will crash immediately when trying to fetch the narrative predictions.

To generate the video, run:
```bash
node generate_pulse_video.js > D:\debug.log 2>&1
```

## 2. Expected Pipeline Behavior
- **Data Filtering:** The script explicitly filters the database to only pull the Top 3 events from specific categories (`Finance`, `Technology`, `Economy`, `Business`, `Crypto`).
- **Narration Generation (Gemini):** The prompt forces a high-energy intro, requests exact algorithmic percentages, and strictly limits the script to **130-160 words (60-90 seconds)** to keep the video concise.
- **Voice Synthesis (ElevenLabs):** Converts the script to a highly professional `.mp3`.
- **UI Overlay Generation:** Puppeteer overlays a sleek, professional Bloomberg-style financial card (no neon/cyberpunk aesthetics) over the background assets.
- **Pacing & Multiplexing:** The script mathematically duplicates the scenes so no single image stays on screen for more than **8-12 seconds**. It adds a **3-second padding** to ensure the visual outlasts the voiceover. 

## 3. Faststart Indexing
> [!IMPORTANT]
> The final video file output by the script will have its `moov` atom at the very end of the file. To prevent Windows Media Player from "spinning" or failing to load, you MUST run a faststart fix on the resulting file.

Once the script generates `pulse_video_YYYY-MM-DD.mp4`, run this FFmpeg command:
```powershell
& "D:\video_build\ffmpeg\bin\ffmpeg.exe" -y -i "D:\axiom-news-api\pulse_video_pipeline\pulse_video_YYYY-MM-DD.mp4" -c copy -movflags +faststart "D:\axiom-news-api\pulse_video_pipeline\pulse_video_YYYY-MM-DD_fixed.mp4"
Move-Item -Path "D:\axiom-news-api\pulse_video_pipeline\pulse_video_YYYY-MM-DD_fixed.mp4" -Destination "D:\axiom-news-api\pulse_video_pipeline\pulse_video_YYYY-MM-DD.mp4" -Force
```

## 4. File Structure & Cleanup
All automatic cleanup in the `generate_pulse_video.js` script was explicitly removed. This ensures we can recover the raw clips or audio if the muxing fails.

After the user has manually reviewed and approved the video, you must run the cleanup script to wipe the intermediate artifacts:
```bash
node D:\axiom-news-api\pulse_video_pipeline\cleanup_pulse_files.js
```

## 5. Thumbnails
YouTube thumbnails are generated via Gemini `generate_image` tool (e.g. "ultra professional female news anchor, 16x9"). 
**Note:** The tool natively outputs 1024x1024 (1:1) images. You will need to use FFmpeg to crop them to 16:9 (`1024x576`) before saving them to `D:\axiom-marketing-videos\Final_Renders_With_Intro\thumbnails`.
