const express = require('express');
const cors = require('cors');
const { searchAmazon } = require('./scrapers/amazon');
const { searchAmazonAE } = require('./scrapers/amazon-ae');
const { searchAmazonDE } = require('./scrapers/amazon-de');
const { searchEbay } = require('./scrapers/ebay');
const { searchIdealo } = require('./scrapers/idealo');
const { searchNoon } = require('./scrapers/noon');

const app = express();
const PORT = process.env.PORT || 5001;
const AED_TO_USD_RATE = parseFloat(process.env.AED_TO_USD_RATE) || 0.2723;
const EUR_TO_TRY_RATE = parseFloat(process.env.EUR_TO_TRY_RATE) || 51.0;
const USD_TO_TRY_RATE = parseFloat(process.env.USD_TO_TRY_RATE) || 44.0;

// CORS ayarları
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// OPTIONS request'leri için özel handler
app.options('*', cors());

app.use(express.json());

app.post('/api/search', async (req, res) => {
  try {
    const { query, sites } = req.body;

    if (!query || !sites || sites.length === 0) {
      return res.status(400).json({ error: 'Query ve en az bir site seçilmelidir' });
    }

    const results = [];

    for (const site of sites) {
      try {
        let siteResults = [];
        
        if (site === 'amazon') {
          siteResults = await searchAmazon(query);
        } else if (site === 'amazon_ae') {
          siteResults = await searchAmazonAE(query);
        } else if (site === 'amazon_de') {
          siteResults = await searchAmazonDE(query);
        } else if (site === 'idealo') {
          siteResults = await searchIdealo(query);
        } else if (site === 'noon') {
          siteResults = await searchNoon(query);
        } else if (site === 'ebay') {
          siteResults = await searchEbay(query);
        }

        results.push({
          site,
          products: siteResults,
          success: true
        });
      } catch (error) {
        results.push({
          site,
          products: [],
          success: false,
          error: error.message
        });
      }
    }

    // Tüm ürünleri birleştir ve fiyatına göre sırala
    const allProducts = [];
    results.forEach(result => {
      if (result.success && result.products) {
        result.products.forEach(product => {
          let normalizedProduct = { ...product };
          if (product.currency && product.currency.toUpperCase() === 'AED') {
            const basePrice = parseFloat(product.price);
            if (!isNaN(basePrice)) {
              const usdPrice = basePrice * AED_TO_USD_RATE;
              normalizedProduct = {
                ...product,
                price: usdPrice.toFixed(2),
                currency: 'USD',
                originalPrice: product.price,
                originalCurrency: product.currency
              };
            }
          } else if (product.currency && product.currency.toUpperCase() === 'EUR') {
            const basePrice = parseFloat(product.price);
            if (!isNaN(basePrice)) {
              const tryPrice = Math.ceil((basePrice * EUR_TO_TRY_RATE) / 100) * 100;
              normalizedProduct = {
                ...product,
                price: tryPrice.toFixed(0),
                currency: 'TRY',
                originalPrice: product.price,
                originalCurrency: product.currency
              };
            }
          }
          if (normalizedProduct.currency && normalizedProduct.currency.toUpperCase() === 'USD') {
            const usdBase = parseFloat(normalizedProduct.price);
            if (!isNaN(usdBase)) {
              const tryPrice = Math.ceil((usdBase * USD_TO_TRY_RATE) / 100) * 100;
              normalizedProduct = {
                ...normalizedProduct,
                price: tryPrice.toFixed(0),
                currency: 'TRY',
                originalPrice: normalizedProduct.originalPrice || normalizedProduct.price,
                originalCurrency: normalizedProduct.originalCurrency || 'USD',
                usdPrice: usdBase.toFixed(2)
              };
            }
          }
          allProducts.push({
            ...normalizedProduct,
            site: result.site
          });
        });
      }
    });

    // Önce marka eşleşmesi, sonra kapasite/ifade eşleşmesi, yakınsa ucuz olan öne gelsin
    const normalizedQuery = (query || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const brandToken = normalizedQuery ? normalizedQuery.split(' ')[0] : null;
    const capacityMatch = normalizedQuery.match(/(\d+)\s*tb/);
    const capacityToken = capacityMatch ? `${capacityMatch[1]}tb` : null;

    allProducts.sort((a, b) => {
      const matchA = typeof a.matchPercent === 'number' ? a.matchPercent : 0;
      const matchB = typeof b.matchPercent === 'number' ? b.matchPercent : 0;
      const scoreA = typeof a.matchScore === 'number' ? a.matchScore : 0;
      const scoreB = typeof b.matchScore === 'number' ? b.matchScore : 0;
      const priceA = parseFloat(a.price) || Infinity;
      const priceB = parseFloat(b.price) || Infinity;

      const titleA = (a.title || '').toLowerCase().replace(/\s+/g, ' ');
      const titleB = (b.title || '').toLowerCase().replace(/\s+/g, ' ');
      const titleANormalized = titleA.replace(/\s+/g, '');
      const titleBNormalized = titleB.replace(/\s+/g, '');

      const brandMatchA = brandToken ? titleA.startsWith(brandToken) || titleA.includes(`${brandToken} `) : false;
      const brandMatchB = brandToken ? titleB.startsWith(brandToken) || titleB.includes(`${brandToken} `) : false;

      const exactPhraseA = normalizedQuery && titleA.includes(normalizedQuery);
      const exactPhraseB = normalizedQuery && titleB.includes(normalizedQuery);

      const capacityMatchA = capacityToken
        ? (titleANormalized.includes(capacityToken) || titleA.includes(capacityToken.replace('tb', ' tb')))
        : false;
      const capacityMatchB = capacityToken
        ? (titleBNormalized.includes(capacityToken) || titleB.includes(capacityToken.replace('tb', ' tb')))
        : false;

      const sponsoredA = Boolean(a.isSponsored);
      const sponsoredB = Boolean(b.isSponsored);

      if (sponsoredA !== sponsoredB) return sponsoredA ? 1 : -1;
      if (brandMatchA !== brandMatchB) return brandMatchA ? -1 : 1;
      if (capacityMatchA !== capacityMatchB) return capacityMatchA ? -1 : 1;
      if (exactPhraseA !== exactPhraseB) return exactPhraseA ? -1 : 1;

      const diff = Math.abs(matchA - matchB);
      if (diff <= 5 && priceA !== priceB) {
        return priceA - priceB;
      }

      if (matchA !== matchB) return matchB - matchA;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return priceA - priceB;
    });

    res.json({
      query,
      results,
      sortedProducts: allProducts
    });
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} zaten kullanımda. Lütfen başka bir port kullanın veya mevcut process'i durdurun.`);
    process.exit(1);
  } else {
    throw err;
  }
});
