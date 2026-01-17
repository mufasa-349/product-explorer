import React, { useState } from 'react';
import './App.css';
import axios from 'axios';

function App() {
  const [query, setQuery] = useState('');
  const [selectedSites, setSelectedSites] = useState(['amazon', 'ebay']);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currencyOverride, setCurrencyOverride] = useState('auto');

  const siteEstimates = {
    amazon: 25,
    amazon_ae: 20,
    amazon_de: 20,
    idealo: 10,
    noon: 12,
    ebay: 10
  };

  const handleSiteToggle = (site) => {
    setSelectedSites(prev => 
      prev.includes(site) 
        ? prev.filter(s => s !== site)
        : [...prev, site]
    );
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

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post('http://localhost:5001/api/search', {
        query: query.trim(),
        sites: selectedSites
      });

      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Arama sırasında bir hata oluştu');
    } finally {
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

  return (
    <div className="App">
      <div className="container">
        <h1 className="title">Product Explorer</h1>
        
        <form onSubmit={handleSearch} className="search-form">
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
          {!loading && (
            <div className="search-estimate">
              Tahmini bekleme süresi: ~{estimateWaitSeconds(selectedSites)} sn
            </div>
          )}

          <div className="site-selection">
            <label className="site-checkbox">
              <input
                type="checkbox"
                checked={selectedSites.includes('amazon')}
                onChange={() => handleSiteToggle('amazon')}
                disabled={loading}
              />
              <span>Amazon.com</span>
            </label>
            <label className="site-checkbox">
              <input
                type="checkbox"
                checked={selectedSites.includes('amazon_ae')}
                onChange={() => handleSiteToggle('amazon_ae')}
                disabled={loading}
              />
              <span>Amazon.ae</span>
            </label>
            <label className="site-checkbox">
              <input
                type="checkbox"
                checked={selectedSites.includes('amazon_de')}
                onChange={() => handleSiteToggle('amazon_de')}
                disabled={loading}
              />
              <span>Amazon.de</span>
            </label>
            <label className="site-checkbox">
              <input
                type="checkbox"
                checked={selectedSites.includes('idealo')}
                onChange={() => handleSiteToggle('idealo')}
                disabled={loading}
              />
              <span>Idealo.de</span>
            </label>
            <label className="site-checkbox">
              <input
                type="checkbox"
                checked={selectedSites.includes('noon')}
                onChange={() => handleSiteToggle('noon')}
                disabled={loading}
              />
              <span>Noon.com</span>
            </label>
            <label className="site-checkbox">
              <input
                type="checkbox"
                checked={selectedSites.includes('ebay')}
                onChange={() => handleSiteToggle('ebay')}
                disabled={loading}
              />
              <span>eBay.com</span>
            </label>
          </div>
          <div className="site-selection">
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
              <option value="TRY">TRY</option>
            </select>
          </div>
        </form>

        {error && <div className="error-message">{error}</div>}

        {results && (
          <div className="results">
            <h2 className="results-title">
              "{results.query}" için {results.sortedProducts.length} sonuç bulundu
            </h2>

            {results.sortedProducts.length > 0 ? (
              <div className="products-list">
                {results.sortedProducts.map((product, index) => (
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
                                : product.site === 'idealo'
                                  ? 'Idealo.de'
                                  : product.site === 'noon'
                                    ? 'Noon.com'
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
                          : result.site === 'idealo'
                            ? 'Idealo.de'
                            : result.site === 'noon'
                              ? 'Noon.com'
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
