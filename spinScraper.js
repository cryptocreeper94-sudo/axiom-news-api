const { extractDeterministicFacts } = require('./lumeEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Simulated sources for Celebrity Spin Zone
const MOCK_CELEBRITY_QUOTES = [
    {
        celebrity: "Mark Ruffalo",
        source: "HuffPost Entertainment",
        quote: "This is literally the end of the world as we know it. These politicians are signing a death warrant for our children because they care more about corporate greed than human survival! It's apocalyptic!",
        headline: "Mark Ruffalo SLAMS Lawmakers Over 'Apocalyptic' New Climate Policy, Warns of Impending Doom",
        category: "Celebrity Spin",
        publisherId: "spin-huff",
        image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9"
    },
    {
        celebrity: "Leonardo DiCaprio",
        source: "Variety",
        quote: "If we don't ban all fossil fuels immediately, the oceans will boil within 10 years. We have to completely shut down the oil economy right now, regardless of the cost to working class people.",
        headline: "Leonardo DiCaprio Demands IMMEDIATE End to Fossil Fuels in Blistering UN Speech",
        category: "Celebrity Spin",
        publisherId: "spin-variety",
        image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620"
    },
    {
        celebrity: "Elon Musk",
        source: "X Post",
        quote: "The media is actively trying to destroy civilization by pushing these insane narratives. If we don't colonize Mars in the next 5 years, humanity will go extinct due to mind viruses.",
        headline: "Elon Musk Says Humanity Will GO EXTINCT From 'Mind Viruses' Unless We Reach Mars",
        category: "Celebrity Spin",
        publisherId: "spin-x",
        image: "https://images.unsplash.com/photo-1517976487492-5750f3195933"
    }
];

async function scrapeCelebritySpin() {
    console.log(`[${new Date().toISOString()}] Starting Celebrity Spin Zone Scraper...`);
    
    for (const data of MOCK_CELEBRITY_QUOTES) {
        const rawText = `${data.headline}. "${data.quote}"`;
        const titleHash = crypto.createHash('md5').update(data.headline).digest('hex').substring(0, 12);
        const sourceProofHash = crypto.createHash('sha256').update(rawText).digest('hex');

        const existing = await prisma.article.findFirst({
            where: { originalText: rawText }
        });

        if (existing) {
            console.log(`[SKIP] Already processed Spin: ${data.celebrity}`);
            continue;
        }

        console.log(`Processing Spin: ${data.celebrity}...`);
        
        try {
            const deterministicData = await extractDeterministicFacts(rawText, data.source);
            
            await prisma.article.create({
                data: {
                    id: `spin-${titleHash}`,
                    publisherId: data.publisherId,
                    source: data.source,
                    timestamp: new Date(),
                    coreEvent: deterministicData.coreEvent || data.headline,
                    processTimeline: deterministicData.processTimeline || [],
                    biasScore: deterministicData.biasScore || 85, // Spin usually has high bias
                    originalText: rawText,
                    strippedTerms: deterministicData.strippedTerms || [],
                    deterministicRewrite: deterministicData.deterministicRewrite || "",
                    isSatire: false,
                    category: data.category,
                    image: data.image,
                    author: data.celebrity,
                    trustCertificate: deterministicData.trustCertificate,
                    sourceProofHash: sourceProofHash
                }
            });
            console.log(`[SUCCESS] Saved Spin to DB. Spin Score: ${deterministicData.biasScore || 85}%`);
        } catch (err) {
            console.error(`Failed to process spin for ${data.celebrity}:`, err.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

module.exports = { scrapeCelebritySpin };

if (require.main === module) {
    scrapeCelebritySpin().then(() => {
        console.log("Spin scraper finished.");
        process.exit(0);
    });
}
