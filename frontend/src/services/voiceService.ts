import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LanguageCode = 'en' | 'hi' | 'ta';

const LANGUAGE_VOICES: Record<LanguageCode, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
};

export const voiceService = {
    async speak(
        text: string,
        language: LanguageCode = 'en',
        options?: Speech.SpeechOptions
    ): Promise<void> {
        try {
            await Speech.stop();
            await Speech.speak(text, {
                language: LANGUAGE_VOICES[language],
                pitch: 1.0,
                rate: 0.9,
                volume: 1.0,
                ...options,
            });
        } catch (error) {
            console.error('Error speaking text:', error);
        }
    },

    async speakDualLanguage(
        titleEn: string,
        bodyEn: string,
        messages?: Record<string, { title: string; body: string }>
    ): Promise<void> {
        try {
            const primaryLang = (await AsyncStorage.getItem('primary_language')) as LanguageCode || 'en';
            const secondaryLang = (await AsyncStorage.getItem('secondary_language')) as LanguageCode | null;

            const primaryMessage = messages?.[primaryLang] || { title: titleEn, body: bodyEn };
            await this.speak(
                `${primaryMessage.title}. ${primaryMessage.body}`,
                primaryLang
            );

            if (secondaryLang && secondaryLang !== primaryLang) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const secondaryMessage = messages?.[secondaryLang] || { title: titleEn, body: bodyEn };
                await this.speak(
                    `${secondaryMessage.title}. ${secondaryMessage.body}`,
                    secondaryLang
                );
            }
        } catch (error) {
            console.error('Error speaking dual language:', error);
        }
    },

    async stop(): Promise<void> {
        try {
            await Speech.stop();
        } catch (error) {
            console.error('Error stopping speech:', error);
        }
    },

    async isSpeaking(): Promise<boolean> {
        try {
            return await Speech.isSpeakingAsync();
        } catch (error) {
            console.error('Error checking speech status:', error);
            return false;
        }
    },
};
