const { PrismaClient } = require('@prisma/client');
const { generatePrediction } = require('./pulseEngine');
const prisma = new PrismaClient();

async function backfill() {
    console.log("Starting backfill of Pulse predictions...");
    const articles = await prisma.article.findMany({
        where: {
            prediction: null
        }
    });

    console.log(`Found ${articles.length} articles to backfill.`);

    for (const article of articles) {
        console.log(`Backfilling article: ${article.id}`);
        // We simulate the deterministic data from the article fields
        const deterministicData = {
            biasScore: article.biasScore,
            strippedTerms: article.strippedTerms || [],
            category: article.category
        };
        await generatePrediction(article.id, deterministicData, article.originalText, article.publisherId);
    }

    console.log("Backfill complete!");
    process.exit(0);
}

backfill().catch(e => {
    console.error(e);
    process.exit(1);
});
