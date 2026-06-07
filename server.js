process.env.DATABASE_URL = "postgresql://lume_cortex_user:lxKEqdUQcLDOr1VIiLiSxIFb2sqPDtsE@dpg-d7p4u7pkh4rs73btif0g-a.ohio-postgres.render.com/lume_cortex?sslmode=require";

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { scrapeTopHeadlines } = require('./scraper');
const { extractDeterministicFacts } = require('./gemini');
const { getLocalNews } = require('./localScraper');

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
            let finalImage = raw.imageUrl;
            
            // Pollinations AI started throwing 402 Payment Required. 
            // We now strictly use the raw source image, or fall back to high-quality Unsplash category images.
            if (!finalImage) {
                const categoryImages = {
                    'Finance': [
                        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3',
                        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f',
                        'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e',
                        'https://images.unsplash.com/photo-1579532537598-459ecdaf39cc'
                    ],
                    'Politics': [
                        'https://images.unsplash.com/photo-1555848962-6e79363ec58f',
                        'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620',
                        'https://images.unsplash.com/photo-1541872703-74c5e44368f9',
                        'https://images.unsplash.com/photo-1554151228-14d9def656e4'
                    ],
                    'Technology': [
                        'https://images.unsplash.com/photo-1517976487492-5750f3195933',
                        'https://images.unsplash.com/photo-1518770660439-4636190af475',
                        'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
                        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5'
                    ],
                    'World': [
                        'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
                        'https://images.unsplash.com/photo-1521295121783-8a321d551ad2',
                        'https://images.unsplash.com/photo-1507413245164-6160d8298b31',
                        'https://images.unsplash.com/photo-1524661135-423995f22d0b'
                    ],
                    'Science': [
                        'https://images.unsplash.com/photo-1507413245164-6160d8298b31',
                        'https://images.unsplash.com/photo-1532094349884-543bc11b234d',
                        'https://images.unsplash.com/photo-1530026405186-ed1f139313f8',
                        'https://images.unsplash.com/photo-1518152006812-edab29b069fc'
                    ]
                };
                const arr = categoryImages[deterministicData.category] || categoryImages['World'];
                const randomBase = arr[Math.floor(Math.random() * arr.length)];
                finalImage = `${randomBase}?auto=format&fit=crop&q=80&w=800`;
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
                    deterministicRewrite: deterministicData.deterministicRewrite || null,
                    isSatire: raw.publisherId === 'satire',
                    category: deterministicData.category || 'World',
                    image: finalImage,
                    author: deterministicData.author || 'Staff'
                }
            });
            console.log(`[SUCCESS] Saved to DB. Stripped Bias: ${deterministicData.biasScore}%`);
        } else {
            console.log(`[FAILED] Could not process ${raw.source} - Flagging to prevent retry loop`);
            await prisma.article.create({
                data: {
                    id: raw.id,
                    publisherId: raw.publisherId,
                    source: raw.source,
                    timestamp: new Date(raw.timestamp),
                    coreEvent: "PROCESS_FAILED",
                    processTimeline: [],
                    biasScore: -1,
                    originalText: raw.originalText,
                    strippedTerms: [],
                    deterministicRewrite: null,
                    isSatire: raw.publisherId === 'satire',
                    category: 'World',
                    image: null,
                    author: 'Staff'
                }
            });
        }
        
        // Wait 2 seconds between calls to avoid hitting Gemini rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Endpoint for the React Frontend to fetch the live feed
app.get('/v1/feed', async (req, res) => {
    try {
        const articles = await prisma.article.findMany({
            where: {
                coreEvent: {
                    not: "PROCESS_FAILED"
                }
            },
            orderBy: { timestamp: 'desc' },
            take: 250
        });
        res.json({ articles, lastUpdated: new Date().toISOString() });
    } catch (error) {
        console.error("Database query failed:", error);
        res.status(500).json({ error: "Failed to fetch live feed" });
    }
});

// GET Aggregate Scores
app.get('/v1/aggregate', async (req, res) => {
    try {
        const articles = await prisma.article.findMany();
        const publishers = {};
        
        articles.forEach(article => {
            if (!publishers[article.publisherId]) {
                publishers[article.publisherId] = { totalScore: 0, count: 0 };
            }
            if (article.biasScore !== null && article.biasScore !== undefined) {
                publishers[article.publisherId].totalScore += article.biasScore;
                publishers[article.publisherId].count += 1;
            }
        });

        const aggregateScores = {};
        for (const pubId in publishers) {
            if (publishers[pubId].count > 0) {
                aggregateScores[pubId] = Math.round(publishers[pubId].totalScore / publishers[pubId].count);
            }
        }
        res.json({ publishers: aggregateScores });
    } catch (error) {
        console.error("Failed to calculate aggregate scores:", error);
        res.status(500).json({ error: "Failed to calculate aggregate scores" });
    }
});

// GET Celebrity Spin Zone
app.get('/v1/spin', async (req, res) => {
    try {
        const spinArticle = await prisma.article.findFirst({
            where: { category: 'Celebrity Spin' },
            orderBy: { timestamp: 'desc' }
        });
        
        if (spinArticle) {
            res.json({
                celebrity: {
                    id: spinArticle.id,
                    celebrity: spinArticle.author || "Unknown Celebrity",
                    source: spinArticle.source,
                    timestamp: spinArticle.timestamp,
                    originalHeadline: spinArticle.coreEvent,
                    originalQuote: spinArticle.originalText,
                    spinScore: spinArticle.biasScore,
                    strippedTerms: spinArticle.strippedTerms,
                    deterministicRewrite: spinArticle.deterministicRewrite
                }
            });
        } else {
            res.status(404).json({ error: "No celebrity spin found" });
        }
    } catch (error) {
        console.error("Failed to fetch celebrity spin:", error);
        res.status(500).json({ error: "Failed to fetch celebrity spin" });
    }
});

// Endpoint for Local News aggregation
app.get('/v1/local', async (req, res) => {
    const { zip } = req.query;
    if (!zip) return res.status(400).json({ error: "Missing ZIP code" });

    try {
        const localData = await getLocalNews(zip);
        res.json(localData);
    } catch (error) {
        console.error("Local route error:", error.message);
        res.status(500).json({ error: "Failed to load local news pipeline" });
    }
});

// GET Axiom News Explorer (Search)
app.get('/v1/search', async (req, res) => {
    try {
        const { q, startDate, endDate } = req.query;
        if (!q) {
            return res.status(400).json({ error: "Search query 'q' is required" });
        }

        let whereClause = {};

        // Check if query is likely a hash (starts with 0x or is long and alphanumeric)
        const isHash = q.length > 20 && /^[a-zA-Z0-9]+$/.test(q);

        if (isHash) {
            whereClause = {
                OR: [
                    { sourceProofHash: { equals: q } },
                    { trustCertificate: { equals: q } },
                    { sourceProofHash: { startsWith: q } },
                    { trustCertificate: { startsWith: q } }
                ]
            };
        } else {
            // Plain text search across multiple fields
            whereClause = {
                OR: [
                    { originalText: { contains: q, mode: 'insensitive' } },
                    { coreEvent: { contains: q, mode: 'insensitive' } },
                    { deterministicRewrite: { contains: q, mode: 'insensitive' } }
                ]
            };
        }

        // Apply Date Filters
        if (startDate || endDate) {
            whereClause.timestamp = {};
            if (startDate) {
                whereClause.timestamp.gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.timestamp.lte = end;
            }
        }

        const articles = await prisma.article.findMany({
            where: whereClause,
            orderBy: { timestamp: 'desc' },
            take: 100 // Limit results to prevent massive payloads
        });

        res.json({ articles, count: articles.length });
    } catch (error) {
        console.error("Search endpoint failed:", error);
        res.status(500).json({ error: "Search failed" });
    }
});

// Run pipeline twice a day (every 12 hours) to simulate Drudge Report cadence
cron.schedule('0 */12 * * *', () => {
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
