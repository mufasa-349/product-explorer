const puppeteer = require('puppeteer');

async function searchAmazon(query) {
  let browser;
  try {
    console.log(`[AMAZON] Arama başlatılıyor: "${query}"`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // User-Agent ayarla (bot olarak algılanmamak için)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Önce ana sayfaya git
    console.log(`[AMAZON] Ana sayfaya gidiliyor...`);
    await page.goto('https://www.amazon.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Delivery address'i ayarla
    try {
      console.log(`[AMAZON] Delivery address butonu tıklanıyor...`);
      await page.waitForSelector('#nav-global-location-popover-link', { timeout: 10000 });
      await page.click('#nav-global-location-popover-link');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`[AMAZON] Zip code input'una 90075 giriliyor...`);
      await page.waitForSelector('#GLUXZipUpdateInput', { timeout: 10000 });
      await page.click('#GLUXZipUpdateInput', { clickCount: 3 }); // Mevcut değeri seç
      await page.type('#GLUXZipUpdateInput', '90075');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`[AMAZON] Apply butonu tıklanıyor...`);
      await page.waitForSelector('#GLUXZipUpdate', { timeout: 10000 });
      await page.click('#GLUXZipUpdate');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(`[AMAZON] Delivery address ayarlandı (90075)`);
    } catch (e) {
      console.log(`[AMAZON] Delivery address ayarlama hatası: ${e.message}`);
    }
    
    // Arama sayfasına git
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    console.log(`[AMAZON] Arama sayfasına gidiliyor: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log(`[AMAZON] Sayfa yüklendi, delivery address kontrol ediliyor...`);
    
    // Mevcut delivery address'i kontrol et
    const currentAddress = await page.evaluate(() => {
      const addressText = document.querySelector('#glow-ingress-line2, #nav-global-location-slot .nav-line-2')?.textContent || '';
      const zipMatch = addressText.match(/\d{5}/);
      const isUS = addressText.toLowerCase().includes('united states') || 
                   addressText.toLowerCase().includes('usa') ||
                   addressText.toLowerCase().includes('los angeles') ||
                   zipMatch !== null;
      return {
        text: addressText,
        zip: zipMatch ? zipMatch[0] : null,
        isUS: isUS
      };
    });
    
    console.log(`[AMAZON] Mevcut delivery address: "${currentAddress.text}" - Zip: ${currentAddress.zip || 'Bulunamadı'} - US: ${currentAddress.isUS}`);
    
    // Delivery address'in güncellendiğini kontrol et
    const updatedAddress = await page.evaluate(() => {
      const addressText = document.querySelector('#glow-ingress-line2, #nav-global-location-slot .nav-line-2')?.textContent || '';
      const zipMatch = addressText.match(/\d{5}/);
      const isUS = addressText.toLowerCase().includes('united states') || 
                   addressText.toLowerCase().includes('usa') ||
                   addressText.toLowerCase().includes('los angeles') ||
                   zipMatch !== null;
      return {
        text: addressText,
        zip: zipMatch ? zipMatch[0] : null,
        isUS: isUS
      };
    });
    
    console.log(`[AMAZON] Delivery address kontrol: "${updatedAddress.text}" - Zip: ${updatedAddress.zip || 'Bulunamadı'} - US: ${updatedAddress.isUS}`);
    
    // Eğer hala US değilse, delivery address butonuna tıkla
    if (!updatedAddress.isUS || updatedAddress.zip !== '90075') {
      console.log(`[AMAZON] Delivery address hala güncellenmedi, tekrar deneniyor...`);
      
      try {
        const deliveryButton = await page.$('#nav-global-location-slot, #glow-ingress-line2, [data-csa-c-content-id="nav_cs_ap"]');
        if (deliveryButton) {
          console.log(`[AMAZON] Delivery address butonu bulundu, tıklanıyor...`);
          await deliveryButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Pop-up içindeki elementleri kontrol et
          const popupInfo = await page.evaluate(() => {
            const countrySelect = document.querySelector('#GLUXCountryList, select[name="countryCode"], select[id*="Country"]');
            const zipInput = document.querySelector('#GLUXZipUpdateInput, input[name="zipCode"], input[id*="Zip"]');
            const applyBtn = document.querySelector('#GLUXZipUpdate-announce, button[data-action="glow"], button[type="submit"]');
            return {
              hasCountrySelect: !!countrySelect,
              hasZipInput: !!zipInput,
              hasApplyBtn: !!applyBtn
            };
          });
          
          console.log(`[AMAZON] Pop-up içeriği - Country Select: ${popupInfo.hasCountrySelect}, Zip Input: ${popupInfo.hasZipInput}, Apply Button: ${popupInfo.hasApplyBtn}`);
          
          // Ülke seç
          if (popupInfo.hasCountrySelect) {
            await page.evaluate(() => {
              const countrySelect = document.querySelector('#GLUXCountryList, select[name="countryCode"], select[id*="Country"]');
              if (countrySelect) {
                countrySelect.value = 'US';
                countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Zip code gir
          if (popupInfo.hasZipInput) {
            const zipInput = await page.$('#GLUXZipUpdateInput, input[name="zipCode"], input[id*="Zip"]');
            if (zipInput) {
              await zipInput.click({ clickCount: 3 });
              await zipInput.type('90075', { delay: 100 });
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          // Apply butonuna tıkla
          if (popupInfo.hasApplyBtn) {
            const applyBtn = await page.$('#GLUXZipUpdate-announce, button[data-action="glow"], button[type="submit"]');
            if (applyBtn) {
              await applyBtn.click();
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        }
      } catch (e) {
        console.log(`[AMAZON] Delivery address güncelleme hatası: ${e.message}`);
      }
    }
    
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
        if (index >= 20) return; // Daha fazla ürün kontrol et

        try {
          // Ürün adı - farklı selector'ları dene
          const titleElement = element.querySelector('h2 a span, h2 span, .s-title-instructions-style span, a.a-link-normal span, h2 a');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          if (index < 5) {
            console.log(`[AMAZON] Ürün ${index + 1} - Title: "${title.substring(0, 50)}..."`);
          }

          // Ürün adının arama sorgusu ile eşleşmesini kontrol et
          if (title) {
            const normalizedTitle = title.toLowerCase();
            // Sayıları normalize et (8tb -> 8 tb, 870 -> 870) - hem yan yana hem ayrı olabilir
            const normalizedTitleForMatch = normalizedTitle
              .replace(/(\d+)([a-z]+)/gi, '$1 $2')  // 8tb -> 8 tb
              .replace(/([a-z]+)(\d+)/gi, '$1 $2'); // tb8 -> tb 8
            
            // Her kelimeyi kontrol et
            const allWordsMatch = queryWords.every(word => {
              const wordLower = word.toLowerCase();
              // Direkt eşleşme
              if (normalizedTitle.includes(wordLower)) return true;
              // Normalize edilmiş versiyonda eşleşme
              if (normalizedTitleForMatch.includes(wordLower)) return true;
              // Sayıları ayrı kontrol et (8tb -> 8 ve tb)
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
            
            if (!allWordsMatch && index < 5) {
              const missingWords = queryWords.filter(word => {
                const wordLower = word.toLowerCase();
                const normalizedTitleForMatch = normalizedTitle
                  .replace(/(\d+)([a-z]+)/gi, '$1 $2')
                  .replace(/([a-z]+)(\d+)/gi, '$1 $2');
                if (wordLower.match(/^\d+[a-z]+$/)) {
                  const numMatch = wordLower.match(/^(\d+)([a-z]+)$/);
                  if (numMatch) {
                    const num = numMatch[1];
                    const unit = numMatch[2];
                    return !(normalizedTitle.includes(num) && normalizedTitle.includes(unit));
                  }
                }
                return !normalizedTitle.includes(wordLower) && !normalizedTitleForMatch.includes(wordLower);
              });
              console.log(`[AMAZON] Ürün ${index + 1} eşleşmedi - Eksik kelimeler: ${missingWords.join(', ')}`);
              return; // Eşleşmiyorsa atla
            }
            
            if (!allWordsMatch) {
              return; // Eşleşmiyorsa atla
            }
          } else {
            if (index < 5) {
              console.log(`[AMAZON] Ürün ${index + 1} - Title bulunamadı`);
            }
          }

          // Fiyat - daha fazla selector dene
          let price = '';
          const priceSelectors = [
            '.a-price .a-offscreen',
            '.a-price-whole',
            '.a-price .a-price-symbol + span',
            'span.a-price',
            '.a-price',
            '[data-a-color="price"] .a-offscreen',
            '.a-price-range .a-offscreen',
            '.a-price-range .a-price-whole'
          ];
          
          for (const selector of priceSelectors) {
            const priceElement = element.querySelector(selector);
            if (priceElement) {
              const priceText = priceElement.textContent || priceElement.getAttribute('aria-label') || priceElement.innerText || '';
              const extractedPrice = priceText.trim().replace(/[^0-9.]/g, '');
              if (extractedPrice && !isNaN(parseFloat(extractedPrice))) {
                price = extractedPrice;
                break;
              }
            }
          }

          // Eğer hala fiyat bulunamadıysa, tüm fiyat elementlerini kontrol et
          if (!price) {
            const allPriceElements = element.querySelectorAll('[class*="price"], [data-a-color="price"]');
            for (const priceEl of allPriceElements) {
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

          if (title && link && items.length < 10) {
            if (items.length < 3) {
              console.log(`[AMAZON] Ürün eklendi: "${title.substring(0, 40)}..." - Fiyat: ${price || 'Bulunamadı'}`);
            }
            items.push({
              title,
              price: price || 'Fiyat bulunamadı',
              link,
              image
            });
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

      return items;
    }, query);
    
    console.log(`[AMAZON] ${products.length} eşleşen ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[AMAZON] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[AMAZON] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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
