# Product Explorer

Amazon.com ve eBay.com'da ürün araması yapabilen web uygulaması.

## Özellikler

- Amazon.com ve eBay.com'da ürün arama
- Sonuçları fiyatına göre ucuzdan pahalıya sıralama
- Ürün linklerini görüntüleme
- Hata yönetimi (ürün bulunamadı, erişim engeli)

## Kurulum

1. Tüm bağımlılıkları yükleyin:
```bash
npm run install-all
```

2. Uygulamayı başlatın:
```bash
npm run dev
```

Bu komut hem backend (port 5000) hem de frontend (port 3000) sunucularını başlatır.

## Kullanım

1. Tarayıcıda http://localhost:3000 adresine gidin
2. Arama yapmak istediğiniz siteleri seçin (Amazon.com ve/veya eBay.com)
3. Ürün adını girin ve "Ara" butonuna tıklayın
4. Sonuçlar fiyatına göre sıralanmış olarak görüntülenecektir

## Notlar

- Amazon ve eBay scraping yapmak için Puppeteer kullanılmaktadır
- İlk arama biraz uzun sürebilir (sayfa yükleme süreleri nedeniyle)
- Bazı durumlarda siteler bot trafiğini engelleyebilir

## VPS Yayınlama (malikanelectronics.com/product-explorer)

### 1) Frontend API URL güncelle
`client/src/App.js` içindeki tüm `http://localhost:5001` adreslerini aşağıdakiyle değiştirin:
```
https://malikanelectronics.com/product-explorer-api
```

### 2) React build al
`client/package.json` içine şu satırı ekleyin (yoksa):
```
"homepage": "/product-explorer"
```

Build:
```bash
cd /Users/mustafabozyel/Github-Desktop/product-explorer/client
npm run build
```

### 3) Build’i VPS’e gönder
```bash
rsync -av --delete /Users/mustafabozyel/Github-Desktop/product-explorer/client/build/ root@92.112.181.78:/var/www/product-explorer/client/build/
```

### 4) Backend’i VPS’e gönder ve yeniden başlat
```bash
rsync -av --delete /Users/mustafabozyel/Github-Desktop/product-explorer/server/ root@92.112.181.78:/var/www/product-explorer/server/
ssh root@92.112.181.78 "cd /var/www/product-explorer/server && npm install && pm2 restart product-explorer-api"
```

### 5) Puppeteer/Chromium kurulumu (ilk kurulumda)
```bash
apt update
apt install -y \
  libnss3 libatk-bridge2.0-0 libgtk-3-0 libx11-xcb1 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
  libasound2t64 libpangocairo-1.0-0 libcups2 libdrm2 \
  libatspi2.0-0 libxshmfence1 fonts-liberation

cd /var/www/product-explorer/server
npx puppeteer browsers install chrome
pm2 restart product-explorer-api
```

### 6) Nginx route (HTTPS server bloğunda)
`/etc/nginx/sites-available/default` içindeki `listen 443 ssl` olan server bloğuna ekleyin:
```nginx
location = /product-explorer {
  return 301 /product-explorer/;
}

location /product-explorer/ {
  alias /var/www/product-explorer/client/build/;
  try_files $uri $uri/ /product-explorer/index.html;
}

location ^~ /product-explorer/static/ {
  alias /var/www/product-explorer/client/build/static/;
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location = /product-explorer/asset-manifest.json {
  alias /var/www/product-explorer/client/build/asset-manifest.json;
}

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
```

Nginx reload:
```bash
nginx -t
systemctl reload nginx
```

### 7) CORS ayarı
`server/index.js` içinde:
```
origin: 'https://malikanelectronics.com'
```

Sonra:
```bash
pm2 restart product-explorer-api
```

### 8) Yayın URL’leri
- Frontend: `https://malikanelectronics.com/product-explorer`
- Backend: `https://malikanelectronics.com/product-explorer-api`
