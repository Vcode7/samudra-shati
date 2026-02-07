/**
 * Shake Detection Service
 * 
 * Detects 3-4 strong shakes within 2 seconds using accelerometer.
 * Triggers emergency recording when shake is detected.
 */

import { Accelerometer } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';
import { vibrationService } from './vibrationService';
import { Audio } from 'expo-av';

// Thresholds for shake detection
const SHAKE_THRESHOLD = 2.5;  // Acceleration threshold (in g)
const SHAKE_COUNT_REQUIRED = 3;  // Minimum shakes needed
const SHAKE_TIMEOUT_MS = 2000;  // Time window for shakes
const COOLDOWN_MS = 10000;  // Cooldown between triggers

interface ShakeEvent {
    timestamp: number;
    acceleration: number;
}

class ShakeDetectionService {
    private subscription: Subscription | null = null;
    private shakeEvents: ShakeEvent[] = [];
    private lastTriggerTime: number = 0;
    private onShakeCallback: (() => void) | null = null;
    private isEnabled: boolean = false;
    private alertSound: Audio.Sound | null = null;

    /**
     * Start listening for shake gestures
     */
    async start(onShake: () => void) {
        if (this.isEnabled) return;

        this.onShakeCallback = onShake;
        this.isEnabled = true;

        // Set accelerometer update interval
        Accelerometer.setUpdateInterval(100);  // 10 times per second

        this.subscription = Accelerometer.addListener(({ x, y, z }) => {
            // Calculate total acceleration magnitude
            const acceleration = Math.sqrt(x * x + y * y + z * z);

            // Check if this is a shake (minus gravity ~1g)
            if (acceleration > SHAKE_THRESHOLD) {
                this.recordShake(acceleration);
            }
        });

        console.log('[Shake] Detection started');
    }

    /**
     * Stop listening for shake gestures
     */
    stop() {
        if (this.subscription) {
            this.subscription.remove();
            this.subscription = null;
        }
        this.isEnabled = false;
        this.shakeEvents = [];
        console.log('[Shake] Detection stopped');
    }

    /**
     * Record a shake event and check if threshold is met
     */
    private recordShake(acceleration: number) {
        const now = Date.now();

        // Check cooldown
        if (now - this.lastTriggerTime < COOLDOWN_MS) {
            return;
        }

        // Add shake event
        this.shakeEvents.push({ timestamp: now, acceleration });

        // Remove old events outside the time window
        this.shakeEvents = this.shakeEvents.filter(
            event => now - event.timestamp < SHAKE_TIMEOUT_MS
        );

        // Check if we have enough shakes
        if (this.shakeEvents.length >= SHAKE_COUNT_REQUIRED) {
            this.triggerShakeAction();
        }
    }

    /**
     * Trigger the shake action callback
     */
    private async triggerShakeAction() {
        this.lastTriggerTime = Date.now();
        this.shakeEvents = [];

        console.log('[Shake] Shake detected! Triggering action...');

        // Haptic feedback
        vibrationService.emergencyPattern();

        // Play alert sound
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/shake_alert.mp3'),
                { shouldPlay: true, volume: 1.0 }
            );
            this.alertSound = sound;

            // Cleanup after playback
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            // If audio file doesn't exist, use system vibration only
            console.log('[Shake] Alert sound not found, using vibration only');
        }

        // Call the callback
        if (this.onShakeCallback) {
            this.onShakeCallback();
        }
    }

    /**
     * Check if shake detection is currently active
     */
    isActive(): boolean {
        return this.isEnabled;
    }
}

export const shakeDetectionService = new ShakeDetectionService();
