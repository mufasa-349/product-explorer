import React, { useEffect, useState } from 'react';
import './App.css';
import axios from 'axios';

function App() {
  const [query, setQuery] = useState('');
  const [selectedSites, setSelectedSites] = useState(['amazon', 'ebay']);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currencyOverride, setCurrencyOverride] = useState('auto');
  const [imageFile, setImageFile] = useState(null);
  const [imageNote, setImageNote] = useState('');
  const [progress, setProgress] = useState(null);
  const [logs, setLogs] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [sortOption, setSortOption] = useState('default');
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 4000);
  };

  const notifySearchDone = async (total, durationMs) => {
    const seconds = durationMs ? Math.round(durationMs / 1000) : 0;
    const durationText = seconds ? `, süre ${seconds} sn` : '';
    const message = `Arama tamamlandı, ${total} ürün bulundu${durationText}`;
    if (!('Notification' in window)) {
      showToast(message);
      return;
    }
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        showToast(message);
        return;
      }
    }
    if (Notification.permission !== 'granted') {
      showToast(message);
      return;
    }
    new Notification('Arama tamamlandı', {
      body: `${total} ürün bulundu${durationText}`
    });
  };
  const handleImagePaste = (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setImageFile(file);
          setImageNote('Panodan görsel eklendi.');
        }
        break;
      }
    }
  };

  const getImagePreviewUrl = () => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  };

  const countryGroups = [
    {
      id: 'usa',
      label: 'Amerika',
      sites: [
        { id: 'amazon', label: 'Amazon.com' },
        { id: 'ebay', label: 'Ebay.com' }
      ]
    },
    {
      id: 'uae',
      label: 'Dubai',
      sites: [
        { id: 'amazon_ae', label: 'Amazon.ae' },
        { id: 'noon', label: 'Noon.com' },
        { id: 'pricena', label: 'Pricena.ae' }
      ]
    },
    {
      id: 'de',
      label: 'Almanya',
      sites: [
        { id: 'amazon_de', label: 'Amazon.de' },
        { id: 'idealo', label: 'Idealo.de' }
      ]
    },
    {
      id: 'uk',
      label: 'İngiltere',
      sites: [
        { id: 'amazon_uk', label: 'Amazon.co.uk' }
      ]
    },
    {
      id: 'fr',
      label: 'Fransa',
      sites: [
        { id: 'amazon_fr', label: 'Amazon.fr' }
      ]
    },
    {
      id: 'it',
      label: 'İtalya',
      sites: [
        { id: 'amazon_it', label: 'Amazon.it' }
      ]
    },
    {
      id: 'tr',
      label: 'Türkiye',
      sites: [
        { id: 'akakce', label: 'Akakce.com' }
      ]
    },
    {
      id: 'bg',
      label: 'Bulgaristan',
      sites: [
        { id: 'emag', label: 'eMAG.bg' },
        { id: 'pazaruvaj', label: 'Pazaruvaj.com' },
        { id: 'technomarket', label: 'Technomarket.bg' },
        { id: 'technopolis', label: 'Technopolis.bg' }
      ]
    },
    {
      id: 'ro',
      label: 'Romanya',
      sites: [
        { id: 'emag_ro', label: 'eMAG.ro' }
      ]
    },
    {
      id: 'ch',
      label: 'İsviçre',
      sites: [
        { id: 'toppreise', label: 'Toppreise.ch' },
        { id: 'digitec', label: 'Digitec.ch' }
      ]
    },
    {
      id: 'gr',
      label: 'Yunanistan',
      sites: [
        { id: 'skroutz', label: 'Skroutz.gr' }
      ]
    }
  ];
  const allSiteIds = countryGroups.flatMap(group => group.sites.map(site => site.id));

  const siteEstimates = {
    amazon: 25,
    amazon_ae: 20,
    amazon_de: 20,
    amazon_uk: 20,
    amazon_fr: 20,
    amazon_it: 20,
    idealo: 10,
    noon: 12,
    pricena: 10,
    emag: 12,
    emag_ro: 12,
    toppreise: 10,
    digitec: 10,
    pazaruvaj: 10,
    technomarket: 10,
    technopolis: 10,
    skroutz: 10,
    akakce: 8,
    ebay: 10
  };

  const handleSiteToggle = (site) => {
    setSelectedSites(prev => 
      prev.includes(site) 
        ? prev.filter(s => s !== site)
        : [...prev, site]
    );
  };

  const isCountrySelected = (sites) => {
    if (!sites.length) return false;
    return sites.every(site => selectedSites.includes(site));
  };

  const toggleCountrySites = (sites, checked) => {
    setSelectedSites(prev => {
      const withoutGroup = prev.filter(site => !sites.includes(site));
      return checked ? [...withoutGroup, ...sites] : withoutGroup;
    });
  };

  const handleSelectAllSites = () => {
    setSelectedSites(allSiteIds);
  };

  const handleDeselectAllSites = () => {
    setSelectedSites([]);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Lütfen bir ürün adı girin');
      return;
    }

    if (selectedSites.length === 0) {
      setError('Lütfen en az bir site seçin');
      return;
    }

    const searchStartedAt = Date.now();
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(null);
    setLogs([]);

    try {
      let imageToken = '';
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append('image', imageFile);
        const uploadRes = await axios.post('http://localhost:5001/api/image/upload', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageToken = uploadRes.data?.token || '';
      }

      const queryParam = encodeURIComponent(query.trim());
      const sitesParam = encodeURIComponent(JSON.stringify(selectedSites));
      const imageParam = imageToken ? `&imageToken=${encodeURIComponent(imageToken)}` : '';
      const eventSource = new EventSource(`http://localhost:5001/api/search/stream?query=${queryParam}&sites=${sitesParam}${imageParam}`);

      eventSource.addEventListener('log', (event) => {
        const data = JSON.parse(event.data);
        setLogs((prev) => [...prev, data.message]);
      });

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        setProgress(data);
      });

      eventSource.addEventListener('done', (event) => {
        const data = JSON.parse(event.data);
        setResults(data);
        setLoading(false);
        const total = data?.sortedProducts?.length ?? 0;
        notifySearchDone(total, Date.now() - searchStartedAt);
        eventSource.close();
      });

      eventSource.addEventListener('error', (event) => {
        setError('Arama sırasında bir hata oluştu');
        setLoading(false);
        eventSource.close();
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Arama sırasında bir hata oluştu');
      setLoading(false);
    }
  };

  const formatPrice = (product) => {
    if (!product) {
      return { displayPrice: 'Fiyat bulunamadı', displayCurrency: '' };
    }
    const {
      price,
      currency,
      originalPrice,
      originalCurrency,
      usdPrice
    } = product;

    if (!price || price === 'Fiyat bulunamadı') {
      return { displayPrice: 'Fiyat bulunamadı', displayCurrency: '' };
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;

    let displayPrice = numPrice.toFixed(2);
    let displayCurrency = (currency || '').toUpperCase();

    if (currencyOverride === 'AED' && originalCurrency === 'AED' && originalPrice) {
      const originalNum = parseFloat(originalPrice);
      if (!isNaN(originalNum)) {
        displayPrice = originalNum.toFixed(2);
        displayCurrency = 'AED';
      }
    } else if (currencyOverride === 'EUR' && originalCurrency === 'EUR' && originalPrice) {
      const originalNum = parseFloat(originalPrice);
      if (!isNaN(originalNum)) {
        displayPrice = originalNum.toFixed(2);
        displayCurrency = 'EUR';
      }
    } else if (currencyOverride === 'CHF' && originalCurrency === 'CHF' && originalPrice) {
      const originalNum = parseFloat(originalPrice);
      if (!isNaN(originalNum)) {
        displayPrice = originalNum.toFixed(2);
        displayCurrency = 'CHF';
      }
    } else if (currencyOverride === 'USD' && usdPrice) {
      const usdNum = parseFloat(usdPrice);
      if (!isNaN(usdNum)) {
        displayPrice = usdNum.toFixed(2);
        displayCurrency = 'USD';
      }
    } else if (currencyOverride === 'USD' && displayCurrency === 'USD') {
      displayCurrency = 'USD';
    } else if (currencyOverride === 'auto') {
      displayCurrency = displayCurrency || 'USD';
    }

    const currencyPrefix = displayCurrency === 'USD' ? '$' : displayCurrency;
    return {
      displayPrice: `${currencyPrefix} ${displayPrice}`,
      displayCurrency
    };
  };

  const estimateWaitSeconds = (sites) => {
    if (!sites || sites.length === 0) return 0;
    return sites.reduce((sum, site) => sum + (siteEstimates[site] || 8), 0);
  };

  const getSortedProducts = (products) => {
    if (!Array.isArray(products)) return [];
    if (sortOption === 'price_asc') {
      return [...products].sort((a, b) => {
        const aPrice = parseFloat(a?.price);
        const bPrice = parseFloat(b?.price);
        const safeA = Number.isFinite(aPrice) ? aPrice : Number.POSITIVE_INFINITY;
        const safeB = Number.isFinite(bPrice) ? bPrice : Number.POSITIVE_INFINITY;
        return safeA - safeB;
      });
    }
    return products;
  };

  const displayedProducts = results ? getSortedProducts(results.sortedProducts) : [];

  return (
    <div className="App">
      <div className="container">
        <h1 className="title">Product Explorer</h1>
        
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-layout">
            <div className="search-controls">
              <div className="search-bar-container">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ürün ara..."
                  className="search-bar"
                  disabled={loading}
                />
                <button 
                  type="submit" 
                  className="search-button"
                  disabled={loading}
                >
                  {loading ? 'Aranıyor...' : 'Ara'}
                </button>
              </div>
              <div className="search-bar-container image-input-row">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  onPaste={handleImagePaste}
                  className="search-bar"
                  disabled={loading}
                />
                <span className="image-optional-note">Opsiyonel</span>
              </div>
              <div className="image-help-text">
                Görsel ekleme opsiyoneldir. Dosya seçebilir veya panodan yapıştırabilirsiniz.
              </div>
              {imageFile && (
                <div className="image-preview">
                  <div className="image-preview-title">Referans görsel</div>
                  <button
                    type="button"
                    className="image-remove-button"
                    onClick={() => {
                      setImageFile(null);
                      setImageNote('');
                    }}
                    disabled={loading}
                    aria-label="Görseli kaldır"
                    title="Görseli kaldır"
                  >
                    <span className="image-remove-icon">×</span>
                    <span>Görseli kaldır</span>
                  </button>
                  <img src={getImagePreviewUrl()} alt="Referans görsel" />
                </div>
              )}
              {imageNote && <div className="image-note">{imageNote}</div>}
              <div className="currency-row">
                <label className="site-checkbox">
                  <span>Para birimi:</span>
                </label>
                <select
                  value={currencyOverride}
                  onChange={(e) => setCurrencyOverride(e.target.value)}
                  disabled={loading}
                  className="currency-select"
                >
                  <option value="auto">Otomatik</option>
                  <option value="USD">USD ($)</option>
                  <option value="AED">AED</option>
                  <option value="EUR">EUR</option>
                  <option value="CHF">CHF</option>
                  <option value="TRY">TRY</option>
                </select>
              </div>
              <div className="currency-row">
                <label className="site-checkbox">
                  <span>Gelişmiş sıralama:</span>
                </label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  disabled={loading}
                  className="currency-select"
                >
                  <option value="default">Varsayılan</option>
                  <option value="price_asc">Fiyata göre artan</option>
                </select>
              </div>
              {!loading && (
                <div className="search-estimate">
                  Tahmini bekleme süresi: ~{estimateWaitSeconds(selectedSites)} sn
                </div>
              )}
              {loading && progress && (
                <div className="progress-block">
                  <div className="progress-text">
                    {progress.visited}/{progress.total} site gezildi, {progress.products} ürün bulundu
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round((progress.visited / progress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {loading && logs.length > 0 && (
                <div className="log-panel">
                  {logs.slice(-10).map((log, index) => (
                    <div key={`${log}-${index}`} className="log-line">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="site-groups">
              <div className="site-groups-header">
                <div className="site-groups-title">Ülkeler</div>
                <div className="site-groups-actions">
                  <button
                    type="button"
                    className="site-groups-button"
                    onClick={handleSelectAllSites}
                    disabled={loading}
                  >
                    Hepsini seç
                  </button>
                  <button
                    type="button"
                    className="site-groups-button"
                    onClick={handleDeselectAllSites}
                    disabled={loading}
                  >
                    Tümünü kaldır
                  </button>
                </div>
              </div>
              {countryGroups.map((group) => (
                <div key={group.id} className="country-group">
                  <label className="site-checkbox country-checkbox">
                    <input
                      type="checkbox"
                      checked={isCountrySelected(group.sites.map(site => site.id))}
                      onChange={(e) => toggleCountrySites(group.sites.map(site => site.id), e.target.checked)}
                      disabled={loading}
                    />
                    <span>{group.label}</span>
                  </label>
                  <div className="country-sites">
                    {group.sites.map((site) => (
                      <label key={site.id} className="site-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedSites.includes(site.id)}
                          onChange={() => handleSiteToggle(site.id)}
                          disabled={loading}
                        />
                        <span>{site.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {error && <div className="error-message">{error}</div>}
        {toastVisible && <div className="toast-message">{toastMessage}</div>}

        {results && (
          <div className="results">
            <h2 className="results-title">
              "{results.query}" için {results.sortedProducts.length} sonuç bulundu
            </h2>
            {results.imageWarning && (
              <div className="warning-message">{results.imageWarning}</div>
            )}

            {displayedProducts.length > 0 ? (
              <div className="products-list">
                {displayedProducts.map((product, index) => (
                  <div key={index} className="product-card">
                    {product.image && (
                      <img 
                        src={product.image} 
                        alt={product.title}
                        className="product-image"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="product-info">
                      <h3 className="product-title">{product.title}</h3>
                      <div className="product-details">
                        <span className="product-site">
                          {product.site === 'amazon'
                            ? 'Amazon.com'
                            : product.site === 'amazon_ae'
                              ? 'Amazon.ae'
                              : product.site === 'amazon_de'
                                ? 'Amazon.de'
                                : product.site === 'amazon_uk'
                                  ? 'Amazon.co.uk'
                                  : product.site === 'amazon_fr'
                                    ? 'Amazon.fr'
                                    : product.site === 'amazon_it'
                                      ? 'Amazon.it'
                                  : product.site === 'akakce'
                                    ? 'Akakce.com'
                                  : product.site === 'idealo'
                                    ? 'Idealo.de'
                                    : product.site === 'noon'
                                      ? 'Noon.com'
                                      : product.site === 'pricena'
                                        ? 'Pricena.com'
                                        : product.site === 'emag'
                                          ? 'eMAG.bg'
                                          : product.site === 'emag_ro'
                                            ? 'eMAG.ro'
                                            : product.site === 'pazaruvaj'
                                              ? 'Pazaruvaj.com'
                                            : product.site === 'technomarket'
                                              ? 'Technomarket.bg'
                                              : product.site === 'technopolis'
                                                ? 'Technopolis.bg'
                                                : product.site === 'skroutz'
                                                  ? 'Skroutz.gr'
                                                  : product.site === 'toppreise'
                                                    ? 'Toppreise.ch'
                                                    : product.site === 'digitec'
                                                      ? 'Digitec.ch'
                                                      : 'eBay.com'}
                        </span>
                        {(() => {
                          const priceInfo = formatPrice(product);
                          return (
                            <>
                              <span className="product-price">{priceInfo.displayPrice}</span>
                              <span className="product-currency">{priceInfo.displayCurrency}</span>
                            </>
                          );
                        })()}
                      </div>
                      <a 
                        href={product.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="product-link"
                      >
                        Ürüne Git →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-results">
                <p>Ürün bulunamadı</p>
              </div>
            )}

            <div className="site-status">
              {results.results.map((result, index) => (
                <div key={index} className="status-item">
                  <span className="status-site">
                    {result.site === 'amazon'
                      ? 'Amazon.com'
                      : result.site === 'amazon_ae'
                        ? 'Amazon.ae'
                        : result.site === 'amazon_de'
                          ? 'Amazon.de'
                          : result.site === 'amazon_uk'
                            ? 'Amazon.co.uk'
                            : result.site === 'akakce'
                              ? 'Akakce.com'
                            : result.site === 'idealo'
                              ? 'Idealo.de'
                              : result.site === 'noon'
                                ? 'Noon.com'
                                : result.site === 'pricena'
                                  ? 'Pricena.com'
                                  : result.site === 'emag'
                                    ? 'eMAG.bg'
                                    : result.site === 'pazaruvaj'
                                      ? 'Pazaruvaj.com'
                                      : result.site === 'technomarket'
                                        ? 'Technomarket.bg'
                                        : result.site === 'technopolis'
                                          ? 'Technopolis.bg'
                                          : result.site === 'skroutz'
                                            ? 'Skroutz.gr'
                                            : result.site === 'toppreise'
                                              ? 'Toppreise.ch'
                                              : result.site === 'digitec'
                                                ? 'Digitec.ch'
                                                : 'eBay.com'}: 
                  </span>
                  {result.success ? (
                    <span className="status-success">
                      {result.products.length} ürün bulundu
                    </span>
                  ) : (
                    <span className="status-error">
                      {result.error || 'Siteye erişilemedi'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
