export default {
  expo: {
    name: "Sankat saathi",
    slug: "samudar-shati",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0066cc"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.samudarshati.app",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0066cc"
      },
      package: "com.samudarshati.app",
      googleServicesFile: "./google-services.json",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "VIBRATE"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#0066cc"
        }
      ],
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission":
            "Allow Sankat saathi to use your location to show nearby disasters."
        }
      ],
      [
        "./plugins/withGoogleMapsApiKey.js",
        {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "61d9d855-a65d-4dbc-afd4-4f7c69196e22"
      }
    }
  }
};
