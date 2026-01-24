const puppeteer = require('puppeteer');

async function searchIdealo(query) {
  let browser;
  try {
    console.log(`[IDEALO] Arama başlatılıyor: "${query}"`);

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

    const searchUrl = `https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${encodeURIComponent(query)}`;
    console.log(`[IDEALO] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 500)); // 2000 -> 500 ms

    console.log(`[IDEALO] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const productElements = document.querySelectorAll(
        '.sr-resultList__item, .sr-resultList__item_m6xdA, .sr-resultItemTile_B0odU, .sr-resultList__product, .sr-productList__item'
      );

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (items.length >= 4) return;

        try {
          const titleElement = element.querySelector(
            '.sr-productSummary__title, .sr-productSummary__title a, .sr-productSummary__titleText, .sr-productSummary__title_f5flP, .sr-resultItemLink_YbJS7 a, .sr-resultItemLink_YbJS7 .sr-productSummary__title_f5flP'
          );
          let rawTitle = titleElement ? titleElement.textContent.trim() : '';
          if (!rawTitle) return;
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

          const priceElement = element.querySelector(
            '.sr-detailedPriceInfo__price_sYVmx, .sr-detailedPriceInfo__price_seller, .sr-detailedPriceInfo__price, .sr-productSummary__price'
          );
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
                  // 1,159.00 -> 1159.00
                  normalized = cleaned.replace(/,/g, '');
                } else {
                  // 1.159,00 -> 1159.00
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

          const linkElement = element.querySelector('.sr-resultItemLink_YbJS7 a, a');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : 'https://www.idealo.de' + href;
          }

          const imageElement = element.querySelector('img');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          if (rawTitle && link) {
            items.push({
              title: rawTitle,
              price: price || 'Fiyat bulunamadı',
              currency: 'EUR',
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

    console.log(`[IDEALO] ${products.length} ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[IDEALO] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[IDEALO] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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

module.exports = { searchIdealo };
