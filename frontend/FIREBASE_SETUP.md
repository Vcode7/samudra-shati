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

## Step 5: Configure FCM Credentials with Expo (CRITICAL!)

**This step is REQUIRED for push notifications to work on Android devices.**

The error "Unable to retrieve the FCM server key for the recipient's app" means Expo needs your Firebase credentials to deliver notifications.

### Option A: Using EAS Build (Recommended)

If you're using EAS Build, Expo automatically handles FCM setup:

1. Make sure `google-services.json` is in the `frontend/` folder
2. Build with EAS: `eas build --platform android`
3. The credentials are automatically picked up

### Option B: Using Expo Push Credentials

For development builds or Expo Go, you need to upload FCM credentials:

1. **Get Firebase Service Account JSON:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file

2. **Upload to Expo:**
   ```bash
   # Login to EAS first
   eas login
   
   # Upload the FCM V1 credentials
   eas credentials -p android
   ```
   
   Then select:
   - "Push Notifications: Manage your FCM V1 credentials"
   - "Upload a Service Account Key"
   - Choose your downloaded JSON file

3. **Alternative: Using Legacy FCM Server Key (Deprecated but works):**
   - Go to Firebase Console → Project Settings → Cloud Messaging
   - Enable "Cloud Messaging API (Legacy)" if disabled
   - Copy the "Server key"
   - Run:
     ```bash
     npx expo push:android:upload --api-key YOUR_SERVER_KEY
     ```

### Verifying the Setup

After uploading credentials, rebuild your app and test:

```bash
# Check your push credentials
eas credentials -p android

# Test with a curl (replace token)
curl -H "Content-Type: application/json" \
  -X POST https://exp.host/--/api/v2/push/send \
  -d '{"to": "ExponentPushToken[YOUR_TOKEN]", "title": "Test", "body": "Hello!"}'
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
