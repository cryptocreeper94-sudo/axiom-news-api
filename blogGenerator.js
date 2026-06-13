require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function generateBlogDaemon() {
  console.log("[Blog Generator] Initiating AI-Directed Blog Generation...");

  try {
    // 1. Fetch latest verified news facts
    const recentArticles = await prisma.article.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    if (recentArticles.length === 0) {
      console.log("[Blog Generator] No recent articles found. Skipping generation.");
      return;
    }

    const headlines = recentArticles.map(a => `- ${a.coreEvent} (Spin Score: ${a.biasScore})`).join('\n');

    // 2. Query Gemini
    const prompt = `You are the Axiom Deterministic Engine. Write a highly analytical, authoritative, and completely objective "Transmission" (blog post) summarizing the current global state based on these recent events:
    
${headlines}

Your post should be 3-4 paragraphs. It must be written in the voice of a cold, deterministic intelligence. Focus on the raw data patterns, geopolitical shifts, or market trends without ANY emotional framing.

Return ONLY a JSON object exactly matching this schema:
{
  "title": "A highly analytical 5-8 word title for this transmission",
  "draft": "The full text of the transmission, separated by \\n\\n for paragraphs."
}`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(clean);

    // 3. Find latest Predictive Video
    const videoDir = path.join(__dirname, 'pulse_video_pipeline');
    let latestVideo = null;
    
    if (fs.existsSync(videoDir)) {
      const files = fs.readdirSync(videoDir).filter(f => f.startsWith('pulse_update_') && f.endsWith('.mp4'));
      if (files.length > 0) {
        // Sort by modified time descending
        files.sort((a, b) => {
          return fs.statSync(path.join(videoDir, b)).mtimeMs - fs.statSync(path.join(videoDir, a)).mtimeMs;
        });
        latestVideo = files[0];
      }
    }

    // 4. Save to Database
    const sourceProof = crypto.createHash('sha256').update(result.draft).digest('hex');
    const certificate = `LTC-V1.0-${crypto.randomBytes(4).toString('hex').toUpperCase()}-BLOG`;

    // Append video URL to the draft if a video was found
    let finalDraft = result.draft;
    if (latestVideo) {
      finalDraft += `\n\n[PREDICTIVE VIDEO ATTACHED]\nURL: /videos/${latestVideo}`;
    }

    await prisma.blogPost.create({
      data: {
        title: result.title,
        originalDraft: finalDraft,
        deterministicRewrite: finalDraft,
        trustCertificate: certificate,
        sourceProofHash: sourceProof
      }
    });

    console.log(`[Blog Generator] Successfully generated and stored transmission: ${result.title}`);

  } catch (error) {
    console.error(`[Blog Generator] Error generating transmission:`, error.message);
  }
}

// Allow manual execution via command line
if (require.main === module) {
  generateBlogDaemon().then(() => process.exit(0));
}

module.exports = { generateBlogDaemon };
