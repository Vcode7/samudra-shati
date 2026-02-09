/**
 * Verification Modal Component
 * 
 * Shows Verify/Decline buttons for disaster reports.
 * Checks eligibility: not yet verified, within 30min, nearby (<10km)
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { apiClient } from '../services/api';
import { locationService } from '../services/locationService';
import { vibrationService } from '../services/vibrationService';

interface VerificationModalProps {
    visible: boolean;
    disasterId: number;
    disasterLocation: string;
    disasterLat: number;
    disasterLng: number;
    createdAt: string;
    onClose: () => void;
    onVerified: (isConfirmed: boolean) => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
    visible,
    disasterId,
    disasterLocation,
    disasterLat,
    disasterLng,
    createdAt,
    onClose,
    onVerified,
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if disaster is within 30 minutes
    const isWithin30Min = () => {
        const created = new Date(createdAt);
        const now = new Date();
        const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
        return diffMinutes <= 30;
    };

    const handleVerify = async (isConfirmed: boolean) => {
        setLoading(true);
        setError(null);

        try {
            // Get current location
            const coords = await locationService.getCoordinates();

            if (!coords) {
                setError('Could not get your location. Please enable GPS.');
                setLoading(false);
                return;
            }

            // Check distance (10km max)
            const distance = calculateDistance(
                coords.latitude,
                coords.longitude,
                disasterLat,
                disasterLng
            );

            if (distance > 10) {
                setError(`You are ${distance.toFixed(1)}km away. Must be within 10km to verify.`);
                setLoading(false);
                return;
            }

            // Check time
            if (!isWithin30Min()) {
                setError('This report is older than 30 minutes and cannot be verified.');
                setLoading(false);
                return;
            }

            // Submit verification
            const api = await apiClient();
            await api.post(`/api/disasters/${disasterId}/verify`, {
                disaster_report_id: disasterId,
                is_confirmed: isConfirmed,
                latitude: coords.latitude,
                longitude: coords.longitude,
            });

            vibrationService.success();
            onVerified(isConfirmed);
            onClose();

        } catch (err: any) {
            console.error('Verification failed:', err);
            const message = err?.response?.data?.detail || 'Verification failed. Please try again.';
            setError(message);
            vibrationService.error();
        } finally {
            setLoading(false);
        }
    };

    // Haversine distance calculation
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <Text style={styles.title}>🚨 Verify Disaster Report</Text>

                    <Text style={styles.location}>{disasterLocation}</Text>

                    <Text style={styles.question}>
                        Can you confirm this disaster is real?
                    </Text>

                    {error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {loading ? (
                        <ActivityIndicator size="large" color="#0066cc" style={styles.loader} />
                    ) : (
                        <View style={styles.buttons}>
                            <TouchableOpacity
                                style={[styles.button, styles.verifyButton]}
                                onPress={() => handleVerify(true)}
                            >
                                <Text style={styles.buttonText}>✅ Yes, Verify</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, styles.rejectButton]}
                                onPress={() => handleVerify(false)}
                            >
                                <Text style={styles.buttonText}>❌ No, Reject</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 12,
    },
    location: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 16,
    },
    question: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        marginBottom: 20,
    },
    errorBox: {
        backgroundColor: '#ffebee',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: '#c62828',
        fontSize: 14,
        textAlign: 'center',
    },
    loader: {
        marginVertical: 20,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    button: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    verifyButton: {
        backgroundColor: '#4caf50',
    },
    rejectButton: {
        backgroundColor: '#f44336',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        padding: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#666',
        fontSize: 14,
    },
});
