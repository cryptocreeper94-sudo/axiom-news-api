const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    console.log('Fixing satire articles...');
    const res = await prisma.article.updateMany({
        where: { publisherId: 'satire' },
        data: { isSatire: true }
    });
    console.log('Fixed ' + res.count + ' articles.');
    await prisma.$disconnect();
}

fix().catch(console.error);
