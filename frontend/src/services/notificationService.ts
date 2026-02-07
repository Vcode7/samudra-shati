import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { voiceService } from './voiceService';
import { vibrationService } from './vibrationService';
import { apiClient } from './api';
import { emergencyModeService } from './emergencyModeService';
import { locationService } from './locationService';
import { navigateToDisasterMap, navigateToEvacuation } from './navigationService';

// Storage keys
const DEVICE_ID_KEY = 'device_id';
const PUSH_TOKEN_KEY = 'expo_push_token';
const DEVICE_REGISTERED_KEY = 'device_registered';

// Notification action identifiers
const ACTION_VERIFY = 'VERIFY';
const ACTION_REJECT = 'REJECT';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data as {
            type?: string;
            messages?: Record<string, { title: string; body: string }>;
            disaster_id?: number;
            latitude?: number;
            longitude?: number;
            danger_radius_km?: number;
            location?: string;
            actions?: Array<{ identifier: string; title: string }>;
        };

        // Handle emergency mode activation
        if (data.type === 'emergency_active') {
            const messages = data.messages || {} as Record<string, { title: string; body: string }>;

            await voiceService.speakDualLanguage(
                notification.request.content.title || 'EMERGENCY ALERT',
                notification.request.content.body || '',
                messages
            );

            // Activate emergency mode with disaster info
            emergencyModeService.activate({
                disaster_id: data.disaster_id || 0,
                latitude: data.latitude || 0,
                longitude: data.longitude || 0,
                danger_radius_km: data.danger_radius_km || 1.0,
                location_name: data.location || 'Unknown Location',
            });

            return {
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
                shouldShowBanner: true,
                shouldShowList: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
            };
        }

        // Handle evacuation route notification
        if (data.type === 'evacuation_route') {
            const messages = data.messages || {} as Record<string, { title: string; body: string }>;

            await voiceService.speakDualLanguage(
                notification.request.content.title || 'Evacuation Alert',
                notification.request.content.body || '',
                messages
            );

            vibrationService.emergencyPattern();
        }

        // Play voice alert for disaster alerts
        if (data.type === 'disaster_alert' || data.type === 'verification_request' || data.type === 'external_alert' || data.type === 'test_broadcast') {
            const messages = data.messages || {} as Record<string, { title: string; body: string }>;

            await voiceService.speakDualLanguage(
                notification.request.content.title || 'Alert',
                notification.request.content.body || '',
                messages
            );

            vibrationService.emergencyPattern();
        }

        return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
        };
    },
});

// Handle notification action responses (Verify/Reject button taps + notification tap)
async function handleNotificationAction(response: Notifications.NotificationResponse) {
    const actionIdentifier = response.actionIdentifier;
    const data = response.notification.request.content.data as {
        type?: string;
        disaster_id?: number;
        latitude?: number;
        longitude?: number;
        danger_radius_km?: number;
        location?: string;
    };

    // Handle tap on notification body (open map)
    if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        console.log('[Notification] Tapped, navigating to map', data);

        // Navigate to map for emergency/disaster notifications
        if (data.type === 'emergency_active' || data.type === 'disaster_alert' || data.type === 'verification_request') {
            if (data.disaster_id && data.latitude && data.longitude) {
                navigateToDisasterMap({
                    disaster_id: data.disaster_id,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    danger_radius_km: data.danger_radius_km,
                    location_name: data.location,
                });
            }
        }

        // Navigate to evacuation screen for evacuation notifications
        if (data.type === 'evacuation_route') {
            if (data.disaster_id && data.latitude && data.longitude) {
                navigateToEvacuation({
                    disaster_id: data.disaster_id,
                    latitude: data.latitude,
                    longitude: data.longitude,
                });
            }
        }

        return;
    }

    // Handle Verify/Reject action buttons
    if (data.type !== 'verification_request' || !data.disaster_id) {
        return;
    }

    if (actionIdentifier === ACTION_VERIFY || actionIdentifier === ACTION_REJECT) {
        const isConfirmed = actionIdentifier === ACTION_VERIFY;

        try {
            // Get user's current location
            const coords = await locationService.getCoordinates();

            // Send verification to backend
            const api = await apiClient();
            await api.post(`/api/disasters/${data.disaster_id}/verify`, {
                disaster_report_id: data.disaster_id,
                is_confirmed: isConfirmed,
                latitude: coords?.latitude,
                longitude: coords?.longitude,
            });

            // Feedback to user
            vibrationService.success();

            // Schedule a local notification for feedback
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: isConfirmed ? '✅ Verified' : '❌ Rejected',
                    body: isConfirmed
                        ? 'Thank you for verifying this disaster report.'
                        : 'Thank you for your response.',
                    sound: 'default',
                },
                trigger: null,
            });

            // Navigate to map after verification
            if (data.latitude && data.longitude) {
                navigateToDisasterMap({
                    disaster_id: data.disaster_id,
                    latitude: data.latitude,
                    longitude: data.longitude,
                });
            }
        } catch (error: any) {
            console.error('Verification action failed:', error);
            vibrationService.error();

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '⚠️ Verification Failed',
                    body: error?.response?.data?.detail || 'Could not submit verification. Please try again.',
                    sound: 'default',
                },
                trigger: null,
            });
        }
    }
}

export const notificationService = {
    /**
     * Generate or retrieve a unique device ID
     */
    async getDeviceId(): Promise<string> {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

        if (!deviceId) {
            // Generate a unique device ID
            const deviceName = Device.deviceName || 'unknown';
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 10);
            deviceId = `${deviceName}-${timestamp}-${random}`;
            await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }

        return deviceId;
    },

    /**
     * Request notification permissions and get push token
     */
    async registerForPushNotifications(): Promise<string | null> {
        if (!Device.isDevice) {
            console.log('Push notifications only work on physical devices');
            return null;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Push notification permissions not granted');
                return null;
            }

            // Set up Android notification channel first
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('disaster-alerts', {
                    name: 'Disaster Alerts',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF0000',
                    sound: 'default',
                    enableVibrate: true,
                });

                // Set up notification categories with action buttons
                await Notifications.setNotificationCategoryAsync('verification', [
                    {
                        identifier: ACTION_VERIFY,
                        buttonTitle: '✅ Verify',
                        options: { opensAppToForeground: false },
                    },
                    {
                        identifier: ACTION_REJECT,
                        buttonTitle: '❌ Reject',
                        options: { opensAppToForeground: false },
                    },
                ]);

            }

            // Try to get push token
            try {
                const tokenData = await Notifications.getExpoPushTokenAsync();
                const token = tokenData.data;

                console.log('Expo Push Token:', token);
                await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

                return token;
            } catch (tokenError: any) {
                console.warn(
                    'Push token registration failed. Firebase may not be configured.',
                    tokenError.message
                );
                return 'local-notifications-only';
            }
        } catch (error) {
            console.error('Error setting up notifications:', error);
            return null;
        }
    },

    /**
     * Register device with backend for push notifications.
     * This does NOT require user authentication.
     * Should be called on first app open after permission is granted.
     */
    async registerDevice(): Promise<boolean> {
        try {
            // Check if already registered
            const isRegistered = await AsyncStorage.getItem(DEVICE_REGISTERED_KEY);
            const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

            // Get or create push token
            let token = storedToken;
            if (!token || token === 'local-notifications-only') {
                token = await this.registerForPushNotifications();
            }

            if (!token || token === 'local-notifications-only') {
                console.log('No valid push token available for device registration');
                return false;
            }

            // Get device info
            const deviceId = await this.getDeviceId();
            const platform = Platform.OS;

            // Register with backend (no auth required)
            const api = await apiClient();
            await api.post('/api/devices/register', {
                device_id: deviceId,
                expo_push_token: token,
                platform: platform
            });

            await AsyncStorage.setItem(DEVICE_REGISTERED_KEY, 'true');
            console.log('Device registered successfully:', deviceId);
            return true;
        } catch (error: any) {
            console.error('Device registration failed:', error?.response?.data || error.message);
            return false;
        }
    },

    /**
     * Link device to user after login
     */
    async linkDeviceToUser(): Promise<boolean> {
        try {
            const deviceId = await this.getDeviceId();
            const api = await apiClient();

            await api.put('/api/devices/link-user', {
                device_id: deviceId
            });

            console.log('Device linked to user:', deviceId);
            return true;
        } catch (error: any) {
            console.error('Failed to link device to user:', error?.response?.data || error.message);
            return false;
        }
    },

    /**
     * Send heartbeat to keep device active
     */
    async sendHeartbeat(): Promise<void> {
        try {
            const deviceId = await this.getDeviceId();
            const api = await apiClient();

            await api.post('/api/devices/heartbeat', {
                device_id: deviceId
            });
        } catch (error) {
            // Silent fail for heartbeat
            console.log('Heartbeat failed (non-critical)');
        }
    },

    /**
     * Check if device is already registered
     */
    async isDeviceRegistered(): Promise<boolean> {
        const isRegistered = await AsyncStorage.getItem(DEVICE_REGISTERED_KEY);
        return isRegistered === 'true';
    },

    /**
     * Get stored push token
     */
    async getStoredPushToken(): Promise<string | null> {
        return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    },

    addNotificationReceivedListener(
        callback: (notification: Notifications.Notification) => void
    ) {
        return Notifications.addNotificationReceivedListener(callback);
    },

    addNotificationResponseListener(
        callback: (response: Notifications.NotificationResponse) => void
    ) {
        return Notifications.addNotificationResponseReceivedListener(callback);
    },

    async scheduleLocalNotification(
        title: string,
        body: string,
        data?: any,
        seconds: number = 1
    ) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: 'default',
                priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: {
                seconds,
                channelId: 'disaster-alerts',
            },
        });
    },

    async cancelAllNotifications() {
        await Notifications.cancelAllScheduledNotificationsAsync();
    },

    async getPermissionsStatus() {
        const { status } = await Notifications.getPermissionsAsync();
        return status;
    },

    /**
     * Set up listener for notification action button responses
     * Should be called during app initialization
     */
    setupNotificationActionListener() {
        return Notifications.addNotificationResponseReceivedListener(handleNotificationAction);
    },
};
