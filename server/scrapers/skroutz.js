const puppeteer = require('puppeteer');

async function searchSkroutz(query) {
  let browser;
  try {
    console.log(`[SKROUTZ] Arama başlatılıyor: "${query}"`);

    browser = await puppeteer.launch({
      headless: true,
      slowMo: 0,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // HIZLANDIRMA: Kaynak engelleme
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const searchUrl = `https://www.skroutz.gr/search?keyphrase=${encodeURIComponent(query)}`;
    console.log(`[SKROUTZ] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 500)); // 2000 -> 500 ms

    console.log(`[SKROUTZ] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const productElements = document.querySelectorAll('li[data-testid="sku-card"]');

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (items.length >= 4) return;

        try {
          const titleElement = element.querySelector('[data-e2e-testid="sku-title-link"]');
          const rawTitle = titleElement ? titleElement.textContent.trim() : '';
          if (!rawTitle) return;

          const normalizedTitle = rawTitle.toLowerCase();
          const normalizedTitleForMatch = normalizedTitle
            .replace(/(\d+)([a-z]+)/gi, '$1 $2')
            .replace(/([a-z]+)(\d+)/gi, '$1 $2');

          const matchedWords = queryWords.filter(word => {
            const wordLower = word.toLowerCase();
            if (normalizedTitle.includes(wordLower)) return true;
            if (normalizedTitleForMatch.includes(wordLower)) return true;
            if (wordLower.match(/^\d+[a-z]+$/)) {
              const numMatch = wordLower.match(/^(\d+)([a-z]+)$/);
              if (numMatch) {
                const num = numMatch[1];
                const unit = numMatch[2];
                return normalizedTitle.includes(num) && normalizedTitle.includes(unit);
              }
            }
            return false;
          });

          const matchScore = matchedWords.length;
          const matchPercent = queryWords.length > 0
            ? Math.round((matchedWords.length / queryWords.length) * 100)
            : 0;

          const priceElement = element.querySelector('[data-e2e-testid="sku-price-link"]');
          let price = '';
          if (priceElement) {
            const priceText = priceElement.textContent || '';
            const cleaned = priceText.replace(/[^\d.,]/g, '').trim();
            if (cleaned) {
              const lastComma = cleaned.lastIndexOf(',');
              const lastDot = cleaned.lastIndexOf('.');
              let normalized = cleaned;

              if (lastComma !== -1 && lastDot !== -1) {
                if (lastDot > lastComma) {
                  normalized = cleaned.replace(/,/g, '');
                } else {
                  normalized = cleaned.replace(/\./g, '').replace(',', '.');
                }
              } else if (lastComma !== -1) {
                const decimals = cleaned.length - lastComma - 1;
                if (decimals === 2) {
                  normalized = cleaned.replace(/\./g, '').replace(',', '.');
                } else {
                  normalized = cleaned.replace(/,/g, '');
                }
              }

              price = normalized.replace(/[^0-9.]/g, '');
            }
          }

          const linkElement = element.querySelector('a.js-sku-link');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : `https://www.skroutz.gr${href}`;
          }

          const imageElement = element.querySelector('[data-testid="sku-pic-img"]');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          const sponsoredElement = element.querySelector('.shop-promoter .label-text');
          const isSponsored = Boolean(sponsoredElement) || (element.textContent || '').toLowerCase().includes('advertisement');

          if (rawTitle && link) {
            items.push({
              title: rawTitle,
              price: price || 'Fiyat bulunamadı',
              currency: 'EUR',
              link,
              image,
              matchScore,
              matchPercent,
              isSponsored
            });
          }
        } catch (error) {
          console.error('Ürün parse hatası:', error);
        }
      });

      return items;
    }, query);

    console.log(`[SKROUTZ] ${products.length} ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[SKROUTZ] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[SKROUTZ] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
    return products;
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    if (error.message.includes('timeout') || error.message.includes('Navigation')) {
      throw new Error('Siteye erişilemedi');
    }

    throw error;
  }
}

module.exports = { searchSkroutz };
