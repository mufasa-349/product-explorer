const puppeteer = require('puppeteer');

async function searchTechnopolis(query) {
  let browser;
  try {
    console.log(`[TECHNOPOLIS] Arama başlatılıyor: "${query}"`);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const searchUrl = `https://www.technopolis.bg/bg/search/${encodeURIComponent(query)}`;
    console.log(`[TECHNOPOLIS] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[TECHNOPOLIS] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const productElements = document.querySelectorAll('te-product-box[data-product-id]');

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (items.length >= 4) return;

        try {
          const titleElement = element.querySelector('.product-box__title-link');
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

          const euroPriceValue = element.querySelector('.product-box__price .price .product-box__price-value');
          let price = '';
          if (euroPriceValue) {
            const priceText = euroPriceValue.textContent || '';
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

          const linkElement = element.querySelector('a.product-box__title-link, a');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : `https://www.technopolis.bg${href}`;
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

    console.log(`[TECHNOPOLIS] ${products.length} ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[TECHNOPOLIS] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[TECHNOPOLIS] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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

module.exports = { searchTechnopolis };
