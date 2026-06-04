// One-shot: clear all articles and re-scrape with fixed image extraction
process.env.DATABASE_URL = "postgresql://lume_cortex_user:lxKEqdUQcLDOr1VIiLiSxIFb2sqPDtsE@dpg-d7p4u7pkh4rs73btif0g-a.ohio-postgres.render.com/lume_cortex?sslmode=require";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { scrapeTopHeadlines } = require('./scraper');
const { extractDeterministicFacts } = require('./gemini');

async function refresh() {
    console.log('🗑️  Clearing existing articles...');
    const deleted = await prisma.article.deleteMany({});
    console.log(`   Deleted ${deleted.count} articles.`);

    console.log('📡 Scraping fresh headlines...');
    const rawArticles = await scrapeTopHeadlines();
    console.log(`   Scraped ${rawArticles.length} raw articles.`);

    let saved = 0, failed = 0;
    for (const raw of rawArticles) {
        console.log(`   Processing: ${raw.source} - ${raw.rawText.substring(0, 50)}...`);
        console.log(`   Image from RSS: ${raw.imageUrl || '(none)'}`);

        const deterministicData = await extractDeterministicFacts(raw.rawText, raw.source);
        if (deterministicData) {
            let finalImage = raw.imageUrl;
            
            // Sync images to the subject matter using deterministic keyword generation
            if (deterministicData.imageKeyword && deterministicData.imageKeyword !== 'null') {
                finalImage = `https://image.pollinations.ai/prompt/${encodeURIComponent(`Photorealistic editorial news photography of ${deterministicData.imageKeyword}`)}?width=800&height=600&nologo=true`;
                console.log(`   Using AI generated image for keyword: ${deterministicData.imageKeyword}`);
            } else if (!finalImage) {
                const categoryImages = {
                    'Finance': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800',
                    'Politics': 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&q=80&w=800',
                    'Technology': 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&q=80&w=800',
                    'World': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800',
                    'Science': 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=800',
                };
                finalImage = categoryImages[deterministicData.category] || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=800';
                console.log(`   Using fallback image for category: ${deterministicData.category}`);
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
                    isSatire: false,
                    category: deterministicData.category || 'World',
                    image: finalImage
                }
            });
            saved++;
            console.log(`   ✅ Saved (bias: ${deterministicData.biasScore}%, image: ${finalImage ? 'YES' : 'NO'})`);
        } else {
            failed++;
            console.log(`   ❌ Gemini processing failed. Flagging to prevent retry loop.`);
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
                    isSatire: false,
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
