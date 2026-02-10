import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, RefreshControl, Alert, Platform } from 'react-native';
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
        Alert.alert(t('success'), t('test_alert_completed'));
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('app_name')}</Text>
                    <Text style={styles.headerSubtitle}>
                        {t('home')} • {t('trust_score')}: {user?.trust_score?.toFixed(0) || 100}
                    </Text>
                </View>

                {activeAlerts.length > 0 ? (
                    <View style={styles.alertBanner}>
                        <Text style={styles.alertBannerIcon}>🚨</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('AlertsMap')}>
                            <View style={styles.alertBannerContent}>
                                <Text style={styles.alertBannerTitle}>{activeAlerts.length} {t('active_alerts')}</Text>
                                <Text style={styles.alertBannerText}>{t('tap_to_view_details')}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.noAlertBanner}>
                        <Text style={styles.noAlertText}>✅ {t('no_active_alerts')}</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>

                    {/* Emergency Call Button - Prominent placement */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.emergencyCallButton]}
                        onPress={async () => {
                            vibrationService.heavy();
                            const deviceId = await notificationService.getDeviceId();
                            const { EmergencyCallService } = require('../services/emergencyCallService');
                            await EmergencyCallService.initiateEmergencyCall(deviceId);
                        }}
                    >
                        <Text style={styles.emergencyCallIcon}>📞</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.emergencyCallText}>{t('call_for_help')}</Text>
                            <Text style={styles.emergencyCallSubtext}>{t('nearest_authority')}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]} onPress={() => { vibrationService.medium(); navigation.navigate('UploadDisaster'); }}>
                        <Text style={styles.actionButtonIcon}>📸</Text>
                        <Text style={styles.actionButtonText}>{t('report_disaster')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => { vibrationService.light(); navigation.navigate('RecentAlerts'); }}>
                        <Text style={styles.actionButtonIcon}>📋</Text>
                        <Text style={styles.actionButtonText}>{t('recent_alerts')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => { vibrationService.light(); navigation.navigate('Settings'); }}>
                        <Text style={styles.actionButtonIcon}>⚙️</Text>
                        <Text style={styles.actionButtonText}>{t('settings')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => { vibrationService.light(); navigation.navigate('AlertsMap'); }}>
                        <Text style={styles.actionButtonIcon}>🗺️</Text>
                        <Text style={styles.actionButtonText}>{t('view_map')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={handleTestAlert}>
                        <Text style={styles.actionButtonIcon}>🔔</Text>
                        <Text style={styles.actionButtonText}>{t('test_alert')}</Text>
                    </TouchableOpacity>

                    {/* Authority Login - Web Only */}
                    {Platform.OS === 'web' && (
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' }]} onPress={() => { vibrationService.light(); navigation.navigate('AuthorityLogin'); }}>
                            <Text style={styles.actionButtonIcon}>🏛️</Text>
                            <Text style={[styles.actionButtonText, { color: '#fff' }]}>{t('authority_login')}</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#ff3333', borderColor: '#ff0000', borderWidth: 3 }]}
                        onPress={async () => {
                            vibrationService.heavy();
                            Alert.alert(
                                t('emergency_demo'),
                                t('emergency_demo_confirm'),
                                [
                                    { text: t('cancel'), style: 'cancel' },
                                    {
                                        text: t('start_demo'),
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                const api = await apiClient();
                                                const response = await api.post('/api/disasters/demo');
                                                Alert.alert(
                                                    t('demo_started'),
                                                    t('demo_started_message', { count: response.data.devices_notified })
                                                );
                                            } catch (error: any) {
                                                Alert.alert(t('error'), error?.response?.data?.detail || t('failed_start_demo'));
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                    >
                        <Text style={styles.actionButtonIcon}>🚨</Text>
                        <Text style={[styles.actionButtonText, { color: '#fff' }]}>{t('emergency_demo')}</Text>
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
    emergencyCallButton: {
        backgroundColor: '#00B4D8',
        borderColor: '#0077B6',
        borderWidth: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8
    },
    emergencyCallIcon: { fontSize: 36, marginRight: 16 },
    emergencyCallText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    emergencyCallSubtext: { fontSize: 14, color: '#e0f5ff', marginTop: 4 },
    alertCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#ff3333' },
    alertCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    alertCardTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
    alertCardSeverity: { fontSize: 14, color: '#ff3333', fontWeight: '600' },
    alertCardTime: { fontSize: 12, color: '#999' },
});
