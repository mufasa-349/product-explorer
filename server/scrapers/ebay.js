const puppeteer = require('puppeteer');

async function searchEbay(query) {
  let browser;
  try {
    console.log(`[EBAY] Arama başlatılıyor: "${query}"`);
    
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 120,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // User-Agent ayarla
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // eBay.com'a git (zip code 90075 ile)
    const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_stpos=90075`;
    console.log(`[EBAY] Siteye giriliyor: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log(`[EBAY] Sayfa yüklendi, sonuçlar hazırlanıyor...`);
    
    // Sayfanın yüklenmesini bekle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Ürünleri çek
    console.log(`[EBAY] Ürün elementleri aranıyor...`);
    const products = await page.evaluate(() => {
      const items = [];
      const nonSponsoredItems = [];
      const sponsoredItems = [];
      const productElements = document.querySelectorAll('li.s-card');

      console.log(`[EBAY] Bulunan element sayısı: ${productElements.length}`);

      productElements.forEach((element) => {
        if (nonSponsoredItems.length >= 4 && sponsoredItems.length >= 1) return;

        try {
          const titleElement = element.querySelector('.s-card__title .su-styled-text.primary, .s-card__title .su-styled-text');
          const title = titleElement ? titleElement.textContent.trim() : '';
          if (!title) return;

          const priceElement = element.querySelector('.s-card__price, .s-card__attribute-row .s-card__price');
          let price = '';
          if (priceElement) {
            const priceText = priceElement.textContent || '';
            price = priceText.trim().replace(/[^0-9.]/g, '');
          }

          const linkElement = element.querySelector('a.s-card__link');
          const link = linkElement ? linkElement.getAttribute('href') : '';

          const imageElement = element.querySelector('img.s-card__image, img');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          const sponsoredElement = element.querySelector('.s-card__footer [aria-hidden="true"], .s-card__footer [aria-label*="Sponsored"]');
          const isSponsored = Boolean(sponsoredElement) || (element.textContent || '').toLowerCase().includes('sponsored');

          if (title && link) {
            const product = {
              title,
              price: price || 'Fiyat bulunamadı',
              currency: 'USD',
              link,
              image,
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
    });
    
    console.log(`[EBAY] ${products.length} ürün bulundu`);

    // Debug için tarayıcıyı açık bırak
    // await browser.close();

    if (products.length === 0) {
      console.log(`[EBAY] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[EBAY] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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

module.exports = { searchEbay };
