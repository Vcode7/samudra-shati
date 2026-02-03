import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LanguageCode = 'en' | 'hi' | 'ta';

interface LanguageContextType {
    primaryLanguage: LanguageCode;
    secondaryLanguage: LanguageCode | null;
    setPrimaryLanguage: (lang: LanguageCode) => Promise<void>;
    setSecondaryLanguage: (lang: LanguageCode | null) => Promise<void>;
    t: (key: string) => string;
    loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<LanguageCode, Record<string, string>> = {
    en: {
        continue: 'Continue', cancel: 'Cancel', submit: 'Submit', yes: 'Yes', no: 'No',
        loading: 'Loading...', error: 'Error', success: 'Success',
        selectPrimaryLanguage: 'Select Your Primary Language',
        selectSecondaryLanguage: 'Select Secondary Language (Optional)',
        languageDescription: 'Alerts will be announced in both languages',
        phoneNumber: 'Phone Number', enterPhoneNumber: 'Enter your phone number',
        requestOTP: 'Request OTP', enterOTP: 'Enter OTP', verify: 'Verify', resendOTP: 'Resend OTP',
        home: 'Home', activeAlerts: 'Active Alerts', noActiveAlerts: 'No active alerts',
        reportDisaster: 'Report Disaster', recentAlerts: 'Recent Alerts',
        uploadImage: 'Upload Image', takePhoto: 'Take Photo', chooseFromGallery: 'Choose from Gallery',
        description: 'Description (Optional)', location: 'Location', gettingLocation: 'Getting location...',
        settings: 'Settings', changeLanguage: 'Change Language', testAlert: 'Test Alert',
        trustScore: 'Trust Score', logout: 'Logout',
    },
    hi: {
        continue: 'जारी रखें', cancel: 'रद्द करें', submit: 'जमा करें', yes: 'हाँ', no: 'नहीं',
        loading: 'लोड हो रहा है...', error: 'त्रुटि', success: 'सफलता',
        selectPrimaryLanguage: 'अपनी प्राथमिक भाषा चुनें',
        selectSecondaryLanguage: 'द्वितीयक भाषा चुनें (वैकल्पिक)',
        languageDescription: 'अलर्ट दोनों भाषाओं में घोषित किए जाएंगे',
        phoneNumber: 'फ़ोन नंबर', enterPhoneNumber: 'अपना फ़ोन नंबर दर्ज करें',
        requestOTP: 'OTP का अनुरोध करें', enterOTP: 'OTP दर्ज करें', verify: 'सत्यापित करें', resendOTP: 'OTP पुनः भेजें',
        home: 'होम', activeAlerts: 'सक्रिय अलर्ट', noActiveAlerts: 'कोई सक्रिय अलर्ट नहीं',
        reportDisaster: 'आपदा की रिपोर्ट करें', recentAlerts: 'हाल के अलर्ट',
        uploadImage: 'छवि अपलोड करें', takePhoto: 'फोटो लें', chooseFromGallery: 'गैलरी से चुनें',
        description: 'विवरण (वैकल्पिक)', location: 'स्थान', gettingLocation: 'स्थान प्राप्त कर रहे हैं...',
        settings: 'सेटिंग्स', changeLanguage: 'भाषा बदलें', testAlert: 'टेस्ट अलर्ट',
        trustScore: 'विश्वास स्कोर', logout: 'लॉगआउट',
    },
    ta: {
        continue: 'தொடரவும்', cancel: 'ரத்துசெய்', submit: 'சமர்ப்பிக்கவும்', yes: 'ஆம்', no: 'இல்லை',
        loading: 'ஏற்றுகிறது...', error: 'பிழை', success: 'வெற்றி',
        selectPrimaryLanguage: 'உங்கள் முதன்மை மொழியைத் தேர்ந்தெடுக்கவும்',
        selectSecondaryLanguage: 'இரண்டாம் நிலை மொழியைத் தேர்ந்தெடுக்கவும் (விரும்பினால்)',
        languageDescription: 'எச்சரிக்கைகள் இரண்டு மொழிகளிலும் அறிவிக்கப்படும்',
        phoneNumber: 'தொலைபேசி எண்', enterPhoneNumber: 'உங்கள் தொலைபேசி எண்ணை உள்ளிடவும்',
        requestOTP: 'OTP கோரவும்', enterOTP: 'OTP உள்ளிடவும்', verify: 'சரிபார்க்கவும்', resendOTP: 'OTP மீண்டும் அனுப்பவும்',
        home: 'முகப்பு', activeAlerts: 'செயலில் உள்ள எச்சரிக்கைகள்', noActiveAlerts: 'செயலில் எச்சரிக்கைகள் இல்லை',
        reportDisaster: 'பேரிடரை அறிவிக்கவும்', recentAlerts: 'சமீபத்திய எச்சரிக்கைகள்',
        uploadImage: 'படத்தைப் பதிவேற்றவும்', takePhoto: 'புகைப்படம் எடுக்கவும்', chooseFromGallery: 'கேலரியிலிருந்து தேர்வுசெய்யவும்',
        description: 'விளக்கம் (விரும்பினால்)', location: 'இடம்', gettingLocation: 'இடத்தைப் பெறுகிறது...',
        settings: 'அமைப்புகள்', changeLanguage: 'மொழியை மாற்றவும்', testAlert: 'சோதனை எச்சரிக்கை',
        trustScore: 'நம்பிக்கை மதிப்பெண்', logout: 'வெளியேறு',
    },
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [primaryLanguage, setPrimaryLang] = useState<LanguageCode>('en');
    const [secondaryLanguage, setSecondaryLang] = useState<LanguageCode | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLanguagePreferences();
    }, []);

    const loadLanguagePreferences = async () => {
        try {
            const [primary, secondary] = await Promise.all([
                AsyncStorage.getItem('primary_language'),
                AsyncStorage.getItem('secondary_language'),
            ]);
            if (primary) setPrimaryLang(primary as LanguageCode);
            if (secondary) setSecondaryLang(secondary as LanguageCode);
        } catch (error) {
            console.error('Error loading language preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const setPrimaryLanguage = async (lang: LanguageCode) => {
        try {
            await AsyncStorage.setItem('primary_language', lang);
            setPrimaryLang(lang);
        } catch (error) {
            console.error('Error setting primary language:', error);
        }
    };

    const setSecondaryLanguage = async (lang: LanguageCode | null) => {
        try {
            if (lang) {
                await AsyncStorage.setItem('secondary_language', lang);
            } else {
                await AsyncStorage.removeItem('secondary_language');
            }
            setSecondaryLang(lang);
        } catch (error) {
            console.error('Error setting secondary language:', error);
        }
    };

    const t = (key: string): string => {
        return translations[primaryLanguage][key] || key;
    };

    return (
        <LanguageContext.Provider
            value={{
                primaryLanguage,
                secondaryLanguage,
                setPrimaryLanguage,
                setSecondaryLanguage,
                t,
                loading,
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
};

export { translations };
