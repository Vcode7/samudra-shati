const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin to add Google Maps API key to AndroidManifest.xml
 * This ensures the API key is added during prebuild
 */
function withGoogleMapsApiKey(config, { apiKey }) {
    return withAndroidManifest(config, (config) => {
        const androidManifest = config.modResults;
        const application = androidManifest.manifest.application?.[0];

        if (application) {
            // Ensure meta-data array exists
            if (!application['meta-data']) {
                application['meta-data'] = [];
            }

            // Check if the API key already exists
            const existingMetaData = application['meta-data'].find(
                (meta) => meta.$?.['android:name'] === 'com.google.android.geo.API_KEY'
            );

            if (!existingMetaData) {
                // Add Google Maps API key
                application['meta-data'].push({
                    $: {
                        'android:name': 'com.google.android.geo.API_KEY',
                        'android:value': apiKey,
                    },
                });
            }
        }

        return config;
    });
}

module.exports = withGoogleMapsApiKey;
