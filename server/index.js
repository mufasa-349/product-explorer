const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Jimp = require('jimp');
const crypto = require('crypto');
const { searchAmazon } = require('./scrapers/amazon');
const { searchAmazonAE } = require('./scrapers/amazon-ae');
const { searchAmazonDE } = require('./scrapers/amazon-de');
const { searchAmazonUK } = require('./scrapers/amazon-uk');
const { searchAmazonFR } = require('./scrapers/amazon-fr');
const { searchAmazonIT } = require('./scrapers/amazon-it');
const { searchAmazonNL } = require('./scrapers/amazon-nl');
const { searchAmazonES } = require('./scrapers/amazon-es');
const { searchTrovaprezzi } = require('./scrapers/trovaprezzi');
const { searchEbay } = require('./scrapers/ebay');
const { searchIdealo } = require('./scrapers/idealo');
const { searchIdealoFR } = require('./scrapers/idealo-fr');
const { searchNoon } = require('./scrapers/noon');
const { searchPricena } = require('./scrapers/pricena');
const { searchEmag } = require('./scrapers/emag');
const { searchEmagRO } = require('./scrapers/emag-ro');
const { searchToppreise } = require('./scrapers/toppreise');
const { searchDigitec } = require('./scrapers/digitec');
const { searchPazaruvaj } = require('./scrapers/pazaruvaj');
const { searchTechnomarket } = require('./scrapers/technomarket');
const { searchTechnopolis } = require('./scrapers/technopolis');
const { searchSkroutz } = require('./scrapers/skroutz');
const { searchAkakce } = require('./scrapers/akakce');

const app = express();
const PORT = process.env.PORT || 5001;
const AED_TO_USD_RATE = parseFloat(process.env.AED_TO_USD_RATE) || 0.2723;
const EUR_TO_TRY_RATE = parseFloat(process.env.EUR_TO_TRY_RATE) || 51.0;
const USD_TO_TRY_RATE = parseFloat(process.env.USD_TO_TRY_RATE) || 44.0;
const CHF_TO_TRY_RATE = parseFloat(process.env.CHF_TO_TRY_RATE) || 53.8;
const RON_TO_TRY_RATE = parseFloat(process.env.RON_TO_TRY_RATE) || 9.9;
const MAX_CONCURRENT_SEARCHES = parseInt(process.env.MAX_CONCURRENT_SEARCHES, 10) || 1;
let activeSearches = 0;
const searchQueue = [];

// Kuyruğu işleyen fonksiyon
function processNextInQueue() {
  if (activeSearches < MAX_CONCURRENT_SEARCHES && searchQueue.length > 0) {
    const nextSearch = searchQueue.shift();
    activeSearches++;
    
    // Sıradaki kullanıcıya başladığımızı haber ver
    nextSearch.onStart();
    
    // Aramayı çalıştır
    nextSearch.run().finally(() => {
      activeSearches--;
      processNextInQueue(); // Bir sonrakine geç
    });
    
    // Kalanlara sıralarını güncelle
    updateQueuePositions();
  }
}

function updateQueuePositions() {
  searchQueue.forEach((item, index) => {
    item.onQueueUpdate(index + 1);
  });
}

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenen formatlar: JPEG, PNG, GIF, WebP, AVIF'));
    }
  }
});
const imageStore = new Map();
const IMAGE_TTL_MS = 10 * 60 * 1000;

const putImageBuffer = (buffer) => {
  const token = crypto.randomUUID();
  imageStore.set(token, { buffer, expiresAt: Date.now() + IMAGE_TTL_MS });
  return token;
};

const takeImageBuffer = (token) => {
  if (!token) return null;
  const entry = imageStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    imageStore.delete(token);
    return null;
  }
  imageStore.delete(token);
  return entry.buffer;
};

async function computeImageHash(buffer) {
  const image = await Jimp.read(buffer);
  image.resize(8, 8).grayscale();
  const pixels = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const { r } = Jimp.intToRGBA(image.getPixelColor(x, y));
      pixels.push(r);
    }
  }
  const avg = pixels.reduce((sum, val) => sum + val, 0) / pixels.length;
  return pixels.map(val => (val >= avg ? '1' : '0')).join('');
}

function hammingDistance(hashA, hashB) {
  if (!hashA || !hashB || hashA.length !== hashB.length) return null;
  let diff = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) diff += 1;
  }
  return diff;
}

async function fetchImageBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Image fetch failed');
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function addImageSimilarity(allProducts, inputImageBuffer) {
  if (!inputImageBuffer) return;
  const inputHash = await computeImageHash(inputImageBuffer);
  await Promise.all(allProducts.map(async (product) => {
    if (!product.image) return;
    try {
      const imageBuffer = await fetchImageBuffer(product.image);
      const productHash = await computeImageHash(imageBuffer);
      const distance = hammingDistance(inputHash, productHash);
      if (distance !== null) {
        const similarity = Math.round((1 - distance / inputHash.length) * 100);
        product.imageSimilarity = similarity;
      }
    } catch (e) {
      // Görsel alınamazsa skor ekleme
    }
  }));
}

async function runSearch(query, sites, options = {}) {
  const logs = [];
  const progress = {
    visited: 0,
    total: sites.length,
    products: 0
  };
  const onLog = options.onLog || ((message) => logs.push(message));
  const onProgress = options.onProgress || ((data) => Object.assign(progress, data));
  const onPartialResults = options.onPartialResults || (() => {});
  const emitProgress = (extra = {}) => onProgress({ ...progress, ...extra });
  const SITE_TIMEOUT_MS = 120000; // Amazon ve ağır siteler için süreyi 120 saniyeye çıkardık

  const withTimeout = (promise, site) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${site} timeout oldu, atlanıyor`));
      }, SITE_TIMEOUT_MS);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };

  const results = [];

  for (const site of sites) {
    try {
      emitProgress({ currentSite: site });
      onLog(`[${site.toUpperCase()}] Arama başlatılıyor`);
      let siteResults = [];
      if (site === 'amazon') {
        siteResults = await withTimeout(searchAmazon(query, onLog), site);
      } else if (site === 'amazon_ae') {
        siteResults = await withTimeout(searchAmazonAE(query), site);
      } else if (site === 'amazon_de') {
        siteResults = await withTimeout(searchAmazonDE(query), site);
      } else if (site === 'amazon_uk') {
        siteResults = await withTimeout(searchAmazonUK(query), site);
      } else if (site === 'amazon_fr') {
        siteResults = await withTimeout(searchAmazonFR(query), site);
      } else if (site === 'amazon_it') {
        siteResults = await withTimeout(searchAmazonIT(query), site);
      } else if (site === 'amazon_nl') {
        siteResults = await withTimeout(searchAmazonNL(query), site);
      } else if (site === 'amazon_es') {
        siteResults = await withTimeout(searchAmazonES(query), site);
      } else if (site === 'trovaprezzi') {
        siteResults = await withTimeout(searchTrovaprezzi(query), site);
      } else if (site === 'idealo') {
        siteResults = await withTimeout(searchIdealo(query), site);
      } else if (site === 'idealo_fr') {
        siteResults = await withTimeout(searchIdealoFR(query), site);
      } else if (site === 'noon') {
        siteResults = await withTimeout(searchNoon(query), site);
      } else if (site === 'pricena') {
        siteResults = await withTimeout(searchPricena(query), site);
      } else if (site === 'emag') {
        siteResults = await withTimeout(searchEmag(query), site);
      } else if (site === 'emag_ro') {
        siteResults = await withTimeout(searchEmagRO(query), site);
      } else if (site === 'toppreise') {
        siteResults = await withTimeout(searchToppreise(query), site);
      } else if (site === 'digitec') {
        siteResults = await withTimeout(searchDigitec(query), site);
      } else if (site === 'pazaruvaj') {
        siteResults = await withTimeout(searchPazaruvaj(query), site);
      } else if (site === 'technomarket') {
        siteResults = await withTimeout(searchTechnomarket(query), site);
      } else if (site === 'technopolis') {
        siteResults = await withTimeout(searchTechnopolis(query), site);
      } else if (site === 'skroutz') {
        siteResults = await withTimeout(searchSkroutz(query), site);
      } else if (site === 'akakce') {
        siteResults = await withTimeout(searchAkakce(query), site);
      } else if (site === 'ebay') {
        siteResults = await withTimeout(searchEbay(query), site);
      }

      results.push({
        site,
        products: siteResults,
        success: true
      });
      onLog(`[${site.toUpperCase()}] ${siteResults.length} ürün bulundu`);
    } catch (error) {
      results.push({
        site,
        products: [],
        success: false,
        error: error.message
      });
      onLog(`[${site.toUpperCase()}] Hata: ${error.message}`);
    }

    progress.visited += 1;
    progress.products = results.reduce((sum, result) => sum + (result.products?.length || 0), 0);
    emitProgress({ currentSite: site });

    // Her site sonrası ara sonuçları gönder
    const partialAllProducts = [];
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
          } else if (product.currency && (product.currency.toUpperCase() === 'EUR' || (result.site === 'amazon_uk' && parseFloat(product.price) < 2000))) {
            const basePrice = parseFloat(product.price);
            if (!isNaN(basePrice)) {
              const tryPrice = Math.ceil((basePrice * EUR_TO_TRY_RATE) / 100) * 100;
              normalizedProduct = {
                ...product,
                price: tryPrice.toFixed(0),
                currency: 'TRY',
                originalPrice: product.price,
                originalCurrency: (result.site === 'amazon_uk' && product.currency === 'TRY') ? 'EUR' : product.currency
              };
            }
          } else if (product.currency && product.currency.toUpperCase() === 'CHF') {
            const basePrice = parseFloat(product.price);
            if (!isNaN(basePrice)) {
              const tryPrice = Math.ceil((basePrice * CHF_TO_TRY_RATE) / 100) * 100;
              normalizedProduct = {
                ...product,
                price: tryPrice.toFixed(0),
                currency: 'TRY',
                originalPrice: product.price,
                originalCurrency: product.currency
              };
            }
          } else if (product.currency && product.currency.toUpperCase() === 'RON') {
            const basePrice = parseFloat(product.price);
            if (!isNaN(basePrice)) {
              const tryPrice = Math.ceil((basePrice * RON_TO_TRY_RATE) / 100) * 100;
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
          partialAllProducts.push({
            ...normalizedProduct,
            site: result.site
          });
        });
      }
    });

    onPartialResults({
      query,
      results: [...results],
      sortedProducts: [...partialAllProducts]
    });
  }

  // Tüm siteler bittiğinde resim benzerliğini ekle (isteğe bağlı)
  if (options.imageBuffer && allProducts.length > 0) {
    try {
      await addImageSimilarity(allProducts, options.imageBuffer);
    } catch (e) {
      // noop
    }
  }

  return {
    query,
    results,
    sortedProducts: allProducts,
    imageWarning: null,
    logs,
    progress
  };
}

app.post('/api/search', upload.single('image'), async (req, res) => {
  try {
    const rawQuery = req.body.query;
    const rawSites = req.body.sites;
    const query = typeof rawQuery === 'string' ? rawQuery : '';
    const sites = typeof rawSites === 'string' ? JSON.parse(rawSites) : rawSites;

    if (!query || !sites || sites.length === 0) {
      return res.status(400).json({ error: 'Query ve en az bir site seçilmelidir' });
    }

    if (activeSearches >= MAX_CONCURRENT_SEARCHES) {
      return res.status(429).json({ error: 'Sunucu şu anda meşgul, lütfen biraz sonra tekrar deneyin' });
    }

    activeSearches += 1;
    let searchResult;
    try {
      searchResult = await runSearch(query, sites, {
        imageBuffer: req.file?.buffer
      });
    } finally {
      activeSearches = Math.max(activeSearches - 1, 0);
    }

    res.json(searchResult);
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

app.post('/api/image/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Görsel bulunamadı' });
    }
    
    // WebP formatını JPG'ye dönüştür
    let imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype || '';
    
    if (mimeType === 'image/webp' || mimeType === 'image/avif') {
      try {
        const image = await Jimp.read(imageBuffer);
        imageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
      } catch (convertError) {
        // Dönüştürme başarısız olursa orijinal buffer'ı kullan
        console.log('[IMAGE] Format dönüştürme hatası, orijinal format kullanılıyor:', convertError.message);
      }
    }
    
    const token = putImageBuffer(imageBuffer);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

app.get('/api/search/stream', async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query : '';
  const sites = req.query.sites ? JSON.parse(req.query.sites) : [];
  const imageToken = typeof req.query.imageToken === 'string' ? req.query.imageToken : '';

  if (!query || !sites || sites.length === 0) {
    return res.status(400).json({ error: 'Query ve en az bir site seçilmelidir' });
  }

  if (activeSearches >= MAX_CONCURRENT_SEARCHES) {
    return res.status(429).json({ error: 'Sunucu şu anda meşgul, lütfen biraz sonra tekrar deneyin' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering'i devre dışı bırak
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    try {
      if (res.destroyed) return;
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      if (typeof res.flush === 'function') res.flush();
    } catch (err) {
      if (!res.destroyed) console.error('Event send error:', err);
    }
  };

  const startSearchTask = async () => {
    try {
      const imageBuffer = takeImageBuffer(imageToken);
      const searchResult = await runSearch(query, sites, {
        onLog: (message) => sendEvent('log', { message }),
        onProgress: (progress) => sendEvent('progress', progress),
        onPartialResults: (results) => sendEvent('partial_results', results),
        imageBuffer
      });

      sendEvent('done', searchResult);
      res.end();
    } catch (error) {
      sendEvent('error', { message: error.message });
      res.end();
    }
  };

  if (activeSearches < MAX_CONCURRENT_SEARCHES) {
    activeSearches += 1;
    startSearchTask().finally(() => {
      activeSearches = Math.max(activeSearches - 1, 0);
      processNextInQueue();
    });
  } else {
    // Kuyruğa ekle
    const queueItem = {
      onStart: () => {
        sendEvent('log', { message: '[SİSTEM] Sıra size geldi, arama başlatılıyor...' });
        sendEvent('queue_update', { position: 0 });
      },
      onQueueUpdate: (pos) => {
        sendEvent('queue_update', { position: pos });
        sendEvent('log', { message: `[SİSTEM] Sunucu meşgul. Sıraya alındınız, önünüzde ${pos} kişi var.` });
      },
      run: startSearchTask
    };
    searchQueue.push(queueItem);
    queueItem.onQueueUpdate(searchQueue.length);
  }

  res.on('close', () => {
    // Eğer kullanıcı bağlantıyı keserse kuyruktan çıkar
    const index = searchQueue.findIndex(item => item.run === startSearchTask);
    if (index !== -1) {
      searchQueue.splice(index, 1);
      updateQueuePositions();
    }
  });
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
