const puppeteer = require('puppeteer');

async function searchToppreise(query) {
  let browser;
  try {
    console.log(`[TOPPREISE] Arama başlatılıyor: "${query}"`);

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

    const searchUrl = `https://www.toppreise.ch/browse?q=${encodeURIComponent(query)}&cid=`;
    console.log(`[TOPPREISE] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 500)); // 2000 -> 500 ms

    console.log(`[TOPPREISE] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const productElements = document.querySelectorAll('.Plugin_Product.f_collection, .Plugin_Product');

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (items.length >= 4) return;

        try {
          const titleElement = element.querySelector('a.bold');
          let rawTitle = titleElement ? titleElement.textContent.trim() : '';
          rawTitle = rawTitle.replace(/\s+/g, ' ').trim();
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

          const priceElement = element.querySelector('.priceContainer.shippingPrice .Plugin_Price, .priceContainer.productPrice .Plugin_Price');
          let price = '';
          if (priceElement) {
            const priceText = priceElement.textContent || '';
            price = priceText.trim().replace(/[^0-9.]/g, '');
          }

          const linkElement = element.querySelector('a.bold');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : 'https://www.toppreise.ch' + href;
          }

          const imageElement = element.querySelector('img.Plugin_Image');
          const image = imageElement ? (imageElement.getAttribute('data-src') || imageElement.getAttribute('src')) : '';

          if (rawTitle && link) {
            items.push({
              title: rawTitle,
              price: price || 'Fiyat bulunamadı',
              currency: 'CHF',
              link,
              image,
              matchScore,
              matchPercent,
              isSponsored: false
            });
          }
        } catch (error) {
          console.error('Ürün parse hatası:', error);
        }
      });

      return items;
    }, query);

    console.log(`[TOPPREISE] ${products.length} ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[TOPPREISE] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[TOPPREISE] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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

module.exports = { searchToppreise };
