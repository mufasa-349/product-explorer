const puppeteer = require('puppeteer');

function normalizePrice(text) {
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
}

async function searchTrovaprezzi(query) {
  let browser;
  try {
    console.log(`[TROVAPREZZI] Arama baslatiliyor: "${query}"`);

    browser = await puppeteer.launch({
      headless: false,
      slowMo: 10,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const searchUrl = `https://www.trovaprezzi.it/hard-disk-esterni/prezzi-scheda-prodotto/${encodeURIComponent(query)}`;
    console.log(`[TROVAPREZZI] Arama sayfasina gidiliyor: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[TROVAPREZZI] Urun elementleri aranıyor...');
    const products = await page.evaluate((searchQuery) => {
      const items = [];
      let productElements = Array.from(document.querySelectorAll('li.listing_item'));
      if (productElements.length === 0) {
        productElements = Array.from(document.querySelectorAll('.listing_item'));
      }

      const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      productElements.forEach((element) => {
        if (items.length >= 4) return;

        try {
          const titleElement = element.querySelector('.item_name, a.item_name');
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

          const priceElement = element.querySelector('.item_basic_price');
          const priceText = priceElement ? priceElement.textContent : '';
          const price = normalizePrice(priceText);

          const linkElement = element.querySelector('a.item_name, a.listing_item_button, a.item_image');
          let link = '';
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            link = href.startsWith('http') ? href : `https://www.trovaprezzi.it${href}`;
          }

          const imageElement = element.querySelector('.item_image img, img');
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

    console.log(`[TROVAPREZZI] ${products.length} urun bulundu`);

    await browser.close();

    if (products.length === 0) {
      console.log('[TROVAPREZZI] Ürün bulunamadı');
      throw new Error('Ürün bulunamadı');
    }

    console.log(`[TROVAPREZZI] Arama tamamlandi, ${products.length} urun donduruluyor`);
    return products;
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

module.exports = { searchTrovaprezzi };
