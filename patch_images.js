const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const categoryImages = {
    'Finance': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800',
    'Politics': 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&q=80&w=800',
    'Technology': 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&q=80&w=800',
    'World': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800',
    'Science': 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=800',
};

async function fixImages() {
    console.log("Fetching articles with broken pollinations.ai images...");
    const brokenArticles = await prisma.article.findMany({
        where: {
            image: {
                contains: 'pollinations.ai'
            }
        }
    });

    console.log(`Found ${brokenArticles.length} broken articles. Fixing...`);

    let count = 0;
    for (const article of brokenArticles) {
        const fallback = categoryImages[article.category] || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=800';
        await prisma.article.update({
            where: { id: article.id },
            data: { image: fallback }
        });
        count++;
    }

    console.log(`Successfully fixed ${count} images.`);
    process.exit(0);
}

fixImages().catch(e => {
    console.error(e);
    process.exit(1);
});
