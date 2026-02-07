import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import MapView, { Marker, Callout, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { locationService } from '../services/locationService';
import { apiClient } from '../services/api';

interface DisasterMarker {
    id: number;
    latitude: number;
    longitude: number;
    location_name: string;
    severity_level: number;
    status: string;
    created_at: string;
}

interface Authority {
    id: number;
    organization_name: string;
    authority_type: string;
    base_latitude: number;
    base_longitude: number;
    operational_radius_km: number;
    contact_number: string;
}

interface SafeArea {
    id: number;
    latitude: number;
    longitude: number;
    radius_km: number;
    description: string | null;
    is_active: boolean;
}

const { width, height } = Dimensions.get('window');

export const AlertsMapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { t } = useLanguage();
    const mapRef = useRef<MapView>(null);
    const [disasters, setDisasters] = useState<DisasterMarker[]>([]);
    const [authorities, setAuthorities] = useState<Authority[]>([]);
    const [safeAreas, setSafeAreas] = useState<SafeArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAuthorities, setShowAuthorities] = useState(true);
    const [showDangerZones, setShowDangerZones] = useState(true);
    const [showSafeAreas, setShowSafeAreas] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [region, setRegion] = useState({
        latitude: 13.0827,  // Default: Chennai
        longitude: 80.2707,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
    });

    useEffect(() => {
        loadData();
        getCurrentLocation();
    }, []);

    const getCurrentLocation = async () => {
        try {
            const coords = await locationService.getCoordinates();
            if (coords) {
                setUserLocation(coords);
                setRegion({
                    ...region,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                });
            }
        } catch (error) {
            console.error('Error getting location:', error);
        }
    };

    const loadData = async () => {
        try {
            const api = await apiClient();
            const coords = await locationService.getCoordinates();
            const lat = coords?.latitude || 13.0827;
            const lng = coords?.longitude || 80.2707;

            const [disastersRes, authoritiesRes, safeAreasRes] = await Promise.all([
                api.get('/api/disasters/recent?page=1&page_size=100'),
                api.get('/api/authorities/nearby').catch(() => ({ data: [] })),
                api.get(`/api/safe-areas/nearby?lat=${lat}&lng=${lng}&radius_km=50`).catch(() => ({ data: [] })),
            ]);
            setDisasters(disastersRes.data);
            setAuthorities(authoritiesRes.data);
            setSafeAreas(safeAreasRes.data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Get danger zone radius based on severity (in meters)
    const getDangerRadius = (severity: number): number => {
        if (severity >= 8) return 5000;  // 5km for critical
        if (severity >= 5) return 3000;  // 3km for high
        if (severity >= 3) return 1500;  // 1.5km for moderate
        return 500;  // 0.5km for low
    };

    // Get fill color for danger zone circle
    const getDangerFillColor = (severity: number): string => {
        if (severity >= 8) return 'rgba(255, 0, 0, 0.15)';     // Critical - red
        if (severity >= 5) return 'rgba(255, 152, 0, 0.15)';   // High - orange
        if (severity >= 3) return 'rgba(255, 193, 7, 0.15)';   // Moderate - yellow
        return 'rgba(33, 150, 243, 0.1)';  // Low - blue
    };

    // Get stroke color for danger zone circle
    const getDangerStrokeColor = (severity: number): string => {
        if (severity >= 8) return '#ff0000';   // Critical - red
        if (severity >= 5) return '#ff9800';   // High - orange
        if (severity >= 3) return '#ffc107';   // Moderate - yellow
        return '#2196f3';  // Low - blue
    };

    const getMarkerColor = (status: string, severity: number) => {
        if (status === 'FALSE_ALARM') return '#999';
        if (status === 'VERIFIED') {
            if (severity >= 8) return '#ff0000';
            if (severity >= 5) return '#ff9800';
            return '#ffc107';
        }
        return '#2196f3'; // Pending
    };

    const getAuthorityIcon = (type: string): string => {
        switch (type?.toLowerCase()) {
            case 'fire': return '🚒';
            case 'coast_guard': return '⚓';
            case 'ndrf': return '🛟';
            case 'medical': return '🏥';
            case 'police': return '🚔';
            default: return '🏛️';
        }
    };


    const handleMarkerPress = (disaster: DisasterMarker) => {
        vibrationService.light();
    };

    const navigateToDetails = (disasterId: number) => {
        navigation.navigate('DisasterDetails', { disasterId });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0066cc" />
                    <Text style={styles.loadingText}>Loading map data...</Text>
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
                <Text style={styles.title}>🗺️ Disaster Map</Text>
            </View>

            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    region={region}
                    onRegionChangeComplete={setRegion}
                    showsUserLocation={true}
                    showsMyLocationButton={true}
                    showsCompass={true}
                >
                    {/* Danger Zone Circles */}
                    {showDangerZones && disasters.filter(d => d.status === 'VERIFIED').map((disaster) => (
                        <Circle
                            key={`circle-${disaster.id}`}
                            center={{
                                latitude: disaster.latitude,
                                longitude: disaster.longitude,
                            }}
                            radius={getDangerRadius(disaster.severity_level)}
                            fillColor={getDangerFillColor(disaster.severity_level)}
                            strokeColor={getDangerStrokeColor(disaster.severity_level)}
                            strokeWidth={2}
                        />
                    ))}
                    {showDangerZones && disasters.filter(d => d.status !== 'VERIFIED').map((disaster) => (
                        <Circle
                            key={`circle-${disaster.id}`}
                            center={{
                                latitude: disaster.latitude,
                                longitude: disaster.longitude,
                            }}
                            radius={getDangerRadius(disaster.severity_level)}
                            fillColor={getDangerFillColor(disaster.severity_level)}
                            strokeColor={getDangerStrokeColor(disaster.severity_level)}
                            strokeWidth={1}
                        />
                    ))}
                    {/* Disaster Markers */}
                    {disasters.map((disaster) => (
                        <Marker
                            key={disaster.id}
                            coordinate={{
                                latitude: disaster.latitude,
                                longitude: disaster.longitude,
                            }}
                            pinColor={getMarkerColor(disaster.status, disaster.severity_level)}
                            onPress={() => handleMarkerPress(disaster)}
                        >
                            <Callout onPress={() => navigateToDetails(disaster.id)}>
                                <View style={styles.callout}>
                                    <Text style={styles.calloutTitle}>{disaster.location_name}</Text>
                                    <Text style={styles.calloutSeverity}>
                                        Severity: {disaster.severity_level}/10
                                    </Text>
                                    <Text style={styles.calloutStatus}>{disaster.status}</Text>
                                    <Text style={styles.calloutTap}>Tap for details →</Text>
                                </View>
                            </Callout>
                        </Marker>
                    ))}

                    {/* Authority Markers */}
                    {showAuthorities && authorities.map((auth) => (
                        <Marker
                            key={`auth-${auth.id}`}
                            coordinate={{
                                latitude: auth.base_latitude,
                                longitude: auth.base_longitude,
                            }}
                            pinColor="#00aa00"
                        >
                            <View style={styles.authorityMarker}>
                                <Text style={styles.authorityIcon}>
                                    {getAuthorityIcon(auth.authority_type)}
                                </Text>
                            </View>
                            <Callout>
                                <View style={styles.callout}>
                                    <Text style={styles.calloutTitle}>
                                        {getAuthorityIcon(auth.authority_type)} {auth.organization_name}
                                    </Text>
                                    <Text style={styles.calloutSeverity}>
                                        Type: {auth.authority_type}
                                    </Text>
                                    <Text style={styles.calloutStatus}>
                                        📞 {auth.contact_number}
                                    </Text>
                                    <Text style={styles.calloutTap}>
                                        Coverage: {auth.operational_radius_km}km
                                    </Text>
                                </View>
                            </Callout>
                        </Marker>
                    ))}

                    {/* Safe Area Circles */}
                    {showSafeAreas && safeAreas.map((area) => (
                        <Circle
                            key={`safe-${area.id}`}
                            center={{
                                latitude: area.latitude,
                                longitude: area.longitude,
                            }}
                            radius={area.radius_km * 1000}  // Convert km to meters
                            fillColor="rgba(76, 175, 80, 0.2)"
                            strokeColor="#4caf50"
                            strokeWidth={2}
                        />
                    ))}

                    {/* Safe Area Markers */}
                    {showSafeAreas && safeAreas.map((area) => (
                        <Marker
                            key={`safe-marker-${area.id}`}
                            coordinate={{
                                latitude: area.latitude,
                                longitude: area.longitude,
                            }}
                        >
                            <View style={styles.safeAreaMarker}>
                                <Text style={styles.safeAreaIcon}>🟢</Text>
                            </View>
                            <Callout>
                                <View style={styles.callout}>
                                    <Text style={styles.calloutTitle}>🟢 Safe Area</Text>
                                    <Text style={styles.calloutSeverity}>
                                        Radius: {area.radius_km}km
                                    </Text>
                                    {area.description && (
                                        <Text style={styles.calloutStatus}>{area.description}</Text>
                                    )}
                                </View>
                            </Callout>
                        </Marker>
                    ))}
                </MapView>
            </View>

            {/* Toggle Controls */}
            <View style={styles.toggleRow}>
                <TouchableOpacity
                    style={[styles.toggleButton, showDangerZones && styles.toggleActive]}
                    onPress={() => setShowDangerZones(!showDangerZones)}
                >
                    <Text style={[styles.toggleText, showDangerZones && styles.toggleTextActive]}>
                        ⭕ Danger Zones
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleButton, showAuthorities && styles.toggleActive]}
                    onPress={() => setShowAuthorities(!showAuthorities)}
                >
                    <Text style={[styles.toggleText, showAuthorities && styles.toggleTextActive]}>
                        🏛️ Authorities
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleButton, showSafeAreas && styles.toggleActive]}
                    onPress={() => setShowSafeAreas(!showSafeAreas)}
                >
                    <Text style={[styles.toggleText, showSafeAreas && styles.toggleTextActive]}>
                        🟢 Safe Areas
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ff0000' }]} />
                    <Text style={styles.legendText}>Critical</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ff9800' }]} />
                    <Text style={styles.legendText}>High</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ffc107' }]} />
                    <Text style={styles.legendText}>Moderate</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#00aa00' }]} />
                    <Text style={styles.legendText}>Authority</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4caf50' }]} />
                    <Text style={styles.legendText}>Safe Zone</Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.stats}>
                <Text style={styles.statsText}>
                    {disasters.length} disasters • {authorities.length} authorities nearby
                </Text>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
    header: { backgroundColor: '#0066cc', padding: 16, paddingTop: 10 },
    backButton: { marginBottom: 8 },
    backButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    mapContainer: { flex: 1 },
    map: { width: '100%', height: '100%' },
    callout: { padding: 8, minWidth: 150 },
    calloutTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4 },
    calloutSeverity: { fontSize: 12, color: '#ff6600', marginBottom: 2 },
    calloutStatus: { fontSize: 12, color: '#666', marginBottom: 4 },
    calloutTap: { fontSize: 11, color: '#0066cc', fontStyle: 'italic' },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#ddd',
        justifyContent: 'space-around',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
    legendText: { fontSize: 11, color: '#666' },
    stats: {
        backgroundColor: '#333',
        padding: 12,
        alignItems: 'center',
    },
    statsText: { fontSize: 12, color: '#fff' },
    toggleRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
    },
    toggleActive: {
        backgroundColor: '#0066cc',
    },
    toggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
    },
    toggleTextActive: {
        color: '#fff',
    },
    authorityMarker: {
        backgroundColor: '#fff',
        padding: 6,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#00aa00',
    },
    authorityIcon: {
        fontSize: 22,
    },
    safeAreaMarker: {
        backgroundColor: '#fff',
        padding: 6,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#4caf50',
    },
    safeAreaIcon: {
        fontSize: 22,
    }

});
