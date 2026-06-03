process.env.DATABASE_URL = "postgresql://lume_cortex_user:lxKEqdUQcLDOr1VIiLiSxIFb2sqPDtsE@dpg-d7p4u7pkh4rs73btif0g-a.ohio-postgres.render.com/lume_cortex?sslmode=require";

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

app.get('/ping', (req, res) => res.status(200).send('pong'));

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
            let finalImage = null;
            if (deterministicData.imageKeyword && Math.random() > 0.5) {
                finalImage = `https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&q=80&w=800`; // Backup image
                // In a production environment we would fetch from Unsplash API: 
                // finalImage = `https://source.unsplash.com/800x400/?${encodeURIComponent(deterministicData.imageKeyword)}`;
                // Because source.unsplash is deprecated, we will just use a generic premium image or rely on the keyword if we integrate an API.
                // For now, let's use a dynamic search string via an alternative like placehold.co or just a curated Unsplash ID array in real code.
                // Actually, let's use the premium Unsplash API format if we assume the frontend will handle it, or we just leave it as a high-quality placeholder for this demo:
                finalImage = `https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=800`; 
                if (deterministicData.category === 'Finance') finalImage = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800';
                if (deterministicData.category === 'Politics') finalImage = 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&q=80&w=800';
                if (deterministicData.category === 'Technology') finalImage = 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&q=80&w=800';
            }

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
                    isSatire: false,
                    category: deterministicData.category || 'World',
                    image: finalImage
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
    try {
        console.log("Starting initial pipeline on boot...");
        runNewsPipeline().catch(e => console.error("Pipeline crashed on boot:", e));
    } catch (e) {
        console.error("Database wipe failed:", e.message);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});
