import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { apiClient } from '../services/api';

interface DisasterSummary {
    id: number;
    location_name: string;
    severity_level: number;
    status: string;
    created_at: string;
    verified_count: number;
    is_in_radius: boolean;
}

interface AuthorityInfo {
    id: number;
    name: string;
    department: string;
    operational_radius_km: number;
    total_verified: number;
    pending_count: number;
}

export const AuthorityDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const [authorityInfo, setAuthorityInfo] = useState<AuthorityInfo | null>(null);
    const [disasters, setDisasters] = useState<DisasterSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const api = await apiClient();
            const [infoRes, disastersRes] = await Promise.all([
                api.get('/api/authorities/me'),
                api.get('/api/authorities/disasters'),
            ]);
            setAuthorityInfo(infoRes.data);
            setDisasters(disastersRes.data);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadDashboardData();
    };

    const handleVerifyDisaster = async (disasterId: number) => {
        try {
            const api = await apiClient();

            await api.post(`/api/disasters/${disasterId}/authority-verify`);
            vibrationService.success();
            Alert.alert('Success', 'Disaster verified successfully');
            loadDashboardData();
        } catch (error: any) {
            vibrationService.error();
            Alert.alert('Error', error.response?.data?.detail || 'Failed to verify disaster');
        }
    };

    const handleBroadcastAlert = async (disasterId: number) => {
        Alert.alert(
            'Broadcast Alert',
            'This will send emergency notifications to all users in the affected area. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Broadcast',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const api = await apiClient();

                            await api.post(`/api/disasters/${disasterId}/broadcast`);
                            vibrationService.success();
                            Alert.alert('Success', 'Alert broadcasted to affected areas');
                        } catch (error: any) {
                            vibrationService.error();
                            Alert.alert('Error', error.response?.data?.detail || 'Broadcast failed');
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await logout();
                    navigation.replace('Home');
                },
            },
        ]);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ff6600" />
                    <Text style={styles.loadingText}>Loading dashboard...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <Text style={styles.title}>🏛️ Authority Dashboard</Text>
                        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                    {authorityInfo && (
                        <View style={styles.authorityInfo}>
                            <Text style={styles.authorityName}>{authorityInfo.name}</Text>
                            <Text style={styles.authorityDept}>{authorityInfo.department}</Text>
                        </View>
                    )}
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{authorityInfo?.pending_count || 0}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{authorityInfo?.total_verified || 0}</Text>
                        <Text style={styles.statLabel}>Verified</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{authorityInfo?.operational_radius_km || 0}km</Text>
                        <Text style={styles.statLabel}>Radius</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => navigation.navigate('EquipmentManagement')}
                        >
                            <Text style={styles.actionIcon}>🚒</Text>
                            <Text style={styles.actionText}>Equipment</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => navigation.navigate('SafeAreaManagement')}
                        >
                            <Text style={styles.actionIcon}>🟢</Text>
                            <Text style={styles.actionText}>Safe Areas</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => navigation.navigate('AlertsMap')}
                        >
                            <Text style={styles.actionIcon}>🗺️</Text>
                            <Text style={styles.actionText}>View Map</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Disasters in Area */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Disasters in Your Area</Text>
                    {disasters.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No disasters reported in your area</Text>
                        </View>
                    ) : (
                        disasters.map((disaster) => (
                            <View key={disaster.id} style={styles.disasterCard}>
                                <View style={styles.disasterHeader}>
                                    <Text style={styles.disasterLocation}>{disaster.location_name}</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: disaster.status === 'VERIFIED' ? '#4caf50' : '#ff9800' }]}>
                                        <Text style={styles.statusText}>{disaster.status}</Text>
                                    </View>
                                </View>
                                <View style={styles.disasterDetails}>
                                    <Text style={styles.detailText}>Severity: {disaster.severity_level}/10</Text>
                                    <Text style={styles.detailText}>Verifications: {disaster.verified_count}</Text>
                                </View>
                                <Text style={styles.timeText}>
                                    {new Date(disaster.created_at).toLocaleString()}
                                </Text>
                                <View style={styles.disasterActions}>
                                    <TouchableOpacity
                                        style={styles.disasterButton}
                                        onPress={() => navigation.navigate('DisasterDetails', { disasterId: disaster.id })}
                                    >
                                        <Text style={styles.disasterButtonText}>View</Text>
                                    </TouchableOpacity>
                                    {disaster.status !== 'VERIFIED' && (
                                        <TouchableOpacity
                                            style={[styles.disasterButton, styles.verifyButton]}
                                            onPress={() => handleVerifyDisaster(disaster.id)}
                                        >
                                            <Text style={[styles.disasterButtonText, { color: '#fff' }]}>Verify</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={[styles.disasterButton, styles.broadcastButton]}
                                        onPress={() => handleBroadcastAlert(disaster.id)}
                                    >
                                        <Text style={[styles.disasterButtonText, { color: '#fff' }]}>Broadcast</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    scrollView: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#aaa' },
    header: { backgroundColor: '#16213e', padding: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    logoutButton: { padding: 8, backgroundColor: '#ff4444', borderRadius: 8 },
    logoutText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    authorityInfo: { marginTop: 12 },
    authorityName: { fontSize: 18, fontWeight: '600', color: '#ff6600' },
    authorityDept: { fontSize: 14, color: '#aaa', marginTop: 4 },
    statsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
    statCard: {
        flex: 1,
        backgroundColor: '#16213e',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    statNumber: { fontSize: 24, fontWeight: 'bold', color: '#ff6600' },
    statLabel: { fontSize: 12, color: '#aaa', marginTop: 4 },
    section: { padding: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
    actionButtons: { flexDirection: 'row', gap: 12 },
    actionButton: {
        flex: 1,
        backgroundColor: '#16213e',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    actionIcon: { fontSize: 32, marginBottom: 8 },
    actionText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    emptyCard: { backgroundColor: '#16213e', padding: 20, borderRadius: 12, alignItems: 'center' },
    emptyText: { fontSize: 14, color: '#aaa' },
    disasterCard: {
        backgroundColor: '#16213e',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ff6600',
    },
    disasterHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    disasterLocation: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    disasterDetails: { flexDirection: 'row', gap: 16, marginBottom: 8 },
    detailText: { fontSize: 14, color: '#aaa' },
    timeText: { fontSize: 12, color: '#666', marginBottom: 12 },
    disasterActions: { flexDirection: 'row', gap: 8 },
    disasterButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#2a2a4e',
        alignItems: 'center',
    },
    verifyButton: { backgroundColor: '#4caf50' },
    broadcastButton: { backgroundColor: '#ff4444' },
    disasterButtonText: { fontSize: 14, fontWeight: '600', color: '#0088ff' },
});
