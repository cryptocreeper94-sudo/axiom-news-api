const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
    const articles = await prisma.article.findMany({
        orderBy: { timestamp: 'desc' },
        take: 15
    });
    console.log("Top 15 latest articles in DB:");
    articles.forEach(a => {
        console.log(`- ${a.source} | pubId: ${a.publisherId} | isSatire: ${a.isSatire} | title: ${a.coreEvent.substring(0,40)}`);
    });
    await prisma.$disconnect();
}
inspect().catch(console.error);
