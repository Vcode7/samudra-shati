import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vibrationService } from './vibrationService';
import { apiClient } from './api';

// Storage keys
const EMERGENCY_ACTIVE_KEY = 'emergency_mode_active';
const EMERGENCY_DISASTER_KEY = 'emergency_disaster_id';

// Location tracking interval (10 seconds)
const LOCATION_UPDATE_INTERVAL = 10000;

interface DisasterLocation {
    disaster_id: number;
    latitude: number;
    longitude: number;
    danger_radius_km: number;
    location_name: string;
}

interface RadiusCheckResult {
    in_danger_zone: boolean;
    distance_km: number;
    should_vibrate: boolean;
}

let locationSubscription: Location.LocationSubscription | null = null;
let locationIntervalId: NodeJS.Timeout | null = null;
let currentDisaster: DisasterLocation | null = null;
let isEmergencyModeActive = false;

// Callback for UI updates
let onEmergencyStateChange: ((active: boolean, disaster: DisasterLocation | null) => void) | null = null;

export const emergencyModeService = {
    /**
     * Set callback for emergency state changes (for UI updates)
     */
    setStateChangeCallback(callback: (active: boolean, disaster: DisasterLocation | null) => void): void {
        onEmergencyStateChange = callback;
    },

    /**
     * Check if emergency mode is currently active
     */
    isActive(): boolean {
        return isEmergencyModeActive;
    },

    /**
     * Get current disaster info
     */
    getCurrentDisaster(): DisasterLocation | null {
        return currentDisaster;
    },

    /**
     * Activate emergency mode for a specific disaster
     */
    async activate(disaster: DisasterLocation): Promise<void> {
        if (isEmergencyModeActive && currentDisaster?.disaster_id === disaster.disaster_id) {
            console.log('Emergency mode already active for this disaster');
            return;
        }

        console.log('Activating emergency mode for disaster:', disaster);

        currentDisaster = disaster;
        isEmergencyModeActive = true;

        // Persist state
        await AsyncStorage.setItem(EMERGENCY_ACTIVE_KEY, 'true');
        await AsyncStorage.setItem(EMERGENCY_DISASTER_KEY, JSON.stringify(disaster));

        // Request location permissions if needed
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('Location permission not granted for emergency mode');
        }

        // Start continuous vibration
        vibrationService.startContinuousEmergency();

        // Start location tracking
        this.startLocationTracking();

        // Notify UI
        if (onEmergencyStateChange) {
            onEmergencyStateChange(true, disaster);
        }
    },

    /**
     * Deactivate emergency mode
     */
    async deactivate(): Promise<void> {
        console.log('Deactivating emergency mode');

        isEmergencyModeActive = false;
        currentDisaster = null;

        // Clear persisted state
        await AsyncStorage.removeItem(EMERGENCY_ACTIVE_KEY);
        await AsyncStorage.removeItem(EMERGENCY_DISASTER_KEY);

        // Stop vibration
        vibrationService.stopContinuousEmergency();

        // Stop location tracking
        this.stopLocationTracking();

        // Notify UI
        if (onEmergencyStateChange) {
            onEmergencyStateChange(false, null);
        }
    },

    /**
     * Silence vibration but keep emergency mode active (user tapped "Silence")
     */
    silenceVibration(): void {
        vibrationService.stopContinuousEmergency();
        console.log('Emergency vibration silenced by user');
    },

    /**
     * Resume vibration after silencing
     */
    resumeVibration(): void {
        if (isEmergencyModeActive) {
            vibrationService.startContinuousEmergency();
        }
    },

    /**
     * Start tracking user location and sending updates to server
     */
    startLocationTracking(): void {
        if (locationIntervalId) return; // Already tracking

        console.log('Starting location tracking for emergency mode');

        // Send location updates every 10 seconds
        locationIntervalId = setInterval(async () => {
            if (!isEmergencyModeActive || !currentDisaster) {
                this.stopLocationTracking();
                return;
            }

            try {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });

                await this.checkRadiusAndUpdateVibration({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    accuracy: location.coords.accuracy || undefined,
                });
            } catch (error) {
                console.error('Error getting location:', error);
            }
        }, LOCATION_UPDATE_INTERVAL);

        // Also do an immediate check
        this.checkCurrentLocation();
    },

    /**
     * Stop location tracking
     */
    stopLocationTracking(): void {
        if (locationIntervalId) {
            clearInterval(locationIntervalId);
            locationIntervalId = null;
        }

        if (locationSubscription) {
            locationSubscription.remove();
            locationSubscription = null;
        }

        console.log('Location tracking stopped');
    },

    /**
     * Check current location immediately
     */
    async checkCurrentLocation(): Promise<RadiusCheckResult | null> {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            return await this.checkRadiusAndUpdateVibration({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy || undefined,
            });
        } catch (error) {
            console.error('Error checking current location:', error);
            return null;
        }
    },

    /**
     * Check if user is in danger zone and update vibration accordingly
     */
    async checkRadiusAndUpdateVibration(userLocation: {
        latitude: number;
        longitude: number;
        accuracy?: number;
    }): Promise<RadiusCheckResult> {
        if (!currentDisaster) {
            return { in_danger_zone: false, distance_km: 999, should_vibrate: false };
        }

        try {
            // Get device ID for tracking
            const deviceId = await AsyncStorage.getItem('device_id') || 'unknown';

            // Send location update to server
            const api = await apiClient();
            const response = await api.post('/api/locations/update', {
                device_id: deviceId,
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                disaster_id: currentDisaster.disaster_id,
                accuracy: userLocation.accuracy,
            });

            const result: RadiusCheckResult = {
                in_danger_zone: response.data.in_danger_zone,
                distance_km: response.data.distance_km,
                should_vibrate: response.data.should_vibrate,
            };

            console.log('Radius check result:', result);

            // Update vibration based on result
            if (!result.in_danger_zone) {
                // User has left the danger zone - stop vibration and deactivate
                console.log('User left danger zone - stopping emergency mode');
                await this.deactivate();
            } else if (result.should_vibrate && !vibrationService.isEmergencyVibrationActive()) {
                // User is in danger zone but vibration stopped - restart it
                vibrationService.startContinuousEmergency();
            }

            return result;
        } catch (error) {
            console.error('Error checking radius:', error);

            // Fallback: calculate distance locally
            const distance = this.calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                currentDisaster.latitude,
                currentDisaster.longitude
            );

            const inDangerZone = distance <= currentDisaster.danger_radius_km;

            if (!inDangerZone) {
                await this.deactivate();
            }

            return {
                in_danger_zone: inDangerZone,
                distance_km: distance,
                should_vibrate: inDangerZone,
            };
        }
    },

    /**
     * Calculate distance between two points using Haversine formula
     */
    calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    /**
     * Restore emergency state from storage (called on app start)
     */
    async restoreState(): Promise<void> {
        try {
            const isActive = await AsyncStorage.getItem(EMERGENCY_ACTIVE_KEY);
            const disasterJson = await AsyncStorage.getItem(EMERGENCY_DISASTER_KEY);

            if (isActive === 'true' && disasterJson) {
                const disaster: DisasterLocation = JSON.parse(disasterJson);

                // Check if disaster is still active via API
                try {
                    const api = await apiClient();
                    const response = await api.get(`/api/disasters/${disaster.disaster_id}`);

                    if (response.data.alert_status === 'emergency_active') {
                        await this.activate(disaster);
                    } else {
                        await this.deactivate();
                    }
                } catch {
                    // If API fails, keep local state
                    await this.activate(disaster);
                }
            }
        } catch (error) {
            console.error('Error restoring emergency state:', error);
        }
    },
};
