const puppeteer = require('puppeteer');

async function searchEbay(query) {
  let browser;
  try {
    console.log(`[EBAY] Arama başlatılıyor: "${query}"`);
    
    browser = await puppeteer.launch({
      headless: true,
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

    console.log(`[EBAY] Sayfa yüklendi, search bar kontrol ediliyor...`);
    
    // Sayfanın yüklenmesini bekle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Ürünleri çek
    console.log(`[EBAY] Ürün elementleri aranıyor...`);
    const products = await page.evaluate(() => {
      const items = [];
      const productElements = document.querySelectorAll('.s-item, .srp-results .s-item');

      console.log(`[EBAY] Bulunan element sayısı: ${productElements.length}`);

      productElements.forEach((element, index) => {
        if (index === 0 || index >= 11) return; // İlk eleman genelde reklam, sonraki 10 ürünü al

        try {
          // Ürün adı
          const titleElement = element.querySelector('.s-item__title, .s-item__title--tagblock');
          const title = titleElement ? titleElement.textContent.trim() : '';

          // Fiyat - farklı formatları dene
          const priceElement = element.querySelector('.s-item__price, .s-item__detail--primary');
          let price = '';
          if (priceElement) {
            const priceText = priceElement.textContent || '';
            // "$123.45" formatından sadece sayıları al
            price = priceText.trim().replace(/[^0-9.]/g, '');
          }

          // Link
          const linkElement = element.querySelector('.s-item__link, a.s-item__link');
          const link = linkElement ? linkElement.getAttribute('href') : '';

          // Resim
          const imageElement = element.querySelector('.s-item__image img, .s-item__image-wrapper img');
          const image = imageElement ? (imageElement.getAttribute('src') || imageElement.getAttribute('data-src')) : '';

          if (title && link && title !== 'Shop on eBay' && !title.includes('Shop on eBay')) {
            items.push({
              title,
              price: price || 'Fiyat bulunamadı',
              link,
              image
            });
          }
        } catch (error) {
          console.error('Ürün parse hatası:', error);
        }
      });

      return items;
    });
    
    console.log(`[EBAY] ${products.length} ürün bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log(`[EBAY] Ürün bulunamadı`);
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[EBAY] Arama tamamlandı, ${products.length} ürün döndürülüyor`);
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

module.exports = { searchEbay };
