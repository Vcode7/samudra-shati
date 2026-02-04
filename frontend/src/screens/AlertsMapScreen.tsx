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
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLanguage } from '../context/LanguageContext';
import { vibrationService } from '../services/vibrationService';
import { locationService } from '../services/locationService';
import api from '../services/api';

interface DisasterMarker {
    id: number;
    latitude: number;
    longitude: number;
    location_name: string;
    severity_level: number;
    status: string;
    created_at: string;
}

const { width, height } = Dimensions.get('window');

export const AlertsMapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { t } = useLanguage();
    const mapRef = useRef<MapView>(null);
    const [disasters, setDisasters] = useState<DisasterMarker[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [region, setRegion] = useState({
        latitude: 13.0827,  // Default: Chennai
        longitude: 80.2707,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
    });

    useEffect(() => {
        loadDisasters();
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

    const loadDisasters = async () => {
        try {
            const response = await api.get('/api/disasters/recent?page=1&page_size=100');
            setDisasters(response.data);
        } catch (error) {
            console.error('Error loading disasters:', error);
        } finally {
            setLoading(false);
        }
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
                </MapView>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ff0000' }]} />
                    <Text style={styles.legendText}>Critical (8-10)</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ff9800' }]} />
                    <Text style={styles.legendText}>High (5-7)</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#ffc107' }]} />
                    <Text style={styles.legendText}>Moderate (1-4)</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#2196f3' }]} />
                    <Text style={styles.legendText}>Pending</Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.stats}>
                <Text style={styles.statsText}>
                    {disasters.length} disasters shown • {disasters.filter(d => d.status === 'VERIFIED').length} verified
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
});
