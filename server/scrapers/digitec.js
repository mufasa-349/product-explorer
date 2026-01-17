const puppeteer = require('puppeteer');

async function searchDigitec(query) {
  let browser;
  try {
    console.log(`[DIGITEC] Arama başlatılıyor: "${query}"`);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const searchUrl = `https://www.digitec.ch/en/search?q=${encodeURIComponent(query)}`;
    console.log(`[DIGITEC] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[DIGITEC] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const productElements = document.querySelectorAll('a[aria-label][href*="/product/"]');

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (items.length >= 4) return;

        try {
          const rawTitle = element.getAttribute('aria-label')?.trim() || '';
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

          const link = element.getAttribute('href')
            ? `https://www.digitec.ch${element.getAttribute('href')}`
            : '';

          if (!link) return;

          const priceElement = element.closest('article')?.querySelector('[data-test="product-price"], [data-test="price"]');
          let price = '';
          if (priceElement) {
            const priceText = priceElement.textContent || '';
            price = priceText.trim().replace(/[^0-9.]/g, '');
          }

          const imageElement = element.closest('article')?.querySelector('img');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          items.push({
            title: rawTitle.replace(/\s+/g, ' ').trim(),
            price: price || 'Fiyat bulunamadı',
            currency: 'CHF',
            link,
            image,
            matchScore,
            matchPercent,
            isSponsored: false
          });
        } catch (error) {
          console.error('Ürün parse hatası:', error);
        }
      });

      return items;
    }, query);

    console.log(`[DIGITEC] ${products.length} ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[DIGITEC] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[DIGITEC] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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

module.exports = { searchDigitec };
