#!/bin/bash

# ============================================================================
# SERVER DURUM KONTROL SCRIPTİ
# ============================================================================
# Bu script server'ın kaynak kullanımını kontrol eder
# ============================================================================

echo "============================================================================"
echo "SERVER DURUM KONTROLÜ"
echo "============================================================================"
echo ""

# 1. Memory durumu
echo "1. MEMORY DURUMU:"
echo "----------------------------------------"
free -h
echo ""

# 2. Disk kullanımı
echo "2. DİSK KULLANIMI:"
echo "----------------------------------------"
df -h
echo ""

# 3. PM2 process'leri
echo "3. PM2 PROCESS'LERİ:"
echo "----------------------------------------"
pm2 list
echo ""

# 4. PM2 memory kullanımı (detaylı)
echo "4. PM2 MEMORY KULLANIMI (DETAYLI):"
echo "----------------------------------------"
pm2 list --sort memory:desc
echo ""

# 5. Top 10 process (memory)
echo "5. EN ÇOK MEMORY KULLANAN 10 PROCESS:"
echo "----------------------------------------"
ps aux --sort=-%mem | head -11
echo ""

# 6. Top 10 process (CPU)
echo "6. EN ÇOK CPU KULLANAN 10 PROCESS:"
echo "----------------------------------------"
ps aux --sort=-%cpu | head -11
echo ""

# 7. Load average
echo "7. SİSTEM YÜKÜ (LOAD AVERAGE):"
echo "----------------------------------------"
uptime
echo ""

# 8. Node.js process'leri
echo "8. NODE.JS PROCESS'LERİ:"
echo "----------------------------------------"
ps aux | grep node | grep -v grep
echo ""

# 9. Puppeteer/Chrome process'leri
echo "9. PUPPETEER/CHROME PROCESS'LERİ:"
echo "----------------------------------------"
ps aux | grep -E "(chrome|chromium|puppeteer)" | grep -v grep
echo ""

# 10. Öneriler
echo "============================================================================"
echo "ÖNERİLER:"
echo "============================================================================"

# Memory kontrolü
MEM_AVAILABLE=$(free -m | awk 'NR==2{printf "%.0f", $7}')
if [ "$MEM_AVAILABLE" -lt 500 ]; then
    echo "⚠️  DÜŞÜK MEMORY! ($MEM_AVAILABLE MB kaldı)"
    echo "   - PM2 process'lerini kontrol edin: pm2 list"
    echo "   - Gereksiz process'leri durdurun"
    echo "   - PM2 restart yapın: pm2 restart all"
fi

# Disk kontrolü
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  DİSK DOLU! (%$DISK_USAGE kullanılıyor)"
    echo "   - Eski log dosyalarını temizleyin"
    echo "   - Gereksiz dosyaları silin"
fi

# PM2 process sayısı
PM2_COUNT=$(pm2 list | grep -c "online\|stopped")
if [ "$PM2_COUNT" -gt 5 ]; then
    echo "⚠️  ÇOK FAZLA PM2 PROCESS! ($PM2_COUNT process)"
    echo "   - Gereksiz process'leri durdurun: pm2 delete <id>"
fi

echo ""
echo "============================================================================"
echo "HIZLI TEMİZLİK KOMUTLARI:"
echo "============================================================================"
echo "  # PM2 restart (tüm process'ler):"
echo "  pm2 restart all"
echo ""
echo "  # PM2 memory kullanımını göster:"
echo "  pm2 monit"
echo ""
echo "  # Zombie process'leri temizle:"
echo "  pkill -9 chrome"
echo "  pkill -9 chromium"
echo ""
echo "  # Sistem cache temizle (dikkatli kullanın):"
echo "  sync && echo 3 > /proc/sys/vm/drop_caches"
echo ""
echo "============================================================================"
