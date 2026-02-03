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
                notification.request.content.title,
                notification.request.content.body,
                messages
            );

            vibrationService.emergencyPattern();
        }

        return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
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

            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: Constants.expoConfig?.extra?.eas?.projectId,
            });

            console.log('Expo Push Token:', tokenData.data);

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

            return tokenData.data;
        } catch (error) {
            console.error('Error registering for push notifications:', error);
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
