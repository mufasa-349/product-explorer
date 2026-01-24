const puppeteer = require('puppeteer');
const https = require('https');

const translationCache = new Map();

function translateToEnglish(text) {
  return new Promise((resolve) => {
    if (!text) return resolve(text);
    if (!/[А-Яа-я]/.test(text)) return resolve(text);
    if (translationCache.has(text)) return resolve(translationCache.get(text));

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=bg&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const translated = Array.isArray(parsed) && Array.isArray(parsed[0])
            ? parsed[0].map(part => part[0]).join('')
            : '';
          const cleaned = translated.trim();
          if (cleaned) {
            translationCache.set(text, cleaned);
            return resolve(cleaned);
          }
        } catch (e) {
          // noop
        }
        resolve(text);
      });
    }).on('error', () => resolve(text));
  });
}

async function searchEmag(query) {
  let browser;
  try {
    console.log(`[EMAG] Arama baslatiliyor: "${query}"`);

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

    const searchUrl = `https://www.emag.bg/search/${encodeURIComponent(query)}?ref=effective_search`;
    console.log(`[EMAG] Arama sayfasina gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 500)); // 2000 -> 500 ms

    console.log(`[EMAG] Urun elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const productElements = document.querySelectorAll('.card-v2-wrapper.js-section-wrapper');

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      const normalizePrice = (text) => {
        if (!text) return '';
        let normalized = text.replace(/\s/g, '');
        const match = normalized.match(/[\d.,]+/);
        if (!match) return '';
        normalized = match[0];
        if (normalized.includes(',') && normalized.includes('.')) {
          normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else if (normalized.includes(',')) {
          normalized = normalized.replace(',', '.');
        }
        return normalized.replace(/[^0-9.]/g, '');
      };

      productElements.forEach((element) => {
        if (items.length >= 4) return;

        try {
          const titleElement = element.querySelector('.card-v2-title, .card-v2-title-wrapper a');
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

          let price = '';
          const priceElements = Array.from(element.querySelectorAll('.product-new-price'));
          if (priceElements.length > 0) {
            const euroPriceEl = priceElements.find(el => (el.textContent || '').includes('€'));
            const priceText = euroPriceEl ? euroPriceEl.textContent : priceElements[0].textContent;
            price = normalizePrice(priceText);
          }

          const linkElement = element.querySelector('a.js-product-url');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : `https://www.emag.bg${href}`;
          }

          const imageElement = element.querySelector('.card-v2-thumb img, img');
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
          console.error('Urun parse hatasi:', error);
        }
      });

      return items;
    }, query);

    console.log(`[EMAG] ${products.length} urun bulundu`);

    const translatedProducts = await Promise.all(
      products.map(async (product) => {
        const translatedTitle = await translateToEnglish(product.title);
        return {
          ...product,
          title: translatedTitle || product.title,
          originalTitle: product.title
        };
      })
    );

    await browser.close();

    if (translatedProducts.length === 0) {
      console.log('[EMAG] Ürün bulunamadı');
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[EMAG] Arama tamamlandi, ${translatedProducts.length} urun donduruluyor`);
    return translatedProducts;
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    if (error.message.includes('timeout') || error.message.includes('Navigation')) {
      throw new Error('Siteye erisilemedi');
    }

    throw error;
  }
}

module.exports = { searchEmag };
