'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Slider,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {
    Send as SendIcon,
    Notifications as NotificationsIcon,
    Warning as WarningIcon,
    DirectionsRun as EvacuationIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import type { NotificationType, NotificationTarget } from '@/lib/types';

const notificationTypes: { value: NotificationType; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'emergency_broadcast', label: 'Emergency Broadcast', icon: WarningIcon, color: '#ef4444' },
    { value: 'area_warning', label: 'Area Warning', icon: NotificationsIcon, color: '#f59e0b' },
    { value: 'evacuation_alert', label: 'Evacuation Alert', icon: EvacuationIcon, color: '#dc2626' },
    { value: 'info', label: 'Information', icon: InfoIcon, color: '#3b82f6' },
];

export default function NotificationsPage() {
    const searchParams = useSearchParams();

    const [notificationType, setNotificationType] = useState<NotificationType>('emergency_broadcast');
    const [target, setTarget] = useState<NotificationTarget>('all');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [radiusKm, setRadiusKm] = useState<number>(5);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    // Check for lat/lng from URL params (coming from map context menu)
    useEffect(() => {
        const lat = searchParams.get('lat');
        const lng = searchParams.get('lng');
        if (lat && lng) {
            setLatitude(lat);
            setLongitude(lng);
            setTarget('area');
            setNotificationType('area_warning');
        }
    }, [searchParams]);

    const sendMutation = useMutation({
        mutationFn: async () => {
            const payload: any = {
                notification_type: notificationType,
                title,
                body,
                target,
            };

            if (target === 'area') {
                payload.latitude = parseFloat(latitude);
                payload.longitude = parseFloat(longitude);
                payload.radius_km = radiusKm;
            }

            const res = await api.post('/api/notifications/send', payload);
            return res.data;
        },
        onSuccess: (data) => {
            setResult({ success: true, message: data.message });
        },
        onError: (error: any) => {
            setResult({ success: false, message: error?.response?.data?.detail || 'Failed to send notification' });
        },
    });

    const handleSend = () => {
        if (!title.trim() || !body.trim()) {
            setResult({ success: false, message: 'Title and body are required' });
            return;
        }
        sendMutation.mutate();
    };

    const selectedType = notificationTypes.find(t => t.value === notificationType);

    return (
        <AppShell>
            <Stack spacing={3}>
                {/* Header */}
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        Send Notifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Broadcast emergency alerts, warnings, and updates to users
                    </Typography>
                </Box>

                <Grid container spacing={3}>
                    {/* Left side - Form */}
                    <Grid item xs={12} lg={7}>
                        <Paper sx={{ p: 3 }}>
                            <Stack spacing={3}>
                                {/* Notification type selection */}
                                <Box>
                                    <Typography variant="subtitle2" fontWeight={600} mb={2}>
                                        Notification Type
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {notificationTypes.map((type) => {
                                            const Icon = type.icon;
                                            const isSelected = notificationType === type.value;
                                            return (
                                                <Grid item xs={6} key={type.value}>
                                                    <Card
                                                        sx={{
                                                            cursor: 'pointer',
                                                            border: isSelected ? `2px solid ${type.color}` : '2px solid transparent',
                                                            bgcolor: isSelected ? `${type.color}15` : 'background.paper',
                                                            transition: 'all 0.2s ease',
                                                            '&:hover': { borderColor: type.color },
                                                        }}
                                                        onClick={() => setNotificationType(type.value)}
                                                    >
                                                        <CardContent sx={{ py: 2 }}>
                                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                                <Icon sx={{ color: type.color }} />
                                                                <Typography variant="body2" fontWeight={isSelected ? 700 : 500}>
                                                                    {type.label}
                                                                </Typography>
                                                            </Stack>
                                                        </CardContent>
                                                    </Card>
                                                </Grid>
                                            );
                                        })}
                                    </Grid>
                                </Box>

                                {/* Target selection */}
                                <Box>
                                    <Typography variant="subtitle2" fontWeight={600} mb={1}>
                                        Target Audience
                                    </Typography>
                                    <RadioGroup
                                        row
                                        value={target}
                                        onChange={(e) => setTarget(e.target.value as NotificationTarget)}
                                    >
                                        <FormControlLabel value="all" control={<Radio />} label="All Users" />
                                        <FormControlLabel value="area" control={<Radio />} label="Specific Area" />
                                    </RadioGroup>
                                </Box>

                                {/* Area targeting fields */}
                                {target === 'area' && (
                                    <Stack spacing={2}>
                                        <Stack direction="row" spacing={2}>
                                            <TextField
                                                label="Latitude"
                                                value={latitude}
                                                onChange={(e) => setLatitude(e.target.value)}
                                                type="number"
                                                fullWidth
                                                size="small"
                                            />
                                            <TextField
                                                label="Longitude"
                                                value={longitude}
                                                onChange={(e) => setLongitude(e.target.value)}
                                                type="number"
                                                fullWidth
                                                size="small"
                                            />
                                        </Stack>
                                        <Box>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                Radius: {radiusKm} km
                                            </Typography>
                                            <Slider
                                                value={radiusKm}
                                                onChange={(_, v) => setRadiusKm(v as number)}
                                                min={1}
                                                max={50}
                                                step={1}
                                                valueLabelDisplay="auto"
                                                sx={{ maxWidth: 300 }}
                                            />
                                        </Box>
                                    </Stack>
                                )}

                                {/* Message content */}
                                <TextField
                                    label="Notification Title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    fullWidth
                                    placeholder="e.g., ⚠️ Flood Warning in Chennai"
                                />
                                <TextField
                                    label="Message Body"
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    fullWidth
                                    multiline
                                    rows={4}
                                    placeholder="Enter the notification message..."
                                />

                                {/* Result message */}
                                {result && (
                                    <Alert severity={result.success ? 'success' : 'error'}>
                                        {result.message}
                                    </Alert>
                                )}

                                {/* Send button */}
                                <Button
                                    variant="contained"
                                    size="large"
                                    startIcon={<SendIcon />}
                                    onClick={handleSend}
                                    disabled={sendMutation.isPending}
                                    sx={{
                                        bgcolor: selectedType?.color,
                                        '&:hover': { bgcolor: selectedType?.color, filter: 'brightness(0.9)' },
                                    }}
                                >
                                    {sendMutation.isPending ? 'Sending...' : 'Send Notification'}
                                </Button>
                            </Stack>
                        </Paper>
                    </Grid>

                    {/* Right side - Preview */}
                    <Grid item xs={12} lg={5}>
                        <Paper sx={{ p: 3, position: 'sticky', top: 80 }}>
                            <Typography variant="subtitle2" fontWeight={600} mb={2}>
                                Preview
                            </Typography>

                            <Card sx={{
                                bgcolor: 'background.default',
                                border: `1px solid ${selectedType?.color || '#fff'}20`,
                            }}>
                                <CardContent>
                                    <Stack spacing={1}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Chip
                                                size="small"
                                                label={selectedType?.label}
                                                sx={{
                                                    bgcolor: `${selectedType?.color}20`,
                                                    color: selectedType?.color,
                                                    fontWeight: 600,
                                                }}
                                            />
                                        </Stack>
                                        <Typography variant="h6" fontWeight={700}>
                                            {title || 'Notification Title'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {body || 'Your message will appear here...'}
                                        </Typography>
                                        {target === 'area' && latitude && longitude && (
                                            <Typography variant="caption" color="text.secondary">
                                                📍 Targeting area: {latitude}, {longitude} ({radiusKm}km radius)
                                            </Typography>
                                        )}
                                        {target === 'all' && (
                                            <Typography variant="caption" color="text.secondary">
                                                📢 Broadcasting to all users
                                            </Typography>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Box mt={3}>
                                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                                    Quick tips:
                                </Typography>
                                <Stack spacing={0.5}>
                                    <Typography variant="caption" color="text.secondary">
                                        • Use emojis to grab attention (🚨 ⚠️ 🔴)
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        • Keep messages concise and actionable
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        • Include location info when relevant
                                    </Typography>
                                </Stack>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Stack>
        </AppShell>
    );
}
