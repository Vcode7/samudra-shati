import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, RefreshControl, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { voiceService } from '../services/voiceService';
import { notificationService } from '../services/notificationService';
import { apiClient } from '../services/api';

interface DisasterAlert {
    id: number;
    location_name: string;
    severity_level: number;
    created_at: string;
    status: string;
}

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [activeAlerts, setActiveAlerts] = useState<DisasterAlert[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActiveAlerts();

        // Set up auto-refresh polling every 15 seconds for real-time updates
        const pollInterval = setInterval(() => {
            loadActiveAlerts();
            // Send heartbeat to keep device active
            notificationService.sendHeartbeat();
        }, 15000);

        return () => clearInterval(pollInterval);
    }, []);

    const loadActiveAlerts = async () => {
        try {
            const api = await apiClient();
            const response = await api.get('/api/disasters/active');
            setActiveAlerts(response.data);
        } catch (error) {
            console.error('Error loading alerts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadActiveAlerts();
    };

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
        await notificationService.scheduleLocalNotification('Test Alert', 'This is a test disaster alert', { type: 'test' });
        Alert.alert('Test Alert', 'Voice and vibration test completed!');
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>🌊 Samudar Shati</Text>
                    <Text style={styles.headerSubtitle}>
                        {t('home')} • Trust Score: {user?.trust_score?.toFixed(0) || 100}
                    </Text>
                </View>

                {activeAlerts.length > 0 ? (
                    <View style={styles.alertBanner}>
                        <Text style={styles.alertBannerIcon}>🚨</Text>
                        <View style={styles.alertBannerContent}>
                            <Text style={styles.alertBannerTitle}>{activeAlerts.length} {t('activeAlerts')}</Text>
                            <Text style={styles.alertBannerText}>Tap to view details</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.noAlertBanner}>
                        <Text style={styles.noAlertText}>✅ {t('noActiveAlerts')}</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>

                    <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]} onPress={() => { vibrationService.medium(); navigation.navigate('UploadDisaster'); }}>
                        <Text style={styles.actionButtonIcon}>📸</Text>
                        <Text style={styles.actionButtonText}>{t('reportDisaster')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => { vibrationService.light(); navigation.navigate('RecentAlerts'); }}>
                        <Text style={styles.actionButtonIcon}>📋</Text>
                        <Text style={styles.actionButtonText}>{t('recentAlerts')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => { vibrationService.light(); navigation.navigate('Settings'); }}>
                        <Text style={styles.actionButtonIcon}>⚙️</Text>
                        <Text style={styles.actionButtonText}>{t('settings')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => { vibrationService.light(); navigation.navigate('AlertsMap'); }}>
                        <Text style={styles.actionButtonIcon}>🗺️</Text>
                        <Text style={styles.actionButtonText}>View Map</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={handleTestAlert}>
                        <Text style={styles.actionButtonIcon}>🔔</Text>
                        <Text style={styles.actionButtonText}>{t('testAlert')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' }]} onPress={() => { vibrationService.light(); navigation.navigate('AuthorityLogin'); }}>
                        <Text style={styles.actionButtonIcon}>🏛️</Text>
                        <Text style={[styles.actionButtonText, { color: '#fff' }]}>Authority Login</Text>
                    </TouchableOpacity>
                </View>

                {activeAlerts.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Active Disasters</Text>
                        {activeAlerts.slice(0, 5).map((alert) => (
                            <TouchableOpacity key={alert.id} style={styles.alertCard} onPress={() => { vibrationService.light(); navigation.navigate('DisasterDetails', { disasterId: alert.id }); }}>
                                <View style={styles.alertCardHeader}>
                                    <Text style={styles.alertCardTitle}>{alert.location_name}</Text>
                                    <Text style={styles.alertCardSeverity}>Severity: {alert.severity_level}/10</Text>
                                </View>
                                <Text style={styles.alertCardTime}>{new Date(alert.created_at).toLocaleString()}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollView: { flex: 1 },
    header: { backgroundColor: '#0066cc', padding: 20, paddingTop: 40 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    headerSubtitle: { fontSize: 14, color: '#e0f0ff' },
    alertBanner: { backgroundColor: '#ff3333', flexDirection: 'row', padding: 16, alignItems: 'center', margin: 16, borderRadius: 12 },
    alertBannerIcon: { fontSize: 32, marginRight: 12 },
    alertBannerContent: { flex: 1 },
    alertBannerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
    alertBannerText: { fontSize: 14, color: '#ffe0e0' },
    noAlertBanner: { backgroundColor: '#4caf50', padding: 16, margin: 16, borderRadius: 12, alignItems: 'center' },
    noAlertText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    section: { padding: 16 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
    actionButton: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 12, marginBottom: 12, borderWidth: 2, borderColor: '#ddd' },
    actionButtonPrimary: { backgroundColor: '#ff6600', borderColor: '#ff6600' },
    actionButtonIcon: { fontSize: 28, marginRight: 16 },
    actionButtonText: { fontSize: 18, fontWeight: '600', color: '#333' },
    alertCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#ff3333' },
    alertCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    alertCardTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
    alertCardSeverity: { fontSize: 14, color: '#ff3333', fontWeight: '600' },
    alertCardTime: { fontSize: 12, color: '#999' },
});
