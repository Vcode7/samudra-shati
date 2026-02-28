import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Alert,
    Platform,
    Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LanguageCode } from '../context/LanguageContext';
import { ALL_LANGUAGES } from '../i18n';
import { vibrationService } from '../services/vibrationService';
import { voiceService } from '../services/voiceService';
import { notificationService } from '../services/notificationService';
import { apiClient } from '../services/api';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { user, logout } = useAuth();
    const { t, primaryLanguage, secondaryLanguage, setPrimaryLanguage, setSecondaryLanguage } = useLanguage();
    const [showLanguageSelector, setShowLanguageSelector] = useState(false);
    const [broadcastLoading, setBroadcastLoading] = useState(false);

    const handleTestAlert = async () => {
        vibrationService.emergencyPattern();
        await voiceService.speakDualLanguage(
            'Test Alert',
            'This is a test disaster alert. Your notification system is working correctly.',
            {
                en: { title: 'Test Alert', body: 'This is a test disaster alert.' },
                hi: { title: 'परीक्षण अलर्ट', body: 'यह एक परीक्षण आपदा अलर्ट है।' },
                ta: { title: 'சோதனை எச்சரிக்கை', body: 'இது ஒரு சோதனை பேரிடர் எச்சரிக்கை.' },
            }
        );
        await notificationService.scheduleLocalNotification(
            'Test Alert',
            'This is a test disaster alert',
            { type: 'test' }
        );
        Alert.alert(t('success'), 'Test alert completed! Check if voice and vibration worked.');
    };

    const handleTestBroadcast = async () => {
        Alert.alert(
            '📢 Test Broadcast',
            'This will send a test notification to ALL registered devices. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send to All',
                    style: 'destructive',
                    onPress: async () => {
                        setBroadcastLoading(true);
                        try {
                            const api = await apiClient();
                            const response = await api.post('/api/admin/test-broadcast');
                            const data = response.data;

                            Alert.alert(
                                '✅ Broadcast Sent',
                                `Total devices: ${data.total_tokens}\nDelivered: ${data.delivered_count}\nFailed: ${data.failed_count}`
                            );
                        } catch (error: any) {
                            Alert.alert('Error', 'Failed to send broadcast: ' + (error?.response?.data?.detail || error.message));
                        } finally {
                            setBroadcastLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const openBatterySettings = () => {
        if (Platform.OS === 'android') {
            Linking.openSettings();
        }
    };

    const handleLogout = () => {
        Alert.alert(
            t('logout'),
            'Are you sure you want to logout?',
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('logout'),
                    style: 'destructive',
                    onPress: async () => {
                        vibrationService.medium();
                        await logout();
                    },
                },
            ]
        );
    };

    const handleLanguageChange = async (lang: LanguageCode, isSecondary: boolean) => {
        vibrationService.light();
        if (isSecondary) {
            await setSecondaryLanguage(secondaryLanguage === lang ? null : lang);
        } else {
            await setPrimaryLanguage(lang);
            if (secondaryLanguage === lang) {
                await setSecondaryLanguage(null);
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('settings')}</Text>
                </View>

                {/* User Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('profile')}</Text>
                    <View style={styles.card}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t('phone_number')}:</Text>
                            <Text style={styles.infoValue}>{user?.phone_number || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{t('trust_score')}:</Text>
                            <Text style={[styles.infoValue, styles.trustScore]}>
                                {user?.trust_score?.toFixed(0) || 100}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Language Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('change_language')}</Text>

                    <View style={styles.card}>
                        <View style={styles.languageRow}>
                            <View style={styles.languageInfo}>
                                <Text style={styles.cardSubtitle}>{t('primary_language')}</Text>
                                <Text style={styles.languageName}>
                                    {ALL_LANGUAGES.find(l => l.code === primaryLanguage)?.nativeName || 'English'}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.languageRow, { marginTop: 12 }]}>
                            <View style={styles.languageInfo}>
                                <Text style={styles.cardSubtitle}>{t('secondary_language')}</Text>
                                <Text style={styles.languageName}>
                                    {secondaryLanguage
                                        ? ALL_LANGUAGES.find(l => l.code === secondaryLanguage)?.nativeName
                                        : t('optional')}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.changeLanguageButton}
                            onPress={() => navigation.navigate('LanguageSelection')}
                        >
                            <Text style={styles.changeLanguageButtonText}>
                                {t('change_language')} →
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('actions')}</Text>

                    <TouchableOpacity style={styles.actionButton} onPress={handleTestAlert}>
                        <Text style={styles.actionButtonIcon}>🔔</Text>
                        <Text style={styles.actionButtonText}>{t('testAlert')}</Text>
                    </TouchableOpacity>



                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#ff9800' }]}
                        onPress={handleTestBroadcast}
                        disabled={broadcastLoading}
                    >
                        <Text style={styles.actionButtonIcon}>📢</Text>
                        <Text style={styles.actionButtonText}>
                            {broadcastLoading ? t('sending') : t('test_broadcast')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
                        <Text style={styles.actionButtonIcon}>🚪</Text>
                        <Text style={[styles.actionButtonText, styles.logoutText]}>{t('logout')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Debug Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('debug')}</Text>
                    <TouchableOpacity style={styles.actionButton} onPress={() => vibrationService.emergencyPattern()}>
                        <Text style={styles.actionButtonIcon}>📳</Text>
                        <Text style={styles.actionButtonText}>{t('test_shake')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('EmergencyCamera')}>
                        <Text style={styles.actionButtonIcon}>📸</Text>
                        <Text style={styles.actionButtonText}>{t('test_emergency_camera')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Battery Optimization Warning (Android Only) */}
                {Platform.OS === 'android' && (
                    <View style={styles.section}>
                        <View style={styles.warningBox}>
                            <Text style={styles.warningTitle}>⚠️ Battery Optimization</Text>
                            <Text style={styles.warningText}>
                                To receive alerts reliably when the app is closed, disable battery optimization for this app.
                            </Text>
                            <TouchableOpacity
                                style={styles.settingsButton}
                                onPress={openBatterySettings}
                            >
                                <Text style={styles.settingsButtonText}>Open Settings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* App Info */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>🌊 Sankat saathi v1.0.0</Text>
                    <Text style={styles.footerSubtext}>Ocean Alert System</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollView: { flex: 1 },
    header: { backgroundColor: '#0066cc', padding: 20, paddingTop: 10 },
    backButton: { marginBottom: 10 },
    backButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    section: { padding: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 12 },
    cardSubtitle: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 12 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    infoLabel: { fontSize: 16, color: '#666' },
    infoValue: { fontSize: 16, fontWeight: '600', color: '#333' },
    trustScore: { color: '#4caf50' },
    languageRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    languageInfo: { flex: 1 },
    languageName: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 4 },
    changeLanguageButton: {
        backgroundColor: '#0066cc',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 16,
    },
    changeLanguageButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    languageGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    languageButton: {
        flex: 1,
        minWidth: 100,
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    languageButtonSecondary: { backgroundColor: '#e6f2ff' },
    languageButtonSelected: { backgroundColor: '#0066cc', borderColor: '#0066cc' },
    languageText: { fontSize: 16, fontWeight: '600', color: '#333' },
    languageTextSelected: { color: '#fff' },
    actionButton: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#ddd',
    },
    logoutButton: { borderColor: '#f44336' },
    actionButtonIcon: { fontSize: 24, marginRight: 12 },
    actionButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
    logoutText: { color: '#f44336' },
    warningBox: {
        backgroundColor: '#fff3e0',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ff9800',
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#e65100',
        marginBottom: 8,
    },
    warningText: {
        fontSize: 14,
        color: '#bf360c',
        lineHeight: 20,
        marginBottom: 12,
    },
    settingsButton: {
        backgroundColor: '#ff9800',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    settingsButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    footer: { padding: 16, paddingTop: 40, alignItems: 'center' },
    footerText: { fontSize: 16, fontWeight: '600', color: '#666' },
    footerSubtext: { fontSize: 14, color: '#999', marginTop: 4 },
});
