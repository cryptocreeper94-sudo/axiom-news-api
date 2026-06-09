// DATABASE_URL is set via .env or Render environment variables

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const twilio = require('twilio');
const crypto = require('crypto');
const { Resend } = require('resend');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { scrapeTopHeadlines } = require('./scraper');
const { extractDeterministicFacts } = require('./lumeEngine');
const { getLocalNews } = require('./localScraper');
const pulseEngine = require('./pulseEngine');
const { extractAndSaveCivicsContext } = require('./civicsEngine');
const agentRoutes = require('./agentRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/v1/agent', agentRoutes);

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) 
  : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.get('/ping', (req, res) => res.status(200).send('pong'));

const PORT = process.env.PORT || 4001;

// Daily Genesis Block Cron Job
cron.schedule('0 8 * * *', async () => {
    console.log('Sending daily Genesis Block update...');
    const subscribers = await prisma.subscriber.findMany();
    const latestNews = await prisma.article.findMany({ take: 5, orderBy: { timestamp: 'desc' } });
    
    const message = `Genesis Block Daily:\n${latestNews.map(n => `- ${n.coreEvent}`).join('\n')}`;

    for (const sub of subscribers) {
        if (sub.email && resend) {
            await resend.emails.send({
                from: 'Axiom Engine <genesis@axiom42news.com>',
                to: sub.email,
                subject: 'Your Daily Genesis Block',
                text: message
            });
        }
        if (sub.phone && twilioClient) {
            await twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: sub.phone
            });
        }
    }
});

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
            where: { 
                originalText: raw.originalText
            }
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

            await prisma.article.upsert({
                where: { id: raw.id },
                update: {
                    coreEvent: deterministicData.coreEvent,
                    processTimeline: deterministicData.processTimeline,
                    biasScore: deterministicData.biasScore,
                    strippedTerms: deterministicData.strippedTerms,
                    deterministicRewrite: deterministicData.deterministicRewrite || null,
                    image: finalImage,
                    category: deterministicData.category || 'World',
                },
                create: {
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
                    author: deterministicData.author || 'Staff',
                    trustCertificate: 'LTC-v1.0-' + require('crypto').createHash('sha256').update(JSON.stringify(deterministicData)).digest('hex'),
                    sourceProofHash: raw.sourceProofHash
                }
            });
            console.log(`[SUCCESS] Saved to DB. Stripped Bias: ${deterministicData.biasScore}%`);
            
            // Integrate Pulse Engine
            await pulseEngine.generatePrediction(raw.id, deterministicData, raw.originalText, raw.publisherId);
            
            // Extract Civics Context
            await extractAndSaveCivicsContext(raw.id, raw.originalText);
            
        } else {
            console.log(`[FAILED] Could not process ${raw.source} - Flagging to prevent retry loop`);
            await prisma.article.upsert({
                where: { id: raw.id },
                update: {
                    coreEvent: "PROCESS_FAILED",
                    biasScore: -1,
                    originalText: raw.originalText,
                },
                create: {
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
                    author: 'Staff',
                    trustCertificate: 'LTC-v1.0-FAILED',
                    sourceProofHash: raw.sourceProofHash
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
            take: 250,
            include: { prediction: true, civicsContext: true }
        });
        res.json({ articles, lastUpdated: new Date().toISOString() });
    } catch (error) {
        console.error("Database query failed:", error);
        res.status(500).json({ error: "Failed to fetch live feed" });
    }
});

// GET Aggregate Scores (Only scoring matched core events)
app.get('/v1/aggregate', async (req, res) => {
    try {
        const articles = await prisma.article.findMany();
        
        // 1. Group by coreEvent to find matches
        const coreEventCounts = {};
        articles.forEach(article => {
            if (article.coreEvent && !article.isSatire && article.biasScore >= 0) {
                if (!coreEventCounts[article.coreEvent]) {
                    coreEventCounts[article.coreEvent] = new Set();
                }
                coreEventCounts[article.coreEvent].add(article.publisherId);
            }
        });

        // 2. Score articles
        const publishers = {};
        articles.forEach(article => {
            // Only consider successfully processed articles
            if (article.biasScore !== null && article.biasScore !== undefined && article.biasScore >= 0) {
                if (!publishers[article.publisherId]) {
                    publishers[article.publisherId] = { matchedScore: 0, matchedCount: 0, unmatchedScore: 0, unmatchedCount: 0, totalCount: 0 };
                }
                publishers[article.publisherId].totalCount += 1;
                
                // Only count as "matched" if this event was covered by > 1 publisher
                if (article.coreEvent && coreEventCounts[article.coreEvent] && coreEventCounts[article.coreEvent].size > 1) {
                    publishers[article.publisherId].matchedScore += article.biasScore;
                    publishers[article.publisherId].matchedCount += 1;
                } else {
                    publishers[article.publisherId].unmatchedScore += article.biasScore;
                    publishers[article.publisherId].unmatchedCount += 1;
                }
            }
        });

        const aggregateScores = {};
        const aggregateStats = {};
        for (const pubId in publishers) {
            const pub = publishers[pubId];
            
            // "only use the comparible stories for the actual rating. the one off stories could be rated by their own merit."
            if (pub.matchedCount > 0) {
                aggregateScores[pubId] = Math.round(pub.matchedScore / pub.matchedCount);
            } else if (pub.unmatchedCount > 0) {
                aggregateScores[pubId] = Math.round(pub.unmatchedScore / pub.unmatchedCount);
            }
            
            aggregateStats[pubId] = {
                matchedVolume: pub.matchedCount,
                unmatchedVolume: pub.unmatchedCount,
                totalVolume: pub.totalCount,
                unmatchedScore: pub.unmatchedCount > 0 ? Math.round(pub.unmatchedScore / pub.unmatchedCount) : null,
                isComparative: pub.matchedCount > 0
            };
        }
        res.json({ publishers: aggregateScores, publisherStats: aggregateStats });
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

// GET Related Articles for Spin Comparison (Narrative Delta)
app.get('/v1/related', async (req, res) => {
    try {
        const { coreEvent, excludePublisher } = req.query;
        if (!coreEvent) {
            return res.status(400).json({ error: "coreEvent is required" });
        }

        // Find articles with the exact same coreEvent but from a different publisher
        const relatedArticles = await prisma.article.findMany({
            where: {
                coreEvent: { equals: coreEvent },
                publisherId: { not: excludePublisher },
                isSatire: false
            },
            orderBy: {
                biasScore: 'desc' // Try to find a highly biased opposing view for contrast
            },
            take: 1
        });

        if (relatedArticles.length > 0) {
            res.json(relatedArticles[0]);
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error("Related endpoint failed:", error);
        res.status(500).json({ error: "Failed to fetch related article" });
    }
});

// GET Pulse Predictions Feed
app.get('/v1/pulse/predictions', async (req, res) => {
    try {
        const predictions = await prisma.narrativePrediction.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                article: {
                    select: {
                        coreEvent: true,
                        source: true,
                        image: true,
                        deterministicRewrite: true,
                        category: true,
                        biasScore: true
                    }
                },
                feature: true
            }
        });
        res.json({ predictions });
    } catch (error) {
        console.error("Failed to fetch Pulse predictions:", error);
        res.status(500).json({ error: "Failed to fetch Pulse predictions" });
    }
});

// GET Pulse Prediction Stats
app.get('/v1/pulse/stats', async (req, res) => {
    try {
        const total = await prisma.narrativePrediction.count();
        const highImpact = await prisma.narrativePrediction.count({ where: { signal: 'HIGH' } });
        const mediumImpact = await prisma.narrativePrediction.count({ where: { signal: 'MEDIUM' } });
        const lowImpact = await prisma.narrativePrediction.count({ where: { signal: 'LOW' } });

        res.json({
            totalPredictions: total,
            signals: {
                HIGH: highImpact,
                MEDIUM: mediumImpact,
                LOW: lowImpact
            }
        });
    } catch (error) {
        console.error("Failed to fetch Pulse stats:", error);
        res.status(500).json({ error: "Failed to fetch Pulse stats" });
    }
});

// GET Algorithmic Publisher Leaderboard
app.get('/v1/leaderboard', async (req, res) => {
    try {
        // We calculate the average biasScore grouped by publisherId
        const aggregations = await prisma.article.groupBy({
            by: ['publisherId'],
            _avg: {
                biasScore: true
            },
            _count: {
                id: true
            },
            where: {
                isSatire: false
            }
        });

        // Filter out publishers with too few articles to be statistically significant,
        // map to a clean format, and sort by lowest average bias.
        const leaderboard = aggregations
            .filter(agg => agg._count.id > 1) 
            .map(agg => ({
                publisherId: agg.publisherId,
                averageBias: Math.round(agg._avg.biasScore),
                articleCount: agg._count.id
            }))
            .sort((a, b) => a.averageBias - b.averageBias);

        res.json(leaderboard);
    } catch (error) {
        console.error("Leaderboard endpoint failed:", error);
        res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
});

// POST Subscribe to Genesis Block
app.post('/v1/subscribe', async (req, res) => {
    try {
        const { email, phone } = req.body;
        if (!email && !phone) {
            return res.status(400).json({ error: "Must provide email or phone" });
        }

        const subscriber = await prisma.subscriber.create({
            data: { email, phone }
        });

        res.json({ success: true, message: "Subscribed to the Genesis Block" });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "Already subscribed" });
        }
        console.error("Subscribe failed:", error);
        res.status(500).json({ error: "Failed to subscribe" });
    }
});

// The Daily Genesis Block Job
async function broadcastGenesisBlock() {
    console.log(`[${new Date().toISOString()}] Compiling Daily Genesis Block...`);
    try {
        // Get the top 5 most purely deterministic (lowest bias) articles from the last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const topFacts = await prisma.article.findMany({
            where: {
                timestamp: { gte: twentyFourHoursAgo },
                isSatire: false,
                biasScore: { lte: 10 }
            },
            orderBy: { biasScore: 'asc' },
            take: 5
        });

        if (topFacts.length === 0) return;

        let digestText = "AXIOM DAILY GENESIS BLOCK\n\n";
        let htmlBody = `<div style="font-family: monospace; background: #000; color: #10b981; padding: 20px;">
                        <h2>AXIOM DAILY GENESIS BLOCK</h2>`;

        topFacts.forEach((fact, i) => {
            const entry = `${i+1}. [LUME-V: ${fact.trustCertificate.substring(0,8)}] ${fact.deterministicRewrite}\n`;
            digestText += entry;
            htmlBody += `<p><strong>[LUME-V: ${fact.trustCertificate.substring(0,8)}]</strong> ${fact.deterministicRewrite}</p>`;
        });

        // Seal the entire digest with a master hash
        const digestHash = crypto.createHash('sha256').update(digestText).digest('hex');
        digestText += `\nDIGEST HASH: ${digestHash}\nStay Neutral.`;
        htmlBody += `<hr style="border-color:#10b98133"/><p>DIGEST HASH: ${digestHash}</p><p>Stay Neutral.</p></div>`;

        // Fetch subscribers
        const subscribers = await prisma.subscriber.findMany({ where: { active: true } });

        // Dispatch via Twilio (SMS)
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            const phoneSubs = subscribers.filter(s => s.phone);
            for (const sub of phoneSubs) {
                try {
                    await twilioClient.messages.create({
                        body: digestText,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: sub.phone
                    });
                } catch (e) {
                    console.error(`Failed to text ${sub.phone}:`, e.message);
                }
            }
        }

        // Dispatch via Resend (Email)
        if (resend) {
            const emailSubs = subscribers.filter(s => s.email);
            for (const sub of emailSubs) {
                try {
                    await resend.emails.send({
                        from: 'Axiom Engine <genesis@axiom42news.com>',
                        to: sub.email,
                        subject: 'Daily Genesis Block [Verified Reality]',
                        html: htmlBody
                    });
                } catch (e) {
                    console.error(`Failed to email ${sub.email}:`, e.message);
                }
            }
        }
        
        console.log(`Genesis Block ${digestHash} broadcasted successfully.`);
    } catch (error) {
        console.error("Failed to broadcast Genesis Block:", error);
    }
}

// Check every 15 minutes if 12 hours have elapsed since the last successful scrape
cron.schedule('*/15 * * * *', async () => {
    try {
        const lastScrape = await prisma.article.findFirst({
            where: { isSatire: false, coreEvent: { not: "PROCESS_FAILED" } },
            orderBy: { timestamp: 'desc' }
        });
        
        if (lastScrape) {
            const twelveHours = 12 * 60 * 60 * 1000;
            const elapsed = Date.now() - new Date(lastScrape.timestamp).getTime();
            if (elapsed < twelveHours) {
                return; // Not due yet
            }
        }
        
        await runNewsPipeline().catch(e => console.error("Pipeline crashed on cron:", e));
    } catch (err) {
        console.error("Cron check failed:", err.message);
    }
});

// Broadcast Genesis Block daily at 8:00 AM EST (13:00 UTC)
cron.schedule('0 13 * * *', () => {
    broadcastGenesisBlock();
});

// Manual trigger for scraping
app.get('/v1/force-scrape', async (req, res) => {
    try {
        // Run asynchronously so we don't block the request
        runNewsPipeline().catch(e => console.error("Manual pipeline triggered crashed:", e));
        res.json({ message: "Scrape pipeline triggered in the background. This will take a few minutes." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`Axiom News API listening on port ${PORT}`);
    try {
        console.log("Checking if initial pipeline should run on boot...");
        const lastScrape = await prisma.article.findFirst({
            where: { isSatire: false },
            orderBy: { timestamp: 'desc' }
        });
        const twelveHours = 12 * 60 * 60 * 1000;
        if (!lastScrape || (Date.now() - new Date(lastScrape.timestamp).getTime()) >= twelveHours) {
            runNewsPipeline().catch(e => console.error("Pipeline crashed on boot:", e));
        } else {
            console.log("Skipping boot scrape. Less than 12 hours since last scrape.");
        }
    } catch (e) {
        console.error("Database check failed:", e.message);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});
