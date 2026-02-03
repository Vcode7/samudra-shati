import * as Location from 'expo-location';

export const locationService = {
    async requestPermissions(): Promise<boolean> {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('Error requesting location permissions:', error);
            return false;
        }
    },

    async getCurrentLocation(): Promise<Location.LocationObject | null> {
        try {
            const hasPermission = await this.requestPermissions();

            if (!hasPermission) {
                console.log('Location permission not granted');
                return null;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            return location;
        } catch (error) {
            console.error('Error getting current location:', error);
            return null;
        }
    },

    async getCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
        const location = await this.getCurrentLocation();

        if (!location) {
            return null;
        }

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };
    },

    async reverseGeocode(
        latitude: number,
        longitude: number
    ): Promise<string | null> {
        try {
            const results = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (results.length > 0) {
                const address = results[0];
                const parts = [
                    address.name,
                    address.street,
                    address.city,
                    address.region,
                ].filter(Boolean);

                return parts.join(', ');
            }

            return null;
        } catch (error) {
            console.error('Error reverse geocoding:', error);
            return null;
        }
    },

    calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371;
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) *
            Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    },

    toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    },

    formatDistance(km: number): string {
        if (km < 1) {
            return `${Math.round(km * 1000)}m`;
        } else if (km < 10) {
            return `${km.toFixed(1)}km`;
        } else {
            return `${Math.round(km)}km`;
        }
    },
};
