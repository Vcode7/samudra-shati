'use client';

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  VerifiedUser as VerifyIcon,
  Timer as TimerIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DisasterReport, DisasterStatus } from '@/lib/types';

async function fetchActive(): Promise<DisasterReport[]> {
  const res = await api.get('/api/disasters/active');
  return res.data;
}

async function fetchRecent(): Promise<DisasterReport[]> {
  const res = await api.get('/api/disasters/recent?limit=50');
  return res.data;
}

function getTimeSince(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getSeverityColor(level: number): 'error' | 'warning' | 'success' | 'info' {
  if (level >= 7) return 'error';
  if (level >= 4) return 'warning';
  return 'success';
}

function getStatusColor(status: DisasterStatus): 'error' | 'warning' | 'success' | 'info' | 'default' {
  switch (status) {
    case 'pending': return 'warning';
    case 'verified': return 'error';
    case 'resolved': return 'success';
    case 'false_alarm': return 'default';
    default: return 'info';
  }
}

export function LiveAlertsTable({
  onOpenDetails,
}: {
  onOpenDetails: (d: DisasterReport) => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'active' | 'recent'>('active');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [minSeverity, setMinSeverity] = useState('');
  const [verifying, setVerifying] = useState<number | null>(null);

  const { data: activeData, isLoading: loadingActive, error: errorActive } = useQuery({
    queryKey: ['disasters', 'active'],
    queryFn: fetchActive,
    refetchInterval: 15000,
  });

  const { data: recentData, isLoading: loadingRecent, error: errorRecent } = useQuery({
    queryKey: ['disasters', 'recent'],
    queryFn: fetchRecent,
    refetchInterval: 30000,
  });

  const data = tab === 'active' ? activeData : recentData;
  const isLoading = tab === 'active' ? loadingActive : loadingRecent;
  const error = tab === 'active' ? errorActive : errorRecent;

  const filtered = useMemo(() => {
    let result = data ?? [];

    const min = minSeverity ? Number(minSeverity) : null;
    if (min != null) {
      result = result.filter((d) => d.severity_level >= min);
    }

    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }

    return result;
  }, [data, minSeverity, statusFilter]);

  const onVerifyAuthority = async (disasterId: number) => {
    setVerifying(disasterId);
    try {
      await api.post(`/api/authorities/${disasterId}/verify`);
      await qc.invalidateQueries({ queryKey: ['disasters'] });
    } finally {
      setVerifying(null);
    }
  };

  const onRefresh = () => {
    qc.invalidateQueries({ queryKey: ['disasters'] });
  };

  return (
    <Paper sx={{ p: 2, background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%)' }}>
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="error" />
              Emergency Alerts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filtered.length} alerts • Auto-refreshes every 15s
            </Typography>
          </Box>
          <Tooltip title="Refresh now">
            <IconButton onClick={onRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { minWidth: 100 }
          }}
        >
          <Tab value="active" label="Active" />
          <Tab value="recent" label="All Recent" />
        </Tabs>

        {/* Filters */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            label="Min severity"
            value={minSeverity}
            onChange={(e) => setMinSeverity(e.target.value)}
            size="small"
            type="number"
            inputProps={{ min: 1, max: 10 }}
            sx={{ width: 130 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="false_alarm">False Alarm</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {error ? <Alert severity="error">Failed to load alerts</Alert> : null}

        {/* Table */}
        <Box sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Severity</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Alert Mode</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Radius</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimerIcon fontSize="small" />
                    Time
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((d) => (
                <TableRow
                  key={d.id}
                  hover
                  onClick={() => onOpenDetails(d)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.08)' }
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>#{d.id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {d.location_name ?? 'Unknown'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={getSeverityColor(d.severity_level)}
                      label={`${d.severity_level}/10`}
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={getStatusColor(d.status)}
                      variant="outlined"
                      label={d.status.replace('_', ' ')}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell>
                    {d.alert_status === 'emergency_active' ? (
                      <Chip
                        size="small"
                        color="error"
                        label="EMERGENCY"
                        sx={{
                          animation: 'pulse 1.5s infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.6 },
                          },
                        }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {d.alert_status?.replace('_', ' ') ?? '—'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{d.danger_radius_km} km</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {getTimeSince(d.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetails(d);
                        }}
                      >
                        Details
                      </Button>
                      {d.status === 'pending' && (
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          startIcon={<VerifyIcon />}
                          disabled={verifying === d.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onVerifyAuthority(d.id);
                          }}
                        >
                          {verifying === d.id ? 'Verifying...' : 'Verify'}
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography color="text.secondary">Loading alerts...</Typography>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography color="text.secondary" textAlign="center" py={4}>
                      No alerts match your filters
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    </Paper>
  );
}

