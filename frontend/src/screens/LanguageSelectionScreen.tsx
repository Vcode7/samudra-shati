import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar ,ScrollView} from 'react-native';
import { useLanguage, LanguageCode } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';

const LANGUAGES = [
    { code: 'en' as LanguageCode, name: 'English', nativeName: 'English' },
    { code: 'hi' as LanguageCode, name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ta' as LanguageCode, name: 'Tamil', nativeName: 'தமிழ்' },
];

interface Props {
    onComplete: () => void;
}

export const LanguageSelectionScreen: React.FC<Props> = ({ onComplete }) => {
    const { setPrimaryLanguage, setSecondaryLanguage } = useLanguage();
    const [selectedPrimary, setSelectedPrimary] = useState<LanguageCode | null>(null);
    const [selectedSecondary, setSelectedSecondary] = useState<LanguageCode | null>(null);

    const handlePrimarySelect = (code: LanguageCode) => {
        vibrationService.light();
        setSelectedPrimary(code);
        if (selectedSecondary === code) setSelectedSecondary(null);
    };

    const handleSecondarySelect = (code: LanguageCode) => {
        vibrationService.light();
        setSelectedSecondary(selectedSecondary === code ? null : code);
    };

    const handleContinue = async () => {
        if (!selectedPrimary) return;
        console.log("Language selected, continuing...");

        vibrationService.success();
        console.log("Language selected, continuing...");
        await setPrimaryLanguage(selectedPrimary);
        await setSecondaryLanguage(selectedSecondary);
        onComplete();
    };

    return (
        <SafeAreaView style={styles.container}>

            <StatusBar barStyle="light-content" backgroundColor="#0066cc" />
             <ScrollView
    contentContainerStyle={styles.scrollContent}
    showsVerticalScrollIndicator={false}
  >


            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.appName}>🌊 Samudar Shati</Text>
                    <Text style={styles.appSubtitle}>Ocean Alert System</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Select Your Primary Language</Text>
                    <Text style={styles.sectionSubtitle}>Required</Text>
                    <View style={styles.languageGrid}>
                        {LANGUAGES.map((lang) => (
                            <TouchableOpacity
                            key={lang.code}
                            style={[styles.languageButton, selectedPrimary === lang.code && styles.languageButtonSelected]}
                            onPress={() => handlePrimarySelect(lang.code)}
                            >
                                <Text style={[styles.languageNative, selectedPrimary === lang.code && styles.languageTextSelected]}>
                                    {lang.nativeName}
                                </Text>
                                <Text style={[styles.languageName, selectedPrimary === lang.code && styles.languageTextSelected]}>
                                    {lang.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {selectedPrimary && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Select Secondary Language</Text>
                        <Text style={styles.sectionSubtitle}>Optional - Alerts will play in both languages</Text>
                        <View style={styles.languageGrid}>
                            {LANGUAGES.filter((lang) => lang.code !== selectedPrimary).map((lang) => (
                                <TouchableOpacity
                                    key={lang.code}
                                    style={[
                                        styles.languageButton,
                                        styles.languageButtonSecondary,
                                        selectedSecondary === lang.code && styles.languageButtonSelected,
                                    ]}
                                    onPress={() => handleSecondarySelect(lang.code)}
                                >
                                    <Text style={[styles.languageNative, selectedSecondary === lang.code && styles.languageTextSelected]}>
                                        {lang.nativeName}
                                    </Text>
                                    <Text style={[styles.languageName, selectedSecondary === lang.code && styles.languageTextSelected]}>
                                        {lang.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.continueButton, !selectedPrimary && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!selectedPrimary}
                >
                    <Text style={styles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
            </View>
                                
                                </ScrollView>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0066cc' },
    content: { flex: 1, padding: 20 },
    header: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
    appName: { fontSize: 36, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
    appSubtitle: { fontSize: 16, color: '#e0f0ff' },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
    sectionSubtitle: { fontSize: 14, color: '#b3d9ff', marginBottom: 16 },
    languageGrid: { gap: 12 },
    languageButton: { backgroundColor: '#ffffff', borderRadius: 12, padding: 5, alignItems: 'center', borderWidth: 3, borderColor: 'transparent' },
    languageButtonSecondary: { backgroundColor: '#e6f2ff' },
    languageButtonSelected: { backgroundColor: '#ff6600', borderColor: '#ffffff' },
    languageNative: { fontSize: 28, fontWeight: 'bold', color: '#0066cc', marginBottom: 4 },
    languageName: { fontSize: 16, color: '#666' },
    languageTextSelected: { color: '#ffffff' },
    continueButton: { backgroundColor: '#ff6600', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
    continueButtonDisabled: { backgroundColor: '#999', opacity: 0.5 },
    continueButtonText: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
    scrollContent: {
  flexGrow: 1,
},


});
