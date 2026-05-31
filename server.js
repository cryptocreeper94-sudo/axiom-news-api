const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { scrapeTopHeadlines } = require('./scraper');
const { extractDeterministicFacts } = require('./gemini');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4001;

async function runNewsPipeline() {
    console.log(`[${new Date().toISOString()}] Starting Axiom News Pipeline...`);
    
    // 1. Scrape raw news
    const rawArticles = await scrapeTopHeadlines();
    console.log(`Scraped ${rawArticles.length} raw articles.`);

    // 2. Process each article through Gemini sequentially
    for (const raw of rawArticles) {
        console.log(`Processing: ${raw.source} - ${raw.rawText.substring(0, 40)}...`);
        
        // Prevent duplicate processing based on raw text
        const existing = await prisma.article.findFirst({
            where: { originalText: raw.originalText }
        });
        
        if (existing) {
            console.log(`[SKIP] Already processed: ${raw.source}`);
            continue;
        }

        const deterministicData = await extractDeterministicFacts(raw.rawText, raw.source);
        
        if (deterministicData) {
            await prisma.article.create({
                data: {
                    id: raw.id,
                    publisherId: raw.publisherId,
                    source: raw.source,
                    timestamp: new Date(raw.timestamp),
                    coreEvent: deterministicData.coreEvent,
                    processTimeline: deterministicData.processTimeline,
                    biasScore: deterministicData.biasScore,
                    originalText: raw.originalText,
                    strippedTerms: deterministicData.strippedTerms,
                    isSatire: false
                }
            });
            console.log(`[SUCCESS] Saved to DB. Stripped Bias: ${deterministicData.biasScore}%`);
        } else {
            console.log(`[FAILED] Could not process ${raw.source}`);
        }
        
        // Wait 2 seconds between calls to avoid hitting Gemini rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Endpoint for the React Frontend to fetch the live feed
app.get('/v1/feed', async (req, res) => {
    try {
        const articles = await prisma.article.findMany({
            orderBy: { timestamp: 'desc' },
            take: 50
        });
        res.json(articles);
    } catch (error) {
        console.error("Database query failed:", error);
        res.status(500).json({ error: "Failed to fetch live feed" });
    }
});

// Run pipeline every 60 minutes
cron.schedule('0 * * * *', () => {
    runNewsPipeline();
});

// Start server
app.listen(PORT, async () => {
    console.log(`Axiom News API listening on port ${PORT}`);
    // Run pipeline immediately to seed if empty
    try {
        const count = await prisma.article.count();
        if (count === 0) {
            console.log("Database empty, running initial pipeline...");
            runNewsPipeline();
        }
    } catch (e) {
        console.log("Waiting for database...");
    }
});
