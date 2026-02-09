export type DeviceLocation = {
  device_id: string;
  latitude: number;
  longitude: number;
  last_updated: string;
  in_danger_zone: boolean;
  distance_km?: number;
  disaster_id?: number;
};
