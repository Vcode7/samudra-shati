import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    Animated,
    Easing,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { apiClient } from '../services/api';
import { locationService } from '../services/locationService';
import { vibrationService } from '../services/vibrationService';

interface SafeArea {
    id: number;
    latitude: number;
    longitude: number;
    radius_km: number;
    description: string | null;
    is_active: boolean;
}

interface EvacuationDirection {
    has_safe_area: boolean;
    safe_area?: SafeArea;
    distance_km?: number;
    estimated_time_minutes?: number;
    crowd_direction?: number;
    crowd_confidence?: number;
    bearing_to_safe_area?: number;
}

interface Props {
    navigation: any;
    route: {
        params?: {
            disaster_id?: number;
            disaster_location?: { latitude: number; longitude: number };
        };
    };
}

export const EvacuationGuidanceScreen: React.FC<Props> = ({ navigation, route }) => {
    const mapRef = useRef<MapView>(null);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [evacuationData, setEvacuationData] = useState<EvacuationDirection | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Arrow rotation animation
    const rotationAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const disasterLocation = route.params?.disaster_location;

    useEffect(() => {
        loadEvacuationData();
        startAnimations();

        // Refresh every 30 seconds
        const interval = setInterval(loadEvacuationData, 30000);
        return () => clearInterval(interval);
    }, []);

    const startAnimations = () => {
        // Pulse animation for evacuation card
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const loadEvacuationData = async () => {
        try {
            const coords = await locationService.getCoordinates();
            if (!coords) {
                setError('Unable to get your location');
                setLoading(false);
                return;
            }

            setUserLocation(coords);

            const api = await apiClient();
            const response = await api.get('/api/evacuation/direction', {
                params: {
                    lat: coords.latitude,
                    lng: coords.longitude,
                    disaster_id: route.params?.disaster_id,
                },
            });

            setEvacuationData(response.data);

            // Update arrow rotation
            const direction = response.data.bearing_to_safe_area || response.data.crowd_direction;
            if (direction !== undefined) {
                Animated.timing(rotationAnim, {
                    toValue: direction,
                    duration: 500,
                    useNativeDriver: true,
                }).start();
            }

            // Vibrate to alert user
            vibrationService.light();
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to get evacuation guidance');
        } finally {
            setLoading(false);
        }
    };

    const getDirectionText = (degrees: number): string => {
        const directions = ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'];
        const index = Math.round(degrees / 45) % 8;
        return directions[index];
    };

    const rotation = rotationAnim.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
    });

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4caf50" />
                    <Text style={styles.loadingText}>Finding safest route...</Text>
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
                <Text style={styles.title}>🚶 Evacuation Guidance</Text>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    region={userLocation ? {
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    } : undefined}
                    showsUserLocation={true}
                >
                    {/* Disaster Zone */}
                    {disasterLocation && (
                        <>
                            <Circle
                                center={disasterLocation}
                                radius={2000}
                                fillColor="rgba(255, 0, 0, 0.2)"
                                strokeColor="#ff0000"
                                strokeWidth={2}
                            />
                            <Marker
                                coordinate={disasterLocation}
                                pinColor="#ff0000"
                                title="Disaster Zone"
                            />
                        </>
                    )}

                    {/* Safe Area */}
                    {evacuationData?.safe_area && (
                        <>
                            <Circle
                                center={{
                                    latitude: evacuationData.safe_area.latitude,
                                    longitude: evacuationData.safe_area.longitude,
                                }}
                                radius={evacuationData.safe_area.radius_km * 1000}
                                fillColor="rgba(76, 175, 80, 0.25)"
                                strokeColor="#4caf50"
                                strokeWidth={3}
                            />
                            <Marker
                                coordinate={{
                                    latitude: evacuationData.safe_area.latitude,
                                    longitude: evacuationData.safe_area.longitude,
                                }}
                                pinColor="#4caf50"
                                title="Safe Area"
                                description={evacuationData.safe_area.description || 'Evacuation Point'}
                            />
                        </>
                    )}

                    {/* Route line to safe area */}
                    {userLocation && evacuationData?.safe_area && (
                        <Polyline
                            coordinates={[
                                userLocation,
                                {
                                    latitude: evacuationData.safe_area.latitude,
                                    longitude: evacuationData.safe_area.longitude,
                                },
                            ]}
                            strokeColor="#4caf50"
                            strokeWidth={4}
                            lineDashPattern={[10, 5]}
                        />
                    )}
                </MapView>
            </View>

            {/* Direction Card */}
            <Animated.View style={[styles.directionCard, { transform: [{ scale: pulseAnim }] }]}>
                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={loadEvacuationData}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : evacuationData?.has_safe_area ? (
                    <>
                        <Text style={styles.cardTitle}>🟢 Safe Area Found</Text>
                        <View style={styles.directionRow}>
                            <Animated.View style={[styles.arrowContainer, { transform: [{ rotate: rotation }] }]}>
                                <Text style={styles.arrow}>➡️</Text>
                            </Animated.View>
                            <View style={styles.directionInfo}>
                                <Text style={styles.directionText}>
                                    Head {getDirectionText(evacuationData.bearing_to_safe_area || 0)}
                                </Text>
                                <Text style={styles.distanceText}>
                                    {evacuationData.distance_km?.toFixed(1)} km away
                                </Text>
                                {evacuationData.estimated_time_minutes && (
                                    <Text style={styles.timeText}>
                                        ⏱️ ~{Math.round(evacuationData.estimated_time_minutes)} min walk
                                    </Text>
                                )}
                            </View>
                        </View>
                        {evacuationData.safe_area?.description && (
                            <Text style={styles.description}>{evacuationData.safe_area.description}</Text>
                        )}
                    </>
                ) : evacuationData?.crowd_direction !== undefined ? (
                    <>
                        <Text style={styles.cardTitle}>🚶 Community Evacuation Route</Text>
                        <View style={styles.directionRow}>
                            <Animated.View style={[styles.arrowContainer, { transform: [{ rotate: rotation }] }]}>
                                <Text style={styles.arrow}>➡️</Text>
                            </Animated.View>
                            <View style={styles.directionInfo}>
                                <Text style={styles.directionText}>
                                    Head {getDirectionText(evacuationData.crowd_direction)}
                                </Text>
                                <Text style={styles.confidenceText}>
                                    {Math.round((evacuationData.crowd_confidence || 0) * 100)}% confidence
                                </Text>
                                <Text style={styles.subText}>
                                    Based on community movement
                                </Text>
                            </View>
                        </View>
                    </>
                ) : (
                    <View style={styles.noDataContainer}>
                        <Text style={styles.noDataIcon}>📍</Text>
                        <Text style={styles.noDataText}>
                            No evacuation route available yet.
                        </Text>
                        <Text style={styles.noDataSubtext}>
                            Stay calm and follow official instructions.
                        </Text>
                    </View>
                )}
            </Animated.View>

            {/* Refresh Button */}
            <TouchableOpacity style={styles.refreshButton} onPress={loadEvacuationData}>
                <Text style={styles.refreshText}>🔄 Refresh Guidance</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#aaa' },
    header: { backgroundColor: '#16213e', padding: 16, paddingTop: 10 },
    backButton: { marginBottom: 8 },
    backButtonText: { fontSize: 16, color: '#4caf50', fontWeight: '600' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    mapContainer: { flex: 1 },
    map: { width: '100%', height: '100%' },
    directionCard: {
        backgroundColor: '#16213e',
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#4caf50',
    },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },
    directionRow: { flexDirection: 'row', alignItems: 'center' },
    arrowContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#4caf50',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    arrow: { fontSize: 30 },
    directionInfo: { flex: 1 },
    directionText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    distanceText: { fontSize: 16, color: '#4caf50', marginTop: 4 },
    timeText: { fontSize: 14, color: '#aaa', marginTop: 4 },
    confidenceText: { fontSize: 14, color: '#ffc107', marginTop: 4 },
    subText: { fontSize: 12, color: '#888', marginTop: 2 },
    description: { fontSize: 14, color: '#aaa', marginTop: 12, textAlign: 'center', fontStyle: 'italic' },
    errorContainer: { alignItems: 'center', padding: 20 },
    errorIcon: { fontSize: 40, marginBottom: 12 },
    errorText: { fontSize: 16, color: '#ff6b6b', textAlign: 'center', marginBottom: 16 },
    retryButton: { backgroundColor: '#4caf50', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
    retryText: { color: '#fff', fontWeight: 'bold' },
    noDataContainer: { alignItems: 'center', padding: 16 },
    noDataIcon: { fontSize: 40, marginBottom: 12 },
    noDataText: { fontSize: 16, color: '#fff', textAlign: 'center' },
    noDataSubtext: { fontSize: 14, color: '#aaa', marginTop: 8, textAlign: 'center' },
    refreshButton: {
        backgroundColor: '#2a2a4e',
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    refreshText: { color: '#4caf50', fontSize: 16, fontWeight: '600' },
});

export default EvacuationGuidanceScreen;
