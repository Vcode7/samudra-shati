import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TextInput,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { LanguageCode, ALL_LANGUAGES, REGION_ORDER, REGION_LABELS, LanguageInfo } from '../i18n';
import { vibrationService } from '../services/vibrationService';

interface Props {
    onComplete: () => void;
}

export const LanguageSelectionScreen: React.FC<Props> = ({ onComplete }) => {
    const { primaryLanguage, secondaryLanguage, setPrimaryLanguage, setSecondaryLanguage, t } = useLanguage();
    const [step, setStep] = useState<'primary' | 'secondary'>('primary');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter languages based on search query
    const filteredLanguages = useMemo(() => {
        if (!searchQuery.trim()) return ALL_LANGUAGES;
        const q = searchQuery.toLowerCase().trim();
        return ALL_LANGUAGES.filter(
            (lang) =>
                lang.name.toLowerCase().includes(q) ||
                lang.nativeName.toLowerCase().includes(q) ||
                lang.code.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    // Group filtered languages by region
    const groupedLanguages = useMemo(() => {
        const groups: Record<string, LanguageInfo[]> = {};
        for (const region of REGION_ORDER) {
            const langs = filteredLanguages.filter((l) => l.region === region);
            if (langs.length > 0) {
                groups[region] = langs;
            }
        }
        return groups;
    }, [filteredLanguages]);

    const handleLanguageSelect = async (code: LanguageCode) => {
        vibrationService.light();

        if (step === 'primary') {
            await setPrimaryLanguage(code);
            setStep('secondary');
            setSearchQuery('');
        } else {
            if (code === primaryLanguage) {
                // Don't allow same as primary; treat as skip
                await setSecondaryLanguage(null);
            } else {
                await setSecondaryLanguage(code);
            }
            onComplete();
        }
    };

    const handleSkipSecondary = () => {
        vibrationService.light();
        setSecondaryLanguage(null);
        onComplete();
    };

    const selectedCode = step === 'primary' ? primaryLanguage : secondaryLanguage;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.emoji}>🌊</Text>
                <Text style={styles.title}>
                    {step === 'primary' ? t('select_primary_language') : t('select_secondary_language')}
                </Text>
                <Text style={styles.subtitle}>
                    {step === 'primary' ? t('required') : t('alerts_play_both')}
                </Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder={t('search_languages')}
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                />
            </View>

            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
                {Object.entries(groupedLanguages).map(([region, langs]) => (
                    <View key={region}>
                        <Text style={styles.regionHeader}>{t(REGION_LABELS[region])}</Text>
                        {langs.map((lang) => (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.languageCard,
                                    selectedCode === lang.code && styles.selectedCard,
                                    step === 'secondary' && lang.code === primaryLanguage && styles.disabledCard,
                                ]}
                                onPress={() => handleLanguageSelect(lang.code)}
                                disabled={step === 'secondary' && lang.code === primaryLanguage}
                            >
                                <View style={styles.languageInfo}>
                                    <Text style={[
                                        styles.nativeName,
                                        selectedCode === lang.code && styles.selectedText,
                                    ]}>
                                        {lang.nativeName}
                                    </Text>
                                    <Text style={[
                                        styles.englishName,
                                        selectedCode === lang.code && styles.selectedSubText,
                                    ]}>
                                        {lang.name}
                                    </Text>
                                </View>
                                {selectedCode === lang.code && (
                                    <Text style={styles.checkmark}>✓</Text>
                                )}
                                {step === 'secondary' && lang.code === primaryLanguage && (
                                    <Text style={styles.primaryBadge}>{t('primary_language')}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}

                {filteredLanguages.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>{t('no_results')}</Text>
                    </View>
                )}
            </ScrollView>

            {/* Step indicator and skip button */}
            <View style={styles.footer}>
                <View style={styles.stepIndicator}>
                    <View style={[styles.dot, step === 'primary' && styles.activeDot]} />
                    <View style={[styles.dot, step === 'secondary' && styles.activeDot]} />
                </View>
                {step === 'secondary' && (
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkipSecondary}>
                        <Text style={styles.skipText}>
                            {t('continue')} →
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a1628',
    },
    header: {
        paddingVertical: 24,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    emoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#8899aa',
        textAlign: 'center',
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    searchInput: {
        backgroundColor: '#1a2a3e',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#2a3a4e',
    },
    languageList: {
        flex: 1,
        paddingHorizontal: 20,
    },
    regionHeader: {
        fontSize: 13,
        fontWeight: '700',
        color: '#5588bb',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 16,
        marginBottom: 8,
        paddingLeft: 4,
    },
    languageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#1a2a3e',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCard: {
        borderColor: '#0088ff',
        backgroundColor: '#0d2040',
    },
    disabledCard: {
        opacity: 0.4,
    },
    languageInfo: {
        flex: 1,
    },
    nativeName: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    englishName: {
        fontSize: 14,
        color: '#8899aa',
    },
    selectedText: {
        color: '#0088ff',
    },
    selectedSubText: {
        color: '#66aaff',
    },
    checkmark: {
        fontSize: 22,
        color: '#0088ff',
        fontWeight: 'bold',
    },
    primaryBadge: {
        fontSize: 11,
        color: '#666',
        fontStyle: 'italic',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
    },
    footer: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    stepIndicator: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#334',
    },
    activeDot: {
        backgroundColor: '#0088ff',
        width: 24,
    },
    skipButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        backgroundColor: '#0088ff',
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    skipText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
