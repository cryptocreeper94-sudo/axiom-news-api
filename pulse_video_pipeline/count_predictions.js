const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function count() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await prisma.narrativePrediction.count({
        where: { createdAt: { gte: yesterday }, probability: { gte: 0.5 } }
    });
    console.log(`TOTAL >= 50%: ${count}`);
    const lowerCount = await prisma.narrativePrediction.count({
        where: { createdAt: { gte: yesterday }, probability: { lt: 0.5 } }
    });
    console.log(`TOTAL < 50%: ${lowerCount}`);
    
    // Let's get the top 3 below 50% if there are no others above 50%
    const lower = await prisma.narrativePrediction.findMany({
        where: { createdAt: { gte: yesterday }, probability: { lt: 0.5 } },
        orderBy: { probability: 'desc' },
        take: 3,
        include: { article: true }
    });
    lower.forEach((p, i) => console.log(`Lower Event ${i+1}: ${p.article.coreEvent} (${(p.probability*100).toFixed(1)}%)`));
}
count().catch(console.error).then(() => process.exit(0));
