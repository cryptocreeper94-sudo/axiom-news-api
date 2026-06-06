const axios = require('axios');
const cheerio = require('cheerio');

axios.get('https://feeds.washingtonpost.com/rss/world')
  .then(r => {
    const $ = cheerio.load(r.data, {xmlMode: true});
    $('item').slice(0, 5).each((i, el) => {
      console.log('Title:', $(el).find('title').text());
    });
  })
  .catch(e => console.error(e.message));
