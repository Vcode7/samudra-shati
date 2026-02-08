/**
 * Web-specific Map Screen
 * 
 * Uses OpenStreetMap via iframe for web platform.
 * This replaces react-native-maps which doesn't work on web.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { apiClient } from '../../services/api';
import { locationService } from '../../services/locationService';

interface Disaster {
    id: number;
    latitude: number;
    longitude: number;
    location_name: string;
    severity_level: number;
    status: string;
}

export const WebMapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [disasters, setDisasters] = useState<Disaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [center, setCenter] = useState({ lat: 13.0827, lng: 80.2707 });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const api = await apiClient();
            const coords = await locationService.getCoordinates();

            if (coords) {
                setCenter({ lat: coords.latitude, lng: coords.longitude });
            }

            const response = await api.get('/api/disasters/recent?page=1&page_size=50');
            setDisasters(response.data);
        } catch (error) {
            console.error('Error loading disasters:', error);
        } finally {
            setLoading(false);
        }
    };

    // Build OpenStreetMap URL with markers
    const getMapUrl = () => {
        const bbox = `${center.lng - 0.5},${center.lat - 0.5},${center.lng + 0.5},${center.lat + 0.5}`;
        return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.lat},${center.lng}`;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1a1a2e" />
                <Text style={styles.loadingText}>Loading map...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Map iframe */}
            <View style={styles.mapContainer}>
                <iframe
                    src={getMapUrl()}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                    }}
                    title="Disaster Map"
                    loading="lazy"
                />
            </View>

            {/* Disaster list panel */}
            <View style={styles.panel}>
                <Text style={styles.panelTitle}>🚨 Active Disasters ({disasters.length})</Text>

                {disasters.length === 0 ? (
                    <Text style={styles.noDisasters}>No active disasters</Text>
                ) : (
                    <View style={styles.disasterList}>
                        {disasters.slice(0, 10).map((disaster) => (
                            <View key={disaster.id} style={styles.disasterItem}>
                                <View style={styles.disasterHeader}>
                                    <Text style={styles.disasterName}>{disaster.location_name}</Text>
                                    <Text style={[
                                        styles.severity,
                                        disaster.severity_level >= 7 ? styles.severityHigh :
                                            disaster.severity_level >= 4 ? styles.severityMedium :
                                                styles.severityLow
                                    ]}>
                                        {disaster.severity_level}/10
                                    </Text>
                                </View>
                                <Text style={styles.disasterCoords}>
                                    📍 {disaster.latitude.toFixed(4)}, {disaster.longitude.toFixed(4)}
                                </Text>
                                <Text style={styles.disasterStatus}>
                                    Status: {disaster.status}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
                    <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    mapContainer: {
        flex: 2,
        backgroundColor: '#e0e0e0',
    },
    panel: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
        borderLeftWidth: 1,
        borderLeftColor: '#ddd',
        maxWidth: 400,
    },
    panelTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 16,
    },
    noDisasters: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
    },
    disasterList: {
        flex: 1,
    },
    disasterItem: {
        backgroundColor: '#f9f9f9',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#ff3333',
    },
    disasterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    disasterName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    severity: {
        fontSize: 12,
        fontWeight: 'bold',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    severityHigh: {
        backgroundColor: '#ffebee',
        color: '#c62828',
    },
    severityMedium: {
        backgroundColor: '#fff3e0',
        color: '#ef6c00',
    },
    severityLow: {
        backgroundColor: '#e8f5e9',
        color: '#2e7d32',
    },
    disasterCoords: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    disasterStatus: {
        fontSize: 12,
        color: '#888',
    },
    refreshButton: {
        backgroundColor: '#1a1a2e',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
