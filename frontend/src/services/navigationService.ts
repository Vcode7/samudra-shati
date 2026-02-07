/**
 * Navigation Service
 * 
 * Provides global navigation access for deep linking from notifications
 * and other non-component contexts.
 */

import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

// Create a navigation ref that can be accessed globally
export const navigationRef = createNavigationContainerRef();

/**
 * Navigate to a screen from anywhere in the app
 */
export function navigate(name: string, params?: any) {
    if (navigationRef.isReady()) {
        navigationRef.dispatch(
            CommonActions.navigate({
                name,
                params,
            })
        );
    } else {
        // Queue navigation for when ready
        console.log('[Navigation] Not ready, queuing navigate to:', name);
        setTimeout(() => navigate(name, params), 100);
    }
}

/**
 * Navigate to AlertsMap with disaster context
 */
export function navigateToDisasterMap(disaster: {
    disaster_id: number;
    latitude: number;
    longitude: number;
    danger_radius_km?: number;
    location_name?: string;
}) {
    navigate('AlertsMap', {
        focusDisaster: disaster,
        centerOnDisaster: true,
    });
}

/**
 * Navigate to EvacuationGuidance screen
 */
export function navigateToEvacuation(disaster: {
    disaster_id: number;
    latitude: number;
    longitude: number;
}) {
    navigate('EvacuationGuidance', {
        disaster_id: disaster.disaster_id,
        disaster_location: {
            latitude: disaster.latitude,
            longitude: disaster.longitude,
        },
    });
}

export const navigationService = {
    navigationRef,
    navigate,
    navigateToDisasterMap,
    navigateToEvacuation,
};
