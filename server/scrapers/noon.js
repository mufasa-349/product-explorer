const puppeteer = require('puppeteer');

async function searchNoon(query) {
  let browser;
  try {
    console.log(`[NOON] Arama başlatılıyor: "${query}"`);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const searchUrl = `https://www.noon.com/uae-en/search/?q=${encodeURIComponent(query)}`;
    console.log(`[NOON] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[NOON] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const productElements = document.querySelectorAll('[data-qa="plp-product-box"]');

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (items.length >= 4) return;

        try {
          const titleElement = element.querySelector('[data-qa="plp-product-box-name"], .ProductDetailsSection-module-scss-module__Y6u1Qq__title');
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

          const minScore = queryWords.length >= 4 ? 3 : queryWords.length >= 2 ? 2 : 1;
          const minPercent = queryWords.length >= 4 ? 60 : queryWords.length >= 2 ? 50 : 0;
          if (matchScore < minScore || matchPercent < minPercent) {
            return;
          }

          const priceElement = element.querySelector(
            '[data-qa="plp-product-box-price"] .Price-module-scss-module__q-4KEG__amount, .Price-module-scss-module__q-4KEG__amount, .Price-module-scss-module__ozJB4G__productPrice'
          );
          const currencyElement = element.querySelector(
            '[data-qa="plp-product-box-price"] .Price-module-scss-module__q-4KEG__currency, .Price-module-scss-module__q-4KEG__currency, .Price-module-scss-module__ozJB4G__currency'
          );

          let price = '';
          let currency = 'AED';
          if (priceElement) {
            const priceText = priceElement.textContent || '';
            price = priceText.trim().replace(/[^0-9.]/g, '');
          }
          if (currencyElement) {
            const curText = currencyElement.textContent || '';
            if (curText && curText.trim()) {
              currency = curText.trim().toUpperCase();
            }
          }

          const linkElement = element.querySelector('a.PBoxLinkHandler-module-scss-module__WvRpgq__productBoxLink, a');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : 'https://www.noon.com' + href;
          }

          const imageElement = element.querySelector('img.ProductImageCarousel-module-scss-module__SlkSTG__productImage, img');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          if (rawTitle && link) {
            items.push({
              title: rawTitle,
              price: price || 'Fiyat bulunamadı',
              currency,
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

    console.log(`[NOON] ${products.length} ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[NOON] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[NOON] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
    return products.map(product => ({
      ...product,
      currency: 'AED'
    }));
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

module.exports = { searchNoon };
