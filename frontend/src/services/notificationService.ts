import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { voiceService } from './voiceService';
import { vibrationService } from './vibrationService';
import { apiClient } from './api';

// Storage keys
const DEVICE_ID_KEY = 'device_id';
const PUSH_TOKEN_KEY = 'expo_push_token';
const DEVICE_REGISTERED_KEY = 'device_registered';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data;

        // Play voice alert for disaster alerts
        if (data.type === 'disaster_alert' || data.type === 'verification_request' || data.type === 'external_alert' || data.type === 'test_broadcast') {
            const messages = data.messages || {};

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
};

