import * as adhan from 'https://cdn.jsdelivr.net/npm/adhan@4.4.3/+esm';
const { Coordinates, CalculationMethod, PrayerTimes } = adhan;

// Removed PWA registration for pure static HTML/JS standalone


/**
 * Islamiyat - Simplified App Logic
 */

// --- Global State ---
const state = {
    activeTab: 'prayer',
    language: localStorage.getItem('lang') || 'ar',
    theme: localStorage.getItem('theme') || 'light',
    location: JSON.parse(localStorage.getItem('location')) || { city: 'Cairo', country: 'Egypt' },
    favorites: JSON.parse(localStorage.getItem('favorites')) || { surahs: [], radios: [] },
    quran: {
        surahs: [],
        reciters: [],
        selectedReciter: localStorage.getItem('selectedReciter') || 'quran-com-mishary',
        activeSurah: null
    },
    radios: [],
    manualRadios: [
        { id: '8s5u8p488zquv', name: 'إذاعة القرآن الكريم من القاهرة', url: 'https://n02.radiojar.com/8s5u8p488zquv', category: 'channel', provider: 'radiojar' },
        { id: '0tpyuch996quv', name: 'إذاعة القرآن الكريم من السعودية', url: 'https://n0a.radiojar.com/0tpyuch996quv', category: 'channel', provider: 'radiojar' },
        { id: 'makkah', name: 'إذاعة القرآن الكريم من مكة (بث مباشر)', url: 'https://live.mp3quran.net/makkah', category: 'channel' },
        { name: 'إذاعة القرآن الكريم من نابلس', url: 'https://stream.radioquran.ps/radio/8000/radio.mp3', category: 'channel' }
    ],
    activeRadioCat: 'reciter',
    names: [],
    qibla: {
        dir: null,
        coords: null
    },
    azkar: {
        data: {},
        category: 'أذكار الصباح',
        counters: {}
    },
    hadith: {
        list: [],
        index: 0
    },
    audio: {
        isPlaying: false,
        title: '',
        subtitle: ''
    },
    fontSize: parseInt(localStorage.getItem('fontSize')) || 24
};

// --- API Helpers ---
async function fetchWithCache(url, cacheKey, expiry = 43200000) { // 12 hours default
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < expiry) return data;
    }
    const res = await fetch(url);
    const data = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
}

function changeFontSize(v) {
    state.fontSize = Math.max(16, Math.min(48, state.fontSize + v));
    localStorage.setItem('fontSize', state.fontSize);
    applyFontSize();
}

function applyFontSize() {
    const els = document.querySelectorAll('#hadith-text, #ayah-list p.text-2xl');
    els.forEach(el => el.style.fontSize = state.fontSize + 'px');
}

async function shareText(text) {
    if (navigator.share) {
        try {
            await navigator.share({ title: 'إسلاميات', text: text });
        } catch (e) {
            if (e.name !== 'AbortError') console.error(e);
        }
    } else {
        navigator.clipboard.writeText(text);
        alert('تم نسخ النص!');
    }
}

// --- UI Controls ---

const uiDict = {
    'إسلاميات': 'Islamiyat',
    'البحث عن مدينة...': 'Search for a city...',
    'الصلاة القادمة': 'Next Prayer',
    'أسماء الله': 'Names of Allah',
    'القبلة': 'Qibla',
    'التقويم': 'Calendar',
    'أسماء الله الحسنى': 'Names of Allah (Asma ul-Husna)',
    'اتجاه القبلة': 'Qibla Direction',
    'تحديد دقيق لاتجاه الكعبة المشرفة من موقعك الحالي': 'Accurate direction of the Kaaba from your current location',
    'البحث عن القبلة...': 'Searching for Qibla...',
    'الموقع الحالي': 'Current Location',
    'جاري التحديد': 'Locating...',
    'المسافة لمكة': 'Distance to Makkah',
    'تفعيل الموقع الجغرافي': 'Enable Geolocation',
    'نحتاج للوصول لموقعك لتوفير اتجاه دقيق للغاية للقبلة بناءً على إحداثياتك الحالية.': 'We need location access to provide accurate Qibla direction based on your current coordinates.',
    'تحديد الموقع': 'Locate Me',
    'ابحث عن سورة...': 'Search for Surah...',
    'سورة': 'Surah',
    'ابحث عن إذاعة...': 'Search for Radio...',
    'القراء': 'Reciters',
    'قنوات الراديو': 'Radio Channels',
    'أذكار ورقية': 'Azkar & Ruqyah',
    'تفسير وفتاوى': 'Tafsir & Fatwas',
    'إذعات متنوعة': 'Misc Radios',
    'الأقسام': 'Categories',
    'أذكار الصباح': 'Morning Azkar',
    'الأربعون النووية': '40 Nawawi Hadith',
    'اختر تلاوة...': 'Select Recitation...',
    'جارِ التشغيل': 'Playing',
    'الصلاة': 'Prayer',
    'القرآن': 'Quran',
    'الأذكار': 'Azkar',
    'الأحاديث': 'Hadith',
    'الراديو': 'Radio',
    'ابحث عن قارئ...': 'Search for Reciter...',
    'إغلاق': 'Close',
    'إعدادات التقويم': 'Calendar Settings',
    'تعديل التاريخ الهجري (بالأيام)': 'Hijri Date Adjustment (+/- days)',
    'سورة البقرة، 144': 'Al-Baqarah, 144',
    'التكرار': 'Repeat',
    'الحديث التالي': 'Next Hadith',
    'الحديث السابق': 'Previous Hadith',
    'مشاركة': 'Share',
    'نسخ': 'Copy'
};

function applyTranslations() {
    if (state.language === 'en') {
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let n;
        while(n = walk.nextNode()) {
            let txt = n.nodeValue.trim();
            if(uiDict[txt]) {
                n.nodeValue = n.nodeValue.replace(txt, uiDict[txt]);
            }
        }
        document.querySelectorAll('[placeholder]').forEach(el => {
            let pt = el.getAttribute('placeholder').trim();
            if(uiDict[pt]) el.setAttribute('placeholder', uiDict[pt]);
        });
    }
}

function initTheme() {
    if (state.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    document.getElementById('theme-toggle').onclick = () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', state.theme);
        initTheme();
    };
}

function initLanguage() {
    const isEn = state.language === 'en';
    document.documentElement.dir = isEn ? 'ltr' : 'rtl';
    document.documentElement.lang = state.language;
    document.getElementById('lang-toggle').innerText = isEn ? 'AR' : 'EN';
    document.getElementById('app-title').innerText = isEn ? 'Islamiyat' : 'إسلاميات';
    
    applyTranslations();
    document.getElementById('lang-toggle').onclick = () => {
        state.language = state.language === 'ar' ? 'en' : 'ar';
        localStorage.setItem('lang', state.language);
        location.reload();
    };
}

function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const id = btn.getAttribute('data-tab');
        if (id === tabId) {
            btn.classList.remove('opacity-40');
            btn.classList.add('text-[#1C6B4F]');
        } else {
            btn.classList.add('opacity-40');
            btn.classList.remove('text-[#1C6B4F]');
        }
    });

    // Run tab-specific init
    if (tabId === 'prayer') initPrayer();
    if (tabId === 'quran') initQuran();
    if (tabId === 'radio') initRadio();
    if (tabId === 'azkar') initAzkar();
    if (tabId === 'hadith') initHadith();
}

// --- Feature: Prayer Times ---
async function initPrayer() {
    const loader = document.getElementById('prayer-loading');
    const content = document.getElementById('prayer-content');
    loader.classList.remove('hidden');
    content.classList.add('hidden');

    try {
        const { city, country } = state.location;
        let coords = new Coordinates(30.0444, 31.2357); // Default Cairo
        
        // Attempt to convert city to coords roughly using simple cache or fallback to geolocation if allowed
        // Wait, for exact offline, we rely on stored location from geolocation
        if (state.location.coords) {
            coords = new Coordinates(state.location.coords.lat, state.location.coords.lng);
        }

        const date = new Date();
        const params = CalculationMethod.Egyptian();
        const prayerTimes = new PrayerTimes(coords, date, params);
        
        // Use standard JS Date format
        function timeStr(dateObj) {
            return dateObj.getHours().toString().padStart(2, '0') + ':' + dateObj.getMinutes().toString().padStart(2, '0');
        }

        const pureTimings = {
            Fajr: timeStr(prayerTimes.fajr),
            Dhuhr: timeStr(prayerTimes.dhuhr),
            Asr: timeStr(prayerTimes.asr),
            Maghrib: timeStr(prayerTimes.maghrib),
            Isha: timeStr(prayerTimes.isha)
        };

        renderPrayerGrid(pureTimings);
        startPrayerCountdown(pureTimings);
        
        // Approximate Hijri Date using standard JS Intl
        
        const hijriStr = new Intl.DateTimeFormat(state.language === 'en' ? 'en-US-u-ca-islamic' : 'ar-SA-u-ca-islamic', {day: 'numeric', month: 'long', year : 'numeric'}).format(new Date(Date.now() + (hijriOffset * 86400000)));
        document.getElementById('hijri-date-top').innerText = hijriStr;
        document.getElementById('hijri-date-badge').innerText = hijriStr;


        // Update Location Info
        document.getElementById('location-city-name').innerText = city;
        document.getElementById('location-country-name').innerText = country;
        document.getElementById('location-info').classList.remove('hidden');

        content.classList.remove('hidden');
    } catch (e) {
        console.error(e);
    } finally {
        loader.classList.add('hidden');
    }
}

function renderPrayerGrid(timings) {
    const grid = document.getElementById('prayer-grid');
    const prayers = [
        { key: 'Fajr', name: 'الفجر', en: 'Fajr', icon: 'sunrise' },
        { key: 'Dhuhr', name: 'الظهر', en: 'Dhuhr', icon: 'sun' },
        { key: 'Asr', name: 'العصر', en: 'Asr', icon: 'sun' },
        { key: 'Maghrib', name: 'المغرب', en: 'Maghrib', icon: 'sunset' },
        { key: 'Isha', name: 'العشاء', en: 'Isha', icon: 'moon' }
    ];

    grid.innerHTML = prayers.map(p => `
        <div class="premium-card p-8 flex flex-col items-center justify-center text-center ${p.key === 'Isha' ? 'col-span-2' : ''}">
            <div class="w-12 h-12 bg-[#059669]/5 rounded-2xl flex items-center justify-center mb-4">
                <i data-lucide="${p.icon}" class="w-6 h-6 text-[#1C6B4F]"></i>
            </div>
            <span class="text-xs font-black opacity-40 uppercase tracking-widest mb-1">${state.language === 'en' ? p.en : p.name}</span>
            <div class="text-3xl font-black text-[#1C6B4F] dark:text-[#34D399]">${formatTime(timings[p.key])}</div>
        </div>
    `).join('');
    lucide.createIcons();
}

function formatTime(time24) {
    if (!time24) return '--:--';
    const [h, m] = time24.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
}

function startPrayerCountdown(timings) {
    const nextCard = document.getElementById('next-prayer-card');
    nextCard.classList.remove('hidden');

    function update() {
        const now = new Date();
        const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        let next = null;

        for (const p of prayerOrder) {
            const [h, m] = timings[p].split(':').map(Number);
            const pTime = new Date();
            pTime.setHours(h, m, 0, 0);
            if (pTime > now) {
                next = { name: p, time: pTime };
                break;
            }
        }

        if (!next) {
            const [h, m] = timings.Fajr.split(':').map(Number);
            const pTime = new Date();
            pTime.setDate(now.getDate() + 1);
            pTime.setHours(h, m, 0, 0);
            next = { name: 'Fajr', time: pTime };
        }

        const diff = next.time - now;
        const hh = Math.floor(diff / 3600000);
        const mm = Math.floor((diff % 3600000) / 60000);
        const ss = Math.floor((diff % 60000) / 1000);

        document.getElementById('next-prayer-name').innerText = state.language === 'ar' ? getPrayerNameAr(next.name) : next.name;
        document.getElementById('next-prayer-time').innerText = formatTime(timings[next.name]);
        document.getElementById('next-prayer-remaining').innerText = `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    }

    if (window.prayerTimer) clearInterval(window.prayerTimer);
    window.prayerTimer = setInterval(update, 1000);
    update();
}

function getPrayerNameAr(p) {
    return { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' }[p];
}

// --- Feature: Names of Allah ---
async function openNamesOfAllah() {
    const view = document.getElementById('names-view');
    const list = document.getElementById('names-list');
    view.classList.remove('hidden');
    
    if (state.names.length > 0) return;
    
    list.innerHTML = '<div class="col-span-full flex justify-center py-20"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>';
    lucide.createIcons();

    try {
        
        state.names = [{"name":"الرَّحْمَنُ","transliteration":"Ar Rahmaan","number":1,"en":{"meaning":"The Beneficent"}},{"name":"الرَّحِيمُ","transliteration":"Ar Raheem","number":2,"en":{"meaning":"The Merciful"}},{"name":"الْمَلِكُ","transliteration":"Al Malik","number":3,"en":{"meaning":"The King / Eternal Lord"}},{"name":"الْقُدُّوسُ","transliteration":"Al Quddus","number":4,"en":{"meaning":"The Purest"}},{"name":"السَّلاَمُ","transliteration":"As Salaam","number":5,"en":{"meaning":"The Source of Peace"}},{"name":"الْمُؤْمِنُ","transliteration":"Al Mu'min","number":6,"en":{"meaning":"The inspirer of faith"}},{"name":"الْمُهَيْمِنُ","transliteration":"Al Muhaymin","number":7,"en":{"meaning":"The Guardian"}},{"name":"الْعَزِيزُ","transliteration":"Al Azeez","number":8,"en":{"meaning":"The Precious / The Most Mighty"}},{"name":"الْجَبَّارُ","transliteration":"Al Jabbaar","number":9,"en":{"meaning":"The Compeller"}},{"name":"الْمُتَكَبِّرُ","transliteration":"Al Mutakabbir","number":10,"en":{"meaning":"The Greatest"}},{"name":"الْخَالِقُ","transliteration":"Al Khaaliq","number":11,"en":{"meaning":"The Creator"}},{"name":"الْبَارِئُ","transliteration":"Al Baari","number":12,"en":{"meaning":"The Maker of Order"}},{"name":"الْمُصَوِّرُ","transliteration":"Al Musawwir","number":13,"en":{"meaning":"The Shaper of Beauty"}},{"name":"الْغَفَّارُ","transliteration":"Al Ghaffaar","number":14,"en":{"meaning":"The Forgiving"}},{"name":"الْقَهَّارُ","transliteration":"Al Qahhaar","number":15,"en":{"meaning":"The Subduer"}},{"name":"الْوَهَّابُ","transliteration":"Al Wahhaab","number":16,"en":{"meaning":"The Giver of All"}},{"name":"الرَّزَّاقُ","transliteration":"Ar Razzaaq","number":17,"en":{"meaning":"The Sustainer"}},{"name":"الْفَتَّاحُ","transliteration":"Al Fattaah","number":18,"en":{"meaning":"The Opener"}},{"name":"اَلْعَلِيْمُ","transliteration":"Al 'Aleem","number":19,"en":{"meaning":"The Knower of all"}},{"name":"الْقَابِضُ","transliteration":"Al Qaabid","number":20,"en":{"meaning":"The Constrictor"}},{"name":"الْبَاسِطُ","transliteration":"Al Baasit","number":21,"en":{"meaning":"The Reliever"}},{"name":"الْخَافِضُ","transliteration":"Al Khaafid","number":22,"en":{"meaning":"The Abaser"}},{"name":"الرَّافِعُ","transliteration":"Ar Raafi'","number":23,"en":{"meaning":"The Exalter"}},{"name":"الْمُعِزُّ","transliteration":"Al Mu'iz","number":24,"en":{"meaning":"The Bestower of Honour"}},{"name":"المُذِلُّ","transliteration":"Al Mudhil","number":25,"en":{"meaning":"The Humiliator"}},{"name":"السَّمِيعُ","transliteration":"As Samee'","number":26,"en":{"meaning":"The Hearer of all"}},{"name":"الْبَصِيرُ","transliteration":"Al Baseer","number":27,"en":{"meaning":"The Seer of all"}},{"name":"الْحَكَمُ","transliteration":"Al Hakam","number":28,"en":{"meaning":"The Judge"}},{"name":"الْعَدْلُ","transliteration":"Al 'Adl","number":29,"en":{"meaning":"The Just"}},{"name":"اللَّطِيفُ","transliteration":"Al Lateef","number":30,"en":{"meaning":"The Subtle One"}},{"name":"الْخَبِيرُ","transliteration":"Al Khabeer","number":31,"en":{"meaning":"The All Aware"}},{"name":"الْحَلِيمُ","transliteration":"Al Haleem","number":32,"en":{"meaning":"The Forebearing"}},{"name":"الْعَظِيمُ","transliteration":"Al 'Azeem","number":33,"en":{"meaning":"The Maginificent"}},{"name":"الْغَفُورُ","transliteration":"Al Ghafoor","number":34,"en":{"meaning":"The Great Forgiver"}},{"name":"الشَّكُورُ","transliteration":"Ash Shakoor","number":35,"en":{"meaning":"The Rewarder of Thankfulness"}},{"name":"الْعَلِيُّ","transliteration":"Al 'Aliyy","number":36,"en":{"meaning":"The Highest"}},{"name":"الْكَبِيرُ","transliteration":"Al Kabeer","number":37,"en":{"meaning":"The Greatest"}},{"name":"الْحَفِيظُ","transliteration":"Al Hafeez","number":38,"en":{"meaning":"The Preserver"}},{"name":"المُقيِت","transliteration":"Al Muqeet","number":39,"en":{"meaning":"The Nourisher"}},{"name":"الْحسِيبُ","transliteration":"Al Haseeb","number":40,"en":{"meaning":"The Reckoner"}},{"name":"الْجَلِيلُ","transliteration":"Al Jaleel","number":41,"en":{"meaning":"The Majestic"}},{"name":"الْكَرِيمُ","transliteration":"Al Kareem","number":42,"en":{"meaning":"The Generous"}},{"name":"الرَّقِيبُ","transliteration":"Ar Raqeeb","number":43,"en":{"meaning":"The Watchful One"}},{"name":"الْمُجِيبُ","transliteration":"Al Mujeeb ","number":44,"en":{"meaning":"The Responder to Prayer"}},{"name":"الْوَاسِعُ","transliteration":"Al Waasi'","number":45,"en":{"meaning":"The All Comprehending"}},{"name":"الْحَكِيمُ","transliteration":"Al Hakeem","number":46,"en":{"meaning":"The Perfectly Wise"}},{"name":"الْوَدُودُ","transliteration":"Al Wudood","number":47,"en":{"meaning":"The Loving One"}},{"name":"الْمَجِيدُ","transliteration":"Al Majeed","number":48,"en":{"meaning":"The Most Glorious One"}},{"name":"الْبَاعِثُ","transliteration":"Al Baa'ith","number":49,"en":{"meaning":"The Resurrector"}},{"name":"الشَّهِيدُ","transliteration":"Ash Shaheed","number":50,"en":{"meaning":"The Witness"}},{"name":"الْحَقُّ","transliteration":"Al Haqq","number":51,"en":{"meaning":"The Truth"}},{"name":"الْوَكِيلُ","transliteration":"Al Wakeel","number":52,"en":{"meaning":"The Trustee"}},{"name":"الْقَوِيُّ","transliteration":"Al Qawiyy","number":53,"en":{"meaning":"The Possessor of all strength"}},{"name":"الْمَتِينُ","transliteration":"Al Mateen","number":54,"en":{"meaning":"The Forceful"}},{"name":"الْوَلِيُّ","transliteration":"Al Waliyy","number":55,"en":{"meaning":"The Protector"}},{"name":"الْحَمِيدُ","transliteration":"Al Hameed","number":56,"en":{"meaning":"The Praised"}},{"name":"الْمُحْصِي","transliteration":"Al Muhsi","number":57,"en":{"meaning":"The Appraiser"}},{"name":"الْمُبْدِئُ","transliteration":"Al Mubdi","number":58,"en":{"meaning":"The Originator"}},{"name":"الْمُعِيدُ","transliteration":"Al Mu'eed","number":59,"en":{"meaning":"The Restorer"}},{"name":"الْمُحْيِي","transliteration":"Al Muhiy","number":60,"en":{"meaning":"The Giver of life"}},{"name":"اَلْمُمِيتُ","transliteration":"Al Mumeet","number":61,"en":{"meaning":"The Taker of life"}},{"name":"الْحَيُّ","transliteration":"Al Haiyy","number":62,"en":{"meaning":"The Ever Living"}},{"name":"الْقَيُّومُ","transliteration":"Al Qayyoom","number":63,"en":{"meaning":"The Self Existing"}},{"name":"الْوَاجِدُ","transliteration":"Al Waajid","number":64,"en":{"meaning":"The Finder"}},{"name":"الْمَاجِدُ","transliteration":"Al Maajid","number":65,"en":{"meaning":"The Glorious"}},{"name":"الْواحِدُ","transliteration":"Al Waahid","number":66,"en":{"meaning":"The Only One"}},{"name":"اَلاَحَدُ","transliteration":"Al Ahad","number":67,"en":{"meaning":"The One"}},{"name":"الصَّمَدُ","transliteration":"As Samad","number":68,"en":{"meaning":"The Supreme Provider"}},{"name":"الْقَادِرُ","transliteration":"Al Qaadir","number":69,"en":{"meaning":"The Powerful"}},{"name":"الْمُقْتَدِرُ","transliteration":"Al Muqtadir","number":70,"en":{"meaning":"The Creator of all power"}},{"name":"الْمُقَدِّمُ","transliteration":"Al Muqaddim","number":71,"en":{"meaning":"The Expediter"}},{"name":"الْمُؤَخِّرُ","transliteration":"Al Mu’akhir","number":72,"en":{"meaning":"The Delayer"}},{"name":"الأوَّلُ","transliteration":"Al Awwal","number":73,"en":{"meaning":"The First"}},{"name":"الآخِرُ","transliteration":"Al Aakhir","number":74,"en":{"meaning":"The Last"}},{"name":"الظَّاهِرُ","transliteration":"Az Zaahir","number":75,"en":{"meaning":"The Manifest"}},{"name":"الْبَاطِنُ","transliteration":"Al Baatin","number":76,"en":{"meaning":"The Hidden"}},{"name":"الْوَالِي","transliteration":"Al Waali","number":77,"en":{"meaning":"The Governor"}},{"name":"الْمُتَعَالِي","transliteration":"Al Muta’ali","number":78,"en":{"meaning":"The Supreme One"}},{"name":"الْبَرُّ","transliteration":"Al Barr","number":79,"en":{"meaning":"The Doer of Good"}},{"name":"التَّوَابُ","transliteration":"At Tawwaab","number":80,"en":{"meaning":"The Guide to Repentence"}},{"name":"الْمُنْتَقِمُ","transliteration":"Al Muntaqim","number":81,"en":{"meaning":"The Avenger"}},{"name":"العَفُوُّ","transliteration":"Al Afuww","number":82,"en":{"meaning":"The Forgiver"}},{"name":"الرَّؤُوفُ","transliteration":"Ar Ra’oof","number":83,"en":{"meaning":"The Clement"}},{"name":"مَالِكُ الْمُلْكِ","transliteration":"Maalik Ul Mulk","number":84,"en":{"meaning":"The Owner / Soverign of All"}},{"name":"ذُوالْجَلاَلِ وَالإكْرَامِ","transliteration":"Dhu Al Jalaali Wa Al Ikraam","number":85,"en":{"meaning":"Possessor of Majesty and Bounty"}},{"name":"الْمُقْسِطُ","transliteration":"Al Muqsit","number":86,"en":{"meaning":"The Equitable One"}},{"name":"الْجَامِعُ","transliteration":"Al Jaami'","number":87,"en":{"meaning":"The Gatherer"}},{"name":"الْغَنِيُّ","transliteration":"Al Ghaniyy","number":88,"en":{"meaning":"The Rich One"}},{"name":"الْمُغْنِي","transliteration":"Al Mughi","number":89,"en":{"meaning":"The Enricher"}},{"name":"اَلْمَانِعُ","transliteration":"Al Maani'","number":90,"en":{"meaning":"The Preventer of harm"}},{"name":"الضَّارَّ","transliteration":"Ad Daaarr","number":91,"en":{"meaning":"The Creator of the harmful"}},{"name":"النَّافِعُ","transliteration":"An Naafi’","number":92,"en":{"meaning":"The Bestower of Benefits"}},{"name":"النُّورُ","transliteration":"An Noor","number":93,"en":{"meaning":"The Light"}},{"name":"الْهَادِي","transliteration":"Al Haadi","number":94,"en":{"meaning":"The Guider"}},{"name":"الْبَدِيعُ","transliteration":"Al Badi'","number":95,"en":{"meaning":"The Originator"}},{"name":"اَلْبَاقِي","transliteration":"Al Baaqi","number":96,"en":{"meaning":"The Everlasting One"}},{"name":"الْوَارِثُ","transliteration":"Al Waarith","number":97,"en":{"meaning":"The Inhertior"}},{"name":"الرَّشِيدُ","transliteration":"Ar Rasheed","number":98,"en":{"meaning":"The Most Righteous Guide"}},{"name":"الصَّبُورُ","transliteration":"As Saboor","number":99,"en":{"meaning":"The Patient One"}}];
        renderNames();
    } catch (e) {
        list.innerHTML = '<p class="col-span-full text-center">فشل في جلب الأسماء</p>';
    }
}

function renderNames() {
    const list = document.getElementById('names-list');
    list.innerHTML = state.names.map(n => `
        <div class="bg-[#D7E5DF] dark:bg-[#152A1F] border border-white/40 dark:border-[#1C3B2B] rounded-[2rem] p-6 flex flex-col items-center text-center group cursor-default">
            <span class="text-[10px] opacity-20 font-black mb-4 group-hover:opacity-100 transition-opacity">#${n.number}</span>
            <h3 class="text-3xl font-black text-[#1C6B4F] dark:text-[#34D399] font-['Amiri'] mb-3">${n.name}</h3>
            <p class="text-[11px] font-bold opacity-40 leading-relaxed">${n.en.meaning}</p>
        </div>
    `).join('');
}

function closeNamesOfAllah() {
    document.getElementById('names-view').classList.add('hidden');
}

// --- Feature: Qibla ---
async function requestQiblaSensors() {
    // Request device orientation if available (typically iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permissionState = await DeviceOrientationEvent.requestPermission();
            if (permissionState === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation, true);
            }
        } catch(e) { console.warn("DeviceOrientationEvent permission error", e); }
    } else {
        // Android fallback
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        } else {
            window.addEventListener('deviceorientation', handleOrientation, true);
        }
    }
}

function openQibla() {
    document.getElementById('qibla-view').classList.remove('hidden');
    requestQiblaSensors();
    if (!state.qibla.dir) {
        fetchQibla();
    }
}

async function fetchQibla() {
    if (!navigator.geolocation) return;
    
    // Set loading state
    document.getElementById('qibla-status-text').innerText = 'البحث عن القبلة...';
    document.getElementById('qibla-status-icon').setAttribute('data-lucide', 'compass');
    lucide.createIcons();
    document.getElementById('qibla-status').classList.remove('bg-[#059669]');
    document.getElementById('qibla-status').classList.add('bg-[#1C6B4F]', 'opacity-90');
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        
        // Update local coords
        state.location.coords = { lat: latitude, lng: longitude };
        localStorage.setItem('location', JSON.stringify(state.location));
        
        // Use existing city or attempt reverse geocode
        document.getElementById('qibla-location-text').innerText = state.location.city || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        
        // Calculate Qibla mathematically
        // Mecca coords: 21.422487, 39.826206
        const lat1 = latitude * Math.PI / 180;
        const lon1 = longitude * Math.PI / 180;
        const lat2 = 21.422487 * Math.PI / 180;
        const lon2 = 39.826206 * Math.PI / 180;
        
        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        let qiblaDir = Math.atan2(y, x) * 180 / Math.PI;
        if (qiblaDir < 0) qiblaDir += 360;
        
        state.qibla.dir = qiblaDir;
        
        // Helper formatting for compass directions
        function getDirectionNotation(deg) {
            if(deg >= 337.5 || deg < 22.5) return 'N';
            if(deg >= 22.5 && deg < 67.5) return 'NE';
            if(deg >= 67.5 && deg < 112.5) return 'E';
            if(deg >= 112.5 && deg < 157.5) return 'SE';
            if(deg >= 157.5 && deg < 202.5) return 'S';
            if(deg >= 202.5 && deg < 247.5) return 'SW';
            if(deg >= 247.5 && deg < 292.5) return 'W';
            if(deg >= 292.5 && deg < 337.5) return 'NW';
            return '';
        }
        
        document.getElementById('qibla-deg-text').innerText = `${getDirectionNotation(qiblaDir)} ${Math.round(state.qibla.dir)}°`;
        
        // Calculate Distance
        const R = 6371; // Radius of the earth in km
        const dLat = lat2 - lat1;
        const dLon = lon2 - lon1;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = Math.round(R * c);
        
        document.getElementById('qibla-distance-text').innerText = `${distance.toLocaleString('ar-EG')} كم`;
        
        // Set initial needle
        updateCompass(0);
        
        // Ready status
        document.getElementById('qibla-status-text').innerText = 'وجه هاتفك للقبلة';
        document.getElementById('qibla-status-icon').setAttribute('data-lucide', 'smartphone');
        lucide.createIcons();
    });
}

function handleOrientation(event) {
    let heading = null;

    // iOS case: absolute compass heading is natively provided
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        heading = event.webkitCompassHeading;
    } 
    // Absolute Android orientation OR relative fallback
    else if (event.alpha !== null && event.alpha !== undefined) {
        // event.alpha is counter-clockwise from North, but we need clockwise (standard compass heading)
        heading = 360 - event.alpha;
        if (heading === 360) heading = 0;
    }

    if (heading !== null && state.qibla.dir !== undefined) {
        updateCompass(heading);
    }
}

function updateCompass(deviceHeading) {
    const targetRotation = state.qibla.dir - deviceHeading;
    const needle = document.getElementById('qibla-needle');
    const statusBox = document.getElementById('qibla-status');
    const statusText = document.getElementById('qibla-status-text');
    const statusIcon = document.getElementById('qibla-status-icon');
    
    document.getElementById('qibla-compass').style.transform = `rotate(${-deviceHeading}deg)`;
    needle.style.transform = `rotate(${targetRotation}deg)`;
    
    // Normalize targetRotation to between -180 and 180
    let diff = targetRotation % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    // If facing qibla within 5 degrees
    if (Math.abs(diff) < 5) {
        if (!state.qibla.isFacing) {
            state.qibla.isFacing = true;
            statusBox.className = "bg-[#059669] text-white px-6 py-4 rounded-[1.25rem] w-full flex items-center justify-center gap-3 shadow-[0_8px_25px_rgba(5,150,105,0.4)] font-black text-lg transition-all duration-300 scale-105 mt-2";
            statusText.innerText = "أنت تواجه القبلة!";
            statusIcon.setAttribute('data-lucide', 'check-circle');
            lucide.createIcons();
            if(navigator.vibrate) navigator.vibrate(50);
        }
    } else {
        if (state.qibla.isFacing || state.qibla.isFacing === undefined) {
            state.qibla.isFacing = false;
            statusBox.className = "bg-[#1C6B4F] text-white px-6 py-4 rounded-[1.25rem] w-full flex items-center justify-center gap-3 shadow-[0_8px_25px_rgba(28,107,79,0.3)] font-black text-lg transition-all duration-300 opacity-90 mt-2";
            statusText.innerText = "وجه هاتفك للقبلة";
            statusIcon.setAttribute('data-lucide', 'smartphone');
            lucide.createIcons();
        }
    }
}

function closeQibla() {
    document.getElementById('qibla-view').classList.add('hidden');
}


function openCalendar() {
    document.getElementById('calendar-modal').classList.remove('hidden');
    updateCalendarDisplay();
}

document.getElementById('close-calendar').addEventListener('click', () => {
    document.getElementById('calendar-modal').classList.add('hidden');
});

let hijriOffset = parseInt(localStorage.getItem('hijriOffset')) || 0;
document.getElementById('hijri-offset').innerText = hijriOffset;

document.getElementById('hijri-minus').addEventListener('click', () => {
    hijriOffset--;
    localStorage.setItem('hijriOffset', hijriOffset);
    document.getElementById('hijri-offset').innerText = hijriOffset;
    updateCalendarDisplay();
    // Restart prayer layout to update hijri date top header
    initPrayer();
});

document.getElementById('hijri-plus').addEventListener('click', () => {
    hijriOffset++;
    localStorage.setItem('hijriOffset', hijriOffset);
    document.getElementById('hijri-offset').innerText = hijriOffset;
    updateCalendarDisplay();
    // Restart prayer layout to update hijri date top header
    initPrayer();
});

function updateCalendarDisplay() {
    let adhanDateParam = 'today';
    const loc = state.location.coords ? `${state.location.coords.lat},${state.location.coords.lng}` : state.location.city;
    const cacheKey = `prayer_${loc}_offset${hijriOffset}`;
    
    // Attempting to show the new date taking offset into account
    // For simplicity, we just format the current date + offset
    const d = new Date();
    d.setDate(d.getDate() + hijriOffset);
    const df = new Intl.DateTimeFormat(state.language === 'ar' ? 'ar-FR-u-ca-islamic' : 'en-US-u-ca-islamic', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(d);
    
    document.getElementById('calendar-hijri-display').innerText = df;
}


// --- Feature: Quran ---
async function initQuran() {
    if (state.quran.surahs.length > 0) return; // Prevent double load
    
    try {
        const res = await fetchWithCache('https://api.alquran.cloud/v1/surah', 'surahs_list');
        state.quran.surahs = res.data;
        renderSurahs();
        
        // Fetch reciters
        const lang = state.language === 'ar' ? 'ar' : 'eng';
        const recData = await fetchWithCache(`https://www.mp3quran.net/api/v3/reciters?language=${lang}`, `reciters_${lang}`);
        
        // Manual high quality reciters
        state.quran.reciters = [
            { id: 'quran-com-mishary', name: state.language === 'ar' ? 'الشيخ مشاري العفاسي (HQ)' : 'Mishary Alafasy (HQ)', server: 'https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/' },
            { id: 'quran-com-maher', name: state.language === 'ar' ? 'الشيخ ماهر المعيقلي (HQ)' : 'Maher Al-Muaiqly (HQ)', server: 'https://download.quranicaudio.com/qdc/maher_al_muaiqly/murattal/' }
        ];

        recData.reciters.forEach(r => {
            if (r.moshaf && r.moshaf.length > 0) {
                let reciterName = r.name;
                if (lang === 'ar' && !reciterName.startsWith('القارئ') && !reciterName.startsWith('الشيخ')) {
                    reciterName = `الشيخ ${reciterName}`;
                }
                state.quran.reciters.push({
                    id: `rec_${r.id}`,
                    name: reciterName,
                    server: r.moshaf[0].server
                });
            }
        });

        const currentRec = state.quran.reciters.find(r => r.id === state.quran.selectedReciter) || state.quran.reciters[0];
        document.getElementById('current-reciter-name').innerText = currentRec.name;

    } catch (e) {
        console.error(e);
    }
}

function renderSurahs() {
    const list = document.getElementById('surah-list');
    const query = document.getElementById('surah-search').value.toLowerCase();
    
    list.innerHTML = state.quran.surahs
        .filter(s => s.name.includes(query) || s.englishName.toLowerCase().includes(query))
        .map(s => `
            <div onclick="openSurah(${s.number})" class="premium-card p-6 flex items-center justify-between cursor-pointer group">
                <div class="flex items-center gap-5">
                    <div class="w-14 h-14 bg-[#1C6B4F]/5 rounded-[1.25rem] flex items-center justify-center font-black text-[#1C6B4F] dark:text-[#34D399] transition-all group-hover:bg-[#1C6B4F] group-hover:text-white">${s.number}</div>
                    <div class="text-start">
                        <h3 class="font-extrabold text-xl mb-1 group-hover:text-[#1C6B4F] dark:group-hover:text-[#34D399] transition-colors">${s.name}</h3>
                        <div class="flex items-center gap-2 opacity-40 text-[10px] font-black uppercase tracking-widest">
                            <span>${s.numberOfAyahs} آية</span>
                            <span class="w-1 h-1 bg-current rounded-full"></span>
                            <span>${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="toggleFavoriteSurah(event, ${s.number})" class="p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all ${state.favorites.surahs.includes(s.number) ? 'text-red-500' : 'opacity-20'}">
                        <i data-lucide="heart" class="w-6 h-6 ${state.favorites.surahs.includes(s.number) ? 'fill-red-500' : ''}"></i>
                    </button>
                    <button onclick="playSurah(event, ${s.number})" class="w-12 h-12 bg-[#1C6B4F]/10 text-[#1C6B4F] dark:text-[#34D399] rounded-2xl flex items-center justify-center hover:bg-[#1C6B4F] hover:text-white transition-all">
                        <i data-lucide="play" class="w-6 h-6 fill-current"></i>
                    </button>
                </div>
            </div>
        `).join('');
    lucide.createIcons();
}

function toggleFavoriteSurah(e, num) {
    if (e) e.stopPropagation();
    const idx = state.favorites.surahs.indexOf(num);
    if (idx > -1) state.favorites.surahs.splice(idx, 1);
    else state.favorites.surahs.push(num);
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    renderSurahs();
}

async function openSurah(num) {
    const detail = document.getElementById('surah-detail');
    const ayahList = document.getElementById('ayah-list');
    const title = document.getElementById('surah-detail-title');
    
    state.quran.activeSurah = state.quran.surahs.find(s => s.number === num);
    title.innerText = state.quran.activeSurah.name;
    detail.classList.remove('hidden');
    ayahList.innerHTML = '<div class="flex justify-center py-20"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>';
    lucide.createIcons();

    try {
        console.log(`Fetching surah ${num}...`);
        const res = await fetch(`https://quranenc.com/api/v1/translation/sura/arabic_moyassar/${num}`);
        if (!res.ok) throw new Error('API unstable');
        const data = await res.json();
        
        if (data && data.result && data.result.length > 0) {
            ayahList.innerHTML = data.result.map(a => `
                <div class="bg-[#D7E5DF] dark:bg-[#152A1F] p-6 rounded-3xl space-y-4">
                    <div class="flex justify-between items-start">
                        <span class="w-10 h-10 rounded-full border border-white/40 dark:border-[#1C3B2B] flex items-center justify-center opacity-40 font-bold">${a.aya}</span>
                    </div>
                    <p class="text-2xl font-['Amiri'] leading-relaxed text-start font-bold" style="font-size: ${state.fontSize}px">${a.arabic_text}</p>
                    <p class="text-sm opacity-60 text-start">${a.translation}</p>
                </div>
            `).join('');
        } else {
            // Fallback to alquran.cloud if quranenc fails
            const res2 = await fetch(`https://api.alquran.cloud/v1/surah/${num}/ar.alafasy`);
            const data2 = await res2.json();
            ayahList.innerHTML = data2.data.ayahs.map(a => `
                <div class="bg-[#D7E5DF] dark:bg-[#152A1F] p-6 rounded-3xl space-y-4">
                    <div class="flex justify-between items-start">
                        <span class="w-10 h-10 rounded-full border border-white/40 dark:border-[#1C3B2B] flex items-center justify-center opacity-40 font-bold">${a.numberInSurah}</span>
                    </div>
                    <p class="text-2xl font-['Amiri'] leading-relaxed text-start font-bold" style="font-size: ${state.fontSize}px">${a.text}</p>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error("Fetch Ayahs error:", e);
        ayahList.innerHTML = '<p class="text-center p-10">فشل في جلب الآيات. يرجى المحقق من الاتصال بالإنترنت.</p>';
    }
}

function playSurah(e, num) {
    if (e) e.stopPropagation();
    const surah = state.quran.surahs.find(s => s.number === num);
    const reciter = state.quran.reciters.find(r => r.id === state.quran.selectedReciter) || state.quran.reciters[0];
    
    const server = reciter.server.endsWith('/') ? reciter.server : reciter.server + '/';
    let url = '';
    if (reciter.id.startsWith('quran-com')) {
        url = `${server}${num}.mp3`;
    } else {
        url = `${server}${String(num).padStart(3, '0')}.mp3`;
    }

    startAudio(url, surah.name, reciter.name);
}

// --- Feature: Radio ---
async function initRadio() {
    if (state.radios.length > 0) {
        renderRadios();
        return;
    }
    
    const list = document.getElementById('radio-list');
    list.innerHTML = '<div class="col-span-full flex justify-center py-20"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>';
    lucide.createIcons();

    try {
        const lang = state.language === 'ar' ? 'ar' : 'eng';
        const data = await fetchWithCache(`https://www.mp3quran.net/api/v3/radios?language=${lang}`, `radios_all`);
        const apiRadios = data.radios.map(r => {
            let cat = 'reciter';
            const n = r.name.toLowerCase();
            const secureUrl = r.url.replace('http://', 'https://');
            
            if (n.includes('تفسير') || n.includes('فتاوى') || n.includes('دروس')) cat = 'tafsir';
            else if (n.includes('أذكار') || n.includes('رقية') || n.includes('تكبيرات')) cat = 'azkar';
            else if (n.includes('ترجمة') || n.includes('translations') || n.includes('عامة') || n.includes('متنوعة')) cat = 'misc';
            else if (n === 'إذاعة القرآن الكريم' || n.includes('الإذاعة العامة') || n.includes('محطة')) cat = 'channel';
            // Notice: We intentionally do NOT blanket map "إذاعة" to "channel", 
            // because most Mp3Quran API entries are "إذاعة [اسم القارئ]" and correctly belong to "reciter".

            let radioName = r.name;
            if (cat === 'reciter' && lang === 'ar') {
                if (radioName.startsWith('إذاعة ')) {
                    const reciterPart = radioName.replace('إذاعة ', '');
                    if (!reciterPart.startsWith('القارئ') && !reciterPart.startsWith('الشيخ')) {
                        radioName = `إذاعة الشيخ ${reciterPart}`;
                    }
                } else {
                    if (!radioName.startsWith('القارئ') && !radioName.startsWith('الشيخ')) {
                        radioName = `الشيخ ${radioName}`;
                    }
                }
            }
            
            return { ...r, name: radioName, url: secureUrl, category: cat };
        });

        // Combine manual and API radios
        state.radios = [...state.manualRadios, ...apiRadios];
        
        renderRadios();
    } catch (e) {
        list.innerHTML = '<p class="col-span-full text-center p-10">فشل في جلب الإذاعات</p>';
    }
}

function setRadioCat(cat) {
    state.activeRadioCat = cat;
    document.querySelectorAll('.radio-tab-btn').forEach(btn => {
        // Simplified mapping check since getCatName has to match the exact string
        const matched = btn.innerText.trim() === getCatName(cat).trim();
        if (matched) {
            btn.classList.add('bg-[#1C6B4F]', 'text-white');
            btn.classList.remove('bg-white', 'dark:bg-[#111C16]', 'text-inherit');
        } else {
            btn.classList.remove('bg-[#1C6B4F]', 'text-white');
            btn.classList.add('bg-white', 'dark:bg-[#111C16]', 'text-inherit');
        }
    });
    renderRadios();
}

function getCatName(cat) {
    return { reciter: 'القراء', channel: 'قنوات الراديو', azkar: 'أذكار ورقية', tafsir: 'تفسير وفتاوى', misc: 'إذعات متنوعة' }[cat] || 'القراء';
}

function renderRadios() {
    const list = document.getElementById('radio-list');
    const query = document.getElementById('radio-search').value.toLowerCase();
    const filtered = state.radios.filter(r => r.category === state.activeRadioCat && r.name.toLowerCase().includes(query));
    
    list.innerHTML = filtered.slice(0, 50).map(r => `
        <div onclick="startAudio('${r.url}', '${r.name}', 'راديو مباشر', '${r.id || ''}', '${r.provider || ''}')" class="premium-card p-6 flex items-center justify-between cursor-pointer group">
            <div class="flex items-center gap-5">
                <div class="w-14 h-14 bg-[#1C6B4F]/5 rounded-[1.25rem] flex items-center justify-center text-[#1C6B4F] dark:text-[#34D399] group-hover:bg-[#1C6B4F] group-hover:text-white transition-all">
                    <i data-lucide="radio" class="w-7 h-7"></i>
                </div>
                <h3 class="font-extrabold text-lg group-hover:text-[#1C6B4F] dark:group-hover:text-[#34D399] transition-colors text-start">${r.name}</h3>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="toggleFavoriteRadio(event, '${r.url}')" class="p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all ${state.favorites.radios.includes(r.url) ? 'text-red-500' : 'opacity-20'}">
                    <i data-lucide="heart" class="w-6 h-6 ${state.favorites.radios.includes(r.url) ? 'fill-red-500' : ''}"></i>
                </button>
                <button class="w-12 h-12 bg-[#1C6B4F] dark:bg-[#10B981] text-white rounded-2xl flex items-center justify-center hover:scale-105 transition-all">
                    <i data-lucide="play" class="w-6 h-6 fill-white"></i>
                </button>
            </div>
        </div>
    `).join('');
    if(typeof applyTranslations === 'function') applyTranslations();
    lucide.createIcons();
}

function toggleFavoriteRadio(e, url) {
    if (e) e.stopPropagation();
    const idx = state.favorites.radios.indexOf(url);
    if (idx > -1) state.favorites.radios.splice(idx, 1);
    else state.favorites.radios.push(url);
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    renderRadios();
}

// --- Feature: Azkar ---
async function initAzkar() {
    if (Object.keys(state.azkar.data).length > 0) {
        renderAzkar();
        return;
    }
    
    try {
        const data = await fetchWithCache('https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51279ab6eb86dc2f6202c7de26c8948331c1/azkar.json', 'azkar_data');
        state.azkar.data = data;
        
        // Render cats list
        const catList = document.getElementById('azkar-cats-modal');
        catList.innerHTML = Object.keys(data).map(cat => `
            <button onclick="setAzkarCategory('${cat}')" class="w-full text-start p-4 hover:bg-[#059669]/5 rounded-2xl font-bold transition-all">${cat}</button>
        `).join('');
        
        renderAzkar();
    } catch (e) {
        console.error(e);
    }
}

function setAzkarCategory(cat) {
    state.azkar.category = cat;
    state.azkar.counters = {};
    document.getElementById('active-category-name').innerText = cat;
    document.getElementById('azkar-cats-modal').classList.add('hidden');
    renderAzkar();
}

function renderAzkar() {
    const list = document.getElementById('azkar-list');
    const items = state.azkar.data[state.azkar.category] || [];
    
    list.innerHTML = (Array.isArray(items) ? items : items.flat()).map((z, idx) => {
        const target = parseInt(z.count) || 1;
        const current = state.azkar.counters[idx] || 0;
        const complete = current >= target;

        return `
            <div class="premium-card p-10 flex flex-col ${complete ? 'opacity-40 grayscale scale-[0.98]' : ''} transition-all duration-500">
                <p class="text-3xl font-['Amiri'] leading-relaxed text-start mb-10 font-bold">${z.content}</p>
                <div class="flex items-center justify-between border-t border-white/40 dark:border-[#1C3B2B] pt-8">
                    <div class="text-start">
                        <span class="text-[10px] opacity-40 font-black block mb-1 uppercase tracking-widest">التكرار</span>
                        <div class="flex items-baseline gap-1">
                            <span class="font-black text-2xl text-[#1C6B4F] dark:text-[#34D399]">${current}</span>
                            <span class="opacity-20 text-xs">/ ${target}</span>
                        </div>
                    </div>
                    <button onclick="incAzkar(${idx}, ${target})" ${complete ? 'disabled' : ''} class="w-24 h-24 bg-[#1C6B4F] dark:bg-[#10B981] text-white rounded-[2rem] text-4xl font-black shadow-xl active:scale-90 transition-all hover:bg-[#15543D]">
                        ${complete ? '✓' : current}
                    </button>
                    <button onclick="resetAzkar(${idx})" class="w-14 h-14 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center opacity-30 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all"><i data-lucide="refresh-cw" class="w-6 h-6"></i></button>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function incAzkar(idx, target) {
    state.azkar.counters[idx] = (state.azkar.counters[idx] || 0) + 1;
    renderAzkar();
}

function resetAzkar(idx) {
    state.azkar.counters[idx] = 0;
    renderAzkar();
}

// --- Feature: Hadith ---
async function initHadith() {
    if (state.hadith.list.length > 0) return;
    
    try {
        const data = await fetchWithCache('https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-nawawi.json', 'hadith_nawawi');
        state.hadith.list = data.hadiths;
        renderHadith();
    } catch (e) {
        console.error(e);
    }
}

function renderHadith() {
    const h = state.hadith.list[state.hadith.index];
    if (!h) return;
    const el = document.getElementById('hadith-text');
    el.innerText = h.text;
    el.style.fontSize = state.fontSize + 'px';
}

// --- Feature: Audio Player ---
let audioEl = document.getElementById('global-audio');
const miniPlayer = document.getElementById('mini-player');
const playBtn = document.getElementById('player-play-btn');
let hls = null;

function resetAudioElement() {
    if (audioEl) {
        audioEl.pause();
        audioEl.removeAttribute('src');
        audioEl.load();
        
        // Remove old events
        audioEl.onerror = null;
        audioEl.onended = null;
    }
    
    // Create fresh instance to prevent any DOM/Source caching issues
    audioEl = new Audio();
    audioEl.id = 'global-audio';
    audioEl.preload = 'none';
    
    // Reattach listeners
    audioEl.onerror = () => {
        console.error("Audio element error:", audioEl.error);
        if (state.audio.isPlaying) {
            document.getElementById('player-subtitle').innerText = "خطأ في الاتصال بالبث";
            state.audio.isPlaying = false;
            updatePlayerBtn();
        }
    };
    audioEl.onended = () => {
        state.audio.isPlaying = false;
        updatePlayerBtn();
    };
    
    return audioEl;
}

function startAudio(url, title, subtitle, radioId, provider) {
    if (!url) return;
    
    let secureUrl = url.trim();
    // Check if the URL is from mp3quran, explicitly downgrade to HTTP if HTTPS fails, mostly handled by a proxy if needed
    // But since AI Studio is strictly HTTPS, we must force HTTPS.
    // Replace http:// with https:// unless it contains a custom port (like :8000)
    // Custom ports over HTTP will always fail Mixed Content on HTTPS pages, so we try fetching via a proxy or just warn.
    if (secureUrl.startsWith('http://')) {
        if (!secureUrl.includes(':', 6)) {
             secureUrl = secureUrl.replace('http://', 'https://');
        } else {
             // For http with custom ports, the browser will likely block it. We can attempt to rewrite it
             // through a public cors proxy strictly for demo if needed, but best effort is to warn the user 
             // in the player subtitle if it fails later.
        }
    }
    
    state.audio.title = title;
    state.audio.subtitle = subtitle;
    
    document.getElementById('player-title').innerText = title;
    document.getElementById('player-subtitle').innerText = "جاري الاتصال...";
    miniPlayer.classList.remove('hidden');
    
    const originalSubtitle = subtitle;
    
    if (hls) {
        hls.destroy();
        hls = null;
    }
    
    // Fresh node
    resetAudioElement();

    const isHls = secureUrl.includes('.m3u8') || secureUrl.includes('live.mp3quran.net/s_quran');
    
    if (isHls && Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(secureUrl);
        hls.attachMedia(audioEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            playFinal(originalSubtitle, provider, radioId);
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
               console.warn("HLS Error", data);
               hls.destroy();
               hls = null;
               nativePlay(secureUrl, originalSubtitle, provider, radioId);
            }
        });
    } else {
        // Fallback for native radio streams
        nativePlay(secureUrl, originalSubtitle, provider, radioId);
    }
}

function nativePlay(url, sub, prov, rid) {
    if (!audioEl) resetAudioElement(); 
    // We add crossOrigin anonymous if it might be an issue, though direct audio playback usually ignores it unless web audio API is used
    audioEl.crossOrigin = "anonymous";
    audioEl.src = url;
    
    // Some streams need wait for metadata before playing
    audioEl.onloadedmetadata = () => {
        playFinal(sub, prov, rid);
    };
    
    // Timeout fallback if loadedmetadata takes too long (icecast streams)
    const playTimeout = setTimeout(() => {
        playFinal(sub, prov, rid);
    }, 2000);
    
    audioEl.onerror = () => {
        clearTimeout(playTimeout);
        console.error("Audio element error on load:", audioEl.error);
        if (state.audio.isPlaying !== false) {
             state.audio.isPlaying = false;
             document.getElementById('player-subtitle').innerText = "عذراً، ملف الصوت غير متاح عبر هذا الاتصال";
             updatePlayerBtn();
        }
    };
    
    audioEl.load();
}

function playFinal(subtitle, provider, radioId) {
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            state.audio.isPlaying = true;
            document.getElementById('player-subtitle').innerText = subtitle;
            updatePlayerBtn();
            if (provider === 'radiojar' && radioId) {
                fetchRadioJarMetadata(radioId);
            }
        }).catch(error => {
            console.warn("Stream unavailable.");
            state.audio.isPlaying = false;
            updatePlayerBtn();
            document.getElementById('player-subtitle').innerText = "عذراً، هذا البث متوقف حالياً";
        });
    }
}

async function fetchRadioJarMetadata(id) {
    try {
        const res = await fetch(`https://api.radiojar.com/v1/stations/${id}/now_playing/`);
        const data = await res.json();
        if (data && data.title) {
            document.getElementById('player-subtitle').innerText = "الآن: " + data.title;
        }
    } catch (e) { console.warn("Metadata fetch error", e); }
}

// Ensure the first play Btn handler is bound properly
function updatePlayerBtn() {
    playBtn.innerHTML = state.audio.isPlaying ? '<i data-lucide="pause" class="w-6 h-6 fill-white"></i>' : '<i data-lucide="play" class="w-6 h-6 fill-white"></i>';
    lucide.createIcons();
}

playBtn.onclick = () => {
    if (state.audio.isPlaying) {
        audioEl.pause();
    } else {
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
             playPromise.catch(() => {
                  console.error("Play error on toggle.");
             });
        }
    }
    state.audio.isPlaying = !state.audio.isPlaying;
    updatePlayerBtn();
};

// --- Main Init ---
window.onload = () => {
    initTheme();
    initLanguage();
    
    // Default Tab
    switchTab('prayer');

    // Nav Events
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.getAttribute('data-tab'));
    });

    // Special Component Events
    document.getElementById('reciter-dropdown-btn').onclick = () => {
        document.getElementById('reciter-modal').classList.remove('hidden');
        renderReciters();
    };

    document.getElementById('reciter-search').oninput = renderReciters;
    document.getElementById('close-reciter').onclick = () => document.getElementById('reciter-modal').classList.add('hidden');
    document.getElementById('close-surah').onclick = () => document.getElementById('surah-detail').classList.add('hidden');
    document.getElementById('surah-search').oninput = renderSurahs;
    document.getElementById('radio-search').oninput = renderRadios;
    document.getElementById('location-btn').onclick = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                state.location.coords = { lat: latitude, lng: longitude };
                
                // Try reverse geocoding via free api if online
                try {
                    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ar`);
                    const data = await res.json();
                    state.location.city = data.city || data.locality || 'موقعي';
                    state.location.country = data.countryName || '';
                } catch(e) {
                    state.location.city = 'موقعي';
                    state.location.country = '';
                }
                
                localStorage.setItem('location', JSON.stringify(state.location));
                alert('تم تحديث الموقع بنجاح');
                initPrayer();
            });
        }
    };

    document.getElementById('qibla-locate-btn').onclick = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                state.location.coords = { lat: latitude, lng: longitude };
                
                try {
                    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ar`);
                    const data = await res.json();
                    state.location.city = data.city || data.locality || 'موقعي';
                    state.location.country = data.countryName || '';
                } catch(e) {
                    state.location.city = 'موقعي';
                    state.location.country = '';
                }
                
                localStorage.setItem('location', JSON.stringify(state.location));
                alert('تم تحديث الموقع للقبلة بنجاح');
                fetchQibla();
            });
        } else {
             alert('تعذر الوصول للموقع. تأكد من تفعيل الـ GPS ومشاركة الموقع مع المتصفح.');
        }
    };

    document.getElementById('azkar-cats-btn').onclick = () => {
        const modal = document.getElementById('azkar-cats-modal');
        modal.classList.toggle('hidden');
    };

    document.getElementById('next-hadith').onclick = () => {
        state.hadith.index = (state.hadith.index + 1) % state.hadith.list.length;
        renderHadith();
    };
    document.getElementById('prev-hadith').onclick = () => {
        state.hadith.index = (state.hadith.index - 1 + state.hadith.list.length) % state.hadith.list.length;
        renderHadith();
    };

    document.getElementById('share-hadith').onclick = () => {
        const h = state.hadith.list[state.hadith.index];
        if (h) shareText(h.text);
    };

    document.getElementById('share-surah').onclick = () => {
        if (state.quran.activeSurah) {
            shareText(`استمع وشاهد سورة ${state.quran.activeSurah.name} عبر تطبيق إسلاميات`);
        }
    };
};

function renderReciters() {
    const list = document.getElementById('reciter-list');
    const query = document.getElementById('reciter-search').value.toLowerCase();
    
    list.innerHTML = state.quran.reciters
        .filter(r => r.name.toLowerCase().includes(query))
        .map(r => `
            <button onclick="selectReciter('${r.id}')" class="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#059669]/10 text-start transition-all">
                <div class="w-8 h-8 rounded-full bg-[#059669]/5 flex items-center justify-center font-bold text-[#1C6B4F]">${r.name.charAt(0)}</div>
                <span class="font-bold truncate">${r.name}</span>
            </button>
        `).join('');
if(typeof applyTranslations === 'function') applyTranslations();
    }

function selectReciter(id) {
    state.quran.selectedReciter = id;
    localStorage.setItem('selectedReciter', id);
    const rec = state.quran.reciters.find(r => r.id === id);
    document.getElementById('current-reciter-name').innerText = rec.name;
    document.getElementById('reciter-modal').classList.add('hidden');
}

// Ensure functions are available globally for inline HTML event handlers
window.changeFontSize = changeFontSize;
window.openNamesOfAllah = openNamesOfAllah;
window.closeNamesOfAllah = closeNamesOfAllah;
window.openQibla = openQibla;
window.closeQibla = closeQibla;
window.openCalendar = openCalendar;
window.toggleFavoriteSurah = toggleFavoriteSurah;
window.openSurah = openSurah;
window.playSurah = playSurah;
window.setRadioCat = setRadioCat;
window.startAudio = startAudio;
window.toggleFavoriteRadio = toggleFavoriteRadio;
window.setAzkarCategory = setAzkarCategory;
window.incAzkar = incAzkar;
window.resetAzkar = resetAzkar;
window.selectReciter = selectReciter;
