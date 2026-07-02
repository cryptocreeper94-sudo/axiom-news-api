const puppeteer = require('puppeteer');
const fs = require('fs');

async function makeThumbnail() {
    const bgPath = 'C:/Users/unfor/.gemini/antigravity-ide/brain/50ef3e03-8e76-4fb4-be06-178b55aaf529/thumbnail_june16_16x9.png';
    const bgBase64 = fs.readFileSync(bgPath).toString('base64');
    
    const html = `
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,600&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
        <style>
            body {
                margin: 0; padding: 0; width: 1920px; height: 1080px;
                background-image: url('data:image/png;base64,${bgBase64}');
                background-size: cover; background-position: center;
                display: flex; align-items: flex-end; justify-content: flex-start;
            }
            .content {
                position: relative; z-index: 2; margin: 100px; padding: 60px 80px;
                background: rgba(15, 23, 42, 0.90);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255,255,255,0.05);
                border-left: 8px solid #3b82f6;
                border-radius: 8px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            .date {
                font-family: 'Inter', sans-serif; font-weight: 600; font-size: 32px; letter-spacing: 14px; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px;
            }
            .title {
                font-family: 'Playfair Display', serif; font-weight: 600; font-size: 110px; color: #ffffff; line-height: 1.05; text-shadow: 0 10px 40px rgba(0,0,0,0.8); letter-spacing: -1px;
            }
        </style>
    </head>
    <body>
        <div class="content">
            <div class="date">6/16/26</div>
            <div class="title">Axiom Daily Pulse</div>
        </div>
    </body>
    </html>
    `;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(html, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'C:/Users/unfor/.gemini/antigravity-ide/brain/50ef3e03-8e76-4fb4-be06-178b55aaf529/pulse_thumbnail_obama_center_suave.png' });
    await page.screenshot({ path: 'D:/axiom-marketing-videos/Final_Renders_With_Intro/thumbnails/pulse_thumbnail_june16.png' });
    await browser.close();
}

makeThumbnail().then(() => console.log('Thumbnail rendered.'));
