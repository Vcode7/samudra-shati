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
import { apiClient, getAPIBaseURL } from '../services/api';
import { locationService } from '../services/locationService';
import { VerificationModal } from '../components/VerificationModal';
import { Video } from 'expo-av';


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
    verification_count_yes: number;
    verification_count_no: number;
    ai_analysis: any;
}

interface VerificationStatus {
    has_verified: boolean;
    is_confirmed: boolean | null;
    can_verify: boolean;
    reason: string | null;
}

export const DisasterDetailsScreen: React.FC<{ route: any; navigation: any }> = ({
    route,
    navigation,
}) => {
    const { t } = useLanguage();
    const { disasterId, showVerification } = route.params || {};
    const [disaster, setDisaster] = useState<DisasterDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [API_BASE_URL, setAPI_BASE_URL] = useState<string | null>(null);

    // Verification state
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [distance, setDistance] = useState<number | null>(null);
    const isVideo = (url: string) => {
        return url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.mkv') || url.includes('video');
    };

    useEffect(() => {
        const loadApiBaseUrl = async () => {
            const api = await getAPIBaseURL();
            setAPI_BASE_URL(api);
        };
        loadApiBaseUrl();
        loadDisasterDetails();
        loadVerificationStatus();
        calculateDistance();
    }, []);

    const calculateDistance = async () => {
        if (!disaster) return;
        const coords = await locationService.getCoordinates();
        if (coords) {
            const dist = locationService.calculateDistance(
                coords.latitude,
                coords.longitude,
                disaster.latitude,
                disaster.longitude
            );
            setDistance(dist);
        }
    };

    // Recalculate distance when disaster is loaded
    useEffect(() => {
        if (disaster) {
            calculateDistance();
        }
    }, [disaster]);

    // Show verification modal if navigated with showVerification flag
    useEffect(() => {
        if (showVerification && verificationStatus?.can_verify && disaster) {
            setShowVerifyModal(true);
        }
    }, [showVerification, verificationStatus, disaster]);

    const loadDisasterDetails = async () => {
        const api = await apiClient();
        try {
            const response = await api.get(`/api/disasters/${disasterId}`);
            let data = response.data;

            // Parse ai_analysis if it's a string
            if (typeof data.ai_analysis === 'string') {
                try {
                    data.ai_analysis = JSON.parse(data.ai_analysis);
                } catch (e) {
                    console.error("Failed to parse ai_analysis JSON:", e);
                }
            }
            // Double parse check (sometimes it's double stringified)
            if (typeof data.ai_analysis === 'string') {
                try {
                    data.ai_analysis = JSON.parse(data.ai_analysis);
                } catch (e) {
                    // ignore
                }
            }

            setDisaster(data);
        } catch (error) {
            console.error('Error loading disaster details:', error);
            Alert.alert(t('error'), 'Failed to load disaster details');
        } finally {
            setLoading(false);
        }
    };

    const loadVerificationStatus = async () => {
        try {
            const api = await apiClient();
            const coords = await locationService.getCoordinates();

            let url = `/api/disasters/${disasterId}/my-verification`;
            if (coords) {
                url += `?lat=${coords.latitude}&lng=${coords.longitude}`;
            }

            const response = await api.get(url);
            setVerificationStatus(response.data);
        } catch (error) {
            console.log('Could not load verification status:', error);
        }
    };

    const handleVerified = (isConfirmed: boolean) => {
        // Refresh data after verification
        loadDisasterDetails();
        setVerificationStatus({
            has_verified: true,
            is_confirmed: isConfirmed,
            can_verify: false,
            reason: 'You have already verified this disaster'
        });

        Alert.alert(
            isConfirmed ? '✅ Verified' : '❌ Rejected',
            isConfirmed
                ? 'Thank you for verifying this disaster report.'
                : 'Thank you for your response.'
        );
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
                        <Text style={styles.headerBackButtonText}>← {t('back')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('disaster_details')}</Text>
                </View>

                {/* Status Badge */}
                <View style={styles.statusContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(disaster.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(disaster.status)}</Text>
                    </View>
                </View>

                {/* Verification Section */}
                {verificationStatus && (
                    <View style={styles.verificationSection}>
                        {verificationStatus.has_verified ? (
                            <View style={[
                                styles.verifiedBanner,
                                { backgroundColor: verificationStatus.is_confirmed ? '#e8f5e9' : '#ffebee' }
                            ]}>
                                <Text style={[
                                    styles.verifiedText,
                                    { color: verificationStatus.is_confirmed ? '#2e7d32' : '#c62828' }
                                ]}>
                                    {verificationStatus.is_confirmed
                                        ? t('you_verified_disaster')
                                        : t('you_rejected_report')}
                                </Text>
                            </View>
                        ) : verificationStatus.can_verify ? (
                            <View style={styles.verifyPrompt}>
                                <Text style={styles.verifyPromptText}>
                                    🔔 {t('can_you_verify')}
                                </Text>
                                <View style={styles.verifyButtons}>
                                    <TouchableOpacity
                                        style={[styles.verifyBtn, styles.verifyBtnYes]}
                                        onPress={() => setShowVerifyModal(true)}
                                    >
                                        <Text style={styles.verifyBtnText}>✅ {t('verify')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.verifyBtn, styles.verifyBtnNo]}
                                        onPress={() => setShowVerifyModal(true)}
                                    >
                                        <Text style={styles.verifyBtnText}>❌ {t('reject')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : verificationStatus.reason ? (
                            <View style={styles.cannotVerifyBanner}>
                                <Text style={styles.cannotVerifyText}>
                                    ℹ️ {verificationStatus.reason}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                )}

                {/* Image */}
                <View style={styles.imageContainer}>
                    {isVideo(disaster.image_url) ? (
                        <Video
                            source={{ uri: `${API_BASE_URL}${disaster.image_url}` }}
                            style={styles.video}
                            useNativeControls

                            isLooping
                        />
                    ) : (
                        <Image
                            source={{ uri: `${API_BASE_URL}${disaster.image_url}` }}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    )}
                </View>


                {/* Location & Time */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Location & Time</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>📍 Location:</Text>
                        <Text style={styles.infoValue}>{disaster.location_name}</Text>
                    </View>
                    {distance !== null && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>📏 Distance:</Text>
                            <Text style={styles.infoValue}>
                                {locationService.formatDistance(distance)} away
                            </Text>
                        </View>
                    )}
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
                        <Text style={styles.infoValue}>{disaster.verification_count_yes} people</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>❌ Rejected By:</Text>
                        <Text style={styles.infoValue}>{disaster.verification_count_no} people</Text>
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

            {/* Verification Modal */}
            {disaster && (
                <VerificationModal
                    visible={showVerifyModal}
                    disasterId={disaster.id}
                    disasterLocation={disaster.location_name}
                    disasterLat={disaster.latitude}
                    disasterLng={disaster.longitude}
                    createdAt={disaster.created_at}
                    onClose={() => setShowVerifyModal(false)}
                    onVerified={handleVerified}
                />
            )}
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

    // Verification section styles
    verificationSection: { margin: 16, marginBottom: 0 },
    verifiedBanner: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    verifiedText: { fontSize: 16, fontWeight: '600' },
    verifyPrompt: {
        backgroundColor: '#fff3e0',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ff9800',
    },
    verifyPromptText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e65100',
        textAlign: 'center',
        marginBottom: 12,
    },
    verifyButtons: { flexDirection: 'row', gap: 12 },
    verifyBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    verifyBtnYes: { backgroundColor: '#4caf50' },
    verifyBtnNo: { backgroundColor: '#f44336' },
    verifyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    cannotVerifyBanner: {
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
    },
    cannotVerifyText: { fontSize: 14, color: '#666', textAlign: 'center' },

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
    video: {
        width: '100%',
        height: 300,
        backgroundColor: '#000',
    },

});
