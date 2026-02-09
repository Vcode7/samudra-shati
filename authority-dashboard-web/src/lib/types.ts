export type DisasterStatus = 'pending' | 'verified' | 'false_alarm' | 'resolved' | string;
export type DisasterAlertStatus = 'initial' | 'community_verified' | 'emergency_active' | 'resolved' | string;

export type DisasterReport = {
  id: number;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  description?: string | null;
  image_url?: string | null;
  severity_level: number;
  status: DisasterStatus;
  alert_status?: DisasterAlertStatus;
  danger_radius_km: number;
  created_at: string;
  distance_km?: number | null;
  ai_analysis?: string | null;
  verification_count_yes?: number;
  verification_count_no?: number;
};

// Zone types
export type ZoneType = 'safe' | 'service';

export interface Zone {
  id: number;
  zone_type: ZoneType;
  latitude: number;
  longitude: number;
  radius_km: number;
  description?: string | null;
  name?: string | null;
  is_active: boolean;
  created_at: string;
}

// Service center types
export type ServiceCenterType =
  | 'hospital'
  | 'shelter'
  | 'food_center'
  | 'medical_camp'
  | 'rescue_base'
  | 'supply_depot';

// Equipment types
export type EquipmentType =
  | 'ambulance'
  | 'boat'
  | 'rescue_kit'
  | 'drone'
  | 'fire_truck'
  | 'other';

export interface Equipment {
  id: number;
  authority_id: number;
  equipment_type: EquipmentType;
  quantity: number;
  description?: string | null;
  is_available: boolean;
  assigned_disaster_id?: number | null;
  last_latitude?: number | null;
  last_longitude?: number | null;
  created_at: string;
  updated_at: string;
}

// Notification types
export type NotificationType =
  | 'emergency_broadcast'
  | 'area_warning'
  | 'evacuation_alert'
  | 'info';

export type NotificationTarget = 'all' | 'area' | 'devices';

export interface SendNotificationRequest {
  notification_type: NotificationType;
  title: string;
  body: string;
  target: NotificationTarget;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  device_ids?: string[];
  disaster_id?: number;
}

// Analytics types
export interface AnalyticsSummary {
  total: number;
  verified: number;
  pending: number;
  false_alarms: number;
  resolved: number;
  emergency_active: number;
}

export interface DailyDisasterData {
  date: string;
  count: number;
  verified: number;
  false_alarms: number;
}

export interface ResponseTimeMetrics {
  average_response_minutes: number | null;
  fastest_response_minutes: number | null;
  slowest_response_minutes: number | null;
  total_resolved: number;
}

// Authority types
export interface Authority {
  id: number;
  username: string;
  organization_name: string;
  authority_type: string;
  base_latitude?: number;
  base_longitude?: number;
  operational_radius_km: number;
  contact_number?: string;
  is_active: boolean;
}

