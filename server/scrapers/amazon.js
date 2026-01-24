const puppeteer = require('puppeteer');

async function setDeliveryZip(page, zip, onLog = null) {
  const log = onLog || ((msg) => console.log(msg));
  const locationSelectors = [
    '#nav-global-location-popover-link',
    '#nav-global-location-slot',
    '#glow-ingress-line2',
    '[data-csa-c-content-id="nav_cs_ap"]',
    'input[data-action-type="SELECT_LOCATION"]',
    '#nav-global-location-popover-link span',
    '#nav-global-location-slot span',
    'a#nav-global-location-popover-link',
    'span#glow-ingress-line2',
    '[id*="location"]',
    '[aria-label*="Deliver to"]',
    '[aria-label*="deliver to"]',
    '[aria-label*="Select a location"]',
    'a[href*="glow=changeLocation"]',
    '[data-csa-c-slot-id="nav_cs_ap"]'
  ];

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      log(`[AMAZON] Delivery address butonu aranıyor (Deneme ${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      let clicked = false;
      
      // Sadece selektörleri tek tek dene ve logla
      for (const selector of locationSelectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            log(`[AMAZON] Buton bulundu: ${selector}, tıklanıyor...`);
            
            // Elementi görünür kılmak için scroll (JS ile en garantisi)
            await page.evaluate((sel) => {
              const elem = document.querySelector(sel);
              if (elem) elem.scrollIntoView({ behavior: 'auto', block: 'center' });
            }, selector);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Hem normal hem JS ile tıklamayı dene
            try {
              await el.click();
            } catch (clickErr) {
              await page.evaluate((sel) => {
                const elem = document.querySelector(sel);
                if (elem) elem.click();
              }, selector);
            }
            
            clicked = true;
            break;
          }
        } catch (e) {
          continue; 
        }
      }

      // XPath son çare
      if (!clicked) {
        const xpathSelectors = [
          "//a[contains(@id, 'location')]",
          "//span[contains(text(), 'Deliver to')]",
          "//span[contains(text(), 'deliver to')]",
          "//*[contains(@data-csa-c-content-id, 'nav_cs_ap')]"
        ];
        for (const xpath of xpathSelectors) {
          try {
            const elements = await page.$x(xpath);
            if (elements.length > 0) {
              log(`[AMAZON] XPath ile buton bulundu: ${xpath}, tıklanıyor...`);
              await elements[0].click();
              clicked = true;
              break;
            }
          } catch (e) { continue; }
        }
      }

      if (clicked) {
        log(`[AMAZON] Pop-up açıldı, zip kodu giriliyor...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const zipInputSelector = '#GLUXZipUpdateInput, input[name="zipCode"], input[id*="Zip"]';
        const applyButtonSelector = '#GLUXZipUpdate, #GLUXZipUpdate-announce, button[data-action="glow"]';
        
        try {
          await page.waitForSelector(zipInputSelector, { timeout: 7000 });
          const zipInput = await page.$(zipInputSelector);
          if (zipInput) {
            await zipInput.click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await zipInput.type(zip, { delay: 60 });
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const applyBtn = await page.$(applyButtonSelector);
            if (applyBtn) {
              await applyBtn.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const doneButtons = [
                '#GLUXConfirmClose', 
                '#GLUXConfirmClose-announce', 
                'button[name="glowDoneButton"]',
                '.a-popover-footer button'
              ];
              
              for (const doneSel of doneButtons) {
                try {
                  const doneBtn = await page.$(doneSel);
                  if (doneBtn) {
                    await doneBtn.click();
                    log(`[AMAZON] Zip başarıyla ayarlandı.`);
                    break;
                  }
                } catch (e) {}
              }
              
              await new Promise(resolve => setTimeout(resolve, 1500));
              await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
              return true;
            }
          }
        } catch (e) {
          log(`[AMAZON] Zip girişi sırasında hata: ${e.message}`);
        }
      }

      log(`[AMAZON] Buton bulunamadı, sayfa yenileniyor (Deneme ${retryCount + 1})...`);
      retryCount++;
      if (retryCount < maxRetries) {
        await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      }
    } catch (err) {
      log(`[AMAZON] Hata oluştu: ${err.message}`);
      retryCount++;
    }
  }

  log(`[AMAZON] Delivery address ayarlanamadı.`);
  return false;
}

async function searchAmazon(query, onLog = null) {
  const log = onLog || ((msg) => console.log(msg));
  let browser;
  try {
    log(`[AMAZON] Arama başlatılıyor: "${query}"`);
    
    // DEBUG modunda görünür, production'da headless
    // Sadece DEBUG=true olduğunda görünür mod
    const isDebugMode = process.env.DEBUG === 'true';
    const puppeteerArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
    
    // Production'da görsel gereksiz argümanları ekleme
    if (isDebugMode) {
      puppeteerArgs.push('--start-maximized');
    }
    
    browser = await puppeteer.launch({
      headless: !isDebugMode, // Sadece DEBUG=true olduğunda görünür
      slowMo: isDebugMode ? 50 : 0, // Production'da hızlı, debug'da yavaş
      args: puppeteerArgs
    });

    const page = await browser.newPage();
    
    // Sayfa boyutunu ayarla (tam ekran görünüm için)
    await page.setViewport({ width: 1920, height: 1080 });
    
    // User-Agent ayarla (bot olarak algılanmamak için)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Arama sayfasına git (ana sayfaya gitme)
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    log(`[AMAZON] Arama sayfasına gidiliyor: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 60000 // Timeout süresini artırdık
    });

    // Bot detection için sayfayı yenile
    log(`[AMAZON] Bot detection için sayfa yenileniyor...`);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Biraz daha bekle
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }); // Timeout artırıldı
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delivery address'i ayarla (US zip)
    const deliverySet = await setDeliveryZip(page, '90075', onLog);
    if (!deliverySet) {
      log(`[AMAZON] UYARI: Delivery address ayarlanamadı, yine de ürün aramaya çalışılıyor...`);
    } else {
      log(`[AMAZON] Delivery address başarıyla ayarlandı.`);
    }

    log(`[AMAZON] Sayfa kontrol ediliyor...`);
    
    // Captcha kontrolü
    const isCaptcha = await page.evaluate(() => {
      return document.body.innerHTML.includes('type below characters') || 
             document.body.innerHTML.includes('Robot Check') ||
             document.querySelector('input#captchacharacters');
    });

    if (isCaptcha) {
      log(`[AMAZON] HATA: Captcha algılandı, atlanıyor...`);
      throw new Error('Captcha algılandı');
    }

    log(`[AMAZON] Ürünler çekilmeye başlanıyor...`);
    
    // Ürün elementlerinin yüklenmesini bekle
    try {
      await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });
      log(`[AMAZON] Ürün elementleri yüklendi`);
    } catch (e) {
      log(`[AMAZON] Ürün elementleri için selector bulunamadı, alternatif deneniyor...`);
    }
    
    // Sayfanın tam yüklenmesini bekle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Ürünleri çek
    log(`[AMAZON] Ürün elementleri aranıyor...`);
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
        if (nonSponsoredItems.length >= 4 && sponsoredItems.length >= 1) return;

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
          let currency = '';
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
                currency = 'USD';
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
                currency = 'USD';
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
            if (nonSponsoredItems.length < 4) {
              console.log(`[AMAZON] Ürün eklendi: "${title.substring(0, 40)}..." - Fiyat: ${price || 'Bulunamadı'} - Eşleşme: ${matchScore}/${queryWords.length} (${matchPercent}%)`);
            }
            const product = {
              title,
              price: price || 'Fiyat bulunamadı',
              currency: currency || 'USD',
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
    
    log(`[AMAZON] ${products.length} eşleşen ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      log(`[AMAZON] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    log(`[AMAZON] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
    return products;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    // Erişim engeli kontrolü
    if (error.message.includes('timeout') || error.message.includes('Navigation')) {
      throw new Error('Siteye erişilemedi');
    }
    
    throw error;
  }
}

module.exports = { searchAmazon };
