import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const vibrationService = {
    emergencyPattern(): void {
        if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setTimeout(() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }, 500);
            setTimeout(() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }, 1000);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setTimeout(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }, 500);
            setTimeout(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }, 1000);
        }
    },

    verificationPattern(): void {
        if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    },

    success(): void {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },

    error(): void {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },

    light(): void {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },

    medium(): void {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },

    heavy(): void {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },

    selection(): void {
        Haptics.selectionAsync();
    },
};
