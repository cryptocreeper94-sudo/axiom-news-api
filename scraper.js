const axios = require('axios');
const cheerio = require('cheerio');

const FEEDS = [
    { publisherId: 'nyt', name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
    { publisherId: 'fox', name: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/latest.xml' },
    { publisherId: 'wsj', name: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
    { publisherId: 'wapo', name: 'Washington Post', url: 'https://feeds.washingtonpost.com/rss/world' },
    { publisherId: 'bbc', name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { publisherId: 'politico', name: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
    { publisherId: 'breitbart', name: 'Breitbart', url: 'https://feeds.feedburner.com/breitbart' },
    { publisherId: 'cnn', name: 'CNN', url: 'http://rss.cnn.com/rss/cnn_topstories.rss' },
    { publisherId: 'nypost', name: 'New York Post', url: 'https://nypost.com/feed/' },
    { publisherId: 'intercept', name: 'The Intercept', url: 'https://theintercept.com/feed/?lang=en' },
    { publisherId: 'salon', name: 'Salon', url: 'https://www.salon.com/feed/' },
    { publisherId: 'gateway', name: 'The Gateway Pundit', url: 'https://www.thegatewaypundit.com/feed/' },
    { publisherId: 'satire', name: 'The Onion', url: 'https://www.theonion.com/rss' },
    { publisherId: 'satire', name: 'Babylon Bee', url: 'https://babylonbee.com/feed' }
];

async function scrapeTopHeadlines() {
    const rawArticles = [];

    for (const feed of FEEDS) {
        try {
            console.log(`Fetching RSS for ${feed.name}...`);
            const response = await axios.get(feed.url, { 
                timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
            });
            const $ = cheerio.load(response.data, { xmlMode: true });

            const items = $('item').slice(0, 15);
            items.each((index, el) => {
                const title = $(el).find('title').text();
                const description = $(el).find('description').text();
                
                // Try multiple ways to get image from RSS
                let imageUrl = null;
                
                // 1. media:content url attr (most common for news RSS)
                const mediaContent = $(el).find('media\\:content').attr('url');
                if (mediaContent) imageUrl = mediaContent;
                
                // 2. media:thumbnail
                if (!imageUrl) {
                    const mediaThumbnail = $(el).find('media\\:thumbnail').attr('url');
                    if (mediaThumbnail) imageUrl = mediaThumbnail;
                }
                
                // 3. enclosure with image type
                if (!imageUrl) {
                    const enclosure = $(el).find('enclosure').attr('url');
                    const encType = $(el).find('enclosure').attr('type') || '';
                    if (enclosure && (encType.startsWith('image') || enclosure.match(/\.(jpg|jpeg|png|webp|gif)/i))) {
                        imageUrl = enclosure;
                    }
                }
                
                // 4. Extract <img> from content:encoded or description CDATA
                if (!imageUrl) {
                    const contentEncoded = $(el).find('content\\:encoded').text() || '';
                    const descriptionRaw = $(el).find('description').html() || '';
                    const htmlContent = contentEncoded || descriptionRaw;
                    const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (imgMatch && imgMatch[1]) {
                        imageUrl = imgMatch[1];
                    }
                }
                
                // 5. Look for any url attribute on media:group children
                if (!imageUrl) {
                    const mediaGroup = $(el).find('media\\:group media\\:content').attr('url');
                    if (mediaGroup) imageUrl = mediaGroup;
                }
                
                // Remove HTML tags from description if any
                const cleanDesc = description.replace(/<[^>]*>?/gm, '').trim();

                // Create a deterministic ID based on the title so we don't re-process the exact same articles
                const crypto = require('crypto');
                const titleHash = crypto.createHash('md5').update(title).digest('hex').substring(0, 12);

                // Extract the link to the original article
                const articleUrl = $(el).find('link').text() || '';

                rawArticles.push({
                    id: `ax-${feed.publisherId}-${titleHash}`,
                    publisherId: feed.publisherId,
                    source: feed.name,
                    timestamp: new Date().toISOString(),
                    rawText: `${title}. ${cleanDesc}`,
                    originalText: `${title}. ${cleanDesc} | URL: ${articleUrl}`,
                    imageUrl: imageUrl,
                    sourceProofHash: sourceProofHash
                });
            });
        } catch (error) {
            console.error(`Failed to fetch ${feed.name}:`, error.message);
        }
    }

    return rawArticles;
}

module.exports = { scrapeTopHeadlines };
