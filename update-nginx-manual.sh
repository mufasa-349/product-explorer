#!/bin/bash

# ============================================================================
# NGINX KONFİGÜRASYONU GÜNCELLEME SCRIPTİ
# ============================================================================
#
# SORUN:
# ------
# Product Explorer uygulamasında Server-Sent Events (SSE) kullanıyoruz.
# Loglar arama sırasında gerçek zamanlı görünmüyor, arama bitince hepsi
# birden geliyor. Bunun sebebi Nginx'in proxy_buffering özelliği.
#
# Nginx varsayılan olarak response'ları buffer'lar (tamponlar) ve belirli
# bir boyuta ulaşınca veya timeout olunca gönderir. Bu SSE için sorun
# çünkü loglar anında gönderilmeli.
#
# AMAÇ:
# -----
# /product-explorer-api/ location bloğuna şu 3 satırı eklemek:
#   - proxy_buffering off;      → Nginx buffering'i kapatır
#   - proxy_cache off;          → Cache'i kapatır
#   - proxy_read_timeout 86400; → Uzun süreli bağlantılar için timeout
#
# Bu sayede loglar server'dan client'a anında, gerçek zamanlı gönderilecek.
#
# KULLANIM:
# --------
# Bu script:
#   1. Nginx config dosyasının yedeğini alır
#   2. Mevcut /product-explorer-api/ bloğunu gösterir
#   3. Eklenmesi gereken satırları gösterir
#   4. Manuel düzenleme talimatları verir
#
# Script çalıştıktan sonra nano ile dosyayı düzenleyip satırları ekleyin.
# ============================================================================

NGINX_CONFIG="/etc/nginx/sites-available/default"
BACKUP_FILE="/etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)"

echo "============================================================================"
echo "NGINX KONFİGÜRASYONU GÜNCELLEME - Product Explorer SSE Desteği"
echo "============================================================================"
echo ""

# 1. Yedek al
echo "1. Yedek oluşturuluyor: $BACKUP_FILE"
cp "$NGINX_CONFIG" "$BACKUP_FILE"
if [ $? -eq 0 ]; then
    echo "✓ Yedek başarıyla oluşturuldu"
else
    echo "✗ Yedek oluşturulamadı!"
    exit 1
fi

# 2. Mevcut /product-explorer-api/ bloğunu göster
echo ""
echo "2. Mevcut /product-explorer-api/ location bloğu:"
echo "=========================================="
grep -A 10 "location /product-explorer-api/" "$NGINX_CONFIG" || echo "Bloğu bulunamadı!"
echo "=========================================="
echo ""

# 3. Örnek konfigürasyon göster
echo "3. Eklenmesi gereken satırlar:"
echo "=========================================="
cat << 'EOF'
location /product-explorer-api/ {
  proxy_pass http://localhost:5001/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  
  # Server-Sent Events için buffering'i devre dışı bırak
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 86400;
}
EOF
echo "=========================================="
echo ""

# 4. Düzenleme talimatları
echo "4. Düzenleme talimatları:"
echo "   - nano $NGINX_CONFIG"
echo "   - /product-explorer-api/ bloğunu bulun (Ctrl+W ile arama yapın)"
echo "   - Kapanış parantezinden (}) önce yukarıdaki 3 satırı ekleyin:"
echo "     * proxy_buffering off;"
echo "     * proxy_cache off;"
echo "     * proxy_read_timeout 86400;"
echo "   - Ctrl+X, Y, Enter ile kaydedin"
echo ""
echo "5. Sonra şu komutları çalıştırın:"
echo "   nginx -t                    # Syntax kontrolü"
echo "   systemctl reload nginx     # Nginx'i yeniden yükle"
echo ""
echo "============================================================================"
echo "ÖNEMLİ: Bu değişiklikler olmadan loglar gerçek zamanlı görünmeyecek!"
echo "============================================================================"
echo ""
