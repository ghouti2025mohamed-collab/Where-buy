import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { models, useImageEmbedder, useTextEmbedder } from 'react-native-executorch';
import { loadImage } from 'react-native-nitro-image';
import { toClipPrompt } from './ai/clipPrompts';
import { supabase } from './supabase';

const COLORS = {
  primary: '#7257E8',
  secondary: '#F26D8A',
  orange: '#FFAD60',
  background: '#F7F7FC',
  white: '#FFFFFF',
  text: '#24233A',
  muted: '#88889B',
  border: '#EEEEF5',
  green: '#27AE80',
};

const CATEGORIES = [
  { name: 'الكل', emoji: '✨' },
  { name: 'إلكترونيات', emoji: '📱' },
  { name: 'ملابس', emoji: '👕' },
  { name: 'إكسسوارات', emoji: '👜' },
  { name: 'عطور', emoji: '🧴' },
];

const TABS = [
  { id: 'home', label: 'الرئيسية', icon: '⌂' },
  { id: 'search', label: 'ابحث لي', icon: '⌕' },
  { id: 'describe', label: 'اوصف لي', icon: '🤖' },
  { id: 'favorites', label: 'المفضلة', icon: '♡' },
  { id: 'map', label: 'الخريطة', icon: '⌖' },
  { id: 'profile', label: 'حسابي', icon: '♙' },
];

function mapDatabaseProduct(row) {
  const name = row.name || 'منتج';
  let category = 'إكسسوارات';
  let emoji = '🛍️';
  let color = '#EEE9FF';

  if (/سماعات|هاتف|جوال|ساعة ذكية|إلكترونيات|كمبيوتر|لابتوب/i.test(name)) {
    category = 'إلكترونيات'; emoji = /سماعات/.test(name) ? '🎧' : /ساعة/.test(name) ? '⌚' : /هاتف|جوال/.test(name) ? '📱' : '💻'; color = '#EEE9FF';
  } else if (/حذاء|قميص|ملابس|حقيبة|بنطال|تيشيرت/i.test(name)) {
    category = 'ملابس'; emoji = /حذاء/.test(name) ? '👟' : /حقيبة/.test(name) ? '👜' : '👕'; color = '#FFE9DF';
  } else if (/عطر|رائحة/i.test(name)) {
    category = 'عطور'; emoji = '🧴'; color = '#FCE4EF';
  }

  return {
    id: String(row.id),
    name,
    description: row.description || '',
    category,
    price: Number(row.price || 0),
    oldPrice: null,
    emoji,
    color,
    store: row.store || row.company_name || 'متجر غير محدد',
    store_address: row.store_address || '',
    store_phone: row.store_phone || '',
    company_id: row.company_id ? String(row.company_id) : null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    distance: 'غير محددة',
    discount: null,
    image_url: row.image_url || null,
    stock: Number(row.stock || 0),
  };
}

// تطبيع الكلمات العربية واللهجات الشائعة قبل المطابقة.
function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ـ.,،!؟?;:()\[\]{}"'`~@#$%^&*_+=<>\/\\|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SEARCH_SYNONYM_GROUPS = [
  ['حذاء', 'صباط', 'سباط', 'سبادري', 'صندل', 'بوط', 'كبوط'],
  ['رياضي', 'رياضه', 'للرياضه', 'سبور', 'sport', 'sports'],
  ['هاتف', 'تليفون', 'تلفون', 'موبايل', 'جوال', 'سمارتفون', 'smartphone', 'phone'],
  ['سماعات', 'كاسك', ' casque', 'ايربودز', 'airpods', 'headphones', 'ecouteurs'],
  ['حقيبه', 'ساك', 'sac', 'شنطه', 'محفظه يد', 'كرطاب'],
  ['محفظه', 'بوشات', 'محفظة'],
  ['ملعقه', 'مغرف'],
  ['غطاء نوم', 'كوفيرطه'],
  ['وساده', 'مخده'],
  ['وساده طبيه', 'مخده طبيه'],
  ['بساط', 'طابي'],
  ['نافذه', 'تاقة'],
  ['كأس', 'كاس'],
  ['جاكيت', 'فيستا', 'معطف'],
  ['ملابس داخليه', 'سليب'],
  ['سماعات راس', 'كيتمان'],
  ['قبعه', 'كاسكيطة'],
  ['ولاعه', 'بريكة'],
  ['تيشيرت داخلي', 'ديباردال'],
  ['شفرة حلاقه', 'رازوار'],
  ['ماكينه حلاقه', 'طونداز'],
  ['زجاج حمايه', 'انكاسابل'],
  ['شاحن', 'شارجار'],
  ['بنطال', 'سروال', 'pantalon', 'pants'],
  ['تيشيرت', 'تيشورت', 'تي شيرت', 'tshirt', 't shirt'],
  ['عطر', 'بارفان', 'parfum', 'perfume'],
  ['ساعه', 'مونتري', 'montre', 'watch'],
  ['كمبيوتر', 'حاسوب', 'بيسي', 'pc', 'ordinateur', 'computer'],
  ['لابتوب', 'لاب توب', 'portable', 'laptop'],
  ['ابيض', 'بيضاء', 'بيضا', 'white', 'blanc', 'blanche'],
  ['اسود', 'سوداء', 'كحل', 'black', 'noir', 'noire'],
  ['احمر', 'حمراء', 'red', 'rouge'],
  ['ازرق', 'زرقاء', 'blue', 'bleu', 'bleue'],
  ['اخضر', 'خضراء', 'green', 'vert', 'verte'],
];

const SEARCH_STOP_WORDS = new Set([
  'اريد', 'ابحث', 'بحث', 'عن', 'ماذا', 'اين', 'لي', 'من', 'في', 'مع',
  'يكون', 'تكون', 'يكونلي', 'نحب', 'بغيت', 'حبيت', 'عندي', 'شي', 'واحد',
  'واحده', 'من فضلك', 'لو سمحت', 'ثمن', 'سعر', 'بسعر', 'سوم', 'prix',
  'the', 'a', 'an', 'for', 'to', 'please', 'want', 'looking',
]);

const SEARCH_SYNONYM_LOOKUP = (() => {
  const lookup = {};
  SEARCH_SYNONYM_GROUPS.forEach((group) => {
    const canonical = normalizeSearchText(group[0]);
    group.forEach((word) => {
      lookup[normalizeSearchText(word)] = canonical;
    });
  });
  return lookup;
})();

function getSearchTokens(value) {
  return normalizeSearchText(value)
    .split(' ')
    .filter((word) => word && !SEARCH_STOP_WORDS.has(word))
    .map((word) => SEARCH_SYNONYM_LOOKUP[word] || word);
}

function productMatchesSearch(product, query) {
  const rawQuery = String(query || '').trim();
  if (!rawQuery) return true;

  const searchableText = [
    product.name,
    product.description,
    product.category,
    product.store,
  ].filter(Boolean).join(' ');
  const normalizedQuery = normalizeSearchText(rawQuery);
  const normalizedProduct = normalizeSearchText(searchableText);
  if (normalizedProduct.includes(normalizedQuery)) return true;

  const queryTokens = getSearchTokens(rawQuery);
  const productTokens = getSearchTokens(searchableText);
  if (queryTokens.length === 0) return true;

  // يجب أن تطابق كل كلمة مهمة كلمةً في اسم المنتج أو وصفه أو فئته.
  // يسمح هذا بمطابقة اختلاف ترتيب الكلمات والمرادفات واللهجة.
  return queryTokens.every((queryToken) =>
    productTokens.some((productToken) =>
      productToken === queryToken ||
      (queryToken.length >= 3 && productToken.startsWith(queryToken)) ||
      (productToken.length >= 3 && queryToken.startsWith(productToken))
    )
  );
}

function formatPrice(price) {
  return price.toLocaleString('fr-FR') + ' دج';
}

function ProductCard({ product, isFavorite, onFavorite, onPress }) {
  return (
    <View style={styles.productCard}>
      <TouchableOpacity
        style={[styles.productImage, { backgroundColor: product.color }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {product.image_url ? <Image source={{ uri: product.image_url }} style={styles.productPhoto} resizeMode="cover" /> : <Text style={styles.productEmoji}>{product.emoji}</Text>}

        {product.discount ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{product.discount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => onFavorite(product.id)}
      >
        <Text
          style={[
            styles.favoriteIcon,
            isFavorite && styles.favoriteActive,
          ]}
        >
          {isFavorite ? '♥' : '♡'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        <Text style={styles.productPrice}>
          {formatPrice(product.price)}
        </Text>

        {product.oldPrice ? (
          <Text style={styles.oldPrice}>{formatPrice(product.oldPrice)}</Text>
        ) : null}

        <View style={styles.distanceRow}>
          <Text style={styles.distanceText}>📦 المخزون: {product.stock}</Text>
          <Text style={styles.availableText}>
            {product.stock > 0 ? 'متوفر' : 'غير متوفر'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Decode a local image into the HWC RGB buffer required by ExecuTorch CLIP.
async function imageUriToClipBuffer(uri) {
  const image = await loadImage({ url: uri });
  const rawPixels = await image.toRawPixelData();
  return {
    data: new Uint8Array(rawPixels),
    width: image.width,
    height: image.height,
    format: 'rgb',
    layout: 'hwc',
  };
}

async function findProductsByEmbedding(vector) {
  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: Array.from(vector),
    match_threshold: 0.12,
    match_count: 30,
  });
  if (error) throw error;
  return (data || []).map((row) => mapDatabaseProduct(row));
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [connectionStatus, setConnectionStatus] = useState(
    'جارٍ اختبار الاتصال...'
  );
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [favorites, setFavorites] = useState([]);
  const [description, setDescription] = useState('');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authRole, setAuthRole] = useState('customer');
  const [authBusy, setAuthBusy] = useState(false);
  const [authFields, setAuthFields] = useState({
    full_name: '', age: '', phone: '', email: '', password: '',
    company_name: '', registration_number: '', business_type: 'company',
    address: '', business_description: '', latitude: '', longitude: '',
    vehicle_type: 'دراجة نارية',
  });
  const [driverFiles, setDriverFiles] = useState({ avatar: null, idCard: null, vehicleRegistration: null });
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', stock: '1' });
  const [productImage, setProductImage] = useState(null);
  const [productBusy, setProductBusy] = useState(false);
  const [aiImageRequested, setAiImageRequested] = useState(false);
  const [aiTextRequested, setAiTextRequested] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiResults, setAiResults] = useState(null); // null = use the full catalogue
  const [pendingAiSearch, setPendingAiSearch] = useState(null);
  const [pendingProductEmbedding, setPendingProductEmbedding] = useState(null);

  // CLIP image and text encoders share one 512-dimensional vector space.
  // Each model is downloaded only when its corresponding feature is requested.
  const imageEmbedder = useImageEmbedder(
    models.imageEmbeddings.CLIP_VIT_BASE_PATCH32.DEFAULT,
    { preventLoad: !aiImageRequested }
  );
  const textEmbedder = useTextEmbedder(
    models.textEmbeddings.CLIP_VIT_BASE_PATCH32_TEXT.DEFAULT,
    { preventLoad: !aiTextRequested }
  );

  const setAuthField = (key, value) => setAuthFields((old) => ({ ...old, [key]: value }));


  // Run a queued search as soon as the encoder required by that search is ready.
  useEffect(() => {
    if (!pendingAiSearch) return;
    const neededEmbedder = pendingAiSearch.type === 'image' ? imageEmbedder : textEmbedder;
    if (!neededEmbedder.isReady) return;
    let cancelled = false;
    (async () => {
      setAiBusy(true);
      setAiMessage('يجري تحليل طلبك ومطابقة المنتجات...');
      try {
        let vector;
        if (pendingAiSearch.type === 'image') {
          if (!imageEmbedder.embed) throw new Error('محرك الصور لم يصبح جاهزًا بعد.');
          const imageBuffer = await imageUriToClipBuffer(pendingAiSearch.value);
          vector = await imageEmbedder.embed(imageBuffer);
        } else {
          if (!textEmbedder.embed) throw new Error('محرك النصوص لم يصبح جاهزًا بعد.');
          vector = await textEmbedder.embed(toClipPrompt(pendingAiSearch.value));
        }
        const matches = await findProductsByEmbedding(vector);
        if (cancelled) return;
        setActiveCategory('الكل');
        setActiveTab('search');
        if (matches.length) {
          setAiResults(matches);
          setSearchText('');
          setAiMessage(`عثرنا على ${matches.length} منتجًا مشابهًا بالبحث الذكي.`);
          Alert.alert('اكتمل البحث الذكي', `عثرنا على ${matches.length} منتجًا مشابهًا.`);
        } else if (pendingAiSearch.type === 'text') {
          // Preserve the existing Arabic/French/Darja lexical search as a fallback.
          setSearchText(pendingAiSearch.value);
          setAiMessage('لم نجد تطابقًا دلاليًا؛ عرضنا نتائج البحث النصي المعتاد.');
          Alert.alert('لا توجد مطابقة ذكية', 'جرّب وصفًا أقصر أو اسم المنتج، وعرضنا نتائج البحث النصي المعتاد.');
        } else {
          setAiMessage('لم نعثر على منتجات مشابهة.');
          Alert.alert('لا توجد نتائج', 'لم نعثر على منتجات مشابهة لهذه الصورة بعد.');
        }
      } catch (error) {
        if (!cancelled) {
          setAiMessage('تعذر إكمال البحث الذكي.');
          Alert.alert('تعذر البحث الذكي', error?.message || 'تحقق من تحديث قاعدة البيانات ثم أعد المحاولة.');
        }
      } finally {
        if (!cancelled) {
          setAiBusy(false);
          setPendingAiSearch(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pendingAiSearch, imageEmbedder.isReady, textEmbedder.isReady]);

  // If a seller adds a product before the models finish downloading, index its image later.
  useEffect(() => {
    if (!pendingProductEmbedding || !imageEmbedder.isReady || !imageEmbedder.embed) return;
    let cancelled = false;
    (async () => {
      try {
        const buffer = await imageUriToClipBuffer(pendingProductEmbedding.uri);
        const vector = await imageEmbedder.embed(buffer);
        const { error } = await supabase
          .from('products')
          .update({ embedding: Array.from(vector) })
          .eq('id', pendingProductEmbedding.id);
        if (error) throw error;
        if (!cancelled) setConnectionStatus('تم تجهيز صورة المنتج للبحث الذكي.');
      } catch (error) {
        if (!cancelled) setConnectionStatus('حُفظ المنتج، لكن تعذرت فهرسة صورته بالذكاء الاصطناعي: ' + (error?.message || 'خطأ غير معروف'));
      } finally {
        if (!cancelled) setPendingProductEmbedding(null);
      }
    })();
    return () => { cancelled = true; };
  }, [pendingProductEmbedding, imageEmbedder.isReady]);

  function queueAiSearch(type, value) {
    if (!value || !String(value).trim()) {
      Alert.alert('بيانات البحث ناقصة', 'اختر صورة أو اكتب وصف المنتج أولًا.');
      return;
    }
    if (type === 'image') setAiImageRequested(true);
    else setAiTextRequested(true);
    setAiResults(null);
    setPendingAiSearch({ type, value: type === 'text' ? String(value).trim() : value });
    const neededEmbedder = type === 'image' ? imageEmbedder : textEmbedder;
    if (!neededEmbedder.isReady) {
      setAiMessage('يتم تنزيل نموذج الذكاء الاصطناعي لأول مرة. اترك التطبيق مفتوحًا حتى يكتمل التحميل.');
    }
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session || null);
        if (data.session?.user) loadProfile(data.session.user);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (active) {
        setSession(newSession || null);
        if (newSession?.user) setTimeout(() => loadProfile(newSession.user), 0);
        else setProfile(null);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  // Restore favourites from Supabase for signed-in users; use local storage as a resilient fallback.
  useEffect(() => {
    let cancelled = false;
    const userId = session?.user?.id || null;
    const storageKey = userId ? `wherebuy:favorites:${userId}` : 'wherebuy:favorites:guest';

    async function restoreFavorites() {
      if (userId) {
        try {
          const { data, error } = await supabase
            .from('favorites')
            .select('product_id')
            .eq('user_id', userId);
          if (error) throw error;
          const ids = (data || []).map((row) => String(row.product_id));
          if (!cancelled) setFavorites(ids);
          await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
          return;
        } catch (e) {
          if (!cancelled) setConnectionStatus('تعذر مزامنة المفضلة؛ ستُحفظ محليًا: ' + (e?.message || 'خطأ غير معروف'));
        }
      }

      try {
        const stored = await AsyncStorage.getItem(storageKey);
        const parsed = stored ? JSON.parse(stored) : [];
        if (!cancelled) setFavorites(Array.isArray(parsed) ? parsed.map(String) : []);
      } catch (_) {
        if (!cancelled) setFavorites([]);
      }
    }

    restoreFavorites();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  async function loadProfile(user) {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;

      let currentProfile = data;
      if (!currentProfile) {
        const meta = user.user_metadata || {};
        const row = {
          id: user.id,
          full_name: meta.full_name || (user.email ? user.email.split('@')[0] : ''),
          phone: meta.phone || null,
          role: meta.role || 'customer',
          age: meta.age && Number.isFinite(Number(meta.age)) ? Number(meta.age) : null,
          vehicle_type: meta.vehicle_type || null,
        };
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .upsert(row, { onConflict: 'id' })
          .select('*')
          .single();
        if (createError) throw createError;
        currentProfile = created;
      }

      setProfile(currentProfile);
      if (['company', 'store'].includes(currentProfile?.role || user.user_metadata?.role)) {
        const meta = user.user_metadata || {};
        await ensureCompany(user, {
          ...meta,
          full_name: meta.full_name || currentProfile?.full_name || '',
          phone: meta.phone || currentProfile?.phone || null,
          role: currentProfile?.role || meta.role || 'store',
        });
      }
      return currentProfile;
    } catch (e) {
      setConnectionStatus('تعذر تحميل الحساب: ' + (e?.message || 'خطأ غير معروف'));
      return null;
    }
  }

  async function ensureCompany(user, meta) {
    const { data: existing, error: findError } = await supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle();
    if (findError) throw findError;
    if (existing) return;
    const rawLat = meta.latitude === null || meta.latitude === undefined ? '' : String(meta.latitude).trim();
    const rawLng = meta.longitude === null || meta.longitude === undefined ? '' : String(meta.longitude).trim();
    const lat = rawLat === '' ? NaN : Number(rawLat.replace(',', '.'));
    const lng = rawLng === '' ? NaN : Number(rawLng.replace(',', '.'));
    const row = {
      owner_id: user.id,
      name: meta.company_name || meta.full_name || 'متجر جديد',
      registration_number: meta.registration_number || null,
      business_type: meta.business_type || meta.role,
      description: meta.business_description || '',
      phone: meta.phone || null,
      address: meta.address || '',
      latitude: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null,
      longitude: Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null,
    };
    const { error } = await supabase.from('companies').insert(row);
    if (error) throw error;
  }

  async function pickDriverImage(which) {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('إذن الصور مطلوب', 'اسمح للتطبيق بالوصول إلى الصور لاختيار الوثيقة.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setDriverFiles((old) => ({ ...old, [which]: result.assets[0] }));
      }
    } catch (e) {
      Alert.alert('تعذر اختيار الصورة', e?.message || 'حدث خطأ أثناء فتح معرض الصور.');
    }
  }

  async function pickProductImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('إذن الصور مطلوب', 'اسمح للتطبيق بالوصول إلى الصور لاختيار صورة المنتج.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) setProductImage(result.assets[0]);
    } catch (e) {
      Alert.alert('تعذر اختيار الصورة', e.message || 'حدث خطأ أثناء فتح معرض الصور.');
    }
  }

  async function submitProduct() {
    if (productBusy) return;
    if (!session?.user) {
      Alert.alert('تسجيل الدخول مطلوب', 'سجّل الدخول بحساب صاحب متجر أو شركة أولًا.');
      setActiveTab('profile');
      return;
    }
    if (!['company', 'store'].includes(profile?.role || session.user.user_metadata?.role)) {
      Alert.alert('غير مسموح', 'إضافة المنتجات متاحة لحسابات المتاجر والشركات فقط.');
      return;
    }
    const name = productForm.name.trim();
    const price = Number(String(productForm.price).trim().replace(',', '.')); 
    const stock = Number.parseInt(productForm.stock, 10);
    if (!name) {
      Alert.alert('اسم المنتج مطلوب', 'اكتب اسم المنتج أولًا.');
      return;
    }
    if (!productForm.price.trim() || !Number.isFinite(price) || price < 0) {
      Alert.alert('السعر غير صحيح', 'أدخل سعرًا صحيحًا بالدينار الجزائري.');
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      Alert.alert('الكمية غير صحيحة', 'أدخل كمية صحيحة تساوي صفرًا أو أكثر.');
      return;
    }
    if (!productImage?.uri) {
      Alert.alert('صورة المنتج مطلوبة', 'اختر صورة حقيقية للمنتج من هاتفك.');
      return;
    }

    setProductBusy(true);
    let uploadedPath = null;
    let productRowCreated = false;
    try {
      const user = session.user;
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id,name,address,phone,latitude,longitude')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (companyError) throw companyError;
      if (!company?.id) {
        throw new Error('لم نعثر على متجر مرتبط بحسابك. سجّل بيانات المتجر أو تواصل معنا لإصلاح ربط الحساب.');
      }

      const uriParts = productImage.uri.split('?')[0].split('.');
      const extension = (uriParts.length > 1 ? uriParts.pop() : 'jpg').toLowerCase();
      const safeExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg';
      uploadedPath = `${user.id}/products/product-${Date.now()}.${safeExtension}`;
      const response = await fetch(productImage.uri);
      if (!response.ok) throw new Error('تعذّر قراءة الصورة من الهاتف. حاول اختيار الصورة مرة أخرى.');
      const imageBody = await response.arrayBuffer();
      const contentType = productImage.mimeType || (safeExtension === 'png' ? 'image/png' : safeExtension === 'webp' ? 'image/webp' : 'image/jpeg');
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(uploadedPath, imageBody, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('product-images').getPublicUrl(uploadedPath);
      const imageUrl = publicData?.publicUrl;
      if (!imageUrl) throw new Error('تم رفع الصورة لكن تعذّر إنشاء رابطها العام. تحقق من إعداد Public bucket.');

      let productEmbedding = null;
      if (imageEmbedder.isReady && imageEmbedder.embed) {
        try {
          const imageBuffer = await imageUriToClipBuffer(productImage.uri);
          productEmbedding = Array.from(await imageEmbedder.embed(imageBuffer));
        } catch (_) {
          // Product creation must remain possible even if local AI indexing fails.
          productEmbedding = null;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert({
          company_id: company.id,
          name,
          description: productForm.description.trim() || null,
          price,
          stock,
          image_url: imageUrl,
          embedding: productEmbedding,
        })
        .select('id, name, description, price, image_url, stock, company_id')
        .single();
      if (insertError) throw insertError;
      productRowCreated = true;

      setProducts((old) => [
        mapDatabaseProduct({
          ...inserted,
          store: company.name || 'متجر غير محدد',
          store_address: company.address || '',
          store_phone: company.phone || '',
          latitude: company.latitude ?? null,
          longitude: company.longitude ?? null,
        }),
        ...old.filter((item) => item.id !== String(inserted.id)),
      ]);
      if (!productEmbedding) {
        setAiImageRequested(true);
        setPendingProductEmbedding({ id: inserted.id, uri: productImage.uri });
      }
      setProductForm({ name: '', description: '', price: '', stock: '1' });
      setProductImage(null);
      setActiveTab('home');
      Alert.alert('تمت إضافة المنتج 🎉', productEmbedding
        ? 'رُفعت الصورة وحُفظ المنتج وأُضيف إلى فهرس البحث الذكي.'
        : 'حُفظ المنتج بنجاح. سيُجهّز فهرس صورته بعد تحميل نموذج الذكاء الاصطناعي.');
    } catch (e) {
      if (uploadedPath && !productRowCreated) {
        try {
          await supabase.storage.from('product-images').remove([uploadedPath]);
        } catch (_) { /* cleanup is best-effort; preserve the original error */ }
      }
      Alert.alert('تعذرت إضافة المنتج', e?.message || 'حدث خطأ غير متوقع.');
    } finally {
      setProductBusy(false);
    }
  }

  async function uploadDriverFiles(user) {
    if (!user || (user.user_metadata?.role !== 'driver' && profile?.role !== 'driver' && authRole !== 'driver')) return;
    const updates = {};
    const uploadOne = async (asset, label) => {
      if (!asset?.uri) return null;
      const ext = (asset.uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const path = `${user.id}/${label}-${Date.now()}.${safeExt}`;
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('تعذّر قراءة أحد الملفات من الهاتف. أعد اختياره ثم حاول مجددًا.');
      const body = await response.arrayBuffer();
      const { error } = await supabase.storage.from('driver-documents').upload(path, body, {
        contentType: asset.mimeType || (safeExt === 'png' ? 'image/png' : 'image/jpeg'),
        upsert: true,
      });
      if (error) throw error;
      return path;
    };
    if (driverFiles.avatar) updates.avatar_path = await uploadOne(driverFiles.avatar, 'avatar');
    if (driverFiles.idCard) updates.id_card_path = await uploadOne(driverFiles.idCard, 'id-card');
    if (driverFiles.vehicleRegistration) updates.vehicle_registration_path = await uploadOne(driverFiles.vehicleRegistration, 'vehicle-registration');
    if (Object.keys(updates).length) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      setDriverFiles({ avatar: null, idCard: null, vehicleRegistration: null });
    }
  }

  async function submitAuth() {
    if (authBusy) return;
    const email = authFields.email.trim().toLowerCase();
    if (!email || !authFields.password) {
      Alert.alert('بيانات ناقصة', 'أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }
    if (authMode === 'register' && !authFields.full_name.trim()) {
      Alert.alert('الاسم مطلوب', 'أدخل الاسم أو اسم صاحب الحساب.');
      return;
    }
    if (authMode === 'register' && authFields.password.length < 6) {
      Alert.alert('كلمة المرور قصيرة', 'استخدم 6 أحرف على الأقل.');
      return;
    }
    if (authMode === 'register' && ['company', 'store'].includes(authRole) && !authFields.company_name.trim()) {
      Alert.alert('اسم النشاط مطلوب', 'اكتب اسم الشركة أو المحل قبل إنشاء الحساب.');
      return;
    }
    if (authMode === 'register' && authRole === 'driver' && !authFields.vehicle_type.trim()) {
      Alert.alert('نوع المركبة مطلوب', 'اختر نوع المركبة.');
      return;
    }
    setAuthBusy(true);
    try {
      let user = null;
      if (authMode === 'register') {
        const metadata = {
          role: authRole,
          full_name: authFields.full_name.trim(),
          age: authFields.age,
          phone: authFields.phone,
          company_name: authFields.company_name,
          registration_number: authFields.registration_number,
          business_type: authRole === 'store' ? 'store' : authFields.business_type,
          address: authFields.address,
          business_description: authFields.business_description,
          latitude: authFields.latitude,
          longitude: authFields.longitude,
          vehicle_type: authFields.vehicle_type,
        };
        const { data, error } = await supabase.auth.signUp({ email, password: authFields.password, options: { data: metadata } });
        if (error) throw error;
        user = data.user;
        if (!data.session) {
          Alert.alert('تحقق من بريدك', 'أُرسل طلب التسجيل. إذا كان تأكيد البريد مفعّلًا، أكّد بريدك ثم سجّل الدخول. بعد تسجيل الدخول يمكنك رفع وثائق السائق.');
          setAuthMode('login');
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: authFields.password });
        if (error) throw error;
        user = data.user;
      }
      if (user) {
        const meta = user.user_metadata || {};
        const { data: existingProfile, error: existingProfileError } = await supabase
          .from('profiles')
          .select('id,full_name,phone,role,age,vehicle_type')
          .eq('id', user.id)
          .maybeSingle();
        if (existingProfileError) throw existingProfileError;

        // The database profile is authoritative; never downgrade an existing seller/driver to customer.
        const role = existingProfile?.role || meta.role || (authMode === 'register' ? authRole : 'customer');
        const fullName = meta.full_name || authFields.full_name.trim() || existingProfile?.full_name || email.split('@')[0];
        const phone = meta.phone || authFields.phone.trim() || existingProfile?.phone || null;
        const ageValue = meta.age ?? (authMode === 'register' ? authFields.age : existingProfile?.age);
        const parsedAge = ageValue !== null && ageValue !== undefined && String(ageValue).trim() !== ''
          ? Number(ageValue)
          : null;
        const vehicleType = meta.vehicle_type || (authMode === 'register' ? authFields.vehicle_type : null) || existingProfile?.vehicle_type || null;

        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName,
          phone,
          role,
          age: parsedAge !== null && Number.isFinite(parsedAge) ? parsedAge : null,
          vehicle_type: vehicleType,
        }, { onConflict: 'id' });
        if (profileError) throw profileError;

        if (['company', 'store'].includes(role)) {
          await ensureCompany(user, {
            ...authFields,
            ...meta,
            full_name: fullName,
            phone,
            role,
          });
        }
        if (role === 'driver') await uploadDriverFiles(user);
        await loadProfile(user);
        setActiveTab('profile');
        Alert.alert(authMode === 'register' ? 'تم إنشاء الحساب' : 'تم تسجيل الدخول', 'أصبحت متصلًا بتطبيق Where Buy.');
      }
    } catch (e) {
      Alert.alert('تعذر إكمال العملية', e.message || 'حدث خطأ غير متوقع.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setProfile(null);
      setAuthMode('login');
      try {
        const stored = await AsyncStorage.getItem('wherebuy:favorites:guest');
        setFavorites(stored ? JSON.parse(stored) : []);
      } catch (_) {
        setFavorites([]);
      }
    } catch (e) {
      Alert.alert('تعذر تسجيل الخروج', e?.message || 'حدث خطأ أثناء تسجيل الخروج.');
    }
  }

  useEffect(() => {
    if (activeTab !== 'map') return;
    let alive = true;
    setCompaniesLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id,name,address,latitude,longitude');
        if (error) throw error;
        if (!alive) return;
        setCompanies((data || []).filter((c) =>
          c.latitude !== null && c.latitude !== undefined &&
          c.longitude !== null && c.longitude !== undefined &&
          Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)) &&
          Number(c.latitude) >= -90 && Number(c.latitude) <= 90 &&
          Number(c.longitude) >= -180 && Number(c.longitude) <= 180
        ));
      } catch (e) {
        if (alive) Alert.alert('تعذر تحميل المتاجر', e?.message || 'تحقق من الاتصال بقاعدة البيانات.');
      } finally {
        if (alive) setCompaniesLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, description, price, image_url, stock, company_id, created_at')
          .order('created_at', { ascending: false });

        if (error) throw error;

        let companyById = {};
        try {
          const { data: companyRows, error: companyError } = await supabase
            .from('companies')
            .select('id,name,address,phone,latitude,longitude');
          if (companyError) throw companyError;
          companyById = Object.fromEntries((companyRows || []).map((company) => [String(company.id), company]));
        } catch (_) {
          // Products remain available even if the public company listing cannot be loaded.
        }

        if (isMounted) {
          const mapped = (data || []).map((row) => {
            const company = companyById[String(row.company_id)] || {};
            return mapDatabaseProduct({
              ...row,
              store: company.name || 'متجر غير محدد',
              store_address: company.address || '',
              store_phone: company.phone || '',
              latitude: company.latitude ?? null,
              longitude: company.longitude ?? null,
            });
          });
          setProducts(mapped);
          setConnectionStatus(
            'تم الاتصال بنجاح! عدد المنتجات: ' + mapped.length
          );
        }
      } catch (error) {
        if (isMounted) {
          setConnectionStatus('تعذر تحميل المنتجات: ' + error.message);
        }
      }
    }

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleFavorite = async (id) => {
    const productId = String(id);
    const wasFavorite = favorites.includes(productId);
    const nextFavorites = wasFavorite
      ? favorites.filter((item) => item !== productId)
      : [...favorites, productId];
    const userId = session?.user?.id || null;
    const storageKey = userId ? `wherebuy:favorites:${userId}` : 'wherebuy:favorites:guest';

    // Update the UI immediately; persist locally regardless of network state.
    setFavorites(nextFavorites);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextFavorites));
    } catch (_) { /* memory state still works during this session */ }

    if (!userId) return;

    try {
      if (wasFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: userId, product_id: productId });
        if (error) throw error;
      }
    } catch (e) {
      setConnectionStatus('حُفظت المفضلة على هذا الجهاز؛ تعذرت المزامنة: ' + (e?.message || 'خطأ غير معروف'));
    }
  };

  const openProduct = (product) => {
    Alert.alert(
      product.name,
      'السعر: ' + formatPrice(product.price) +
        '\nالمتجر: ' + product.store +
        (product.store_address ? '\nالعنوان: ' + product.store_address : '') +
        (product.store_phone ? '\nالهاتف: ' + product.store_phone : '') +
        '\nالمخزون: ' + product.stock +
        (product.description ? '\nالوصف: ' + product.description : ''),
      [{ text: 'حسنًا' }]
    );
  };

  // AI results are a separate view; the original full catalogue is never replaced.
  const useAiResults = aiResults !== null && activeTab === 'search';
  const baseProducts = useAiResults ? aiResults : products;

  const filteredProducts = baseProducts.filter((product) => {
    const matchesSearch = useAiResults || productMatchesSearch(product, searchText);

    const matchesCategory =
      activeCategory === 'الكل' ||
      product.category === activeCategory;

    const matchesFavorite =
      activeTab !== 'favorites' ||
      favorites.includes(product.id);

    return matchesSearch && matchesCategory && matchesFavorite;
  });

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>W</Text>
        </View>

        <View style={styles.brandTextContainer}>
          <Text style={styles.brandName}>
            Where <Text style={styles.brandAccent}>Buy</Text>
          </Text>
          <Text style={styles.brandSubtitle}>
            ابحث، قارن، واشترِ بذكاء
          </Text>
        </View>

        <TouchableOpacity
          style={styles.walletButton}
          onPress={() => setActiveTab('wallet')}
        >
          <Text style={styles.walletIcon}>👛</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.locationRow}>
        <Text style={styles.locationPin}>📍</Text>
        <View>
          <Text style={styles.locationLabel}>موقعك الحالي</Text>
          <Text style={styles.locationValue}>
            الجزائر · حدد موقعك لاحقًا
          </Text>
        </View>
      </View>

      <View style={styles.connectionStatusBox}>
        <Text style={styles.connectionStatusText}>
          {connectionStatus}
        </Text>
      </View>
    </View>
  );

  const renderSearchBox = () => (
    <View style={styles.searchBox}>
      <Text style={styles.searchIcon}>⌕</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="عن ماذا تبحث ؟؟"
        placeholderTextColor={COLORS.muted}
        value={searchText}
        onChangeText={(text) => {
          setSearchText(text);
          if (aiResults !== null) setAiResults(null);
          if (aiMessage && !aiBusy) setAiMessage('');
        }}
        textAlign="right"
        returnKeyType="search"
        onSubmitEditing={() => queueAiSearch('text', searchText)}
      />

      <TouchableOpacity
        style={styles.cameraButton}
        onPress={async () => {
          try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('إذن الصور مطلوب', 'اسمح للتطبيق باختيار صورة للمنتج.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]) {
              queueAiSearch('image', result.assets[0].uri);
            }
          } catch (e) {
            Alert.alert('تعذر فتح الصور', e?.message || 'حدث خطأ غير متوقع.');
          }
        }}
        disabled={aiBusy}
      >
        <Text style={styles.cameraIcon}>📷</Text>
      </TouchableOpacity>
      {(() => {
        const pendingModel =
          pendingAiSearch?.type === 'image' ? imageEmbedder :
          pendingAiSearch?.type === 'text' ? textEmbedder :
          aiTextRequested && !textEmbedder.isReady ? textEmbedder :
          aiImageRequested && !imageEmbedder.isReady ? imageEmbedder :
          null;
        if (aiBusy) return <Text style={styles.aiStatusText}>يجري البحث الذكي...</Text>;
        if (pendingModel && !pendingModel.isReady) {
          return (
            <Text style={styles.aiStatusText}>
              {`تحميل نموذج الذكاء الاصطناعي: ${Math.round(pendingModel.downloadProgress || 0)}%`}
            </Text>
          );
        }
        if (aiMessage) return <Text style={styles.aiStatusText}>{aiMessage}</Text>;
        return null;
      })()}
    </View>
  );

  const renderCategories = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoriesRow}
    >
      {CATEGORIES.map((category) => {
        const selected = activeCategory === category.name;

        return (
          <TouchableOpacity
            key={category.name}
            style={[
              styles.categoryChip,
              selected && styles.categorySelected,
            ]}
            onPress={() => setActiveCategory(category.name)}
          >
            <Text style={styles.categoryEmoji}>
              {category.emoji}
            </Text>
            <Text
              style={[
                styles.categoryText,
                selected && styles.categoryTextSelected,
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderProductGrid = (products) => {
    if (products.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔎</Text>
          <Text style={styles.emptyTitle}>
            لم نعثر على منتجات
          </Text>
          <Text style={styles.emptySubtitle}>
            جرب البحث بكلمة أخرى
          </Text>
        </View>
      );
    }

    const rows = [];

    for (let i = 0; i < products.length; i += 2) {
      rows.push(products.slice(i, i + 2));
    }

    return (
      <View>
        {rows.map((row, index) => (
          <View style={styles.productRow} key={index}>
            {row.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isFavorite={favorites.includes(product.id)}
                onFavorite={toggleFavorite}
                onPress={() => openProduct(product)}
              />
            ))}

            {row.length === 1 && (
              <View style={styles.productCardPlaceholder} />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderHome = () => (
    <>
      {renderHeader()}

      <View style={styles.mainContent}>
        {renderSearchBox()}

        <TouchableOpacity
          style={styles.aiBanner}
          onPress={() => setActiveTab('describe')}
          activeOpacity={0.85}
        >
          <View style={styles.aiTextContainer}>
            <Text style={styles.aiTitle}>
              لم تجد ما تبحث عنه؟
            </Text>
            <Text style={styles.aiSubtitle}>
              صف لنا شكل المنتج ودعنا نساعدك
            </Text>
            <View style={styles.aiButton}>
              <Text style={styles.aiButtonText}>
                جرّب اوصف لي ←
              </Text>
            </View>
          </View>

          <View style={styles.robotCircle}>
            <Text style={styles.robotEmoji}>🤖</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>
              اكتشف المنتجات
            </Text>
            <Text style={styles.sectionSubtitle}>
              عروض ومنتجات متنوعة
            </Text>
          </View>

          <Text style={styles.resultCount}>
            {filteredProducts.length} منتجات
          </Text>
        </View>

        {renderCategories()}

        {renderProductGrid(filteredProducts)}
      </View>
    </>
  );

  const renderSearch = () => (
    <View style={styles.pageContent}>
      <Text style={styles.pageTitle}>ابحث عن منتج 🔎</Text>
      <Text style={styles.pageSubtitle}>
        اكتب اسم المنتج لمعرفة الأسعار التجريبية المتاحة.
      </Text>

      {renderSearchBox()}

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>نتائج البحث</Text>
        <Text style={styles.resultCount}>
          {filteredProducts.length} نتائج
        </Text>
      </View>

      {renderProductGrid(filteredProducts)}
    </View>
  );

  const renderDescribe = () => (
    <View style={styles.pageContent}>
      <View style={styles.describeHero}>
        <Text style={styles.describeRobot}>🤖</Text>
        <Text style={styles.describeTitle}>اوصف لي</Text>
        <Text style={styles.describeSubtitle}>
          أخبرنا كيف يبدو المنتج الذي تبحث عنه.
        </Text>
      </View>

      <Text style={styles.fieldLabel}>صف المنتج الذي تريده</Text>

      <TextInput
        style={styles.descriptionInput}
        placeholder="مثلاً: حذاء أبيض رياضي بخطوط سوداء..."
        placeholderTextColor={COLORS.muted}
        value={description}
        onChangeText={setDescription}
        multiline
        textAlign="right"
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (!description.trim()) {
            Alert.alert('اكتب وصفًا أولًا', 'أدخل وصف المنتج الذي تريد العثور عليه.');
            return;
          }
          queueAiSearch('text', description);
        }}
        disabled={aiBusy}
      >
        <Text style={styles.primaryButtonText}>
          🔎 ابحث عن المنتج
        </Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>كيف يعمل؟</Text>
        <Text style={styles.infoText}>
          ١. صف المنتج أو لونه أو شكله.
        </Text>
        <Text style={styles.infoText}>
          ٢. نبحث عن المنتجات المطابقة.
        </Text>
        <Text style={styles.infoText}>
          ٣. نطوّر لاحقًا مقارنة الأسعار والمتاجر.
        </Text>
      </View>
    </View>
  );

  const renderFavorites = () => {
    const favoriteProducts = products.filter((product) =>
      favorites.includes(product.id)
    );

    return (
      <View style={styles.pageContent}>
        <Text style={styles.pageTitle}>منتجاتي المفضلة ♥</Text>
        <Text style={styles.pageSubtitle}>
          المنتجات التي حفظتها للرجوع إليها لاحقًا.
        </Text>

        {renderProductGrid(favoriteProducts)}
      </View>
    );
  };

  const renderWallet = () => (
    <View style={styles.pageContent}>
      <Text style={styles.pageTitle}>محفظتي 👛</Text>
      <Text style={styles.pageSubtitle}>
        مساحة لإدارة رصيدك ومدفوعاتك مستقبلًا.
      </Text>

      <View style={styles.walletCard}>
        <Text style={styles.walletCardLabel}>رصيد المحفظة</Text>
        <Text style={styles.walletBalance}>0.00 دج</Text>
        <Text style={styles.walletCardNote}>
          ستظهر معلومات الرصيد بعد ربط المحفظة بخدمة دفع مناسبة.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>خدمات المحفظة</Text>
        <Text style={styles.infoText}>💳 إدارة وسائل الدفع</Text>
        <Text style={styles.infoText}>🧾 سجل المعاملات</Text>
        <Text style={styles.infoText}>🔒 حماية معلوماتك المالية</Text>
      </View>
    </View>
  );

  const renderManageProducts = () => {
    const role = profile?.role || session?.user?.user_metadata?.role;
    if (!session?.user || !['company', 'store'].includes(role)) {
      return (
        <View style={styles.pageContent}>
          <Text style={styles.pageTitle}>إضافة منتج</Text>
          <Text style={styles.pageSubtitle}>هذه الصفحة مخصصة لأصحاب المتاجر والشركات فقط.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setActiveTab('profile')}>
            <Text style={styles.primaryButtonText}>العودة إلى حسابي</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const updateProductField = (key, value) => setProductForm((old) => ({ ...old, [key]: value }));
    const input = (key, label, options = {}) => (
      <View key={key} style={styles.authFieldWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={[styles.authInput, options.multiline && { minHeight: 86, textAlignVertical: 'top' }]}
          placeholder={label}
          placeholderTextColor={COLORS.muted}
          value={productForm[key]}
          onChangeText={(value) => updateProductField(key, value)}
          textAlign="right"
          keyboardType={options.keyboardType || 'default'}
          autoCapitalize={options.autoCapitalize || 'sentences'}
          multiline={options.multiline || false}
        />
      </View>
    );

    return (
      <View style={styles.pageContent}>
        <Text style={styles.pageTitle}>إضافة منتج جديد 🛍️</Text>
        <Text style={styles.pageSubtitle}>أضف منتجًا لمتجرك. ستُرفع الصورة إلى Supabase وتظهر للمستخدمين بعد الحفظ.</Text>
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.imagePickerCard} onPress={pickProductImage} activeOpacity={0.8}>
            {productImage?.uri ? (
              <Image source={{ uri: productImage.uri }} style={styles.productPreview} resizeMode="cover" />
            ) : (
              <>
                <Text style={styles.imagePickerEmoji}>📸</Text>
                <Text style={styles.secondaryButtonText}>اضغط لاختيار صورة المنتج</Text>
                <Text style={styles.smallNote}>اختر صورة واضحة من معرض هاتفك</Text>
              </>
            )}
          </TouchableOpacity>
          {productImage?.uri ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={pickProductImage}>
              <Text style={styles.secondaryButtonText}>تغيير الصورة</Text>
            </TouchableOpacity>
          ) : null}
          {input('name', 'اسم المنتج')}
          {input('description', 'وصف المنتج (اختياري)', { multiline: true })}
          {input('price', 'السعر بالدينار الجزائري', { keyboardType: 'decimal-pad' })}
          {input('stock', 'الكمية المتوفرة', { keyboardType: 'number-pad' })}
          <TouchableOpacity style={styles.primaryButton} onPress={submitProduct} disabled={productBusy}>
            {productBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>☁️ رفع الصورة وحفظ المنتج</Text>}
          </TouchableOpacity>
          <Text style={styles.smallNote}>يُسمح بالإضافة لحساب صاحب المتجر أو الشركة المسجّل فقط.</Text>
        </View>
      </View>
    );
  };

  const renderProfile = () => {
    if (session?.user) {
      return (
        <View style={styles.pageContent}>
          <Text style={styles.pageTitle}>حسابي 👤</Text>
          <View style={styles.profileCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.full_name || session.user.email || 'W').slice(0, 1).toUpperCase()}</Text></View>
            <Text style={styles.profileName}>{profile?.full_name || session.user.email}</Text>
            <Text style={styles.pageSubtitle}>{session.user.email}</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>نوع الحساب</Text>
              <Text style={styles.infoText}>{({customer:'زبون', company:'شركة', store:'محل', driver:'سائق توصيل'})[profile?.role] || 'مستخدم'}</Text>
              {profile?.phone ? <Text style={styles.infoText}>الهاتف: {profile.phone}</Text> : null}
              {profile?.role === 'driver' ? <Text style={styles.infoText}>المركبة: {profile.vehicle_type || 'غير محددة'}</Text> : null}
            </View>
            {['company', 'store'].includes(profile?.role) ? (
              <TouchableOpacity style={styles.primaryButton} onPress={() => setActiveTab('manageProducts')}>
                <Text style={styles.primaryButtonText}>＋ إدارة المنتجات وإضافة منتج</Text>
              </TouchableOpacity>
            ) : null}
            {profile?.role === 'driver' ? (
              <View style={{ width: '100%' }}>
                <Text style={styles.fieldLabel}>إكمال وثائق السائق</Text>
                {[
                  ['avatar', '📸 اختيار الصورة الشخصية'],
                  ['idCard', '🪪 اختيار بطاقة التعريف'],
                  ['vehicleRegistration', '🛵 اختيار البطاقة الرمادية'],
                ].map(([key, label]) => (
                  <TouchableOpacity key={key} style={styles.secondaryButton} onPress={() => pickDriverImage(key)}>
                    <Text style={styles.secondaryButtonText}>{driverFiles[key] ? '✓ ' : ''}{label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.primaryButton} onPress={async () => {
                  setAuthBusy(true);
                  try { await uploadDriverFiles(session.user); await loadProfile(session.user); Alert.alert('تم الحفظ', 'تم رفع الملفات المختارة إلى التخزين الخاص.'); }
                  catch (e) { Alert.alert('تعذر رفع الملفات', e.message); }
                  finally { setAuthBusy(false); }
                }}>
                  <Text style={styles.primaryButtonText}>{authBusy ? 'جارٍ الرفع...' : 'رفع الوثائق بأمان'}</Text>
                </TouchableOpacity>
                <Text style={styles.smallNote}>اختر الملفات ثم ارفعها. الوثائق تحفظ في مساحة خاصة وليست روابط عامة.</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={signOut}><Text style={styles.secondaryButtonText}>تسجيل الخروج</Text></TouchableOpacity>
          </View>
        </View>
      );
    }

    const roleOptions = [
      ['customer', 'زبون'], ['company', 'شركة'], ['store', 'محل'], ['driver', 'سائق توصيل'],
    ];
    const field = (key, label, options = {}) => (
      <View key={key} style={styles.authFieldWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={[styles.authInput, options.multiline && { minHeight: 86, textAlignVertical: 'top' }]}
          placeholder={options.placeholder || label}
          placeholderTextColor={COLORS.muted}
          value={authFields[key]}
          onChangeText={(value) => setAuthField(key, value)}
          textAlign="right"
          secureTextEntry={options.secure || false}
          keyboardType={options.keyboardType || 'default'}
          autoCapitalize={options.autoCapitalize || 'sentences'}
          multiline={options.multiline || false}
        />
      </View>
    );
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.pageContent}>
        <Text style={styles.pageTitle}>{authMode === 'login' ? 'مرحبًا بعودتك 👋' : 'أنشئ حساب Where Buy'}</Text>
        <Text style={styles.pageSubtitle}>سجّل الدخول أو اختر نوع الحساب لإنشاء حساب جديد.</Text>
        <View style={styles.authModeRow}>
          <TouchableOpacity style={[styles.authModeButton, authMode === 'login' && styles.authModeSelected]} onPress={() => setAuthMode('login')}><Text style={[styles.authModeText, authMode === 'login' && styles.authModeTextSelected]}>تسجيل الدخول</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.authModeButton, authMode === 'register' && styles.authModeSelected]} onPress={() => setAuthMode('register')}><Text style={[styles.authModeText, authMode === 'register' && styles.authModeTextSelected]}>حساب جديد</Text></TouchableOpacity>
        </View>
        {authMode === 'register' ? (
          <>
            <Text style={styles.fieldLabel}>نوع الحساب</Text>
            <View style={styles.roleGrid}>{roleOptions.map(([value, label]) => (
              <TouchableOpacity key={value} style={[styles.roleChip, authRole === value && styles.roleChipSelected]} onPress={() => setAuthRole(value)}><Text style={[styles.roleChipText, authRole === value && styles.roleChipTextSelected]}>{label}</Text></TouchableOpacity>
            ))}</View>
            {field('full_name', authRole === 'company' ? 'اسم المسؤول' : authRole === 'store' ? 'اسم صاحب المحل' : 'الاسم الكامل')}
            {authRole === 'customer' || authRole === 'driver' ? field('age', 'العمر', { keyboardType: 'number-pad' }) : null}
            {field('phone', 'رقم الهاتف', { keyboardType: 'phone-pad' })}
            {authRole === 'company' || authRole === 'store' ? <>
              {field('company_name', authRole === 'company' ? 'اسم الشركة' : 'اسم المحل')}
              {authRole === 'company' ? field('registration_number', 'رقم السجل التجاري') : null}
              {field('address', 'العنوان')}
              {field('business_description', 'وصف النشاط', { multiline: true })}
              {authRole === 'company' ? field('business_type', 'نوع النشاط') : null}
              {field('latitude', 'خط العرض (اختياري)', { keyboardType: 'decimal-pad' })}
              {field('longitude', 'خط الطول (اختياري)', { keyboardType: 'decimal-pad' })}
            </> : null}
            {authRole === 'driver' ? <>
              <Text style={styles.fieldLabel}>نوع المركبة</Text>
              <View style={styles.roleGrid}>{['دراجة نارية', 'سيارة', 'شاحنة'].map((v) => <TouchableOpacity key={v} style={[styles.roleChip, authFields.vehicle_type === v && styles.roleChipSelected]} onPress={() => setAuthField('vehicle_type', v)}><Text style={[styles.roleChipText, authFields.vehicle_type === v && styles.roleChipTextSelected]}>{v}</Text></TouchableOpacity>)}</View>
              {[['avatar', '📸 اختيار الصورة الشخصية'], ['idCard', '🪪 اختيار بطاقة التعريف'], ['vehicleRegistration', '🛵 اختيار البطاقة الرمادية']].map(([key, label]) => <TouchableOpacity key={key} style={styles.secondaryButton} onPress={() => pickDriverImage(key)}><Text style={styles.secondaryButtonText}>{driverFiles[key] ? '✓ تم الاختيار: ' : ''}{label}</Text></TouchableOpacity>)}
            </> : null}
          </>
        ) : null}
        {field('email', 'البريد الإلكتروني', { keyboardType: 'email-address', autoCapitalize: 'none' })}
        {field('password', 'كلمة المرور (6 أحرف على الأقل)', { secure: true, autoCapitalize: 'none' })}
        <TouchableOpacity style={styles.primaryButton} disabled={authBusy} onPress={submitAuth}>
          {authBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{authMode === 'login' ? 'دخول آمن' : 'إنشاء الحساب'}</Text>}
        </TouchableOpacity>
        <Text style={styles.smallNote}>لن تُرفع وثائق السائق إلا بعد توفر جلسة تسجيل دخول. إذا طلب Supabase تأكيد البريد، أكّد بريدك ثم سجّل الدخول لإكمال رفع الوثائق.</Text>
      </KeyboardAvoidingView>
    );
  };

  const renderMap = () => {
    const markers = companies.map((c) => ({ name: c.name || 'متجر', address: c.address || '', lat: Number(c.latitude), lng: Number(c.longitude) }));
    const safeMarkers = JSON.stringify(markers).replace(/</g, '\\u003c');
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;font-family:Arial,sans-serif}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const items=${safeMarkers};const center=items.length?[items[0].lat,items[0].lng]:[36.75,3.05];const map=L.map('map').setView(center,items.length?12:5);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);items.forEach(x=>L.marker([x.lat,x.lng]).addTo(map).bindPopup('<b>'+String(x.name).replace(/[&<>]/g,'')+'</b><br>'+String(x.address).replace(/[&<>]/g,'')));if(items.length>1){map.fitBounds(items.map(x=>[x.lat,x.lng]),{padding:[25,25]})}</script></body></html>`;
    return <View style={styles.pageContent}><Text style={styles.pageTitle}>المتاجر على الخريطة 🗺️</Text><Text style={styles.pageSubtitle}>تظهر هنا الشركات والمحلات التي لديها إحداثيات صحيحة مسجلة في قاعدة البيانات.</Text>{companiesLoading ? <ActivityIndicator size="large" color={COLORS.primary} /> : <View style={styles.mapFrame}><WebView originWhitelist={['*']} source={{ html }} javaScriptEnabled domStorageEnabled /></View>}{!companiesLoading && companies.length === 0 ? <Text style={styles.smallNote}>لا توجد متاجر بإحداثيات مسجلة حتى الآن. أضف خط العرض وخط الطول عند تسجيل الشركة أو المحل.</Text> : <Text style={styles.smallNote}>عدد المتاجر المعروضة: {companies.length}. قد تحتاج الخريطة إلى اتصال بالإنترنت لتحميل الخرائط.</Text>}</View>;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHome();
      case 'search':
        return renderSearch();
      case 'describe':
        return renderDescribe();
      case 'favorites':
        return renderFavorites();
      case 'map':
        return renderMap();
      case 'wallet':
        return renderWallet();
      case 'manageProducts':
        return renderManageProducts();
      case 'profile':
        return renderProfile();
      default:
        return renderHome();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Where Buy · ابحث بذكاء
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomNavigation}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabButton}
              onPress={() => {
                setActiveTab(tab.id);
                if (tab.id === 'search') setAiResults(null);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabIcon,
                  selected && styles.tabIconSelected,
                ]}
              >
                {tab.icon}
              </Text>

              <Text
                style={[
                  styles.tabLabel,
                  selected && styles.tabLabelSelected,
                ]}
              >
                {tab.label}
              </Text>

              {selected && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screen: {
    flex: 1,
  },

  screenContent: {
    paddingBottom: 16,
  },

  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  connectionStatusBox: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F0ECFF',
    borderRadius: 10,
  },

  connectionStatusText: {
    color: COLORS.primary,
    fontSize: 11,
    textAlign: 'right',
    fontWeight: '700',
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoText: {
    color: COLORS.white,
    fontSize: 29,
    fontWeight: '900',
  },

  brandTextContainer: {
    flex: 1,
    marginLeft: 11,
  },

  brandName: {
    fontSize: 23,
    fontWeight: '900',
    color: COLORS.text,
  },

  brandAccent: {
    color: COLORS.primary,
  },

  brandSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },

  walletButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#F0ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  walletIcon: {
    fontSize: 23,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    alignSelf: 'flex-end',
  },

  locationPin: {
    fontSize: 20,
    marginLeft: 8,
  },

  locationLabel: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'right',
  },

  locationValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 3,
    textAlign: 'right',
  },

  mainContent: {
    paddingHorizontal: 16,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 58,
    marginTop: 20,
    marginBottom: 17,
  },

  searchIcon: {
    fontSize: 30,
    color: COLORS.primary,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 5,
  },

  aiStatusText: { width: '100%', color: COLORS.primary, fontSize: 11, textAlign: 'right', marginTop: 7, lineHeight: 17 },
  cameraButton: {
    width: 39,
    height: 39,
    backgroundColor: '#F1EDFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraIcon: {
    fontSize: 19,
  },

  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 22,
    padding: 16,
    minHeight: 164,
  },

  aiTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },

  aiTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'right',
  },

  aiSubtitle: {
    color: '#66617E',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 7,
  },

  aiButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: 13,
  },

  aiButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },

  robotCircle: {
    width: 82,
    height: 82,
    borderRadius: 27,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 13,
  },

  robotEmoji: {
    fontSize: 43,
  },

  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 15,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },

  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },

  resultCount: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },

  categoriesRow: {
    paddingBottom: 17,
    paddingTop: 2,
  },

  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
  },

  categorySelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  categoryEmoji: {
    fontSize: 15,
    marginRight: 5,
  },

  categoryText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },

  categoryTextSelected: {
    color: COLORS.white,
  },

  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  productCard: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    borderRadius: 19,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F0EFF7',
    position: 'relative',
  },

  productCardPlaceholder: {
    width: '48.5%',
  },

  productImage: {
    height: 128,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  productEmoji: {
    fontSize: 56,
  },

  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },

  discountText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 10,
  },

  favoriteButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    backgroundColor: COLORS.white,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  favoriteIcon: {
    fontSize: 20,
    color: COLORS.text,
  },

  favoriteActive: {
    color: COLORS.secondary,
  },

  productName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 11,
  },

  storeName: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 6,
  },

  productPrice: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 8,
  },

  oldPrice: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: 'right',
    textDecorationLine: 'line-through',
    marginTop: 3,
  },

  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  distanceText: {
    color: COLORS.muted,
    fontSize: 9,
  },

  availableText: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: '700',
  },

  imagePickerCard: {
    width: '100%',
    minHeight: 190,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 18,
    backgroundColor: '#F7F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 14,
  },
  imagePickerEmoji: {
    fontSize: 42,
    marginBottom: 8,
  },
  productPreview: {
    width: '100%',
    height: 220,
    borderRadius: 14,
  },

  pageContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
  },

  pageTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'right',
  },

  pageSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'right',
    marginTop: 9,
    marginBottom: 12,
  },

  emptyState: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    alignItems: 'center',
    padding: 30,
    marginTop: 12,
  },

  emptyEmoji: {
    fontSize: 40,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },

  emptySubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 7,
  },

  describeHero: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: '#EEE9FF',
    borderRadius: 24,
    marginBottom: 24,
  },

  describeRobot: {
    fontSize: 65,
  },

  describeTitle: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 12,
  },

  describeSubtitle: {
    color: '#66617E',
    fontSize: 13,
    marginTop: 8,
  },

  fieldLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 10,
  },

  descriptionInput: {
    backgroundColor: COLORS.white,
    minHeight: 125,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    fontSize: 14,
    color: COLORS.text,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 17,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '900',
  },

  infoCard: {
    backgroundColor: COLORS.white,
    padding: 18,
    borderRadius: 19,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  infoTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 12,
  },

  infoText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'right',
    marginTop: 9,
    lineHeight: 20,
  },

  walletCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    marginTop: 22,
  },

  walletCardLabel: {
    color: '#E5DEFF',
    fontSize: 13,
    textAlign: 'right',
  },

  walletBalance: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 12,
  },

  walletCardNote: {
    color: '#E5DEFF',
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 18,
    marginTop: 15,
  },

  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 23,
    alignItems: 'center',
    marginTop: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: COLORS.white,
    fontSize: 40,
    fontWeight: '900',
  },

  profileName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 15,
  },

  bottomNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 9,
    paddingBottom: 5,
    minHeight: 66,
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabIcon: {
    color: COLORS.muted,
    fontSize: 24,
    fontWeight: '700',
  },

  tabIconSelected: {
    color: COLORS.primary,
  },

  tabLabel: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 3,
  },

  tabLabelSelected: {
    color: COLORS.primary,
    fontWeight: '900',
  },

  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 3,
  },

  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  authModeRow: { flexDirection: 'row', backgroundColor: '#EDEAF8', borderRadius: 14, padding: 4, marginVertical: 12 },
  authModeButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 11 },
  authModeSelected: { backgroundColor: COLORS.primary },
  authModeText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  authModeTextSelected: { color: COLORS.white },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  roleChip: { width: '48%', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  roleChipSelected: { backgroundColor: '#EEE9FF', borderColor: COLORS.primary },
  roleChipText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  roleChipTextSelected: { color: COLORS.primary },
  authFieldWrap: { marginBottom: 12 },
  authInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, minHeight: 49, paddingHorizontal: 13, paddingVertical: 12, color: COLORS.text, fontSize: 14 },
  secondaryButton: { backgroundColor: '#F0ECFF', borderRadius: 13, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', marginTop: 9 },
  secondaryButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  smallNote: { color: COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', marginTop: 12, marginBottom: 8 },
  mapFrame: { height: 420, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 10 },
  productPhoto: { width: '100%', height: '100%', borderRadius: 14 },
});
