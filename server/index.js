const express = require('express');
const cors = require('cors');
const { searchAmazon } = require('./scrapers/amazon');
const { searchEbay } = require('./scrapers/ebay');

const app = express();
const PORT = process.env.PORT || 5001;

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
          allProducts.push({
            ...product,
            site: result.site
          });
        });
      }
    });

    // Fiyatına göre sırala (ucuzdan pahalıya)
    allProducts.sort((a, b) => {
      const priceA = parseFloat(a.price) || Infinity;
      const priceB = parseFloat(b.price) || Infinity;
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
