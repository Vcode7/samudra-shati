'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  MyLocation as CenterIcon,
  Layers as LayersIcon,
  Circle as CircleIcon,
  AddLocation as AddLocationIcon,
  LocalHospital as HealthcareIcon,
  Help as HelpCenterIcon,
  Report as ReportIcon,
  NotificationsActive as NotifyIcon,
  Shield as SafeIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GoogleMap, MarkerF, CircleF, useJsApiLoader } from '@react-google-maps/api';
import { api } from '@/lib/api';
import { env } from '@/lib/env';
import type { DisasterReport, Zone } from '@/lib/types';
import type { DeviceLocation } from '@/lib/deviceTypes';

async function fetchActive(): Promise<DisasterReport[]> {
  const res = await api.get('/api/disasters/active');
  return res.data;
}

async function fetchDevices(): Promise<DeviceLocation[]> {
  const res = await api.get('/api/locations/devices?in_danger_zone=true');
  console.log("red",res.data);
  return res.data;
}

async function fetchZones(): Promise<Zone[]> {
  try {
    const res = await api.get('/api/zones');
    return res.data;
  } catch {
    return [];
  }
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '70vh',
  borderRadius: 12,
};

const mapOptions = {
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  ],
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
};

type ServiceCenterType = 'healthcare' | 'report' | 'helpcenter';

export function LiveAlertsMap({
  onOpenDetails,
}: {
  onOpenDetails: (d: DisasterReport) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showDangerZones, setShowDangerZones] = useState(true);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showServiceZones, setShowServiceZones] = useState(true);
  const [showDevices, setShowDevices] = useState(true);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    lat: number;
    lng: number;
  } | null>(null);

  // Dialog states
  const [safeAreaDialog, setSafeAreaDialog] = useState(false);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Zone context menu state (for clicking on zones)
  const [zoneContextMenu, setZoneContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    zoneType: 'safe' | 'service';
    zoneId: number;
    zoneName?: string;
  } | null>(null);

  // Form states
  const [safeAreaName, setSafeAreaName] = useState('');
  const [safeAreaRadius, setSafeAreaRadius] = useState('1');
  const [safeAreaCapacity, setSafeAreaCapacity] = useState('100');
  const [serviceType, setServiceType] = useState<ServiceCenterType>('healthcare');
  const [serviceName, setServiceName] = useState('');
  const [serviceContact, setServiceContact] = useState('');

  const { data, error } = useQuery({
    queryKey: ['disasters', 'active'],
    queryFn: fetchActive,
    refetchInterval: 15000,
  });

  const { data: devices } = useQuery({
    queryKey: ['devices', 'danger-zone'],
    queryFn: fetchDevices,
    refetchInterval: 15000,
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
    refetchInterval: 30000,
  });

  const createSafeAreaMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      latitude: number;
      longitude: number;
      radius_km: number;
      capacity: number;
    }) => {
      await api.post('/api/zones/safe', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setSafeAreaDialog(false);
      resetForms();
    },
  });

  const createServiceCenterMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      latitude: number;
      longitude: number;
      service_type: ServiceCenterType;
      contact_info?: string;
    }) => {
      await api.post('/api/zones/service', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setServiceDialog(false);
      resetForms();
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async ({ zoneType, zoneId }: { zoneType: 'safe' | 'service'; zoneId: number }) => {
      await api.delete(`/api/zones/${zoneType}/${zoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setZoneContextMenu(null);
    },
  });

  const resetForms = () => {
    setSafeAreaName('');
    setSafeAreaRadius('1');
    setSafeAreaCapacity('100');
    setServiceName('');
    setServiceType('healthcare');
    setServiceContact('');
    setSelectedLocation(null);
  };

  const safeZones = useMemo(() => (zones ?? []).filter(z => z.zone_type === 'safe'), [zones]);
  const serviceZones = useMemo(() => (zones ?? []).filter(z => z.zone_type === 'service'), [zones]);

  const center = useMemo(() => {
    const first = data?.[0];
    return first
      ? { lat: first.latitude, lng: first.longitude }
      : { lat: 13.0827, lng: 80.2707 };
  }, [data]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: env.googleMapsApiKey,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapRef(map);
  }, []);

  const handleRightClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng && e.domEvent) {
      e.domEvent.preventDefault();
      setContextMenu({
        mouseX: e.domEvent.clientX,
        mouseY: e.domEvent.clientY,
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
    }
  }, []);

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleCloseZoneContextMenu = () => {
    setZoneContextMenu(null);
  };

  const handleSafeZoneClick = (zone: Zone, event: google.maps.MapMouseEvent) => {
    if (event.domEvent) {
      setZoneContextMenu({
        mouseX: event.domEvent.clientX,
        mouseY: event.domEvent.clientY,
        zoneType: 'safe',
        zoneId: zone.id,
        zoneName: zone.name,
      });
    }
  };

  const handleServiceZoneClick = (zone: Zone, event: google.maps.MapMouseEvent) => {
    if (event.domEvent) {
      setZoneContextMenu({
        mouseX: event.domEvent.clientX,
        mouseY: event.domEvent.clientY,
        zoneType: 'service',
        zoneId: zone.id,
        zoneName: zone.name,
      });
    }
  };

  const handleDeleteZone = () => {
    if (zoneContextMenu) {
      deleteZoneMutation.mutate({
        zoneType: zoneContextMenu.zoneType,
        zoneId: zoneContextMenu.zoneId,
      });
    }
  };

  const handleAddSafeArea = () => {
    if (contextMenu) {
      setSelectedLocation({ lat: contextMenu.lat, lng: contextMenu.lng });
      setSafeAreaDialog(true);
    }
    handleCloseContextMenu();
  };

  const handleAddServiceCenter = () => {
    if (contextMenu) {
      setSelectedLocation({ lat: contextMenu.lat, lng: contextMenu.lng });
      setServiceDialog(true);
    }
    handleCloseContextMenu();
  };

  const handleSendNotification = () => {
    if (contextMenu) {
      // Navigate to notifications page with coordinates as query params
      router.push(`/dashboard/notifications?lat=${contextMenu.lat}&lng=${contextMenu.lng}`);
    }
    handleCloseContextMenu();
  };

  const handleCreateSafeArea = () => {
    if (!selectedLocation) return;
    createSafeAreaMutation.mutate({
      name: safeAreaName || 'Safe Area',
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      radius_km: parseFloat(safeAreaRadius) || 1,
      capacity: parseInt(safeAreaCapacity) || 100,
    });
  };

  const handleCreateServiceCenter = () => {
    if (!selectedLocation) return;
    createServiceCenterMutation.mutate({
      name: serviceName || `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} Center`,
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      service_type: serviceType,
      contact_info: serviceContact || undefined,
    });
  };

  const centerOnDisaster = (disaster: DisasterReport) => {
    if (mapRef) {
      mapRef.panTo({ lat: disaster.latitude, lng: disaster.longitude });
      mapRef.setZoom(13);
    }
  };

  if (!env.googleMapsApiKey) {
    return (
      <Alert severity="warning">
        Missing `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Add it to `authority-dashboard-web/.env.local`.
      </Alert>
    );
  }

  if (loadError) {
    return <Alert severity="error">Failed to load Google Maps</Alert>;
  }

  return (
    <Paper sx={{ p: 2, background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%)' }}>
      <Stack spacing={2}>
        {/* Header with controls */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LayersIcon color="primary" />
              Live Map Monitor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data?.length ?? 0} active alerts • {devices?.length ?? 0} devices tracked • Right-click to add zones
            </Typography>
          </Box>
        </Stack>

        {/* Layer toggles */}
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={showDangerZones}
                onChange={(e) => setShowDangerZones(e.target.checked)}
                color="error"
                size="small"
              />
            }
            label={<Typography variant="body2">Danger Zones</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showSafeZones}
                onChange={(e) => setShowSafeZones(e.target.checked)}
                color="success"
                size="small"
              />
            }
            label={<Typography variant="body2">Safe Zones</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showServiceZones}
                onChange={(e) => setShowServiceZones(e.target.checked)}
                color="info"
                size="small"
              />
            }
            label={<Typography variant="body2">Service Centers</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showDevices}
                onChange={(e) => setShowDevices(e.target.checked)}
                color="warning"
                size="small"
              />
            }
            label={<Typography variant="body2">Devices</Typography>}
          />
        </Stack>

        {/* Quick jump to disasters */}
        {data && data.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              Jump to:
            </Typography>
            {data.slice(0, 20).map((d) => (
              <Chip
                key={d.id}
                label={`#${d.id}`}
                size="small"
                color={d.severity_level >= 7 ? 'error' : d.severity_level >= 4 ? 'warning' : 'default'}
                onClick={() => centerOnDisaster(d)}
                icon={<CenterIcon />}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Stack>
        )}

        {error ? <Alert severity="error">Failed to load alerts</Alert> : null}

        {/* Map */}
        {isLoaded ? (
          <Box sx={{ position: 'relative' }}>
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={11}
              options={mapOptions}
              onLoad={onMapLoad}
              onRightClick={handleRightClick}
            >
              {/* Danger zones (red circles) */}
              {showDangerZones && (data ?? []).map((d) => (
                <React.Fragment key={d.id}>
                  <MarkerF
                    position={{ lat: d.latitude, lng: d.longitude }}
                    onClick={() => onOpenDetails(d)}
                    icon={{
                      url: 'data:image/svg+xml,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" fill="${d.severity_level >= 7 ? '#ef4444' : d.severity_level >= 4 ? '#f59e0b' : '#10b981'}" stroke="white" stroke-width="2"/>
                          <text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${d.severity_level}</text>
                        </svg>
                      `),
                      scaledSize: new google.maps.Size(32, 32),
                    }}
                  />
                  <CircleF
                    center={{ lat: d.latitude, lng: d.longitude }}
                    radius={d.danger_radius_km * 1000}
                    options={{
                      strokeColor: '#ef4444',
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                      fillColor: '#ef4444',
                      fillOpacity: 0.15,
                      clickable: true,
                    }}
                    onRightClick={handleRightClick}
                  />
                </React.Fragment>
              ))}

              {/* Safe zones (green circles) */}
              {showSafeZones && safeZones.map((zone) => (
                <React.Fragment key={`safe-${zone.id}`}>
                  <CircleF
                    center={{ lat: zone.latitude, lng: zone.longitude }}
                    radius={zone.radius_km * 1000}
                    options={{
                      strokeColor: '#10b981',
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                      fillColor: '#10b981',
                      fillOpacity: 0.2,
                    }}
                  />
                  <MarkerF
                    position={{ lat: zone.latitude, lng: zone.longitude }}
                    onClick={(e) => handleSafeZoneClick(zone, e)}
                    icon={{
                      url: 'data:image/svg+xml,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" fill="#10b981" stroke="white" stroke-width="2"/>
                          <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">S</text>
                        </svg>
                      `),
                      scaledSize: new google.maps.Size(24, 24),
                    }}
                    title={zone.name ?? 'Safe Area (click to remove)'}
                  />
                </React.Fragment>
              ))}

              {/* Service zones (blue markers) */}
              {showServiceZones && serviceZones.map((zone) => (
                <MarkerF
                  key={`service-${zone.id}`}
                  position={{ lat: zone.latitude, lng: zone.longitude }}
                  onClick={(e) => handleServiceZoneClick(zone, e)}
                  icon={{
                    url: 'data:image/svg+xml,' + encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">
                        <rect x="2" y="2" width="20" height="20" rx="4" fill="#3b82f6" stroke="white" stroke-width="2"/>
                        <text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">+</text>
                      </svg>
                    `),
                    scaledSize: new google.maps.Size(28, 28),
                  }}
                  title={zone.name ?? 'Service Center (click to remove)'}
                />
              ))}

              {/* Device locations */}
              {showDevices && (devices ?? []).map((dev) => (
                <MarkerF
                  key={dev.device_id}
                  position={{ lat: dev.latitude, lng: dev.longitude }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: dev.in_danger_zone ? '#ef4444' : '#9e9e9e',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 1,
                  }}
                />
              ))}
            </GoogleMap>

            {/* Legend overlay */}
            <Paper
              sx={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                p: 1.5,
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={1}>
                LEGEND
              </Typography>
              <Stack spacing={0.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircleIcon sx={{ fontSize: 12, color: '#ef4444' }} />
                  <Typography variant="caption">Danger Zone</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircleIcon sx={{ fontSize: 12, color: '#10b981' }} />
                  <Typography variant="caption">Safe Zone</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircleIcon sx={{ fontSize: 12, color: '#3b82f6' }} />
                  <Typography variant="caption">Service Center</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircleIcon sx={{ fontSize: 8, color: '#f59e0b' }} />
                  <Typography variant="caption">Device</Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
        ) : (
          <Box sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading map...</Typography>
          </Box>
        )}
      </Stack>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleAddSafeArea}>
          <ListItemIcon>
            <SafeIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText>Add Safe Area</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAddServiceCenter}>
          <ListItemIcon>
            <HealthcareIcon fontSize="small" color="info" />
          </ListItemIcon>
          <ListItemText>Add Service Center</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSendNotification}>
          <ListItemIcon>
            <NotifyIcon fontSize="small" color="warning" />
          </ListItemIcon>
          <ListItemText>Send Notification</ListItemText>
        </MenuItem>
      </Menu>

      {/* Zone Context Menu (for clicking on zones to delete) */}
      <Menu
        open={zoneContextMenu !== null}
        onClose={handleCloseZoneContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          zoneContextMenu !== null
            ? { top: zoneContextMenu.mouseY, left: zoneContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            {zoneContextMenu?.zoneName || (zoneContextMenu?.zoneType === 'safe' ? 'Safe Area' : 'Service Center')}
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleDeleteZone} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Remove {zoneContextMenu?.zoneType === 'safe' ? 'Safe Area' : 'Service Center'}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add Safe Area Dialog */}
      <Dialog open={safeAreaDialog} onClose={() => setSafeAreaDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SafeIcon color="success" />
            <span>Add Safe Area</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {selectedLocation && (
              <Alert severity="info">
                Location: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </Alert>
            )}
            <TextField
              label="Name"
              value={safeAreaName}
              onChange={(e) => setSafeAreaName(e.target.value)}
              fullWidth
              placeholder="e.g., Community Hall Safe Zone"
            />
            <TextField
              label="Radius (km)"
              type="number"
              value={safeAreaRadius}
              onChange={(e) => setSafeAreaRadius(e.target.value)}
              inputProps={{ min: 0.1, step: 0.1 }}
              fullWidth
            />
            <TextField
              label="Capacity (people)"
              type="number"
              value={safeAreaCapacity}
              onChange={(e) => setSafeAreaCapacity(e.target.value)}
              inputProps={{ min: 1 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSafeAreaDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleCreateSafeArea}
            disabled={createSafeAreaMutation.isPending}
          >
            {createSafeAreaMutation.isPending ? 'Creating...' : 'Create Safe Area'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Service Center Dialog */}
      <Dialog open={serviceDialog} onClose={() => setServiceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Stack direction="row" spacing={1} alignItems="center">
            <HealthcareIcon color="info" />
            <span>Add Service Center</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {selectedLocation && (
              <Alert severity="info">
                Location: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </Alert>
            )}
            <FormControl fullWidth>
              <InputLabel>Service Type</InputLabel>
              <Select
                value={serviceType}
                label="Service Type"
                onChange={(e) => setServiceType(e.target.value as ServiceCenterType)}
              >
                <MenuItem value="healthcare">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <HealthcareIcon fontSize="small" />
                    <span>Healthcare</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="report">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReportIcon fontSize="small" />
                    <span>Report Center</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="helpcenter">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <HelpCenterIcon fontSize="small" />
                    <span>Help Center</span>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Name"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              fullWidth
              placeholder="e.g., City Hospital Emergency Ward"
            />
            <TextField
              label="Contact Info (optional)"
              value={serviceContact}
              onChange={(e) => setServiceContact(e.target.value)}
              fullWidth
              placeholder="e.g., +91 9876543210"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setServiceDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="info"
            onClick={handleCreateServiceCenter}
            disabled={createServiceCenterMutation.isPending}
          >
            {createServiceCenterMutation.isPending ? 'Creating...' : 'Create Service Center'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
