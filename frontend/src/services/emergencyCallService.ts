/**
 * Emergency Call Service
 * 
 * Handles one-tap emergency calls to nearest authority
 */

import { Linking, Alert } from 'react-native';
import { apiClient } from './api';
import * as Location from 'expo-location';

export interface NearestAuthority {
    authority_id: number;
    organization_name: string;
    authority_type: 'police' | 'medical' | 'fire' | 'coast_guard' | 'ndrf';
    contact_number: string;
    base_latitude: number;
    base_longitude: number;
    distance_km: number;
}

export class EmergencyCallService {
    private static currentCallLogId: number | null = null;
    private static isLocationSharing: boolean = false;

    /**
     * Get nearest authority based on current location
     */
    static async getNearestAuthority(): Promise<NearestAuthority | null> {
        try {
            // Get current location
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required for emergency calls');
                return null;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const { latitude, longitude } = location.coords;

            // Call backend to find nearest authority
            const api = await apiClient();
            const response = await api.get('/api/authorities/nearest', {
                params: { lat: latitude, lng: longitude },
            });

            return response.data as NearestAuthority;
        } catch (error) {
            console.error('Error getting nearest authority:', error);
            Alert.alert('Error', 'Could not find nearest authority');
            return null;
        }
    }

    /**
     * Initiate emergency call to nearest authority
     */
    static async initiateEmergencyCall(deviceId: string): Promise<void> {
        try {
            // Get nearest authority
            const authority = await this.getNearestAuthority();
            if (!authority) {
                return;
            }

            // Get current location
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const { latitude, longitude } = location.coords;

            // Log the emergency call to backend
            const api = await apiClient();
            const response = await api.post('/api/authorities/emergency-call', {
                device_id: deviceId,
                authority_id: authority.authority_id,
                latitude,
                longitude,
            });

            this.currentCallLogId = response.data.call_log_id;
            this.isLocationSharing = true;

            // Show confirmation with authority details
            Alert.alert(
                '📞 Calling Emergency Services',
                `Connecting to: ${authority.organization_name}\nType: ${authority.authority_type}\nDistance: ${authority.distance_km.toFixed(1)} km\n\n📡 Your location is being shared with authorities`,
                [
                    {
                        text: 'Call Now',
                        onPress: () => {
                            // Initiate phone call
                            const phoneUrl = `tel:${authority.contact_number}`;
                            Linking.openURL(phoneUrl);
                        },
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: async () => {
                            await this.stopLocationSharing();
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Error initiating emergency call:', error);
            Alert.alert('Error', 'Could not initiate emergency call');
        }
    }

    /**
     * Stop sharing location with authorities
     */
    static async stopLocationSharing(): Promise<void> {
        if (!this.currentCallLogId) {
            return;
        }

        try {
            const api = await apiClient();
            await api.post(`/api/authorities/emergency-call/${this.currentCallLogId}/stop-sharing`);

            this.currentCallLogId = null;
            this.isLocationSharing = false;

            console.log('Location sharing stopped');
        } catch (error) {
            console.error('Error stopping location sharing:', error);
        }
    }

    /**
     * Check if currently sharing location
     */
    static isCurrentlySharing(): boolean {
        return this.isLocationSharing;
    }

    /**
     * Get list of all available authorities with distances
     */
    static async getAllAuthorities(): Promise<any[]> {
        try {
            const api = await apiClient();
            const response = await api.get('/api/authorities/nearby');
            return response.data;
        } catch (error) {
            console.error('Error getting authorities:', error);
            return [];
        }
    }
}
