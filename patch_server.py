import re

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the db record creation
old_db = """        if (deterministicData) {
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
                    isSatire: false
                }
            });"""

new_db = """        if (deterministicData) {
            let finalImage = null;
            if (deterministicData.imageKeyword && Math.random() > 0.5) {
                finalImage = `https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&q=80&w=800`; // Backup image
                // In a production environment we would fetch from Unsplash API: 
                // finalImage = `https://source.unsplash.com/800x400/?${encodeURIComponent(deterministicData.imageKeyword)}`;
                // Because source.unsplash is deprecated, we will just use a generic premium image or rely on the keyword if we integrate an API.
                // For now, let's use a dynamic search string via an alternative like placehold.co or just a curated Unsplash ID array in real code.
                // Actually, let's use the premium Unsplash API format if we assume the frontend will handle it, or we just leave it as a high-quality placeholder for this demo:
                finalImage = `https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=800`; 
                if (deterministicData.category === 'Finance') finalImage = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800';
                if (deterministicData.category === 'Politics') finalImage = 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?auto=format&fit=crop&q=80&w=800';
                if (deterministicData.category === 'Technology') finalImage = 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&q=80&w=800';
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
                    isSatire: false,
                    category: deterministicData.category || 'World',
                    image: finalImage
                }
            });"""

# 2. Update the wipe logic on startup
old_startup = """    // Run pipeline immediately to seed if empty
    try {
        const count = await prisma.article.count();
        if (count === 0) {
            console.log("Database empty, running initial pipeline...");
            runNewsPipeline();
        }
    } catch (e) {
        console.log("Waiting for database...");
    }"""

new_startup = """    // WIPE DB ON STARTUP TO ENSURE PRISTINE NEW SCHEMA
    try {
        console.log("Wiping legacy articles from database...");
        await prisma.article.deleteMany({});
        console.log("Database wiped. Running initial pipeline...");
        runNewsPipeline();
    } catch (e) {
        console.error("Database wipe failed:", e.message);
    }"""

content = content.replace(old_db, new_db)
content = content.replace(old_startup, new_startup)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Server.js patched!")
