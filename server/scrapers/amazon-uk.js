const puppeteer = require('puppeteer');

async function setDeliveryZip(page, zip) {
  try {
    console.log(`[AMAZON.UK] Delivery address butonu aranıyor...`);
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
        console.log(`[AMAZON.UK] Delivery address butonu tıklanıyor: ${selector}`);
        await el.click();
        clicked = true;
        break;
      }
    }

    if (!foundInFirstPass && !clicked) {
      console.log(`[AMAZON.UK] 5 sn içinde bulunamadı, sayfa yenileniyor...`);
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
          console.log(`[AMAZON.UK] Delivery address butonu tıklanıyor: ${selector}`);
          await el.click();
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) {
      console.log(`[AMAZON.UK] Delivery address butonu bulunamadı`);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    const zipInputSelector = '#GLUXZipUpdateInput, input[name="zipCode"], input[id*="Zip"]';
    const applyButtonSelector = '#GLUXZipUpdate, #GLUXZipUpdate-announce, button[data-action="glow"], button[type="submit"]';
    const continueButtonSelector = '#GLUXConfirmClose, #GLUXConfirmClose-announce, [data-action="GLUXConfirmAction"] #GLUXConfirmClose, [data-action="GLUXConfirmAction"] #GLUXConfirmClose-announce, button[data-action="confirm"], button[name="glowDoneButton"], #a-autoid-3-announce';

    console.log(`[AMAZON.UK] Posta kodu input'u bekleniyor...`);
    await page.waitForSelector(zipInputSelector, { timeout: 10000 });
    const zipInput = await page.$(zipInputSelector);

    if (!zipInput) {
      console.log(`[AMAZON.UK] Posta kodu input'u bulunamadı`);
      return false;
    }

    console.log(`[AMAZON.UK] Posta kodu input'una ${zip} giriliyor...`);
    await zipInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await zipInput.type(zip, { delay: 80 });
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log(`[AMAZON.UK] Apply butonu tıklanıyor...`);
    const applyBtn = await page.$(applyButtonSelector);
    if (applyBtn) {
      await applyBtn.click();
    } else {
      console.log(`[AMAZON.UK] Apply butonu bulunamadı`);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[AMAZON.UK] Continue/Close adımı deneniyor...`);
    let closed = false;
    try {
      await page.waitForSelector(continueButtonSelector, { timeout: 6000 });
      const continueBtn = await page.$(continueButtonSelector);
      if (continueBtn) {
        console.log(`[AMAZON.UK] Continue butonu tıklanıyor...`);
        await continueBtn.click();
        closed = true;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (e) {
      console.log(`[AMAZON.UK] Continue butonu görünmedi, alternatif kapanış deneniyor...`);
    }

    if (!closed) {
      try {
        const closeSelector = 'button[aria-label="Close"], [data-action="a-popover-close"]';
        const closeBtn = await page.$(closeSelector);
        if (closeBtn) {
          console.log(`[AMAZON.UK] Pop-up X butonu tıklanıyor...`);
          await closeBtn.click();
          closed = true;
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      } catch (e) {
        // noop
      }
    }

    if (!closed) {
      console.log(`[AMAZON.UK] Pop-up dışına tıklama deneniyor...`);
      await page.mouse.click(5, 5);
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    console.log(`[AMAZON.UK] Sayfa yenileniyor...`);
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });

    console.log(`[AMAZON.UK] Delivery address ayarlama denemesi tamamlandı (${zip})`);
    return true;
  } catch (e) {
    console.log(`[AMAZON.UK] Delivery address ayarlama hatası: ${e.message}`);
    return false;
  }
}

async function searchAmazonUK(query) {
  let browser;
  try {
    console.log(`[AMAZON.UK] Arama başlatılıyor: "${query}"`);

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

    const searchUrl = `https://www.amazon.co.uk/s?k=${encodeURIComponent(query)}`;
    console.log(`[AMAZON.UK] Arama sayfasına gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await setDeliveryZip(page, 'SW1A 0AA');

    try {
      await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });
      console.log(`[AMAZON.UK] Ürün elementleri yüklendi`);
    } catch (e) {
      console.log(`[AMAZON.UK] Ürün elementleri için selector bulunamadı, devam ediliyor...`);
    }

    await new Promise(resolve => setTimeout(resolve, 500)); // 2000 -> 500 ms

    console.log(`[AMAZON.UK] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const nonSponsoredItems = [];
      const sponsoredItems = [];
      let productElements = document.querySelectorAll('[data-component-type="s-search-result"]');
      if (productElements.length === 0) {
        productElements = document.querySelectorAll('.s-result-item[data-asin]');
      }
      if (productElements.length === 0) {
        productElements = document.querySelectorAll('[data-asin]:not([data-asin=""])');
      }
      if (productElements.length === 0) {
        productElements = document.querySelectorAll('.s-result-item');
      }

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (nonSponsoredItems.length >= 4 && sponsoredItems.length >= 1) return;

        try {
          const brandElement = element.querySelector('[data-cy="title-recipe"] .a-row.a-color-secondary h2 span, h2.a-size-mini span');
          const rawBrand = brandElement ? brandElement.textContent.trim() : '';
          const cleanedBrand = rawBrand.replace(/sponsored/gi, '').trim();

          const productTitleElement = element.querySelector('[data-cy="title-recipe"] a.a-link-normal.s-link-style.a-text-normal h2 span, a.a-link-normal.s-link-style.a-text-normal h2 span');
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
          const priceContainer = element.querySelector('[data-cy="price-recipe"]') || element;
          
          // Önce .a-offscreen'den tam fiyatı al (en güvenilir - "TRY 13,387.09" formatında)
          const offscreenPrice = priceContainer.querySelector('.a-price .a-offscreen');
          if (offscreenPrice) {
            const offscreenText = offscreenPrice.textContent || offscreenPrice.getAttribute('aria-label') || '';
            // "TRY 13,387.09" veya "13,387.09" formatını parse et
            // Virgül binlik ayırıcı, nokta ondalık ayırıcı
            const priceMatch = offscreenText.match(/([\d,]+\.?\d*)/);
            if (priceMatch) {
              // Virgülleri kaldır (binlik ayırıcı), noktayı koru (ondalık ayırıcı)
              price = priceMatch[1].replace(/,/g, '');
            }
          }
          
          // Eğer offscreen'den alınamadıysa, parçalı fiyatı birleştir
          if (!price) {
            const priceWhole = priceContainer.querySelector('.a-price-whole');
            const priceFraction = priceContainer.querySelector('.a-price-fraction');
            
            if (priceWhole) {
              let wholeText = priceWhole.textContent || '';
              // Virgülleri kaldır (binlik ayırıcı)
              wholeText = wholeText.replace(/,/g, '');
              
              if (priceFraction) {
                const fractionText = priceFraction.textContent || '';
                price = `${wholeText}.${fractionText}`;
              } else {
                price = wholeText;
              }
            }
          }
          
          // Son çare: diğer selector'ları dene
          if (!price) {
            const primaryPriceSelectors = [
              '.a-price-whole',
              '.a-price .a-price-symbol + span'
            ];

            for (const selector of primaryPriceSelectors) {
              const priceElement = priceContainer.querySelector(selector);
              if (priceElement) {
                const priceText = priceElement.textContent || priceElement.getAttribute('aria-label') || '';
                // Virgülleri kaldır, sadece sayı ve noktayı koru
                const extractedPrice = priceText.trim().replace(/,/g, '').replace(/[^0-9.]/g, '');
                if (extractedPrice && !isNaN(parseFloat(extractedPrice))) {
                  price = extractedPrice;
                  break;
                }
              }
            }
          }

          // En son çare: tüm price elementlerini ara
          if (!price) {
            const allPriceElements = element.querySelectorAll('[class*="price"], [data-a-color="price"]');
            for (const priceEl of allPriceElements) {
              if (priceEl.closest('[data-cy="secondary-offer-recipe"]')) continue;
              const priceText = priceEl.textContent || priceEl.getAttribute('aria-label') || '';
              // Virgülleri kaldır, sadece sayı ve noktayı koru
              const extractedPrice = priceText.trim().replace(/,/g, '').replace(/[^0-9.]/g, '');
              if (extractedPrice && !isNaN(parseFloat(extractedPrice)) && parseFloat(extractedPrice) > 0) {
                price = extractedPrice;
                break;
              }
            }
          }

          const linkElement = element.querySelector('h2 a, a.a-link-normal');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : 'https://www.amazon.co.uk' + href;
          }

          const imageElement = element.querySelector('.s-image, img');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          if (title && link) {
            const product = {
              title,
              price: price || 'Fiyat bulunamadı',
              currency: 'TRY',
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

    console.log(`[AMAZON.UK] ${products.length} eşleşen ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[AMAZON.UK] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[AMAZON.UK] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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

module.exports = { searchAmazonUK };
