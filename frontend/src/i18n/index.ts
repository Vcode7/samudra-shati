import en from './en.json';
import hi from './hi.json';
import ta from './ta.json';
import te from './te.json';
import kn from './kn.json';
import ml from './ml.json';
import mr from './mr.json';
import bn from './bn.json';
import gu from './gu.json';
import or_lang from './or.json';
import pa from './pa.json';
import as_lang from './as.json';
import ur from './ur.json';
import kok from './kok.json';
import sd from './sd.json';
import ne from './ne.json';
import ks from './ks.json';
import mni from './mni.json';
import bho from './bho.json';
import sat from './sat.json';
import mai from './mai.json';
import dog from './dog.json';
import brx from './brx.json';
import raj from './raj.json';
import tcy from './tcy.json';
import be from './be.json';
import hien from './hi-en.json';

// All supported language codes
export type LanguageCode =
    | 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml' | 'mr' | 'bn'
    | 'gu' | 'or' | 'pa' | 'as' | 'ur' | 'kok' | 'sd' | 'ne'
    | 'ks' | 'mni' | 'bho' | 'sat' | 'mai' | 'dog' | 'brx'
    | 'raj' | 'tcy' | 'be' | 'hi-en';

// Language metadata for UI display
export interface LanguageInfo {
    code: LanguageCode;
    name: string;
    nativeName: string;
    region: 'coastal' | 'northern' | 'eastern' | 'western' | 'northeastern' | 'other';
}

// Complete language registry
export const LANGS: Record<LanguageCode, Record<string, string>> = {
    en,
    hi,
    ta,
    te,
    kn,
    ml,
    mr,
    bn,
    gu,
    or: or_lang,
    pa,
    as: as_lang,
    ur,
    kok,
    sd,
    ne,
    ks,
    mni,
    bho,
    sat,
    mai,
    dog,
    brx,
    raj,
    tcy,
    be,
    'hi-en': hien,
};

// All languages with metadata, grouped by region
export const ALL_LANGUAGES: LanguageInfo[] = [
    // Coastal Languages
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'coastal' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', region: 'coastal' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', region: 'coastal' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', region: 'coastal' },
    { code: 'tcy', name: 'Tulu', nativeName: 'ತುಳು', region: 'coastal' },
    { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', region: 'coastal' },
    { code: 'be', name: 'Beary', nativeName: 'ಬ್ಯಾರಿ', region: 'coastal' },
    { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', region: 'coastal' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'coastal' },

    // Northern Languages
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'northern' },
    { code: 'en', name: 'English', nativeName: 'English', region: 'northern' },
    { code: 'hi-en', name: 'Hinglish', nativeName: 'हिंग्लिश', region: 'northern' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', region: 'northern' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', region: 'northern' },
    { code: 'ks', name: 'Kashmiri', nativeName: 'कॉशुर', region: 'northern' },
    { code: 'dog', name: 'Dogri', nativeName: 'डोगरी', region: 'northern' },
    { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', region: 'northern' },

    // Eastern Languages
    { code: 'bho', name: 'Bhojpuri', nativeName: 'भोजपुरी', region: 'eastern' },
    { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', region: 'eastern' },
    { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', region: 'eastern' },
    { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', region: 'eastern' },

    // Western Languages
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', region: 'western' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', region: 'western' },
    { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', region: 'western' },
    { code: 'raj', name: 'Rajasthani', nativeName: 'राजस्थानी', region: 'western' },

    // Northeastern Languages
    { code: 'mni', name: 'Manipuri', nativeName: 'ꯃꯤꯇꯩꯂꯣꯟ', region: 'northeastern' },
    { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', region: 'northeastern' },
];

// Region labels for grouping
export const REGION_LABELS: Record<string, string> = {
    coastal: 'coastal_languages',
    northern: 'northern_languages',
    eastern: 'eastern_languages',
    western: 'western_languages',
    northeastern: 'northeastern_languages',
    other: 'other_languages',
};

// Region display order
export const REGION_ORDER = ['coastal', 'northern', 'eastern', 'western', 'northeastern', 'other'] as const;

/**
 * Creates a translator function for the given language code.
 * Falls back to English for missing keys.
 * Supports parameterized interpolation: t('key', { param: value })
 */
export function createTranslator(langCode: LanguageCode) {
    const translations = LANGS[langCode] || LANGS.en;
    const fallback = LANGS.en;

    return function t(key: string, params?: Record<string, string | number>): string {
        let text = translations[key] || fallback[key] || key;

        // Interpolate parameters: {param} -> value
        if (params) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
            });
        }

        return text;
    };
}

/**
 * Maps device locale string to our supported LanguageCode.
 * e.g., 'hi-IN' -> 'hi', 'ta-IN' -> 'ta', 'en-US' -> 'en'
 */
export function mapLocaleToLanguageCode(locale: string): LanguageCode {
    if (!locale) return 'en';

    const lower = locale.toLowerCase().replace('_', '-');

    // Check exact match first
    if (lower in LANGS) return lower as LanguageCode;

    // Check base language code (before the dash)
    const base = lower.split('-')[0];
    if (base in LANGS) return base as LanguageCode;

    return 'en';
}
