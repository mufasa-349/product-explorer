const puppeteer = require('puppeteer');

async function setDeliveryZip(page, zip) {
  try {
    console.log(`[AMAZON] Delivery address butonu aranıyor...`);
    const locationSelectors = [
      '#nav-global-location-popover-link',
      '#nav-global-location-slot',
      '#glow-ingress-line2',
      '[data-csa-c-content-id="nav_cs_ap"]',
      'input[data-action-type="SELECT_LOCATION"]'
    ];
    let clicked = false;

    for (const selector of locationSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 8000, visible: true });
      } catch (e) {
        // Bu selector görünür değilse sıradakini dene
      }
      const el = await page.$(selector);
      if (el) {
        console.log(`[AMAZON] Delivery address butonu tıklanıyor: ${selector}`);
        await el.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      console.log(`[AMAZON] Delivery address butonu bulunamadı`);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    const zipInputSelector = '#GLUXZipUpdateInput, input[name="zipCode"], input[id*="Zip"]';
    const applyButtonSelector = '#GLUXZipUpdate, #GLUXZipUpdate-announce, button[data-action="glow"], button[type="submit"]';
    const continueButtonSelector = '#GLUXConfirmClose, #GLUXConfirmClose-announce, [data-action="GLUXConfirmAction"] #GLUXConfirmClose, [data-action="GLUXConfirmAction"] #GLUXConfirmClose-announce, button[data-action="confirm"], button[name="glowDoneButton"], #a-autoid-3-announce';

    console.log(`[AMAZON] Zip code input'u bekleniyor...`);
    await page.waitForSelector(zipInputSelector, { timeout: 10000 });
    const zipInput = await page.$(zipInputSelector);

    if (!zipInput) {
      console.log(`[AMAZON] Zip input bulunamadı`);
      return false;
    }

    console.log(`[AMAZON] Zip code input'una ${zip} giriliyor...`);
    await zipInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await zipInput.type(zip, { delay: 80 });
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log(`[AMAZON] Apply butonu tıklanıyor...`);
    const applyBtn = await page.$(applyButtonSelector);
    if (applyBtn) {
      await applyBtn.click();
    } else {
      console.log(`[AMAZON] Apply butonu bulunamadı`);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[AMAZON] Continue/Close adımı deneniyor...`);
    let closed = false;
    try {
      await page.waitForSelector(continueButtonSelector, { timeout: 6000 });
      const continueBtn = await page.$(continueButtonSelector);
      if (continueBtn) {
        console.log(`[AMAZON] Continue butonu tıklanıyor...`);
        await continueBtn.click();
        closed = true;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (e) {
      console.log(`[AMAZON] Continue butonu görünmedi, alternatif kapanış deneniyor...`);
    }

    if (!closed) {
      try {
        const closeSelector = 'button[aria-label="Close"], [data-action="a-popover-close"]';
        const closeBtn = await page.$(closeSelector);
        if (closeBtn) {
          console.log(`[AMAZON] Pop-up X butonu tıklanıyor...`);
          await closeBtn.click();
          closed = true;
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      } catch (e) {
        // noop
      }
    }

    if (!closed) {
      console.log(`[AMAZON] Pop-up dışına tıklama deneniyor...`);
      await page.mouse.click(5, 5);
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    console.log(`[AMAZON] Sayfa yenileniyor...`);
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });

    console.log(`[AMAZON] Delivery address ayarlama denemesi tamamlandı (${zip})`);
    return true;
  } catch (e) {
    console.log(`[AMAZON] Delivery address ayarlama hatası: ${e.message}`);
    return false;
  }
}

async function searchAmazon(query) {
  let browser;
  try {
    console.log(`[AMAZON] Arama başlatılıyor: "${query}"`);
    
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 120,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // User-Agent ayarla (bot olarak algılanmamak için)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Arama sayfasına git (ana sayfaya gitme)
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    console.log(`[AMAZON] Arama sayfasına gidiliyor: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Delivery address'i ayarla (US zip)
    await setDeliveryZip(page, '90075');

    console.log(`[AMAZON] Sayfa yüklendi, ürünler çekilmeye başlanıyor...`);
    
    // Ürün elementlerinin yüklenmesini bekle
    try {
      await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });
      console.log(`[AMAZON] Ürün elementleri yüklendi`);
    } catch (e) {
      console.log(`[AMAZON] Ürün elementleri için selector bulunamadı, alternatif deneniyor...`);
    }
    
    // Sayfanın tam yüklenmesini bekle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Ürünleri çek
    console.log(`[AMAZON] Ürün elementleri aranıyor...`);
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      const nonSponsoredItems = [];
      const sponsoredItems = [];
      // Önce ana selector'ı dene
      let productElements = document.querySelectorAll('[data-component-type="s-search-result"]');
      
      // Eğer bulunamazsa alternatif selector'ları dene
      if (productElements.length === 0) {
        productElements = document.querySelectorAll('.s-result-item[data-asin]');
      }
      if (productElements.length === 0) {
        productElements = document.querySelectorAll('[data-asin]:not([data-asin=""])');
      }
      if (productElements.length === 0) {
        productElements = document.querySelectorAll('.s-result-item');
      }

      console.log(`[AMAZON] Bulunan element sayısı: ${productElements.length}`);

      // Arama sorgusunu normalize et (küçük harfe çevir, boşlukları temizle)
      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);
      console.log(`[AMAZON] Arama sorgusu kelimeleri: ${queryWords.join(', ')}`);

      productElements.forEach((element, index) => {
        if (nonSponsoredItems.length >= 3 && sponsoredItems.length >= 1) return;

        try {
          // Ürün adı - farklı selector'ları dene
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
          
          if (index < 5) {
            console.log(`[AMAZON] Ürün ${index + 1} - Title: "${title.substring(0, 50)}..."`);
          }

          // Sponsored kontrolü
          const sponsoredElement = element.querySelector(
            '.s-sponsored-label-text, [data-component-type="sp-sponsored-result"], [data-csa-c-content-id*="sponsored"], [aria-label*="Sponsored"], [aria-label*="Gesponsert"]'
          );
          const isSponsored = Boolean(sponsoredElement) || (element.textContent || '').toLowerCase().includes('sponsored');

          // Ürün adının arama sorgusu ile eşleşme skorunu hesapla
          let matchScore = 0;
          let matchPercent = 0;
          if (title) {
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

            matchScore = matchedWords.length;
            matchPercent = queryWords.length > 0
              ? Math.round((matchedWords.length / queryWords.length) * 100)
              : 0;
          } else {
            if (index < 5) {
              console.log(`[AMAZON] Ürün ${index + 1} - Title bulunamadı`);
            }
            return;
          }

          // Fiyat - daha fazla selector dene
          let price = '';
          const priceContainer = element.querySelector('[data-cy="price-recipe"]') || element;
          const primaryPriceSelectors = [
            '.a-price .a-offscreen',
            '.a-price-whole',
            '.a-price .a-price-symbol + span'
          ];

          for (const selector of primaryPriceSelectors) {
            const priceElement = priceContainer.querySelector(selector);
            if (priceElement) {
              const priceText = priceElement.textContent || priceElement.getAttribute('aria-label') || priceElement.innerText || '';
              const extractedPrice = priceText.trim().replace(/[^0-9.]/g, '');
              if (extractedPrice && !isNaN(parseFloat(extractedPrice))) {
                price = extractedPrice;
                break;
              }
            }
          }

          // Eğer hala fiyat bulunamadıysa, ikincil teklif bloklarını hariç tutarak ara
          if (!price) {
            const allPriceElements = element.querySelectorAll('[class*="price"], [data-a-color="price"]');
            for (const priceEl of allPriceElements) {
              if (priceEl.closest('[data-cy="secondary-offer-recipe"]')) continue;
              const priceText = priceEl.textContent || priceEl.getAttribute('aria-label') || '';
              const extractedPrice = priceText.trim().replace(/[^0-9.]/g, '');
              if (extractedPrice && !isNaN(parseFloat(extractedPrice)) && parseFloat(extractedPrice) > 0) {
                price = extractedPrice;
                break;
              }
            }
          }

          // Link
          const linkElement = element.querySelector('h2 a, a.a-link-normal');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : 'https://www.amazon.com' + href;
          } else {
            if (index < 5) {
              console.log(`[AMAZON] Ürün ${index + 1} - Link bulunamadı`);
            }
          }

          // Resim
          const imageElement = element.querySelector('.s-image, img');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          if (title && link) {
            if (nonSponsoredItems.length < 3) {
              console.log(`[AMAZON] Ürün eklendi: "${title.substring(0, 40)}..." - Fiyat: ${price || 'Bulunamadı'} - Eşleşme: ${matchScore}/${queryWords.length} (${matchPercent}%)`);
            }
            const product = {
              title,
              price: price || 'Fiyat bulunamadı',
              link,
              image,
              matchScore,
              matchPercent,
              isSponsored
            };
            if (isSponsored) {
              if (sponsoredItems.length < 1) sponsoredItems.push(product);
            } else {
              if (nonSponsoredItems.length < 3) nonSponsoredItems.push(product);
            }
          } else {
            if (index < 5) {
              if (!title) console.log(`[AMAZON] Ürün ${index + 1} atlandı - Title yok`);
              if (!link) console.log(`[AMAZON] Ürün ${index + 1} atlandı - Link yok`);
            }
          }
        } catch (error) {
          console.error('Ürün parse hatası:', error);
        }
      });

      items.push(...nonSponsoredItems, ...sponsoredItems);
      return items;
    }, query);
    
    console.log(`[AMAZON] ${products.length} eşleşen ürün bulundu`);

    // Debug için tarayıcıyı açık bırak
    // await browser.close();

    if (products.length === 0) {
      console.log(`[AMAZON] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[AMAZON] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
    return products;
  } catch (error) {
    // Debug için tarayıcıyı açık bırak
    // if (browser) {
    //   await browser.close();
    // }
    
    // Erişim engeli kontrolü
    if (error.message.includes('timeout') || error.message.includes('Navigation')) {
      throw new Error('Siteye erişilemedi');
    }
    
    throw error;
  }
}

module.exports = { searchAmazon };
