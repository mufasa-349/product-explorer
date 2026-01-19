const puppeteer = require('puppeteer');

function normalizeCurrency(rawCurrency) {
  if (!rawCurrency) return 'EUR';
  const trimmed = rawCurrency.trim();
  if (!trimmed) return 'EUR';
  if (trimmed.toUpperCase().includes('EUR')) return 'EUR';
  if (trimmed.includes('€')) return 'EUR';
  return trimmed.toUpperCase();
}

async function setDeliveryZip(page, zip) {
  try {
    console.log(`[AMAZON.FR] Delivery address butonu aranıyor...`);
    const locationSelectors = [
      '#nav-global-location-popover-link',
      '#nav-global-location-slot',
      '#glow-ingress-line2',
      '[data-csa-c-content-id="nav_cs_ap"]',
      'input[data-action-type="SELECT_LOCATION"]'
    ];
    let clicked = false;
    let foundInFirstPass = false;

    for (const selector of locationSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000, visible: true });
      } catch (e) {
        // Bu selector görünür değilse sıradakini dene
      }
      const el = await page.$(selector);
      if (el) {
        foundInFirstPass = true;
        console.log(`[AMAZON.FR] Delivery address butonu tıklanıyor: ${selector}`);
        await el.click();
        clicked = true;
        break;
      }
    }

    if (!foundInFirstPass && !clicked) {
      console.log(`[AMAZON.FR] 5 sn içinde bulunamadı, sayfa yenileniyor...`);
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      for (const selector of locationSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000, visible: true });
        } catch (e) {
          // noop
        }
        const el = await page.$(selector);
        if (el) {
          console.log(`[AMAZON.FR] Delivery address butonu tıklanıyor: ${selector}`);
          await el.click();
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) {
      console.log(`[AMAZON.FR] Delivery address butonu bulunamadı`);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    const zipInputSelector = '#GLUXZipUpdateInput, input[name="zipCode"], input[id*="Zip"]';
    const applyButtonSelector = '#GLUXZipUpdate, #GLUXZipUpdate-announce, button[data-action="glow"], button[type="submit"]';
    const continueButtonSelector = '#GLUXConfirmClose, #GLUXConfirmClose-announce, [data-action="GLUXConfirmAction"] #GLUXConfirmClose, [data-action="GLUXConfirmAction"] #GLUXConfirmClose-announce, button[data-action="confirm"], button[name="glowDoneButton"], #a-autoid-3-announce';

    console.log(`[AMAZON.FR] Zip code input'u bekleniyor...`);
    await page.waitForSelector(zipInputSelector, { timeout: 10000 });
    const zipInput = await page.$(zipInputSelector);

    if (!zipInput) {
      console.log(`[AMAZON.FR] Zip input bulunamadı`);
      return false;
    }

    console.log(`[AMAZON.FR] Zip code input'una ${zip} giriliyor...`);
    await zipInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await zipInput.type(zip, { delay: 80 });
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log(`[AMAZON.FR] Apply butonu tıklanıyor...`);
    const applyBtn = await page.$(applyButtonSelector);
    if (applyBtn) {
      await applyBtn.click();
    } else {
      console.log(`[AMAZON.FR] Apply butonu bulunamadı`);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[AMAZON.FR] Continue/Close adımı deneniyor...`);
    let closed = false;
    try {
      await page.waitForSelector(continueButtonSelector, { timeout: 6000 });
      const continueBtn = await page.$(continueButtonSelector);
      if (continueBtn) {
        console.log(`[AMAZON.FR] Continue butonu tıklanıyor...`);
        await continueBtn.click();
        closed = true;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (e) {
      console.log(`[AMAZON.FR] Continue butonu görünmedi, alternatif kapanış deneniyor...`);
    }

    if (!closed) {
      try {
        const closeSelector = 'button[aria-label="Close"], [data-action="a-popover-close"]';
        const closeBtn = await page.$(closeSelector);
        if (closeBtn) {
          console.log(`[AMAZON.FR] Pop-up X butonu tıklanıyor...`);
          await closeBtn.click();
          closed = true;
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      } catch (e) {
        // noop
      }
    }

    if (!closed) {
      console.log(`[AMAZON.FR] Pop-up kapatmak için ESC deneniyor...`);
      await page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    console.log(`[AMAZON.FR] Delivery address ayarlama denemesi tamamlandı (${zip})`);
    return true;
  } catch (e) {
    console.log(`[AMAZON.FR] Delivery address ayarlama hatası: ${e.message}`);
    return false;
  }
}

async function searchAmazonFR(query) {
  let browser;
  try {
    console.log(`[AMAZON.FR] Arama başlatılıyor: "${query}"`);

    browser = await puppeteer.launch({
      headless: true,
      slowMo: 10,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const searchUrl = `https://www.amazon.fr/s?k=${encodeURIComponent(query)}`;
    console.log(`[AMAZON.FR] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await setDeliveryZip(page, '75003');

    try {
      await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });
      console.log(`[AMAZON.FR] Ürün elementleri yüklendi`);
    } catch (e) {
      console.log(`[AMAZON.FR] Ürün elementleri için selector bulunamadı, devam ediliyor...`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[AMAZON.FR] Ürün elementleri aranıyor...`);
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
            link = href.startsWith('http') ? href : 'https://www.amazon.fr' + href;
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

    console.log(`[AMAZON.FR] ${products.length} eşleşen ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[AMAZON.FR] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[AMAZON.FR] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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

module.exports = { searchAmazonFR };
