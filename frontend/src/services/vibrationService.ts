import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Store interval ID for continuous vibration
let emergencyIntervalId: NodeJS.Timeout | null = null;
let isEmergencyActive = false;

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

    /**
     * Start continuous emergency vibration pattern
     * Vibrates every 3 seconds until stopped
     */
    startContinuousEmergency(): void {
        if (isEmergencyActive) return; // Already running

        isEmergencyActive = true;

        // Vibrate immediately
        this.emergencyPattern();

        // Then vibrate every 3 seconds
        emergencyIntervalId = setInterval(() => {
            if (isEmergencyActive) {
                this.emergencyPattern();
            }
        }, 3000);

        console.log('Continuous emergency vibration started');
    },

    /**
     * Stop continuous emergency vibration
     */
    stopContinuousEmergency(): void {
        isEmergencyActive = false;

        if (emergencyIntervalId) {
            clearInterval(emergencyIntervalId);
            emergencyIntervalId = null;
        }

        console.log('Continuous emergency vibration stopped');
    },

    /**
     * Check if emergency vibration is currently active
     */
    isEmergencyVibrationActive(): boolean {
        return isEmergencyActive;
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
