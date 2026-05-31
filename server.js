const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const { scrapeTopHeadlines } = require('./scraper');
const { extractDeterministicFacts } = require('./gemini');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4001;

// In-memory cache of the latest stripped news
let liveNewsCache = [];

async function runNewsPipeline() {
    console.log(`[${new Date().toISOString()}] Starting Axiom News Pipeline...`);
    
    // 1. Scrape raw news
    const rawArticles = await scrapeTopHeadlines();
    console.log(`Scraped ${rawArticles.length} raw articles.`);

    const processedArticles = [];

    // 2. Process each article through Gemini sequentially to respect rate limits
    for (const raw of rawArticles) {
        console.log(`Processing: ${raw.source} - ${raw.rawText.substring(0, 40)}...`);
        const deterministicData = await extractDeterministicFacts(raw.rawText, raw.source);
        
        if (deterministicData) {
            processedArticles.push({
                id: raw.id,
                publisherId: raw.publisherId,
                timestamp: raw.timestamp,
                coreEvent: deterministicData.coreEvent,
                processTimeline: deterministicData.processTimeline,
                source: raw.source,
                biasScore: deterministicData.biasScore,
                originalText: raw.originalText,
                strippedTerms: deterministicData.strippedTerms,
                isSatire: false
            });
            console.log(`[SUCCESS] Stripped Bias: ${deterministicData.biasScore}%`);
        } else {
            console.log(`[FAILED] Could not process ${raw.source}`);
        }
        
        // Wait 2 seconds between calls to avoid hitting Gemini rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (processedArticles.length > 0) {
        liveNewsCache = processedArticles;
        console.log(`[COMPLETE] Pipeline finished. Cached ${liveNewsCache.length} live articles.`);
    }
}

// Endpoint for the React Frontend to fetch the live feed
app.get('/v1/feed', (req, res) => {
    res.json(liveNewsCache);
});

// Run pipeline every 60 minutes
cron.schedule('0 * * * *', () => {
    runNewsPipeline();
});

// Start server
app.listen(PORT, () => {
    console.log(`Axiom News API listening on port ${PORT}`);
    // Run the pipeline immediately on startup to populate cache
    runNewsPipeline();
});
