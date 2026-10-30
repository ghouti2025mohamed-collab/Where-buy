// CLIP ViT-B/32 is English-oriented. This local dictionary maps common
// Algerian Arabic/Darja/French shopping words into short English concepts.
// Unknown words are retained; the app's lexical search remains the fallback.
const WORDS = {
  // Footwear
  'حذاء': 'sneakers', 'صباط': 'sneakers', 'سباط': 'sneakers', 'سبادري': 'sneakers',
  'صندل': 'sandals', 'بوط': 'boots', 'كبوط': 'boots', 'شحطة': 'sneakers',
  // Clothing
  'قميص': 'shirt', 'تيشيرت': 't shirt', 'تيشورت': 't shirt', 'تي شيرت': 't shirt',
  'بنطال': 'trousers', 'سروال': 'trousers', 'جينز': 'jeans', 'جاكيت': 'jacket',
  'فيستا': 'jacket', 'معطف': 'coat', 'ملابس': 'clothes', 'دشداشة': 'traditional robe',
  'قبعة': 'hat', 'كاسكيطة': 'cap', 'حزام': 'belt',
  // Accessories
  'حقيبه': 'handbag', 'شنطه': 'bag', 'ساك': 'bag', 'محفظه': 'wallet',
  'ساعه': 'watch', 'مونتري': 'watch', 'نظاره': 'glasses', 'خاتم': 'ring', 'سلسله': 'necklace',
  // Electronics
  'هاتف': 'smartphone', 'تليفون': 'smartphone', 'تلفون': 'smartphone', 'موبايل': 'mobile phone',
  'جوال': 'smartphone', 'سماعات': 'headphones', 'كاسك': 'headphones', 'ايربودز': 'wireless earbuds',
  'شاحن': 'phone charger', 'شارجار': 'phone charger', 'كمبيوتر': 'computer', 'حاسوب': 'computer',
  'لابتوب': 'laptop', 'لاب توب': 'laptop', 'تلفاز': 'television', 'تلفزيون': 'television',
  'كاميرا': 'camera', 'طابعه': 'printer',
  // Beauty and fragrance
  'عطر': 'perfume', 'بارفان': 'perfume', 'كريم': 'cream', 'شامبو': 'shampoo',
  'مكياج': 'makeup', 'احمر شفاه': 'lipstick', 'احمر شفايف': 'lipstick',
  // Home
  'وساده': 'pillow', 'مخده': 'pillow', 'بساط': 'carpet', 'سجاده': 'carpet',
  'طابي': 'table', 'كرسي': 'chair', 'سرير': 'bed', 'مراه': 'mirror',
  // Colors (masculine, feminine and common Darja forms)
  'ابيض': 'white', 'بيضاء': 'white', 'بيضا': 'white', 'بيض': 'white',
  'اسود': 'black', 'سوداء': 'black', 'سودا': 'black', 'كحل': 'black',
  'احمر': 'red', 'حمراء': 'red', 'حمرا': 'red', 'ازرق': 'blue', 'زرقاء': 'blue', 'زرقا': 'blue',
  'اخضر': 'green', 'خضراء': 'green', 'خضرا': 'green', 'اصفر': 'yellow', 'صفراء': 'yellow',
  'وردي': 'pink', 'بني': 'brown', 'رمادي': 'gray', 'ذهبي': 'gold', 'فضي': 'silver',
  // Descriptors and materials
  'رياضي': 'sport', 'رياضيه': 'sport', 'سبور': 'sport', 'للرياضه': 'sport',
  'جلد': 'leather', 'جلدي': 'leather', 'قطن': 'cotton', 'صوف': 'wool',
  'خطوط': 'stripes', 'بخطوط': 'striped with stripes', 'مخطط': 'striped', 'مخططه': 'striped',
  'ناعم': 'smooth', 'كبير': 'large', 'صغير': 'small', 'طويل': 'long', 'قصير': 'short',
  'انيق': 'elegant', 'فاخر': 'luxury', 'رخيص': 'cheap', 'جديد': 'new',
  // French
  'parfum': 'perfume', 'chaussure': 'shoes', 'chaussures': 'shoes', 'basket': 'sneakers',
  'baskets': 'sneakers', 'blanc': 'white', 'blanche': 'white', 'noir': 'black', 'noire': 'black',
  'rouge': 'red', 'bleu': 'blue', 'bleue': 'blue', 'verte': 'green', 'vert': 'green',
  'jaune': 'yellow', 'rose': 'pink', 'sac': 'bag', 'montre': 'watch', 'telephone': 'smartphone',
  'ordinateur': 'computer', 'portable': 'laptop', 'chemise': 'shirt', 'pantalon': 'trousers',
  'veste': 'jacket', 'robe': 'dress', 'cuir': 'leather', 'lunettes': 'glasses',
  'casque': 'headphones', 'ecouteurs': 'earbuds',
};

const STOP_WORDS = new Set([
  'اريد', 'نحب', 'نحوس', 'بغيت', 'حبيت', 'عندي', 'عندكم', 'ابحث', 'بحث',
  'عن', 'من', 'في', 'مع', 'على', 'الي', 'لي', 'ماذا', 'اين', 'كيف', 'شي',
  'حاجه', 'واحد', 'واحده', 'ثم', 'ثمه', 'the', 'a', 'an', 'for', 'to', 'of',
  'with', 'please', 'want', 'looking', 'search', 'find', 'je', 'veux', 'cherche',
  'un', 'une', 'le', 'la', 'les', 'des', 'pour', 'avec', 'svp',
]);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function toClipPrompt(input) {
  const words = normalize(input).split(/\s+/).filter(Boolean);
  const meaningful = words
    .filter((word) => !STOP_WORDS.has(word) && word.length > 1)
    .map((word) => WORDS[word] || word);
  const finalWords = meaningful.length ? meaningful : words;
  return `a product photo of ${finalWords.join(' ')}`;
}
