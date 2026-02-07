import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { emergencyModeService } from '../services/emergencyModeService';
import { vibrationService } from '../services/vibrationService';

const { width, height } = Dimensions.get('window');

interface DisasterLocation {
    disaster_id: number;
    latitude: number;
    longitude: number;
    danger_radius_km: number;
    location_name: string;
}

interface EmergencyOverlayScreenProps {
    visible: boolean;
    disaster: DisasterLocation | null;
    onDismiss: () => void;
}

export const EmergencyOverlayScreen: React.FC<EmergencyOverlayScreenProps> = ({
    visible,
    disaster,
    onDismiss,
}) => {
    const [isSilenced, setIsSilenced] = useState(false);
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const pulseAnim = new Animated.Value(1);

    useEffect(() => {
        if (visible) {
            // Start pulsing animation
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();

            // Check current location
            checkDistance();

            return () => pulse.stop();
        }
    }, [visible]);

    const checkDistance = useCallback(async () => {
        const result = await emergencyModeService.checkCurrentLocation();
        if (result) {
            setDistanceKm(result.distance_km);
        }
    }, []);

    const handleSilence = () => {
        if (isSilenced) {
            emergencyModeService.resumeVibration();
            setIsSilenced(false);
        } else {
            emergencyModeService.silenceVibration();
            setIsSilenced(true);
        }
    };

    const handleImSafe = async () => {
        await emergencyModeService.deactivate();
        onDismiss();
    };

    if (!visible || !disaster) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Pulsing Background */}
                <Animated.View
                    style={[
                        styles.pulseBackground,
                        { transform: [{ scale: pulseAnim }] },
                    ]}
                />

                {/* Content */}
                <View style={styles.content}>
                    {/* Warning Icon */}
                    <Animated.View
                        style={[
                            styles.iconContainer,
                            { transform: [{ scale: pulseAnim }] },
                        ]}
                    >
                        <MaterialIcons name="warning" size={100} color="#fff" />
                    </Animated.View>

                    {/* Emergency Text */}
                    <Text style={styles.emergencyTitle}>⚠️ EMERGENCY ⚠️</Text>
                    <Text style={styles.dangerText}>YOU ARE IN THE DANGER ZONE</Text>

                    {/* Location Info */}
                    <View style={styles.infoBox}>
                        <Text style={styles.locationText}>
                            📍 {disaster.location_name}
                        </Text>
                        {distanceKm !== null && (
                            <Text style={styles.distanceText}>
                                Distance: {distanceKm.toFixed(2)} km
                            </Text>
                        )}
                        <Text style={styles.radiusText}>
                            Danger Radius: {disaster.danger_radius_km} km
                        </Text>
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructionsBox}>
                        <Text style={styles.instructionTitle}>EVACUATE IMMEDIATELY</Text>
                        <Text style={styles.instructionText}>
                            Move to a safe location at least {disaster.danger_radius_km} km away
                        </Text>
                        <Text style={styles.instructionText}>
                            Alert stops automatically when you leave the danger zone
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.silenceButton]}
                            onPress={handleSilence}
                        >
                            <MaterialIcons
                                name={isSilenced ? "volume-up" : "volume-off"}
                                size={24}
                                color="#fff"
                            />
                            <Text style={styles.buttonText}>
                                {isSilenced ? "Resume Vibration" : "Silence Vibration"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.safeButton]}
                            onPress={handleImSafe}
                        >
                            <MaterialIcons name="check-circle" size={24} color="#fff" />
                            <Text style={styles.buttonText}>I'm Safe</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Status */}
                    <View style={styles.statusBar}>
                        <View style={[styles.statusDot, !isSilenced && styles.statusDotActive]} />
                        <Text style={styles.statusText}>
                            {isSilenced ? "Vibration Silenced" : "Continuous Alert Active"}
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#B71C1C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pulseBackground: {
        position: 'absolute',
        width: width * 1.5,
        height: height * 1.5,
        backgroundColor: '#C62828',
        borderRadius: 1000,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    iconContainer: {
        marginBottom: 20,
    },
    emergencyTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFEB3B',
        textAlign: 'center',
        marginBottom: 10,
        textShadowColor: '#000',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
    },
    dangerText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 30,
    },
    infoBox: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        width: '100%',
    },
    locationText: {
        fontSize: 18,
        color: '#fff',
        textAlign: 'center',
        marginBottom: 10,
    },
    distanceText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFEB3B',
        textAlign: 'center',
        marginBottom: 5,
    },
    radiusText: {
        fontSize: 16,
        color: '#fff',
        textAlign: 'center',
        opacity: 0.8,
    },
    instructionsBox: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 30,
        width: '100%',
    },
    instructionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFEB3B',
        textAlign: 'center',
        marginBottom: 10,
    },
    instructionText: {
        fontSize: 14,
        color: '#fff',
        textAlign: 'center',
        marginBottom: 5,
        lineHeight: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 10,
        flex: 0.48,
    },
    silenceButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 2,
        borderColor: '#fff',
    },
    safeButton: {
        backgroundColor: '#2E7D32',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 8,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#757575',
        marginRight: 10,
    },
    statusDotActive: {
        backgroundColor: '#4CAF50',
    },
    statusText: {
        color: '#fff',
        fontSize: 14,
    },
});

export default EmergencyOverlayScreen;
