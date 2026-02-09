'use client';

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
  VerifiedUser as VerifyIcon,
  CheckCircle as ResolveIcon,
  Edit as EditIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import type { DisasterReport } from '@/lib/types';
import { api } from '@/lib/api';

function getSeverityLabel(level: number): string {
  if (level >= 8) return 'Critical';
  if (level >= 6) return 'Severe';
  if (level >= 4) return 'Moderate';
  return 'Minor';
}

function getSeverityColor(level: number): 'error' | 'warning' | 'success' {
  if (level >= 7) return 'error';
  if (level >= 4) return 'warning';
  return 'success';
}

function getStatusColor(status: string): 'error' | 'warning' | 'success' | 'info' | 'default' {
  switch (status) {
    case 'pending': return 'warning';
    case 'verified': return 'error';
    case 'resolved': return 'success';
    case 'false_alarm': return 'default';
    default: return 'info';
  }
}

export function DisasterDetailsDrawer({
  open,
  onClose,
  disaster,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  disaster: DisasterReport | null;
  onUpdated: () => Promise<void> | void;
}) {
  const [dangerRadiusKm, setDangerRadiusKm] = useState('');
  const [editingRadius, setEditingRadius] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialRadius = useMemo(() => (disaster ? String(disaster.danger_radius_km) : ''), [disaster]);

  React.useEffect(() => {
    setDangerRadiusKm(initialRadius);
    setEditingRadius(false);
  }, [initialRadius]);

  const doAction = async (type: string, fn: () => Promise<void>) => {
    console.log(disaster);
    if (!disaster) return;
    setBusy(true);
    setActionType(type);
    setError(null);
    try {
      await fn();
      await onUpdated();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Action failed');
    } finally {
      setBusy(false);
      setActionType(null);
    }
  };

  const onVerifyAuthority = () =>
    doAction('verify', async () => {
      if (!disaster) return;
      await api.post(`/api/authorities/${disaster.id}/verify`);
    });

  const onResolve = () =>
    doAction('resolve', async () => {
      console.log(disaster);
      if (!disaster) return;
      await api.post(`/api/disasters/${disaster.id}/resolve`);
    });

  const onUpdateRadius = () =>
    doAction('radius', async () => {
      if (!disaster) return;
      await api.patch(`/api/disasters/${disaster.id}/danger-radius`, {
        danger_radius_km: Number(dangerRadiusKm),
      });
      setEditingRadius(false);
    });

  if (!disaster) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 420,
          bgcolor: 'background.default',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        },
      }}
    >
      <Stack sx={{ height: '100%' }}>
        {/* Header */}
        <Box sx={{
          p: 2,
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(30, 41, 59, 1) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <WarningIcon color="error" />
                <Typography variant="h6" fontWeight={800}>
                  Disaster #{disaster.id}
                </Typography>
              </Stack>
              <Chip
                size="small"
                color={getStatusColor(disaster.status)}
                label={disaster.status.replace('_', ' ')}
                sx={{ textTransform: 'capitalize' }}
              />
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={3}>
            {/* Alert status banner */}
            {disaster.alert_status === 'emergency_active' && (
              <Alert
                severity="error"
                sx={{
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                  },
                }}
              >
                🚨 EMERGENCY ACTIVE - Response teams should be deployed
              </Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {/* Location */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <LocationIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={600}>Location</Typography>
              </Stack>
              <Typography variant="body1" fontWeight={500}>
                {disaster.location_name ?? 'Unknown Location'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {disaster.latitude.toFixed(6)}, {disaster.longitude.toFixed(6)}
              </Typography>
            </Box>

            <Divider />

            {/* Severity */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={500}>
                  Severity Level
                </Typography>
                <Typography variant="h4" fontWeight={800} color={`${getSeverityColor(disaster.severity_level)}.main`}>
                  {disaster.severity_level}/10
                </Typography>
              </Box>
              <Chip
                label={getSeverityLabel(disaster.severity_level)}
                color={getSeverityColor(disaster.severity_level)}
                sx={{ fontWeight: 700 }}
              />
            </Stack>

            {/* Danger Radius */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={500} mb={1}>
                Danger Radius
              </Typography>
              {editingRadius ? (
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    value={dangerRadiusKm}
                    onChange={(e) => setDangerRadiusKm(e.target.value)}
                    type="number"
                    inputProps={{ min: 0.1, step: 0.1 }}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={onUpdateRadius}
                    disabled={busy}
                  >
                    {actionType === 'radius' ? <CircularProgress size={16} /> : 'Save'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setEditingRadius(false);
                      setDangerRadiusKm(initialRadius);
                    }}
                  >
                    Cancel
                  </Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h5" fontWeight={700}>
                    {disaster.danger_radius_km} km
                  </Typography>
                  <IconButton size="small" onClick={() => setEditingRadius(true)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
            </Box>

            <Divider />

            {/* Community Verification Stats */}
            {(disaster.verification_count_yes !== undefined || disaster.verification_count_no !== undefined) && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <GroupsIcon color="info" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={600}>Community Verification</Typography>
                </Stack>
                <Stack direction="row" spacing={2}>
                  <Box sx={{ p: 1.5, bgcolor: 'success.main', borderRadius: 2, opacity: 0.9 }}>
                    <Typography variant="caption" color="white">Confirmed</Typography>
                    <Typography variant="h5" fontWeight={800} color="white">
                      {disaster.verification_count_yes ?? 0}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: 'error.main', borderRadius: 2, opacity: 0.9 }}>
                    <Typography variant="caption" color="white">Denied</Typography>
                    <Typography variant="h5" fontWeight={800} color="white">
                      {disaster.verification_count_no ?? 0}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}

            {/* AI Analysis */}
            {disaster.ai_analysis && (
              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  🤖 AI Analysis
                </Typography>
                <Box sx={{
                  p: 2,
                  bgcolor: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: 2,
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}>
                  <Typography variant="body2">
                    {disaster.ai_analysis}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Description */}
            {disaster.description && (
              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  Description
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {disaster.description}
                </Typography>
              </Box>
            )}

            {/* Image */}
            {disaster.image_url && (
              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  Uploaded Image
                </Typography>
                <Box
                  component="img"
                  src={disaster.image_url}
                  alt="Disaster evidence"
                  sx={{
                    width: '100%',
                    borderRadius: 2,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                />
              </Box>
            )}

            {/* Timeline */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={500} mb={0.5}>
                Reported
              </Typography>
              <Typography variant="body2">
                {new Date(disaster.created_at).toLocaleString()}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Action buttons */}
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Stack spacing={1}>
            {disaster.status === 'pending' && (
              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                startIcon={actionType === 'verify' ? <CircularProgress size={20} /> : <VerifyIcon />}
                disabled={busy}
                onClick={onVerifyAuthority}
              >
                {actionType === 'verify' ? 'Verifying...' : 'Verify as Authority'}
              </Button>
            )}
            {(disaster.status === 'pending' || disaster.status === 'verified') && (
              <Button
                variant="outlined"
                color="success"
                fullWidth
                size="large"
                startIcon={actionType === 'resolve' ? <CircularProgress size={20} /> : <ResolveIcon />}
                disabled={busy}
                onClick={onResolve}
              >
                {actionType === 'resolve' ? 'Resolving...' : 'Mark as Resolved'}
              </Button>
            )}
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  );
}
