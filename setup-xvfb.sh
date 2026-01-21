#!/bin/bash

# ============================================================================
# Xvfb KURULUM VE YAPILANDIRMA SCRIPTİ
# ============================================================================
# Bu script server'da headless: false Puppeteer için Xvfb kurar
# ============================================================================

echo "============================================================================"
echo "Xvfb KURULUMU - Headless: false Puppeteer için"
echo "============================================================================"
echo ""

# 1. Xvfb kurulumu kontrolü
echo "1. Xvfb kurulumu kontrol ediliyor..."
if command -v Xvfb &> /dev/null; then
    echo "✓ Xvfb zaten kurulu"
    Xvfb --version
else
    echo "✗ Xvfb bulunamadı, kuruluyor..."
    apt update
    apt install -y xvfb
    echo "✓ Xvfb kuruldu"
fi

echo ""

# 2. Xvfb servis dosyası oluştur
echo "2. Xvfb systemd servisi oluşturuluyor..."
cat > /etc/systemd/system/xvfb.service << 'EOF'
[Unit]
Description=Virtual Framebuffer X Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Xvfb servis dosyası oluşturuldu"

# 3. Xvfb servisini başlat
echo ""
echo "3. Xvfb servisi başlatılıyor..."
systemctl daemon-reload
systemctl enable xvfb
systemctl start xvfb

if systemctl is-active --quiet xvfb; then
    echo "✓ Xvfb servisi çalışıyor"
else
    echo "✗ Xvfb servisi başlatılamadı!"
    exit 1
fi

# 4. DISPLAY environment variable ayarla
echo ""
echo "4. DISPLAY environment variable ayarlanıyor..."
if ! grep -q "DISPLAY=:99" /etc/environment; then
    echo "DISPLAY=:99" >> /etc/environment
    echo "✓ /etc/environment'a eklendi"
else
    echo "✓ Zaten mevcut"
fi

# 5. PM2 ecosystem'e DISPLAY ekle
echo ""
echo "5. PM2 için DISPLAY ayarı..."
echo "PM2 restart sonrası DISPLAY=:99 export edilmeli"
echo ""
echo "PM2 ecosystem.config.js dosyasına şunu ekleyin:"
echo "  env: {"
echo "    DISPLAY: ':99'"
echo "  }"

echo ""
echo "============================================================================"
echo "KURULUM TAMAMLANDI!"
echo "============================================================================"
echo ""
echo "Sonraki adımlar:"
echo "1. PM2 process'ini restart edin:"
echo "   pm2 restart product-explorer-api"
echo ""
echo "2. Veya PM2 ecosystem.config.js kullanıyorsanız DISPLAY ekleyin"
echo ""
echo "3. Test için:"
echo "   export DISPLAY=:99"
echo "   node -e \"const puppeteer = require('puppeteer'); puppeteer.launch({headless: false}).then(b => {console.log('OK'); b.close();});\""
echo ""
