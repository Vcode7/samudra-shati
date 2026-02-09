/**
 * Web Authority Command Center Map
 * 
 * Full-featured map for authorities with:
 * - Interactive Leaflet map
 * - Add safe zones by clicking
 * - Display danger zones (disasters) and safe zones
 * - Device tracking in emergency mode
 * - Toolbar with controls
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import { apiClient } from '../../services/api';
import { locationService } from '../../services/locationService';

interface Disaster {
    id: number;
    latitude: number;
    longitude: number;
    location_name: string;
    severity_level: number;
    status: string;
    created_at: string;
}

interface SafeArea {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    capacity: number;
    current_occupancy: number;
    is_active: boolean;
    authority_id: number;
}

interface DeviceLocation {
    device_id: string;
    latitude: number;
    longitude: number;
    last_updated: string;
    in_danger_zone: boolean;
    distance_km?: number;
}

// Leaflet types for TypeScript
declare global {
    interface Window {
        L: any;
    }
}

export const WebMapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [disasters, setDisasters] = useState<Disaster[]>([]);
    const [safeAreas, setSafeAreas] = useState<SafeArea[]>([]);
    const [devices, setDevices] = useState<DeviceLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [center, setCenter] = useState({ lat: 13.0827, lng: 80.2707 });

    // Map state
    const [mapReady, setMapReady] = useState(false);
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const addingZoneRef = useRef(false);

    // Mode state
    const [addingZone, setAddingZone] = useState(false);
    const [emergencyMode, setEmergencyMode] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState<{ lat: number, lng: number } | null>(null);

    // Form state for new safe zone
    const [zoneName, setZoneName] = useState('');
    const [zoneRadius, setZoneRadius] = useState('500');
    const [zoneCapacity, setZoneCapacity] = useState('100');
    const [zoneDescription, setZoneDescription] = useState('');
    const [savingZone, setSavingZone] = useState(false);

    useEffect(() => {
        addingZoneRef.current = addingZone;
    }, [addingZone]);
    // Load Leaflet scripts
    useEffect(() => {
        const loadLeaflet = async () => {
            // Check if already loaded
            if (window.L) {
                setMapReady(true);
                return;
            }

            // Load CSS
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(css);

            // Load JS
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => setMapReady(true);
            document.body.appendChild(script);
        };

        loadLeaflet();
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapReady || !mapContainerRef.current || mapRef.current) return;

        const L = window.L;

        // Create map
        const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], 12);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Click handler for adding zones
        map.on('click', (e: any) => {
            if (addingZoneRef.current) {
                setSelectedPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
                setShowAddModal(true);
            }
        });

        mapRef.current = map;
    }, [mapReady, center]);

    // Update map markers when data changes
    useEffect(() => {
        if (!mapRef.current || !window.L) return;

        const L = window.L;
        const map = mapRef.current;

        // Clear existing layers (except base tile layer)
        map.eachLayer((layer: any) => {
            if (layer.options && !layer._url) {
                map.removeLayer(layer);
            }
        });

        // Add disaster markers (danger zones - red)
        disasters.forEach(d => {
            const severityRadius = d.severity_level >= 7 ? 2000 : d.severity_level >= 4 ? 1500 : 1000;

            // Danger zone circle
            L.circle([d.latitude, d.longitude], {
                color: '#ff3333',
                fillColor: '#ff3333',
                fillOpacity: 0.2,
                radius: severityRadius,
            }).addTo(map).bindPopup(`
                <b>⚠️ ${d.location_name}</b><br/>
                Severity: ${d.severity_level}/10<br/>
                Status: ${d.status}
            `);

            // Marker
            L.marker([d.latitude, d.longitude], {
                icon: L.divIcon({
                    className: 'danger-marker',
                    html: `<div style="background:#ff3333;color:white;padding:4px 8px;border-radius:4px;font-size:12px;">⚠️ ${d.severity_level}</div>`,
                    iconSize: [40, 20],
                })
            }).addTo(map);
        });

        // Add safe area circles (green if active, grey if inactive)
        safeAreas.forEach(sa => {
            const color = sa.is_active ? '#4CAF50' : '#9e9e9e';

            L.circle([sa.latitude, sa.longitude], {
                color: color,
                fillColor: color,
                fillOpacity: 0.2,
                radius: sa.radius_meters ? sa.radius_meters : 500,
            }).addTo(map).bindPopup(`
                <b>🏕️ ${sa.name}</b><br/>
                Capacity: ${sa.current_occupancy}/${sa.capacity}<br/>
                Status: ${sa.is_active ? 'Active' : 'Inactive'}
            `);

            // Marker
            L.marker([sa.latitude, sa.longitude], {
                icon: L.divIcon({
                    className: 'safe-marker',
                    html: `<div style="background:${color};color:white;padding:4px 8px;border-radius:4px;font-size:12px;">🏕️</div>`,
                    iconSize: [30, 20],
                })
            }).addTo(map);
        });

        // Add device locations in emergency mode
        if (emergencyMode) {
            devices.filter(d => d.in_danger_zone).forEach(device => {
                // Check if device is active (seen within 5 minutes)
                const lastSeen = new Date(device.last_updated);
                const now = new Date();
                const minutesAgo = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
                const isActive = minutesAgo <= 5;

                // Red for active, grey for disconnected
                const markerColor = isActive ? '#ff3333' : '#9e9e9e';
                const statusLabel = isActive ? '📍 Active' : '📍 Lost';

                L.marker([device.latitude, device.longitude], {
                    icon: L.divIcon({
                        className: 'device-marker',
                        html: `<div style="
                            background:${markerColor};
                            color:white;
                            padding:6px 10px;
                            border-radius:12px;
                            font-size:11px;
                            font-weight:bold;
                            box-shadow:0 2px 4px rgba(0,0,0,0.3);
                            ${isActive ? 'animation: pulse 2s infinite;' : ''}
                        ">${statusLabel}</div>`,
                        iconSize: [60, 24],
                    })
                }).addTo(map).bindPopup(`
                    <b>📱 Device in Danger Zone</b><br/>
                    ID: ${device.device_id.slice(0, 8)}...<br/>
                    Distance: ${device.distance_km?.toFixed(2) || '?'}km<br/>
                    Status: <strong style="color:${markerColor}">${isActive ? 'Active' : 'Connection Lost'}</strong><br/>
                    Last seen: ${new Date(device.last_updated).toLocaleTimeString()}
                `);
            });
        }

    }, [disasters, safeAreas, devices, emergencyMode]);

    // Data loading
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const api = await apiClient();
            const coords = await locationService.getCoordinates();

            if (coords) {
                setCenter({ lat: coords.latitude, lng: coords.longitude });
                if (mapRef.current) {
                    mapRef.current.setView([coords.latitude, coords.longitude], 12);
                }
            }

            // Load disasters
            const disasterResponse = await api.get('/api/disasters/recent?page=1&page_size=50');
            setDisasters(disasterResponse.data);

            // Load safe areas
            try {
                const safeAreasResponse = await api.get('/api/authorities/safe-areas?page=1&page_size=50');
                setSafeAreas(safeAreasResponse.data.items || safeAreasResponse.data || []);
            } catch (e) {
                console.log('Safe areas not available');
            }

            // Load device locations if emergency mode
            if (emergencyMode) {
                try {
                    const devicesResponse = await api.get('/api/locations/devices?in_danger_zone=true');
                    setDevices(devicesResponse.data || []);
                } catch (e) {
                    console.log('Device locations not available');
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }, [emergencyMode]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-refresh in emergency mode
    useEffect(() => {
        if (!emergencyMode) return;

        const interval = setInterval(loadData, 30000); // Every 30 seconds
        return () => clearInterval(interval);
    }, [emergencyMode, loadData]);

    // Save new safe zone
    const handleSaveZone = async () => {
        if (!selectedPoint || !zoneName.trim()) return;

        setSavingZone(true);
        try {
            const api = await apiClient();
            await api.post('/api/authorities/safe-areas', {
                name: zoneName.trim(),
                latitude: selectedPoint.lat,
                longitude: selectedPoint.lng,
                radius_meters: parseInt(zoneRadius) || 500,
                capacity: parseInt(zoneCapacity) || 100,
                description: zoneDescription,
                is_active: true,
            });

            // Reset form
            setZoneName('');
            setZoneRadius('500');
            setZoneCapacity('100');
            setZoneDescription('');
            setSelectedPoint(null);
            setShowAddModal(false);
            setAddingZone(false);

            // Reload data
            loadData();
        } catch (error) {
            console.error('Error saving safe zone:', error);
            alert('Failed to save safe zone. Please try again.');
        } finally {
            setSavingZone(false);
        }
    };

    if (loading && !mapReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1a1a2e" />
                <Text style={styles.loadingText}>Loading Command Center...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Toolbar */}
            <View style={styles.toolbar}>
                <Text style={styles.toolbarTitle}>🎖️ Command Center</Text>

                <View style={styles.toolbarButtons}>
                    <TouchableOpacity
                        style={[styles.toolbarBtn, addingZone && styles.toolbarBtnActive]}
                        onPress={() => setAddingZone(!addingZone)}
                    >
                        <Text style={styles.toolbarBtnText}>
                            {addingZone ? '❌ Cancel' : '➕ Add Safe Zone'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.toolbarBtn, emergencyMode && styles.emergencyActive]}
                        onPress={() => setEmergencyMode(!emergencyMode)}
                    >
                        <Text style={styles.toolbarBtnText}>
                            {emergencyMode ? '🔴 Emergency ON' : '⚪ Emergency OFF'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.toolbarBtn} onPress={loadData}>
                        <Text style={styles.toolbarBtnText}>🔄 Refresh</Text>
                    </TouchableOpacity>
                </View>

                {addingZone && (
                    <Text style={styles.toolbarHint}>
                        👆 Click on the map to place a new safe zone
                    </Text>
                )}
            </View>

            <View style={styles.mainContent}>
                {/* Map */}
                <View style={styles.mapContainer}>
                    <div
                        ref={mapContainerRef as any}
                        style={{ width: '100%', height: '100%' }}
                    />
                    {addingZone && (
                        <View style={styles.mapOverlay}>
                            <Text style={styles.mapOverlayText}>ADDING MODE - Click to place zone</Text>
                        </View>
                    )}
                </View>

                {/* Side Panel */}
                <View style={styles.panel}>
                    {/* Stats */}
                    <View style={styles.statsContainer}>
                        <View style={[styles.statBox, styles.dangerStat]}>
                            <Text style={styles.statNumber}>{disasters.length}</Text>
                            <Text style={styles.statLabel}>Danger Zones</Text>
                        </View>
                        <View style={[styles.statBox, styles.safeStat]}>
                            <Text style={styles.statNumber}>{safeAreas.filter(s => s.is_active).length}</Text>
                            <Text style={styles.statLabel}>Safe Zones</Text>
                        </View>
                        {emergencyMode && (
                            <View style={[styles.statBox, styles.deviceStat]}>
                                <Text style={styles.statNumber}>{devices.filter(d => d.in_danger_zone).length}</Text>
                                <Text style={styles.statLabel}>At Risk</Text>
                            </View>
                        )}
                    </View>

                    {/* Legend */}
                    <View style={styles.legend}>
                        <Text style={styles.legendTitle}>Legend</Text>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#ff3333' }]} />
                            <Text style={styles.legendText}>Danger Zone</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                            <Text style={styles.legendText}>Active Safe Zone</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#9e9e9e' }]} />
                            <Text style={styles.legendText}>Inactive Safe Zone</Text>
                        </View>
                        {emergencyMode && (
                            <View style={styles.legendItem}>
                                <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                                <Text style={styles.legendText}>Device in Danger</Text>
                            </View>
                        )}
                    </View>

                    {/* Disaster List */}
                    <Text style={styles.panelTitle}>🚨 Active Alerts</Text>
                    <ScrollView style={styles.disasterList}>
                        {disasters.length === 0 ? (
                            <Text style={styles.noDisasters}>No active disasters</Text>
                        ) : (
                            disasters.slice(0, 8).map((disaster) => (
                                <TouchableOpacity
                                    key={disaster.id}
                                    style={styles.disasterItem}
                                    onPress={() => {
                                        if (mapRef.current) {
                                            mapRef.current.setView([disaster.latitude, disaster.longitude], 14);
                                        }
                                    }}
                                >
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
                                    <Text style={styles.disasterStatus}>{disaster.status}</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>

            {/* Add Zone Modal */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>🏕️ Add New Safe Zone</Text>

                        <Text style={styles.modalCoords}>
                            📍 {selectedPoint?.lat.toFixed(5)}, {selectedPoint?.lng.toFixed(5)}
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Zone Name *"
                            value={zoneName}
                            onChangeText={setZoneName}
                        />

                        <View style={styles.inputRow}>
                            <TextInput
                                style={[styles.input, styles.halfInput]}
                                placeholder="Radius (m)"
                                value={zoneRadius}
                                onChangeText={setZoneRadius}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={[styles.input, styles.halfInput]}
                                placeholder="Capacity"
                                value={zoneCapacity}
                                onChangeText={setZoneCapacity}
                                keyboardType="numeric"
                            />
                        </View>

                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Description (optional)"
                            value={zoneDescription}
                            onChangeText={setZoneDescription}
                            multiline
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => {
                                    setShowAddModal(false);
                                    setSelectedPoint(null);
                                }}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.saveBtn, !zoneName.trim() && styles.saveBtnDisabled]}
                                onPress={handleSaveZone}
                                disabled={!zoneName.trim() || savingZone}
                            >
                                <Text style={styles.saveBtnText}>
                                    {savingZone ? 'Saving...' : 'Save Zone'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#fff',
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16213e',
        padding: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#0f3460',
        flexWrap: 'wrap',
    },
    toolbarTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginRight: 24,
    },
    toolbarButtons: {
        flexDirection: 'row',
        flex: 1,
        gap: 12,
    },
    toolbarBtn: {
        backgroundColor: '#0f3460',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    toolbarBtnActive: {
        backgroundColor: '#e94560',
    },
    emergencyActive: {
        backgroundColor: '#d32f2f',
    },
    toolbarBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    toolbarHint: {
        color: '#e94560',
        fontSize: 13,
        marginTop: 8,
        width: '100%',
    },
    mainContent: {
        flex: 1,
        flexDirection: 'row',
    },
    mapContainer: {
        flex: 2,
        position: 'relative',
    },
    mapOverlay: {
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: [{ translateX: -100 }],
        backgroundColor: '#e94560',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    mapOverlayText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    panel: {
        width: 350,
        backgroundColor: '#16213e',
        padding: 16,
        borderLeftWidth: 1,
        borderLeftColor: '#0f3460',
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    statBox: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    dangerStat: {
        backgroundColor: 'rgba(233, 69, 96, 0.2)',
    },
    safeStat: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
    },
    deviceStat: {
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    statLabel: {
        fontSize: 11,
        color: '#aaa',
        marginTop: 2,
    },
    legend: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    legendTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    legendColor: {
        width: 12,
        height: 12,
        borderRadius: 2,
        marginRight: 8,
    },
    legendText: {
        fontSize: 11,
        color: '#ccc',
    },
    panelTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    noDisasters: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginTop: 20,
    },
    disasterList: {
        flex: 1,
    },
    disasterItem: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#e94560',
    },
    disasterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    disasterName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
    },
    severity: {
        fontSize: 11,
        fontWeight: 'bold',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    severityHigh: {
        backgroundColor: 'rgba(198, 40, 40, 0.3)',
        color: '#ff6b6b',
    },
    severityMedium: {
        backgroundColor: 'rgba(239, 108, 0, 0.3)',
        color: '#ffa726',
    },
    severityLow: {
        backgroundColor: 'rgba(46, 125, 50, 0.3)',
        color: '#66bb6a',
    },
    disasterStatus: {
        fontSize: 11,
        color: '#888',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        backgroundColor: '#16213e',
        width: 400,
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalCoords: {
        fontSize: 14,
        color: '#aaa',
        textAlign: 'center',
        marginBottom: 20,
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 8,
        borderRadius: 6,
    },
    input: {
        backgroundColor: '#0f3460',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        color: '#fff',
        fontSize: 14,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    cancelBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        backgroundColor: '#444',
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#fff',
        fontWeight: '600',
    },
    saveBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        backgroundColor: '#4CAF50',
        alignItems: 'center',
    },
    saveBtnDisabled: {
        backgroundColor: '#555',
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '600',
    },
});
