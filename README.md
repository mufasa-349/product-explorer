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
