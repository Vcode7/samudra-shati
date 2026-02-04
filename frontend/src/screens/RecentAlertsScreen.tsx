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
import api from '../services/api';

interface DisasterAlert {
    id: number;
    location_name: string;
    severity_level: number;
    created_at: string;
    status: string;
    distance_km: number;
    verification_count: number;
}

export const RecentAlertsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { t } = useLanguage();
    const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadAlerts();
    }, []);

    const loadAlerts = async (pageNum: number = 1) => {
        try {
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

    const handleRefresh = () => {
        setRefreshing(true);
        loadAlerts(1);
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            loadAlerts(page + 1);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'VERIFIED':
                return '#4caf50';
            case 'PENDING':
                return '#ff9800';
            case 'FALSE_ALARM':
                return '#f44336';
            default:
                return '#999';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'VERIFIED':
                return 'Verified';
            case 'PENDING':
                return 'Pending';
            case 'FALSE_ALARM':
                return 'False Alarm';
            default:
                return status;
        }
    };

    const renderAlert = ({ item }: { item: DisasterAlert }) => (
        <TouchableOpacity
            style={styles.alertCard}
            onPress={() => {
                vibrationService.light();
                navigation.navigate('DisasterDetails', { disasterId: item.id });
            }}
        >
            <View style={styles.alertHeader}>
                <View style={styles.alertTitleContainer}>
                    <Text style={styles.alertTitle}>{item.location_name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
                    </View>
                </View>
                <Text style={styles.severityText}>Severity: {item.severity_level}/10</Text>
            </View>

            <View style={styles.alertDetails}>
                <Text style={styles.detailText}>
                    📏 {item.distance_km < 1
                        ? `${Math.round(item.distance_km * 1000)}m away`
                        : `${item.distance_km?.toFixed(1)}km away`}
                </Text>
                <Text style={styles.detailText}>
                    ✅ {item.verification_count} verification{item.verification_count !== 1 ? 's' : ''}
                </Text>
            </View>

            <Text style={styles.timeText}>
                {new Date(item.created_at).toLocaleString()}
            </Text>
        </TouchableOpacity>
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
    timeText: { fontSize: 12, color: '#999' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, color: '#999' },
    footerLoader: { paddingVertical: 20, alignItems: 'center' },
});
