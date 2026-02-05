import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { voiceService } from './voiceService';
import { vibrationService } from './vibrationService';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data;

        // Play voice alert for disaster alerts
        if (data.type === 'disaster_alert' || data.type === 'verification_request') {
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

            // Try to get push token - this may fail if Firebase is not configured
            try {
                // const tokenData = await Notifications.getExpoPushTokenAsync({
                //     projectId: Constants.expoConfig?.extra?.eas?.projectId,
                // });
                const tokenData = await Notifications.getExpoPushTokenAsync();

                console.log('Expo Push Token:', tokenData.data);
                return tokenData.data;
            } catch (tokenError: any) {
                // Firebase not configured - log and continue without push token
                // Local notifications will still work
                console.warn(
                    'Push token registration failed. Firebase may not be configured.',
                    'Local notifications will still work.',
                    tokenError.message
                );

                // Return a placeholder token for development
                // The app will still function with local notifications
                return 'local-notifications-only';
            }
        } catch (error) {
            console.error('Error setting up notifications:', error);
            return null;
        }
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
