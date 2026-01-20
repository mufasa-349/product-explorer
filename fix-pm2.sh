#!/bin/bash

# ============================================================================
# PM2 PROCESS DÜZELTME SCRIPTİ
# ============================================================================
# product-explorer-api process'i bulunamadığında kullanılır
# ============================================================================

echo "============================================================================"
echo "PM2 PROCESS DÜZELTME"
echo "============================================================================"
echo ""

# 1. Mevcut PM2 process'lerini göster
echo "1. Mevcut PM2 process'leri:"
echo "----------------------------------------"
pm2 list
echo ""

# 2. Server dizinine git
cd /var/www/product-explorer/server || exit 1

# 3. Process'i başlat veya restart et
echo "2. product-explorer-api process'i başlatılıyor..."
echo "----------------------------------------"

# Önce mevcut process'i sil (varsa)
pm2 delete product-explorer-api 2>/dev/null

# Yeni process'i başlat
pm2 start index.js --name product-explorer-api

# 4. PM2'yi kaydet ve startup script'i oluştur
echo ""
echo "3. PM2 startup script'i oluşturuluyor..."
echo "----------------------------------------"
pm2 save
pm2 startup

# 5. Son durum
echo ""
echo "4. Güncel PM2 durumu:"
echo "----------------------------------------"
pm2 list
echo ""

echo "============================================================================"
echo "✓ Process başlatıldı!"
echo "============================================================================"
echo ""
echo "Yararlı komutlar:"
echo "  pm2 list              # Process'leri listele"
echo "  pm2 logs product-explorer-api  # Logları göster"
echo "  pm2 monit             # Canlı monitoring"
echo "  pm2 restart product-explorer-api  # Restart"
echo "  pm2 stop product-explorer-api    # Durdur"
echo ""
