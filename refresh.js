// One-shot: clear all articles and re-scrape with fixed image extraction
process.env.DATABASE_URL = "postgresql://lume_cortex_user:lxKEqdUQcLDOr1VIiLiSxIFb2sqPDtsE@dpg-d7p4u7pkh4rs73btif0g-a.ohio-postgres.render.com/lume_cortex?sslmode=require";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { scrapeTopHeadlines } = require('./scraper');
const { extractDeterministicFacts } = require('./lumeEngine');

async function refresh() {
    console.log('📡 Scraping fresh headlines...');
    const rawArticles = await scrapeTopHeadlines();
    console.log(`   Scraped ${rawArticles.length} raw articles.`);

    let saved = 0, failed = 0;
    for (const raw of rawArticles) {
        console.log(`   Processing: ${raw.source} - ${raw.rawText.substring(0, 50)}...`);
        console.log(`   Image from RSS: ${raw.imageUrl || '(none)'}`);

        // Prevent infinite API drains by checking if we already processed this exact headline
        const existing = await prisma.article.findUnique({ where: { id: raw.id } });
        if (existing) {
            console.log(`   ⏭️ Skipped (already exists): ${raw.id}`);
            continue;
        }

        const deterministicData = await extractDeterministicFacts(raw.rawText, raw.source);
        if (deterministicData) {
            let finalImage = raw.imageUrl;
            
            if (deterministicData.imageKeyword && deterministicData.imageKeyword !== 'null') {
                finalImage = `https://image.pollinations.ai/prompt/${encodeURIComponent(`Photorealistic editorial news photography of ${deterministicData.imageKeyword}`)}?width=800&height=600&nologo=true`;
                console.log(`   Using AI generated image for keyword: ${deterministicData.imageKeyword}`);
            } else if (!finalImage) {
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
                console.log(`   Using fallback image for category: ${deterministicData.category}`);
            }

            await prisma.article.upsert({
                where: { id: raw.id },
                update: {
                    coreEvent: deterministicData.coreEvent,
                    processTimeline: deterministicData.processTimeline,
                    biasScore: deterministicData.biasScore,
                    originalText: raw.originalText,
                    strippedTerms: deterministicData.strippedTerms,
                    deterministicRewrite: deterministicData.deterministicRewrite || null,
                    isSatire: raw.publisherId === 'satire',
                    category: deterministicData.category || 'World',
                    image: finalImage
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
                    image: finalImage
                }
            });
            saved++;
            console.log(`   ✅ Saved (bias: ${deterministicData.biasScore}%, image: ${finalImage ? 'YES' : 'NO'})`);
        } else {
            failed++;
            console.log(`   ❌ Gemini processing failed. Flagging to prevent retry loop.`);
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
                    image: null
                }
            });
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n🎉 DONE: ${saved} saved, ${failed} failed, ${rawArticles.length} total scraped`);
    await prisma.$disconnect();
    process.exit(0);
}

refresh().catch(e => { console.error('Fatal:', e); process.exit(1); });
