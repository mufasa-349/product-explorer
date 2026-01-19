const puppeteer = require('puppeteer');

function normalizeCurrency(rawCurrency) {
  if (!rawCurrency) return 'EUR';
  const trimmed = rawCurrency.trim();
  if (!trimmed) return 'EUR';
  if (trimmed.toUpperCase().includes('EUR')) return 'EUR';
  if (trimmed.includes('€')) return 'EUR';
  return trimmed.toUpperCase();
}

async function searchAmazonNL(query) {
  let browser;
  try {
    console.log(`[AMAZON.NL] Arama başlatılıyor: "${query}"`);

    browser = await puppeteer.launch({
      headless: true,
      slowMo: 10,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const searchUrl = `https://www.amazon.nl/s?k=${encodeURIComponent(query)}`;
    console.log(`[AMAZON.NL] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    try {
      await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });
      console.log(`[AMAZON.NL] Ürün elementleri yüklendi`);
    } catch (e) {
      console.log(`[AMAZON.NL] Ürün elementleri için selector bulunamadı, devam ediliyor...`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[AMAZON.NL] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const nonSponsoredItems = [];
      const sponsoredItems = [];
      let productElements = Array.from(document.querySelectorAll('[data-component-type="s-search-result"]'));
      if (productElements.length === 0) {
        productElements = Array.from(document.querySelectorAll('.s-result-item[data-asin]'));
      }
      if (productElements.length === 0) {
        productElements = Array.from(document.querySelectorAll('[data-asin]:not([data-asin=""])'));
      }
      if (productElements.length === 0) {
        productElements = Array.from(document.querySelectorAll('.s-card-container, .puis-card-container, [data-cy="asin-faceout-container"]'));
      }

      if (productElements.length > 0) {
        const unique = new Set();
        const deduped = [];
        productElements.forEach((el) => {
          const container = el.closest('.s-card-container, .puis-card-container') || el;
          if (!unique.has(container)) {
            unique.add(container);
            deduped.push(container);
          }
        });
        productElements = deduped;
      }

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (nonSponsoredItems.length >= 4 && sponsoredItems.length >= 1) return;

        try {
          const brandElement = element.querySelector('[data-cy="title-recipe"] .a-row.a-color-secondary h2 span, h2.a-size-mini span');
          const rawBrand = brandElement ? brandElement.textContent.trim() : '';
          const cleanedBrand = rawBrand.replace(/sponsored/gi, '').trim();

          const productTitleElement = element.querySelector(
            '[data-cy="title-recipe"] a.a-link-normal.s-link-style.a-text-normal h2 span, ' +
            '[data-cy="title-recipe"] a.a-link-normal h2 span, ' +
            '[data-cy="title-recipe"] h2.a-size-base-plus span, ' +
            'a.a-link-normal.s-link-style.a-text-normal h2 span, ' +
            'h2.a-size-base-plus span'
          );
          let rawTitle = productTitleElement ? productTitleElement.textContent.trim() : '';
          rawTitle = rawTitle.replace(/sponsored/gi, '').trim();

          const shortTitle = rawTitle.split(' - ')[0].split(' – ')[0].split(' | ')[0].trim();
          let title = shortTitle || rawTitle;
          if (cleanedBrand && title && !title.toLowerCase().startsWith(cleanedBrand.toLowerCase())) {
            title = `${cleanedBrand} ${title}`;
          }

          if (!title) return;

          const sponsoredElement = element.querySelector(
            '.s-sponsored-label-text, [data-component-type="sp-sponsored-result"], [data-csa-c-content-id*="sponsored"], [aria-label*="Sponsored"], [aria-label*="Gesponsert"]'
          );
          const isSponsored = Boolean(sponsoredElement) || (element.textContent || '').toLowerCase().includes('sponsored');

          const normalizedTitle = title.toLowerCase();
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
          let currency = '';
          const priceContainer = element.querySelector('[data-cy="price-recipe"]') || element;
          const priceSelectors = [
            '.a-price .a-offscreen',
            '.a-price-whole',
            '.a-price .a-price-symbol + span'
          ];

          for (const selector of priceSelectors) {
            const priceElement = priceContainer.querySelector(selector);
            if (priceElement) {
              const priceText = priceElement.textContent || priceElement.getAttribute('aria-label') || priceElement.innerText || '';
              const extractedPrice = priceText.trim().replace(/[^0-9.]/g, '');
              if (extractedPrice && !isNaN(parseFloat(extractedPrice))) {
                price = extractedPrice;
                currency = priceText.replace(/[0-9.,\s]/g, '').trim();
                break;
              }
            }
          }

          if (!price) {
            const allPriceElements = element.querySelectorAll('[class*="price"], [data-a-color="price"]');
            for (const priceEl of allPriceElements) {
              if (priceEl.closest('[data-cy="secondary-offer-recipe"]')) continue;
              const priceText = priceEl.textContent || priceEl.getAttribute('aria-label') || '';
              const extractedPrice = priceText.trim().replace(/[^0-9.]/g, '');
              if (extractedPrice && !isNaN(parseFloat(extractedPrice)) && parseFloat(extractedPrice) > 0) {
                price = extractedPrice;
                currency = priceText.replace(/[0-9.,\s]/g, '').trim();
                break;
              }
            }
          }

          const linkElement = element.querySelector('h2 a, a.a-link-normal');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : 'https://www.amazon.nl' + href;
          }

          const imageElement = element.querySelector('.s-image, img');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          if (title && link) {
            const product = {
              title,
              price: price || 'Fiyat bulunamadı',
              currency,
              link,
              image,
              matchScore,
              matchPercent,
              isSponsored
            };
            if (isSponsored) {
              if (sponsoredItems.length < 1) sponsoredItems.push(product);
            } else {
              if (nonSponsoredItems.length < 4) nonSponsoredItems.push(product);
            }
          }
        } catch (error) {
          console.error('Ürün parse hatası:', error);
        }
      });

      items.push(...nonSponsoredItems, ...sponsoredItems);
      return items;
    }, query);

    console.log(`[AMAZON.NL] ${products.length} eşleşen ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[AMAZON.NL] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[AMAZON.NL] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
    return products.map(product => ({
      ...product,
      currency: normalizeCurrency(product.currency)
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

module.exports = { searchAmazonNL };
