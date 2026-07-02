const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const vids = await prisma.pulseVideo.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2
    });
    console.log(vids.map(v => `[${v.createdAt}]\n${v.transcript}`).join('\n\n-----------------\n\n'));
}
check().catch(console.error).then(() => process.exit(0));
