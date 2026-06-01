const axios = require('axios');
const cheerio = require('cheerio');

const FEEDS = [
    { publisherId: 'nyt', name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
    { publisherId: 'fox', name: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/latest.xml' },
    { publisherId: 'wsj', name: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
    { publisherId: 'wapo', name: 'Washington Post', url: 'https://feeds.washingtonpost.com/rss/world' },
    { publisherId: 'bbc', name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { publisherId: 'politico', name: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
    { publisherId: 'breitbart', name: 'Breitbart', url: 'https://feeds.feedburner.com/breitbart' }
];

async function scrapeTopHeadlines() {
    const rawArticles = [];

    for (const feed of FEEDS) {
        try {
            console.log(`Fetching RSS for ${feed.name}...`);
            const response = await axios.get(feed.url, { timeout: 10000 });
            const $ = cheerio.load(response.data, { xmlMode: true });

            // Grab the top 5 <item>s from the feed
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
            });
        } catch (error) {
            console.error(`Failed to fetch ${feed.name}:`, error.message);
        }
    }

    return rawArticles;
}

module.exports = { scrapeTopHeadlines };
