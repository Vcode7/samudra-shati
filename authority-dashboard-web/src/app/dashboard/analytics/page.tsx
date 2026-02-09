'use client';

import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Grid,
    Paper,
    Stack,
    Typography,
    Alert,
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Warning as WarningIcon,
    CheckCircle as VerifiedIcon,
    Cancel as FalseAlarmIcon,
    AccessTime as TimeIcon,
    ReportProblem as EmergencyIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { api } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import type { AnalyticsSummary, DailyDisasterData, ResponseTimeMetrics } from '@/lib/types';

async function fetchSummary(): Promise<AnalyticsSummary> {
    const res = await api.get('/api/disasters/analytics/summary');
    return res.data;
}

async function fetchByDay(): Promise<DailyDisasterData[]> {
    const res = await api.get('/api/disasters/analytics/by-day?days=7');
    return res.data;
}

async function fetchResponseTime(): Promise<ResponseTimeMetrics> {
    const res = await api.get('/api/disasters/analytics/response-time');
    return res.data;
}

function StatCard({
    title,
    value,
    icon: Icon,
    color,
    subtitle,
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    subtitle?: string;
}) {
    return (
        <Card sx={{
            transition: 'all 0.2s ease',
            '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 24px ${color}40`,
            }
        }}>
            <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: `${color}20`,
                        display: 'flex',
                    }}>
                        <Icon sx={{ fontSize: 28, color }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            {title}
                        </Typography>
                        <Typography variant="h4" fontWeight={800} sx={{ color }}>
                            {value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="caption" color="text.secondary">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
}

const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#6366f1'];

export default function AnalyticsPage() {
    const { data: summary, isLoading: loadingSummary, error: errorSummary } = useQuery({
        queryKey: ['analytics', 'summary'],
        queryFn: fetchSummary,
        refetchInterval: 60000,
    });

    const { data: byDay, isLoading: loadingByDay } = useQuery({
        queryKey: ['analytics', 'by-day'],
        queryFn: fetchByDay,
        refetchInterval: 60000,
    });

    const { data: responseTime } = useQuery({
        queryKey: ['analytics', 'response-time'],
        queryFn: fetchResponseTime,
        refetchInterval: 60000,
    });

    const pieData = summary ? [
        { name: 'Verified', value: summary.verified },
        { name: 'Resolved', value: summary.resolved },
        { name: 'Pending', value: summary.pending },
        { name: 'False Alarms', value: summary.false_alarms },
    ] : [];

    return (
        <AppShell>
            <Stack spacing={3}>
                {/* Header */}
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        Analytics Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Overview of disaster reports and response metrics
                    </Typography>
                </Box>

                {errorSummary && <Alert severity="error">Failed to load analytics</Alert>}

                {/* Summary stats */}
                <Grid container spacing={2}>
                    <Grid item xs={6} md={4} lg={2}>
                        <StatCard
                            title="Total Reports"
                            value={summary?.total ?? '-'}
                            icon={WarningIcon}
                            color="#6366f1"
                        />
                    </Grid>
                    <Grid item xs={6} md={4} lg={2}>
                        <StatCard
                            title="Verified"
                            value={summary?.verified ?? '-'}
                            icon={VerifiedIcon}
                            color="#ef4444"
                        />
                    </Grid>
                    <Grid item xs={6} md={4} lg={2}>
                        <StatCard
                            title="Pending"
                            value={summary?.pending ?? '-'}
                            icon={TimeIcon}
                            color="#f59e0b"
                        />
                    </Grid>
                    <Grid item xs={6} md={4} lg={2}>
                        <StatCard
                            title="Resolved"
                            value={summary?.resolved ?? '-'}
                            icon={VerifiedIcon}
                            color="#10b981"
                        />
                    </Grid>
                    <Grid item xs={6} md={4} lg={2}>
                        <StatCard
                            title="False Alarms"
                            value={summary?.false_alarms ?? '-'}
                            icon={FalseAlarmIcon}
                            color="#94a3b8"
                        />
                    </Grid>
                    <Grid item xs={6} md={4} lg={2}>
                        <StatCard
                            title="Active Emergencies"
                            value={summary?.emergency_active ?? '-'}
                            icon={EmergencyIcon}
                            color="#dc2626"
                        />
                    </Grid>
                </Grid>

                {/* Charts row */}
                <Grid container spacing={3}>
                    {/* Bar chart - Disasters per day */}
                    <Grid item xs={12} lg={8}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" fontWeight={700} mb={2}>
                                Disasters Per Day (Last 7 Days)
                            </Typography>
                            {loadingByDay ? (
                                <Typography color="text.secondary">Loading chart...</Typography>
                            ) : byDay && byDay.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={byDay}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                                        />
                                        <YAxis
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: '1px solid #374151',
                                                borderRadius: 8,
                                            }}
                                        />
                                        <Bar dataKey="count" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="verified" name="Verified" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="false_alarms" name="False Alarms" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography color="text.secondary">No data available</Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* Pie chart - Status breakdown */}
                    <Grid item xs={12} lg={4}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" fontWeight={700} mb={2}>
                                Status Breakdown
                            </Typography>
                            {summary && summary.total > 0 ? (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {pieData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: '1px solid #374151',
                                                borderRadius: 8,
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography color="text.secondary">No data available</Typography>
                                </Box>
                            )}
                            <Stack spacing={1} mt={2}>
                                {pieData.map((item, index) => (
                                    <Stack key={item.name} direction="row" alignItems="center" spacing={1}>
                                        <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: COLORS[index] }} />
                                        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                            {item.name}
                                        </Typography>
                                        <Typography variant="caption" fontWeight={600}>{item.value}</Typography>
                                    </Stack>
                                ))}
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Response time metrics */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={700} mb={3}>
                        Response Time Metrics
                    </Typography>
                    <Grid container spacing={3}>
                        <Grid item xs={6} md={3}>
                            <Box textAlign="center">
                                <Typography variant="caption" color="text.secondary">Average Response</Typography>
                                <Typography variant="h3" fontWeight={800} color="primary.main">
                                    {responseTime?.average_response_minutes != null
                                        ? `${Math.round(responseTime.average_response_minutes)}m`
                                        : '-'}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Box textAlign="center">
                                <Typography variant="caption" color="text.secondary">Fastest Response</Typography>
                                <Typography variant="h3" fontWeight={800} color="success.main">
                                    {responseTime?.fastest_response_minutes != null
                                        ? `${Math.round(responseTime.fastest_response_minutes)}m`
                                        : '-'}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Box textAlign="center">
                                <Typography variant="caption" color="text.secondary">Slowest Response</Typography>
                                <Typography variant="h3" fontWeight={800} color="warning.main">
                                    {responseTime?.slowest_response_minutes != null
                                        ? `${Math.round(responseTime.slowest_response_minutes)}m`
                                        : '-'}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Box textAlign="center">
                                <Typography variant="caption" color="text.secondary">Total Resolved</Typography>
                                <Typography variant="h3" fontWeight={800} color="info.main">
                                    {responseTime?.total_resolved ?? '-'}
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>
            </Stack>
        </AppShell>
    );
}
