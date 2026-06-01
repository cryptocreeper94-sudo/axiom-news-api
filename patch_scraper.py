import re

with open('scraper.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_scraper = """            // Grab the very first <item> from the feed
            const firstItem = $('item').first();
            if (firstItem.length > 0) {
                const title = firstItem.find('title').text();
                const description = firstItem.find('description').text();
                
                // Remove HTML tags from description if any
                const cleanDesc = description.replace(/<[^>]*>?/gm, '').trim();

                rawArticles.push({
                    id: `ax-${Date.now()}-${feed.publisherId}`,
                    publisherId: feed.publisherId,
                    source: feed.name,
                    timestamp: new Date().toISOString(),
                    rawText: `${title}. ${cleanDesc}`,
                    originalText: `${title}. ${cleanDesc}`
                });
            }"""

new_scraper = """            // Grab the top 5 <item>s from the feed
            const items = $('item').slice(0, 5);
            items.each((index, el) => {
                const title = $(el).find('title').text();
                const description = $(el).find('description').text();
                
                // Remove HTML tags from description if any
                const cleanDesc = description.replace(/<[^>]*>?/gm, '').trim();

                rawArticles.push({
                    id: `ax-${Date.now()}-${feed.publisherId}-${index}`,
                    publisherId: feed.publisherId,
                    source: feed.name,
                    timestamp: new Date().toISOString(),
                    rawText: `${title}. ${cleanDesc}`,
                    originalText: `${title}. ${cleanDesc}`
                });
            });"""

content = content.replace(old_scraper, new_scraper)

with open('scraper.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Scraper patched to fetch 5 articles!")
