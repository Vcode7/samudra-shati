import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Modal,
    ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { emergencyModeService } from '../services/emergencyModeService';
import { vibrationService } from '../services/vibrationService';
import { useLanguage } from '../context/LanguageContext';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { locationService } from '../services/locationService';
import { navigationService } from '../services/navigationService';

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
    const { t } = useLanguage();
    const [isSilenced, setIsSilenced] = useState(false);
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const pulseAnim = new Animated.Value(1);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    useEffect(() => {
        if (visible) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ])
            );
            pulse.start();

            checkDistance();

            (async () => {
                const coords = await locationService.getCoordinates();
                if (coords) setUserLocation(coords);
            })();

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
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
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
                    <Text style={styles.emergencyTitle}>{t('emergency_title')}</Text>
                    <Text style={styles.dangerText}>{t('you_are_in_danger_zone')}</Text>

                    {/* Location Info */}
                    <View style={styles.infoBox}>
                        <Text style={styles.locationText}>
                            📍 {disaster.location_name}
                        </Text>
                        {distanceKm !== null && (
                            <Text style={styles.distanceText}>
                                {t('distance')}: {distanceKm.toFixed(2)} km
                            </Text>
                        )}
                        <Text style={styles.radiusText}>
                            {t('danger_radius')}: {disaster.danger_radius_km} km
                        </Text>
                    </View>
                    {/* Mini Map Preview */}
                    <TouchableOpacity
                        style={styles.miniMapContainer}
                        activeOpacity={0.9}
                        onPress={() => {
                            onDismiss();
                            navigationService.navigateToDisasterMap(disaster);
                        }}
                    >
                        <View pointerEvents="none" style={styles.miniMapWrapper}>
                            <MapView
                                style={styles.miniMap}
                                provider={PROVIDER_GOOGLE}
                                scrollEnabled={false}
                                zoomEnabled={false}
                                pitchEnabled={false}
                                rotateEnabled={false}
                                initialRegion={{
                                    latitude: disaster.latitude,
                                    longitude: disaster.longitude,
                                    latitudeDelta: 0.02,
                                    longitudeDelta: 0.02,
                                }}
                            >
                                {/* Disaster */}
                                <Marker
                                    coordinate={{
                                        latitude: disaster.latitude,
                                        longitude: disaster.longitude,
                                    }}
                                    pinColor="red"
                                />

                                {/* Danger radius */}
                                <Circle
                                    center={{
                                        latitude: disaster.latitude,
                                        longitude: disaster.longitude,
                                    }}
                                    radius={disaster.danger_radius_km * 1000}
                                    fillColor="rgba(255,0,0,0.15)"
                                    strokeColor="#ff0000"
                                    strokeWidth={2}
                                />

                                {/* User */}
                                {userLocation && (
                                    <Marker
                                        coordinate={userLocation}
                                        pinColor="blue"
                                        title="You"
                                    />
                                )}
                            </MapView>
                        </View>

                        <View style={styles.mapOverlayLabel}>
                            <Text style={styles.mapOverlayText}>Tap to open full map</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Instructions */}
                    <View style={styles.instructionsBox}>
                        <Text style={styles.instructionTitle}>{t('evacuate_immediately')}</Text>
                        <Text style={styles.instructionText}>
                            {t('move_to_safe_location', { distance: disaster.danger_radius_km })}
                        </Text>
                        <Text style={styles.instructionText}>
                            {t('alert_stops_auto')}
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
                                {isSilenced ? t('resume_vibration') : t('silence_vibration')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.safeButton]}
                            onPress={handleImSafe}
                        >
                            <MaterialIcons name="check-circle" size={24} color="#fff" />
                            <Text style={styles.buttonText}>{t('im_safe')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Status */}
                    <View style={styles.statusBar}>
                        <View style={[styles.statusDot, !isSilenced && styles.statusDotActive]} />
                        <Text style={styles.statusText}>
                            {isSilenced ? t('vibration_silenced') : t('continuous_alert_active')}
                        </Text>
                    </View>
                </ScrollView>
            </View >
        </Modal >
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
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 40, // Extra padding for bottom buttons
    },
    iconContainer: {
        marginBottom: 20,
        marginTop: 40, // Add top margin inside scrollview
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
    miniMapContainer: {
        height: 160,
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: '#ffeb3b',
    },

    miniMapWrapper: {
        flex: 1,
        width: '100%',
    },

    miniMap: {
        flex: 1,
    },

    mapOverlayLabel: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },

    mapOverlayText: {
        color: '#FFEB3B',
        fontSize: 12,
        fontWeight: 'bold',
    },

});

export default EmergencyOverlayScreen;
