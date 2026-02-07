import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    TextInput,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import Slider from '@react-native-community/slider';
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

export const SafeAreaManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const mapRef = useRef<MapView>(null);
    const [safeAreas, setSafeAreas] = useState<SafeArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New safe area state
    const [isMarking, setIsMarking] = useState(false);
    const [newAreaLocation, setNewAreaLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [newAreaRadius, setNewAreaRadius] = useState(0.5); // km
    const [newAreaDescription, setNewAreaDescription] = useState('');

    const [region, setRegion] = useState({
        latitude: 13.0827,
        longitude: 80.2707,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const coords = await locationService.getCoordinates();
            if (coords) {
                setRegion({
                    ...region,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                });
            }

            const api = await apiClient();
            const response = await api.get('/api/authorities/safe-areas');
            setSafeAreas(response.data);
        } catch (error) {
            console.error('Error loading safe areas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMapPress = (event: MapPressEvent) => {
        if (isMarking) {
            const { latitude, longitude } = event.nativeEvent.coordinate;
            setNewAreaLocation({ latitude, longitude });
            vibrationService.light();
        }
    };

    const handleSaveArea = async () => {
        if (!newAreaLocation) {
            Alert.alert('Error', 'Please tap on the map to select a location');
            return;
        }

        setSaving(true);
        try {
            const api = await apiClient();
            await api.post('/api/authorities/safe-areas', {
                latitude: newAreaLocation.latitude,
                longitude: newAreaLocation.longitude,
                radius_km: newAreaRadius,
                description: newAreaDescription || null,
            });

            vibrationService.success();
            Alert.alert('Success', 'Safe area marked successfully');

            // Reset and reload
            setIsMarking(false);
            setNewAreaLocation(null);
            setNewAreaRadius(0.5);
            setNewAreaDescription('');
            loadData();
        } catch (error: any) {
            vibrationService.error();
            Alert.alert('Error', error?.response?.data?.detail || 'Failed to save safe area');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (areaId: number, currentActive: boolean) => {
        try {
            const api = await apiClient();
            await api.put(`/api/authorities/safe-areas/${areaId}`, {
                is_active: !currentActive,
            });

            vibrationService.success();
            loadData();
        } catch (error: any) {
            vibrationService.error();
            Alert.alert('Error', error?.response?.data?.detail || 'Failed to update safe area');
        }
    };

    const handleDeleteArea = (areaId: number) => {
        Alert.alert(
            'Deactivate Safe Area',
            'Are you sure you want to deactivate this safe area?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Deactivate',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const api = await apiClient();
                            await api.delete(`/api/authorities/safe-areas/${areaId}`);
                            vibrationService.success();
                            loadData();
                        } catch (error: any) {
                            vibrationService.error();
                            Alert.alert('Error', 'Failed to deactivate safe area');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4caf50" />
                    <Text style={styles.loadingText}>Loading safe areas...</Text>
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
                <Text style={styles.title}>🟢 Safe Area Management</Text>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    region={region}
                    onRegionChangeComplete={setRegion}
                    onPress={handleMapPress}
                    showsUserLocation={true}
                >
                    {/* Existing safe areas */}
                    {safeAreas.map((area) => (
                        <React.Fragment key={area.id}>
                            <Circle
                                center={{
                                    latitude: area.latitude,
                                    longitude: area.longitude,
                                }}
                                radius={area.radius_km * 1000}
                                fillColor={area.is_active ? 'rgba(76, 175, 80, 0.2)' : 'rgba(158, 158, 158, 0.2)'}
                                strokeColor={area.is_active ? '#4caf50' : '#9e9e9e'}
                                strokeWidth={2}
                            />
                            <Marker
                                coordinate={{
                                    latitude: area.latitude,
                                    longitude: area.longitude,
                                }}
                                title={area.description || 'Safe Area'}
                                description={`Radius: ${area.radius_km}km | ${area.is_active ? 'Active' : 'Inactive'}`}
                                pinColor={area.is_active ? '#4caf50' : '#9e9e9e'}
                            />
                        </React.Fragment>
                    ))}

                    {/* New area preview */}
                    {newAreaLocation && (
                        <>
                            <Circle
                                center={newAreaLocation}
                                radius={newAreaRadius * 1000}
                                fillColor="rgba(33, 150, 243, 0.3)"
                                strokeColor="#2196f3"
                                strokeWidth={3}
                            />
                            <Marker
                                coordinate={newAreaLocation}
                                pinColor="#2196f3"
                                title="New Safe Area"
                                description={`Radius: ${newAreaRadius}km`}
                            />
                        </>
                    )}
                </MapView>

                {isMarking && (
                    <View style={styles.markingOverlay}>
                        <Text style={styles.markingText}>👆 Tap on map to select location</Text>
                    </View>
                )}
            </View>

            {/* Controls Panel */}
            <View style={styles.controlsPanel}>
                {!isMarking ? (
                    <>
                        <TouchableOpacity
                            style={styles.markButton}
                            onPress={() => setIsMarking(true)}
                        >
                            <Text style={styles.markButtonText}>➕ Mark New Safe Area</Text>
                        </TouchableOpacity>

                        {/* Safe Area List */}
                        <View style={styles.areaList}>
                            <Text style={styles.listTitle}>Your Safe Areas ({safeAreas.length})</Text>
                            {safeAreas.slice(0, 3).map((area) => (
                                <View key={area.id} style={styles.areaItem}>
                                    <View style={styles.areaInfo}>
                                        <Text style={[styles.areaStatus, { color: area.is_active ? '#4caf50' : '#9e9e9e' }]}>
                                            {area.is_active ? '🟢' : '⚪'}
                                        </Text>
                                        <Text style={styles.areaText}>
                                            {area.description || `Area ${area.id}`} ({area.radius_km}km)
                                        </Text>
                                    </View>
                                    <View style={styles.areaActions}>
                                        <TouchableOpacity
                                            onPress={() => handleToggleActive(area.id, area.is_active)}
                                            style={styles.areaActionBtn}
                                        >
                                            <Text style={styles.areaActionText}>
                                                {area.is_active ? 'Disable' : 'Enable'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteArea(area.id)}
                                            style={[styles.areaActionBtn, styles.deleteBtn]}
                                        >
                                            <Text style={styles.deleteText}>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </>
                ) : (
                    <View style={styles.newAreaControls}>
                        <Text style={styles.controlLabel}>Radius: {newAreaRadius.toFixed(1)} km</Text>
                        <Slider
                            style={styles.slider}
                            minimumValue={0.1}
                            maximumValue={2}
                            step={0.1}
                            value={newAreaRadius}
                            onValueChange={setNewAreaRadius}
                            minimumTrackTintColor="#4caf50"
                            maximumTrackTintColor="#ddd"
                            thumbTintColor="#4caf50"
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Description (optional)"
                            placeholderTextColor="#999"
                            value={newAreaDescription}
                            onChangeText={setNewAreaDescription}
                        />

                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setIsMarking(false);
                                    setNewAreaLocation(null);
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, !newAreaLocation && styles.disabledButton]}
                                onPress={handleSaveArea}
                                disabled={!newAreaLocation || saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save Safe Area</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
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
    markingOverlay: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(33, 150, 243, 0.9)',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    markingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    controlsPanel: {
        backgroundColor: '#16213e',
        padding: 16,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    markButton: {
        backgroundColor: '#4caf50',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    markButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    areaList: { marginTop: 8 },
    listTitle: { color: '#aaa', fontSize: 14, marginBottom: 8 },
    areaItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0f0f23',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    areaInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    areaStatus: { fontSize: 16, marginRight: 8 },
    areaText: { color: '#fff', fontSize: 14, flex: 1 },
    areaActions: { flexDirection: 'row', gap: 8 },
    areaActionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#2a2a4e',
        borderRadius: 6,
    },
    areaActionText: { color: '#4caf50', fontSize: 12, fontWeight: '600' },
    deleteBtn: { backgroundColor: '#ff444422' },
    deleteText: { fontSize: 14 },
    newAreaControls: { paddingTop: 8 },
    controlLabel: { color: '#fff', fontSize: 14, marginBottom: 8 },
    slider: { width: '100%', height: 40 },
    input: {
        backgroundColor: '#0f0f23',
        color: '#fff',
        padding: 14,
        borderRadius: 8,
        marginTop: 12,
        fontSize: 16,
    },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelButton: {
        flex: 1,
        backgroundColor: '#2a2a4e',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    saveButton: {
        flex: 2,
        backgroundColor: '#4caf50',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    disabledButton: { backgroundColor: '#4caf5066' },
});

export default SafeAreaManagementScreen;
