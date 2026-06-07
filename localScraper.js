const axios = require('axios');
const cheerio = require('cheerio');
const { extractDeterministicFacts } = require('./lumeEngine');
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
        
        // Cryptographic proof of the raw RSS payload
        const sourceProofHash = crypto.createHash('sha256').update(response.data).digest('hex');

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
            let deterministicData;
            try {
                deterministicData = await extractDeterministicFacts(rawText, source);
            } catch (err) {
                console.error('Lume processing failed for local news, using fallback:', err.message);
                deterministicData = {
                    coreEvent: displayTitle,
                    category: 'Local',
                    biasScore: 50,
                    processTimeline: ['Local RSS fetched', 'Lume processing failed, fallback used'],
                    strippedTerms: [],
                    deterministicRewrite: cleanDesc,
                    trustCertificate: 'LTC-v1.0-FALLBACK'
                };
            }
            
            localArticles.push({
                id: `loc-${zip}-${titleHash}`,
                publisherId: 'local',
                source: source,
                timestamp: new Date().toISOString(),
                coreEvent: deterministicData.coreEvent || displayTitle,
                category: deterministicData.category || 'Local',
                image: null, // Local news RSS rarely gives good images reliably
                isSatire: false,
                biasScore: deterministicData.biasScore || 50,
                processTimeline: deterministicData.processTimeline || [],
                strippedTerms: deterministicData.strippedTerms || [],
                deterministicRewrite: deterministicData.deterministicRewrite || cleanDesc,
                trustCertificate: deterministicData.trustCertificate,
                sourceProofHash: sourceProofHash,
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
