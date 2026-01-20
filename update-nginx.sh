#!/bin/bash

# Nginx konfigürasyonunu güncelleme scripti
# Bu script /product-explorer-api/ location bloğuna gerekli ayarları ekler

NGINX_CONFIG="/etc/nginx/sites-available/default"
BACKUP_FILE="/etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)"

echo "Nginx konfigürasyonu güncelleniyor..."

# 1. Yedek al
echo "1. Yedek oluşturuluyor: $BACKUP_FILE"
cp "$NGINX_CONFIG" "$BACKUP_FILE"
if [ $? -eq 0 ]; then
    echo "✓ Yedek başarıyla oluşturuldu"
else
    echo "✗ Yedek oluşturulamadı!"
    exit 1
fi

# 2. Mevcut /product-explorer-api/ bloğunu kontrol et
if ! grep -q "location /product-explorer-api/" "$NGINX_CONFIG"; then
    echo "✗ /product-explorer-api/ location bloğu bulunamadı!"
    exit 1
fi

# 3. Eğer zaten proxy_buffering off varsa, güncelleme yapma
if grep -q "proxy_buffering off" "$NGINX_CONFIG" && grep -A 5 "location /product-explorer-api/" "$NGINX_CONFIG" | grep -q "proxy_buffering off"; then
    echo "✓ proxy_buffering zaten devre dışı, güncelleme gerekmiyor"
else
    # 4. /product-explorer-api/ bloğunun sonuna ayarları ekle
    echo "2. Nginx konfigürasyonu güncelleniyor..."
    
    # Sed ile location bloğunun kapanış parantezinden önce ayarları ekle
    sed -i '/location \/product-explorer-api\/ {/,/^[[:space:]]*}$/ {
        /^[[:space:]]*}$/ {
            i\
  # Server-Sent Events için buffering'\''i devre dışı bırak\
  proxy_buffering off;\
  proxy_cache off;\
  proxy_read_timeout 86400;
        }
    }' "$NGINX_CONFIG"
    
    if [ $? -eq 0 ]; then
        echo "✓ Konfigürasyon güncellendi"
    else
        echo "✗ Konfigürasyon güncellenemedi!"
        echo "Yedekten geri yükleniyor..."
        cp "$BACKUP_FILE" "$NGINX_CONFIG"
        exit 1
    fi
fi

# 5. Nginx syntax kontrolü
echo "3. Nginx syntax kontrolü yapılıyor..."
nginx -t
if [ $? -eq 0 ]; then
    echo "✓ Nginx syntax kontrolü başarılı"
else
    echo "✗ Nginx syntax hatası var!"
    echo "Yedekten geri yükleniyor..."
    cp "$BACKUP_FILE" "$NGINX_CONFIG"
    exit 1
fi

# 6. Nginx reload
echo "4. Nginx reload ediliyor..."
systemctl reload nginx
if [ $? -eq 0 ]; then
    echo "✓ Nginx başarıyla reload edildi"
    echo ""
    echo "Güncelleme tamamlandı! Loglar artık gerçek zamanlı görünecek."
else
    echo "✗ Nginx reload edilemedi!"
    echo "Yedekten geri yükleniyor..."
    cp "$BACKUP_FILE" "$NGINX_CONFIG"
    systemctl reload nginx
    exit 1
fi
