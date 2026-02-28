import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { apiClient } from '../services/api';
import { locationService } from '../services/locationService';

interface DisasterAlert {
    id: number;
    location_name: string;
    latitude: number;
    longitude: number;
    severity_level: number;
    created_at: string;
    status: string;
    distance_km: number | null;
    verification_count_yes: number;
    verification_count_no: number;
}

interface AIPrediction {
    id: number;
    type: string;
    latitude: number;
    longitude: number;
    severity: number;
    confidence: number;
    message: string;
    predicted_at: string;
    status: string;
}

export const RecentAlertsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { t } = useLanguage();
    const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
    const [predictions, setPredictions] = useState<AIPrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    useEffect(() => {
        loadLocation();
        loadAlerts();
        loadPredictions();
    }, []);

    const loadLocation = async () => {
        const coords = await locationService.getCoordinates();
        console.log('User location:', coords);
        if (coords) {
            setUserLocation(coords);
        }
    };

    const loadAlerts = async (pageNum: number = 1) => {
        try {
            const api = await apiClient();
            const response = await api.get(`/api/disasters/recent?page=${pageNum}&page_size=20`);
            if (pageNum === 1) {
                setAlerts(response.data);
            } else {
                setAlerts((prev) => [...prev, ...response.data]);
            }
            setHasMore(response.data.length === 20);
            setPage(pageNum);
        } catch (error) {
            console.error('Error loading alerts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadPredictions = async () => {
        try {
            const api = await apiClient();
            const response = await api.get('/api/predictions/active');
            setPredictions(response.data);
        } catch (error) {
            console.error('Error loading AI predictions:', error);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadLocation();
        loadAlerts(1);
        loadPredictions();
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            loadAlerts(page + 1);
        }
    };

    const getStatusColor = (status: string) => {
        console.log('Status:', status);
        switch (status) {
            case 'verified':
                return '#f44336';
            case 'pending':
                return '#ff9800';
            case 'false_alarm':
                return '#999';
            default:
                return '#4caf50';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'VERIFIED':
                return 'Verified';
            case 'PENDING':
                return t('pending');
            case 'FALSE_ALARM':
                return t('false_alarm');
            default:
                return status;
        }
    };

    const isWithin30Min = (createdAt: string) => {
        const created = new Date(createdAt);
        const now = new Date();
        return (now.getTime() - created.getTime()) / (1000 * 60) <= 30;
    };

    const renderAlert = ({ item }: { item: DisasterAlert }) => {
        const canVerify = item.status === 'PENDING' && isWithin30Min(item.created_at);

        let displayDistance = item.distance_km;
        if ((displayDistance === null || displayDistance === undefined) && userLocation) {
            displayDistance = locationService.calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                item.latitude,
                item.longitude
            );
        }

        return (
            <TouchableOpacity
                style={styles.alertCard}
                onPress={() => {
                    vibrationService.light();
                    navigation.navigate('DisasterDetails', {
                        disasterId: item.id,
                        showVerification: canVerify
                    });
                }}
            >
                <View style={styles.alertHeader}>
                    <View style={styles.alertTitleContainer}>
                        <Text style={styles.alertTitle}>{item.location_name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
                        </View>
                    </View>
                    <Text style={styles.severityText}>{t('severity')}: {item.severity_level}/10</Text>
                </View>

                <View style={styles.alertDetails}>
                    <Text style={styles.detailText}>
                        📏 {displayDistance !== null
                            ? locationService.formatDistance(displayDistance) + ' away'
                            : 'Unknown distance'}
                    </Text>
                    <Text style={styles.detailText}>
                        {item.verification_count_yes + item.verification_count_no} response{(item.verification_count_yes + item.verification_count_no) !== 1 ? 's' : ''}
                    </Text>
                </View>

                <View style={styles.bottomRow}>
                    <Text style={styles.timeText}>
                        {new Date(item.created_at).toLocaleString()}
                    </Text>

                    {canVerify && (
                        <View style={styles.verifyHint}>
                            <Text style={styles.verifyHintText}>🔔 Tap to verify</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const renderPrediction = (pred: AIPrediction) => (
        <View key={pred.id} style={styles.aiPredictionCard}>
            <View style={styles.aiHeader}>
                <Text style={styles.aiType}>
                    {pred.type.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                        {Math.round(pred.confidence * 100)}%
                    </Text>
                </View>
            </View>
            <Text style={styles.aiMessage}>{pred.message}</Text>
            <View style={styles.aiFooter}>
                <Text style={styles.aiSeverity}>⚠️ Severity: {pred.severity}/10</Text>
                <Text style={styles.aiTime}>
                    {new Date(pred.predicted_at).toLocaleTimeString()}
                </Text>
            </View>
        </View>
    );

    if (loading && alerts.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0066cc" />
                    <Text style={styles.loadingText}>{t('loading')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{t('recentAlerts')}</Text>
            </View>

            <FlatList
                data={alerts}
                renderItem={renderAlert}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    predictions.length > 0 ? (
                        <View style={styles.aiSection}>
                            <Text style={styles.aiSectionTitle}>🤖 AI Early Warnings</Text>
                            {predictions.map(renderPrediction)}
                        </View>
                    ) : null
                }
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No alerts found</Text>
                    </View>
                }
                ListFooterComponent={
                    loading && alerts.length > 0 ? (
                        <View style={styles.footerLoader}>
                            <ActivityIndicator size="small" color="#0066cc" />
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { backgroundColor: '#0066cc', padding: 20, paddingTop: 10 },
    backButton: { marginBottom: 10 },
    backButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
    listContent: { padding: 16 },
    alertCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ff6600',
    },
    alertHeader: { marginBottom: 12 },
    alertTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    alertTitle: { fontSize: 18, fontWeight: '600', color: '#333', flex: 1 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    severityText: { fontSize: 14, color: '#ff6600', fontWeight: '600' },
    alertDetails: { flexDirection: 'row', gap: 16, marginBottom: 8 },
    detailText: { fontSize: 14, color: '#666' },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    timeText: { fontSize: 12, color: '#999' },
    verifyHint: {
        backgroundColor: '#fff3e0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    verifyHintText: { fontSize: 12, color: '#e65100', fontWeight: '600' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, color: '#999' },
    footerLoader: { paddingVertical: 20, alignItems: 'center' },
    // AI Prediction Styles
    aiSection: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#9c27b0',
    },
    aiSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#9c27b0',
        marginBottom: 12,
    },
    aiPredictionCard: {
        backgroundColor: '#f3e5f5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ce93d8',
    },
    aiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    aiType: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#6a1b9a',
        flex: 1,
    },
    confidenceBadge: {
        backgroundColor: '#9c27b0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    confidenceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    aiMessage: {
        fontSize: 13,
        color: '#333',
        marginBottom: 8,
        lineHeight: 18,
    },
    aiFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    aiSeverity: {
        fontSize: 12,
        color: '#d32f2f',
        fontWeight: '600',
    },
    aiTime: {
        fontSize: 11,
        color: '#666',
    },
});
