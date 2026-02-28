# Backend Routes Integration Status

## ✅ Routes Currently Used in Frontend

### Disasters
- `GET /api/disasters/active` - HomeScreen, RecentAlertsScreen
- `GET /api/disasters/{id}` - DisasterDetailsScreen
- `POST /api/disasters/upload` - UploadDisasterScreen
- `POST /api/disasters/{id}/verify` - VerificationScreen
- `POST /api/disasters/demo` - HomeScreen (emergency demo button)

### Devices
- `POST /api/devices/register` - notificationService
- `POST /api/devices/heartbeat` - notificationService (enhanced with location)  
- `PUT /api/devices/link-user` - notificationService

### Authorities
- `GET /api/authorities/nearest` - emergencyCallService ✅ NEW
- `POST /api/authorities/emergency-call` - emergencyCallService ✅ NEW

### Locations
- `POST /api/locations/emergency-update` - emergencyModeService
- `POST /api/locations/stop-emergency` - emergencyModeService

## ⚠️ Routes NOT YET Used in Frontend

### Evacuation Routes
1. **`POST /api/devices/location`** - Track device movement for crowd analysis
   - **Purpose**: Anonymous location tracking during disasters
   - **Integration Needed**: Emergency mode service or disaster map

2. **`GET /api/evacuation/direction`** - Get evacuation recommendations
   - **Purpose**: Find nearest safe area or crowd movement direction
   - **Integration Needed**: EvacuationScreen (already has this!)
   - **STATUS**: Already used in `EvacuationScreen.tsx` ✅

3. **`POST /api/evacuation/trigger-crowd-alert`** - Backend-triggered crowd alerts
   - **Purpose**: Send evacuation notifications when crowd pattern detected
   - **Integration Needed**: This is called by backend automatically, NOT frontend
  - **STATUS**: Backend-only endpoint ✅

### Safe Areas
1. **`GET /api/safe-areas/nearby`** - Find nearest safe zones
   - **Purpose**: Show safe evacuation points on map
   - **Integration Needed**: AlertsMapScreen, EvacuationScreen

2. **`POST /api/authorities/safe-areas`** - Create safe area (authority only)
   - **Integration Needed**: Authority dashboard

3. **`GET /api/authorities/safe-areas`** - List authority's safe areas
   - **Integration Needed**: Authority dashboard

4. **`PUT /api/authorities/safe-areas/{id}`** - Update safe area
   - **Integration Needed**: Authority dashboard

5. **`DELETE /api/authorities/safe-areas/{id}`** - Deactivate safe area
   - **Integration Needed**: Authority dashboard

### Predictions (AI Early Warnings)
1. **`GET /api/predictions/active`** - Get active AI predictions
   - **Purpose**: Show AI-detected threats on map/alerts
   - **Integration Needed**: RecentAlertsScreen, AlertsMapScreen

2. **`GET /api/predictions/{id}`** - Get specific prediction details
   - **Integration Needed**: PredictionDetailsScreen (new screen)

3. **`POST /api/predictions/{id}/verify`** - Authority verifies/cancels prediction
   - **Integration Needed**: Authority dashboard

### Admin Routes
1. **`POST /api/admin/test-broadcast`** - Test push notifications
   - **Integration Needed**: SettingsScreen ✅ ALREADY USED

2. **`POST /api/admin/external-alerts`** - Receive social media crawler alerts
   - **Integration Needed**: Backend-only (social-crawler service)

3. **`GET /api/admin/external-alerts`** - View external alerts
   - **Integration Needed**: Authority dashboard

4. **`GET /api/admin/notification-logs`** - View notification history
   - **Integration Needed**: Authority dashboard

5. **`POST /api/admin/check-region-disconnects`** - Manual trigger disconnect detection
   - **Integration Needed**: Authority dashboard (testing)

### Emergency Call Routes (NEW)
1. **`POST /api/authorities/emergency-call/{id}/stop-sharing`** - Stop location sharing
   - **Integration Needed**: emergencyCallService ✅ ALREADY IMPLEMENTED

2. **`GET /api/authorities/emergency-calls`** - View incoming emergency calls
   - **Integration Needed**: Authority dashboard

### Region Disconnect Alerts (NEW)
1. **`GET /api/authorities/region-alerts`** - View disconnect alerts
   - **Integration Needed**: Authority dashboard

2. **`PUT /api/authorities/region-alerts/{id}/status`** - Update alert status
   - **Integration Needed**: Authority dashboard

---

## 🎯 Priority Integrations Needed

### High Priority (User-Facing)
1. ✅ **Safe Areas on Map** - Integrate `GET /api/safe-areas/nearby` into AlertsMapScreen
2. ✅ **AI Predictions Display** - Show `GET /api/predictions/active` in RecentAlertsScreen
3. **Device Movement Tracking** - Send `POST /api/devices/location` during emergency mode

### Medium Priority (Authority Dashboard)
-All authority-specific routes are for the web dashboard, not mobile app

### Low Priority (Backend/Admin)
- Most admin routes are for internal testing or backend-to-backend communication

---

## 📝 Implementation Plan

### Task 1: Add Safe Areas to Map ✅
**File**: `frontend/src/screens/AlertsMapScreen.tsx`
**Route**: `GET /api/safe-areas/nearby?lat=...&lng=...&radius_km=20`
**UI**: Green circles showing safe evacuation zones

### Task 2: Display AI Predictions ✅
**File**: `frontend/src/screens/RecentAlertsScreen.tsx`
**Route**: `GET /api/predictions/active`
**UI**: Section for "AI Early Warnings" with confidence scores

### Task 3: Track Movement in Emergency Mode
**File**: `frontend/src/services/emergencyModeService.ts`
**Route**: `POST /api/devices/location`
**Trigger**: Send location every 30 seconds during emergency mode
