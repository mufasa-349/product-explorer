// DEBUG modunu aktif et
process.env.DEBUG = 'true';

const { searchAmazon } = require('./server/scrapers/amazon');

// Test için arama sorgusu
const testQuery = process.argv[2] || 'samsung galaxy a17';

console.log('🔍 Amazon test başlatılıyor...');
console.log(`📝 Arama sorgusu: "${testQuery}"`);
console.log('🌐 Browser görünür modda açılacak - ne yaptığını izleyebilirsiniz\n');

searchAmazon(testQuery, (message) => {
  console.log(message);
})
  .then((products) => {
    console.log('\n✅ Test başarılı!');
    console.log(`📦 ${products.length} ürün bulundu:`);
    products.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.title}`);
      console.log(`   💰 Fiyat: ${product.price} ${product.currency}`);
      console.log(`   🔗 Link: ${product.link}`);
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test başarısız!');
    console.error('Hata:', error.message);
    console.error('\nDetaylar:');
    console.error(error);
    process.exit(1);
  });
