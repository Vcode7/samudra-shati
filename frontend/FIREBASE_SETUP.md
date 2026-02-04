# Firebase Push Notifications Setup

This guide explains how to configure Firebase for push notifications in the Samudar Shati app.

## Current Status

The app currently **works without Firebase** configured - it will:
- Show a warning in console about Firebase not being configured
- Fall back to **local notifications** (still works!)
- Voice alerts and vibration patterns work perfectly

To enable **remote push notifications** from your backend, follow these steps.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** or **"Add project"**
3. Enter project name: `samudar-shati` (or your preferred name)
4. Enable/disable Google Analytics (optional)
5. Click **Create Project**

## Step 2: Add Android App to Firebase

1. In Firebase Console, click **"Add app"** → **Android**
2. Enter Android package name: `com.samudarshati.app`
3. App nickname: `Samudar Shati`
4. Click **Register app**
5. Download `google-services.json`

## Step 3: Configure the App

1. **Copy** the downloaded `google-services.json` to:
   ```
   frontend/google-services.json
   ```

2. The `app.json` is already configured with:
   ```json
   "android": {
     "googleServicesFile": "./google-services.json"
   }
   ```

## Step 4: Rebuild the App

After adding `google-services.json`, you need to rebuild:

```bash
cd frontend

# Clear any cached builds
npx expo prebuild --clean

# Run the app
npx expo run:android
# OR
npm run android
```

## Step 5: Get FCM Server Key (For Backend)

1. In Firebase Console → Project Settings → Cloud Messaging
2. Enable **Cloud Messaging API (Legacy)**
3. Copy the **Server key**
4. Add to your backend `.env`:
   ```
   FCM_SERVER_KEY=your_fcm_server_key_here
   ```

## Testing Push Notifications

### From Firebase Console
1. Go to **Engage** → **Messaging**
2. Click **New campaign** → **Notifications**
3. Enter notification title and text
4. Select your Android app
5. Click **Send test message**
6. Enter your device's push token (printed in app console)

### From Backend API
```bash
curl -X POST http://localhost:8000/api/test/push \
  -H "Content-Type: application/json" \
  -d '{"token": "your_expo_push_token", "title": "Test", "body": "Test message"}'
```

## Troubleshooting

### Error: "Default FirebaseApp is not initialized"
- Make sure `google-services.json` is in `frontend/` folder
- Rebuild the app with `npx expo prebuild --clean`

### Notifications not appearing
- Check device notification permissions
- Ensure the app has notification channel created
- Test with local notification first (Test Alert button)

### Push token is "local-notifications-only"
- Firebase is not configured (this is expected without google-services.json)
- Local notifications still work!

## Development Without Firebase

During development, you can test notifications without Firebase:

1. **Local Notifications** - Use the "Test Alert" button
2. **Voice Alerts** - Work independently of push notifications
3. **Vibration** - Works independently

The notification service will gracefully fall back to local notifications if Firebase is not configured.

## Google Maps API Key

For the map feature to work, you also need a Google Maps API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Maps SDK for Android** and **Maps SDK for iOS**
3. Create an API key
4. Replace `YOUR_GOOGLE_MAPS_API_KEY` in `app.json`:
   ```json
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "YOUR_ACTUAL_API_KEY"
       }
     }
   }
   ```

## EAS Build (Production)

For production builds with EAS:

1. Upload `google-services.json` as a secret:
   ```bash
   eas secret:create --name GOOGLE_SERVICES_JSON --scope project --type file --value ./google-services.json
   ```

2. Update `eas.json` to use the secret

3. Build:
   ```bash
   eas build --platform android
   ```
