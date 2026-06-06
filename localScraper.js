const axios = require('axios');
const cheerio = require('cheerio');
const { extractDeterministicFacts } = require('./gemini');
const crypto = require('crypto');

async function getLocalNews(zip) {
    try {
        // 1. Geocode the ZIP
        console.log(`Geocoding ZIP: ${zip}`);
        const geoRes = await axios.get(`https://api.zippopotam.us/us/${zip}`, { timeout: 5000 });
        const place = geoRes.data.places[0];
        const city = place['place name'];
        const state = place['state abbreviation'];
        const locationString = `${city} ${state}`;
        console.log(`Resolved to: ${locationString}`);

        // 2. Fetch Google News RSS for this location
        const query = encodeURIComponent(`${locationString} local news`);
        const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
        
        console.log(`Fetching local RSS: ${rssUrl}`);
        const response = await axios.get(rssUrl, { 
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const $ = cheerio.load(response.data, { xmlMode: true });

        const items = $('item').slice(0, 15); // Top 15 local stories
        const localArticles = [];

        for (let i = 0; i < items.length; i++) {
            const el = items[i];
            const title = $(el).find('title').text();
            const description = $(el).find('description').text();
            const link = $(el).find('link').text();
            
            // Clean up title (Google news appends publisher like "- The New York Times")
            const cleanTitleMatch = title.match(/^(.*?)\s*-/);
            const displayTitle = cleanTitleMatch ? cleanTitleMatch[1] : title;
            const sourceMatch = title.match(/-\s*(.*)$/);
            const source = sourceMatch ? sourceMatch[1] : `${city} Local News`;

            const cleanDesc = description.replace(/<[^>]*>?/gm, '').trim();
            const rawText = `${displayTitle}. ${cleanDesc}`;
            
            const titleHash = crypto.createHash('md5').update(displayTitle).digest('hex').substring(0, 12);

            // Pass through deterministic engine locally
            const deterministicData = await extractDeterministicFacts(rawText, source);
            
            localArticles.push({
                id: `loc-${zip}-${titleHash}`,
                publisherId: 'local',
                source: source,
                timestamp: new Date().toISOString(),
                coreEvent: deterministicData.coreEvent,
                category: deterministicData.category,
                image: null, // Local news RSS rarely gives good images reliably
                isSatire: false,
                biasScore: deterministicData.biasScore,
                processTimeline: deterministicData.processTimeline,
                strippedTerms: deterministicData.strippedTerms,
                deterministicRewrite: deterministicData.deterministicRewrite,
                rawText: rawText,
                originalText: `${rawText} | URL: ${link}`
            });
        }
        
        return {
            location: locationString,
            articles: localArticles
        };

    } catch (error) {
        console.error('Local News Error:', error.message);
        throw new Error('Failed to fetch local news');
    }
}

module.exports = { getLocalNews };
