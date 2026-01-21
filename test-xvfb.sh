#!/bin/bash

# ============================================================================
# Xvfb TEST SCRIPTİ
# ============================================================================
# Xvfb'nin çalışıp çalışmadığını ve headless: false Puppeteer'in
# çalışıp çalışmadığını test eder
# ============================================================================

echo "============================================================================"
echo "Xvfb TEST"
echo "============================================================================"
echo ""

# 1. Xvfb servis durumu
echo "1. Xvfb servis durumu:"
echo "----------------------------------------"
if systemctl is-active --quiet xvfb 2>/dev/null; then
    echo "✓ Xvfb servisi çalışıyor"
    systemctl status xvfb --no-pager -l | head -5
else
    echo "✗ Xvfb servisi çalışmıyor"
    echo "  Başlatmak için: systemctl start xvfb"
fi
echo ""

# 2. Xvfb process kontrolü
echo "2. Xvfb process kontrolü:"
echo "----------------------------------------"
if pgrep -x Xvfb > /dev/null; then
    echo "✓ Xvfb process çalışıyor"
    ps aux | grep Xvfb | grep -v grep
else
    echo "✗ Xvfb process bulunamadı"
fi
echo ""

# 3. DISPLAY environment variable
echo "3. DISPLAY environment variable:"
echo "----------------------------------------"
if [ -n "$DISPLAY" ]; then
    echo "✓ DISPLAY ayarlı: $DISPLAY"
else
    echo "✗ DISPLAY ayarlı değil"
    echo "  Export etmek için: export DISPLAY=:99"
fi
echo ""

# 4. Xvfb display test (xset komutu ile)
echo "4. Xvfb display testi:"
echo "----------------------------------------"
if command -v xset &> /dev/null; then
    DISPLAY=:99 xset q > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✓ Display :99 çalışıyor"
        DISPLAY=:99 xset q | head -3
    else
        echo "✗ Display :99 çalışmıyor"
        echo "  Xvfb'yi başlatmak için: systemctl start xvfb"
    fi
else
    echo "⚠ xset komutu bulunamadı (x11-xserver-utils paketi gerekli)"
    echo "  Kurmak için: apt install x11-xserver-utils"
fi
echo ""

# 5. Puppeteer headless: false test
echo "5. Puppeteer headless: false testi:"
echo "----------------------------------------"
cd /var/www/product-explorer/server 2>/dev/null || cd /tmp

cat > /tmp/test-puppeteer-headless.js << 'TEST_EOF'
const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Puppeteer başlatılıyor (headless: false)...');
    console.log('DISPLAY:', process.env.DISPLAY || 'NOT SET');
    
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    console.log('✓ Browser başarıyla başlatıldı!');
    console.log('PID:', browser.process()?.pid || 'unknown');
    
    const page = await browser.newPage();
    await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('✓ Sayfa yüklendi: Google.com');
    
    await browser.close();
    console.log('✓ Test başarılı!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Hata:', error.message);
    process.exit(1);
  }
})();
TEST_EOF

if [ -f /var/www/product-explorer/server/node_modules/puppeteer/package.json ]; then
    export DISPLAY=:99
    node /tmp/test-puppeteer-headless.js
    TEST_RESULT=$?
    if [ $TEST_RESULT -eq 0 ]; then
        echo ""
        echo "✓ Puppeteer headless: false testi başarılı!"
    else
        echo ""
        echo "✗ Puppeteer headless: false testi başarısız!"
        echo "  Xvfb'yi kontrol edin: systemctl status xvfb"
    fi
else
    echo "⚠ Puppeteer bulunamadı (/var/www/product-explorer/server/node_modules/puppeteer)"
    echo "  Test için server dizinine gidin ve npm install yapın"
fi

rm -f /tmp/test-puppeteer-headless.js

echo ""
echo "============================================================================"
echo "TEST TAMAMLANDI"
echo "============================================================================"
echo ""
echo "Özet:"
echo "  - Xvfb servisi çalışıyorsa ✓"
echo "  - DISPLAY=:99 ayarlıysa ✓"
echo "  - Puppeteer testi başarılıysa ✓"
echo ""
echo "Eğer tüm testler başarılıysa, headless: false çalışacaktır!"
echo ""
