import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTranslator, mapLocaleToLanguageCode, LanguageCode } from '../i18n';
import * as Localization from 'expo-localization';

export type { LanguageCode } from '../i18n';

interface LanguageContextType {
    primaryLanguage: LanguageCode;
    secondaryLanguage: LanguageCode | null;
    setPrimaryLanguage: (lang: LanguageCode) => Promise<void>;
    setSecondaryLanguage: (lang: LanguageCode | null) => Promise<void>;
    t: (key: string, params?: Record<string, string | number>) => string;
    loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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

            if (primary) {
                setPrimaryLang(primary as LanguageCode);
            } else {
                // Detect device locale as default
                try {
                    const locales = Localization.getLocales();
                    if (locales && locales.length > 0) {
                        const deviceLocale = locales[0].languageTag || 'en';
                        const detected = mapLocaleToLanguageCode(deviceLocale);
                        setPrimaryLang(detected);
                    }
                } catch (localeError) {
                    console.log('Could not detect device locale, defaulting to English');
                }
            }

            if (secondary) {
                setSecondaryLang(secondary as LanguageCode);
            }
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

    // Memoize the translator so it only recreates when language changes
    const t = useCallback(
        (key: string, params?: Record<string, string | number>): string => {
            const translator = createTranslator(primaryLanguage);
            return translator(key, params);
        },
        [primaryLanguage]
    );

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
