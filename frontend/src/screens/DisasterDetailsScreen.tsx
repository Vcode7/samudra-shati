import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import api, { API_BASE_URL } from '../services/api';

interface DisasterDetails {
    id: number;
    location_name: string;
    description: string;
    latitude: number;
    longitude: number;
    severity_level: number;
    image_url: string;
    status: string;
    created_at: string;
    verified_count: number;
    rejected_count: number;
    ai_analysis: any;
}

export const DisasterDetailsScreen: React.FC<{ route: any; navigation: any }> = ({
    route,
    navigation,
}) => {
    const { t } = useLanguage();
    const { disasterId } = route.params;
    const [disaster, setDisaster] = useState<DisasterDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDisasterDetails();
    }, []);

    const loadDisasterDetails = async () => {
        try {
            const response = await api.get(`/api/disasters/${disasterId}`);
            setDisaster(response.data);
        } catch (error) {
            console.error('Error loading disaster details:', error);
            Alert.alert(t('error'), 'Failed to load disaster details');
        } finally {
            setLoading(false);
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
                return 'Pending Verification';
            case 'FALSE_ALARM':
                return 'False Alarm';
            default:
                return status;
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0066cc" />
                    <Text style={styles.loadingText}>{t('loading')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!disaster) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Disaster not found</Text>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
                        <Text style={styles.headerBackButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Disaster Details</Text>
                </View>

                {/* Status Badge */}
                <View style={styles.statusContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(disaster.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(disaster.status)}</Text>
                    </View>
                </View>

                {/* Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: `${API_BASE_URL}${disaster.image_url}` }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                </View>

                {/* Location & Time */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Location & Time</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>📍 Location:</Text>
                        <Text style={styles.infoValue}>{disaster.location_name}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>🕐 Reported:</Text>
                        <Text style={styles.infoValue}>
                            {new Date(disaster.created_at).toLocaleString()}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>🌍 Coordinates:</Text>
                        <Text style={styles.infoValue}>
                            {disaster.latitude.toFixed(4)}, {disaster.longitude.toFixed(4)}
                        </Text>
                    </View>
                </View>

                {/* Severity & Verification */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Assessment</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>⚠️ Severity:</Text>
                        <Text style={[styles.infoValue, styles.severityValue]}>
                            {disaster.severity_level}/10
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>✅ Verified By:</Text>
                        <Text style={styles.infoValue}>{disaster.verified_count} people</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>❌ Rejected By:</Text>
                        <Text style={styles.infoValue}>{disaster.rejected_count} people</Text>
                    </View>
                </View>

                {/* Description */}
                {disaster.description && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Description</Text>
                        <Text style={styles.descriptionText}>{disaster.description}</Text>
                    </View>
                )}

                {/* AI Analysis */}
                {disaster.ai_analysis && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>AI Analysis</Text>
                        {disaster.ai_analysis.is_mock && (
                            <View style={styles.mockBadge}>
                                <Text style={styles.mockBadgeText}>
                                    ⚙️ Mock Analysis (Integration Pending)
                                </Text>
                            </View>
                        )}
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Hazard Detected:</Text>
                            <Text style={styles.infoValue}>
                                {disaster.ai_analysis.hazard_detected ? 'Yes' : 'No'}
                            </Text>
                        </View>
                        {disaster.ai_analysis.hazard_type && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Type:</Text>
                                <Text style={styles.infoValue}>{disaster.ai_analysis.hazard_type}</Text>
                            </View>
                        )}
                        {disaster.ai_analysis.confidence && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Confidence:</Text>
                                <Text style={styles.infoValue}>
                                    {(disaster.ai_analysis.confidence * 100).toFixed(0)}%
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollView: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { fontSize: 18, color: '#666', marginBottom: 20 },
    backButton: { padding: 16, backgroundColor: '#0066cc', borderRadius: 12 },
    backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    header: { backgroundColor: '#0066cc', padding: 20, paddingTop: 10 },
    headerBackButton: { marginBottom: 10 },
    headerBackButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    statusContainer: { padding: 16, paddingBottom: 0, alignItems: 'center' },
    statusBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    statusText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
    imageContainer: { margin: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: '#ddd' },
    image: { width: '100%', height: 250 },
    card: { backgroundColor: '#fff', margin: 16, marginTop: 0, padding: 16, borderRadius: 12 },
    cardTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
    infoRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' },
    infoLabel: { fontSize: 16, color: '#666', width: 140 },
    infoValue: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333' },
    severityValue: { color: '#ff6600', fontWeight: 'bold' },
    descriptionText: { fontSize: 16, color: '#333', lineHeight: 24 },
    mockBadge: {
        backgroundColor: '#fff7e6',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ffc107',
    },
    mockBadgeText: { fontSize: 14, color: '#ff6600', textAlign: 'center' },
});
