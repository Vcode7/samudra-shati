import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Alert,
    ActivityIndicator,
    Image,
    ScrollView,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import {apiClient, getAPIBaseURL } from '../services/api';


interface DisasterDetails {
    id: number;
    location_name: string;
    description: string;
    severity_level: number;
    image_url: string;
    distance_km: number;
    created_at: string;
}

export const VerificationScreen: React.FC<{ route: any; navigation: any }> = ({
    route,
    navigation,
}) => {

    const { t } = useLanguage();
    const { disasterId } = route.params;
    const [disaster, setDisaster] = useState<DisasterDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [API_BASE_URL, setAPI_BASE_URL] = useState<string | null>(null);

    useEffect(() => {
        const loadApiBaseUrl = async () => {
            const api = await getAPIBaseURL();
            setAPI_BASE_URL(api);
        }
        loadApiBaseUrl();
        loadDisasterDetails();
    }, []);

    const loadDisasterDetails = async () => {
        try {
            const api = await apiClient();
            const response = await api.get(`/api/disasters/${disasterId}`);
            setDisaster(response.data);
        } catch (error) {
            console.error('Error loading disaster details:', error);
            Alert.alert(t('error'), 'Failed to load disaster details');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (isConfirmed: boolean) => {
        setSubmitting(true);
        try {   
            const api = await apiClient();
            await api.post(`/api/disasters/${disasterId}/verify`, {
                is_confirmed: isConfirmed,
            });

            vibrationService.success();
            Alert.alert(
                t('success'),
                `Thank you for your response!`,
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } catch (error: any) {
            vibrationService.error();
            Alert.alert(t('error'), error.response?.data?.detail || 'Failed to submit verification');
        } finally {
            setSubmitting(false);
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
                    <Text style={styles.title}>Verify Disaster Report</Text>
                </View>

                {/* Disaster Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: `${API_BASE_URL}${disaster.image_url}` }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                </View>

                {/* Disaster Details */}
                <View style={styles.detailsCard}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>📍 Location:</Text>
                        <Text style={styles.detailValue}>{disaster.location_name}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>📏 Distance:</Text>
                        <Text style={styles.detailValue}>
                            {disaster.distance_km < 1
                                ? `${Math.round(disaster.distance_km * 1000)}m away`
                                : `${disaster.distance_km.toFixed(1)}km away`}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>⚠️ Severity:</Text>
                        <Text style={styles.detailValue}>{disaster.severity_level}/10</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>🕐 Reported:</Text>
                        <Text style={styles.detailValue}>
                            {new Date(disaster.created_at).toLocaleString()}
                        </Text>
                    </View>

                    {disaster.description && (
                        <View style={styles.descriptionContainer}>
                            <Text style={styles.detailLabel}>📝 Description:</Text>
                            <Text style={styles.descriptionText}>{disaster.description}</Text>
                        </View>
                    )}
                </View>

                {/* Question */}
                <View style={styles.questionCard}>
                    <Text style={styles.questionTitle}>🤔 Have you seen this disaster?</Text>
                    <Text style={styles.questionSubtitle}>
                        Your response helps us verify this report and alert authorities.
                    </Text>
                </View>

                {/* Verification Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.verifyButton, styles.yesButton, submitting && styles.buttonDisabled]}
                        onPress={() => handleVerify(true)}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.buttonIcon}>✅</Text>
                                <Text style={styles.buttonText}>{t('yes')}</Text>
                                <Text style={styles.buttonSubtext}>I confirm this disaster</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.verifyButton, styles.noButton, submitting && styles.buttonDisabled]}
                        onPress={() => handleVerify(false)}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.buttonIcon}>❌</Text>
                                <Text style={styles.buttonText}>{t('no')}</Text>
                                <Text style={styles.buttonSubtext}>I haven't seen this</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
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
    imageContainer: { margin: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: '#ddd' },
    image: { width: '100%', height: 250 },
    detailsCard: { backgroundColor: '#fff', margin: 16, marginTop: 0, padding: 16, borderRadius: 12 },
    detailRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
    detailLabel: { fontSize: 16, fontWeight: '600', color: '#666', width: 120 },
    detailValue: { flex: 1, fontSize: 16, color: '#333' },
    descriptionContainer: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
    descriptionText: { fontSize: 16, color: '#333', marginTop: 8, lineHeight: 24 },
    questionCard: {
        backgroundColor: '#fff7e6',
        margin: 16,
        marginTop: 0,
        padding: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#ffc107',
    },
    questionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
    questionSubtitle: { fontSize: 14, color: '#666', lineHeight: 20 },
    buttonContainer: { padding: 16, paddingTop: 0, gap: 12 },
    verifyButton: {
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 120,
    },
    yesButton: { backgroundColor: '#4caf50' },
    noButton: { backgroundColor: '#f44336' },
    buttonDisabled: { opacity: 0.6 },
    buttonIcon: { fontSize: 40, marginBottom: 8 },
    buttonText: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    buttonSubtext: { fontSize: 14, color: '#ffffffcc' },
});
