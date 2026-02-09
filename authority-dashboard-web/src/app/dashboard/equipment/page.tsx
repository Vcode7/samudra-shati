'use client';

import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
    Alert,
} from '@mui/material';
import {
    Add as AddIcon,
    DirectionsBoat as BoatIcon,
    LocalHospital as AmbulanceIcon,
    Build as KitIcon,
    FlightTakeoff as DroneIcon,
    LocalFireDepartment as FireTruckIcon,
    MoreVert as MoreIcon,
    Check as AvailableIcon,
    Close as UnavailableIcon,
    Build as BuildIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import type { Equipment, EquipmentType } from '@/lib/types';

const equipmentIcons: Record<EquipmentType, React.ElementType> = {
    ambulance: AmbulanceIcon,
    boat: BoatIcon,
    rescue_kit: KitIcon,
    drone: DroneIcon,
    fire_truck: FireTruckIcon,
    other: BuildIcon,
};

async function fetchEquipment(): Promise<Equipment[]> {
    const res = await api.get('/api/authorities/equipment');
    return res.data;
}

function EquipmentCard({ equipment }: { equipment: Equipment }) {
    const Icon = equipmentIcons[equipment.equipment_type] || BuildIcon;

    return (
        <Card sx={{
            height: '100%',
            transition: 'all 0.2s ease',
            '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)',
            }
        }}>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: equipment.is_available ? 'success.main' : 'grey.700',
                            display: 'flex',
                        }}>
                            <Icon sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Chip
                            size="small"
                            icon={equipment.is_available ? <AvailableIcon /> : <UnavailableIcon />}
                            label={equipment.is_available ? 'Available' : 'In Use'}
                            color={equipment.is_available ? 'success' : 'default'}
                        />
                    </Stack>

                    <Box>
                        <Typography variant="h6" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                            {equipment.equipment_type.replace('_', ' ')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {equipment.description || 'No description'}
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={2} alignItems="center">
                        <Box>
                            <Typography variant="caption" color="text.secondary">Quantity</Typography>
                            <Typography variant="h5" fontWeight={700}>{equipment.quantity}</Typography>
                        </Box>
                        {equipment.assigned_disaster_id && (
                            <Chip
                                size="small"
                                label={`Assigned to #${equipment.assigned_disaster_id}`}
                                color="warning"
                                variant="outlined"
                            />
                        )}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

export default function EquipmentPage() {
    const qc = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [equipmentType, setEquipmentType] = useState<EquipmentType>('ambulance');
    const [quantity, setQuantity] = useState('1');
    const [description, setDescription] = useState('');

    const { data: equipment, isLoading, error } = useQuery({
        queryKey: ['equipment'],
        queryFn: fetchEquipment,
    });

    const addMutation = useMutation({
        mutationFn: async (data: { equipment_type: EquipmentType; quantity: number; description: string }) => {
            await api.post('/api/authorities/equipment', data);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['equipment'] });
            setDialogOpen(false);
            setEquipmentType('ambulance');
            setQuantity('1');
            setDescription('');
        },
    });

    const handleSubmit = () => {
        addMutation.mutate({
            equipment_type: equipmentType,
            quantity: parseInt(quantity) || 1,
            description,
        });
    };

    const stats = React.useMemo(() => {
        const items = equipment ?? [];
        return {
            total: items.length,
            available: items.filter(e => e.is_available).length,
            inUse: items.filter(e => !e.is_available).length,
            totalQuantity: items.reduce((acc, e) => acc + e.quantity, 0),
        };
    }, [equipment]);

    return (
        <AppShell>
            <Stack spacing={3}>
                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                        <Typography variant="h4" fontWeight={800}>
                            Equipment Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Manage your authority's rescue equipment and resources
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setDialogOpen(true)}
                    >
                        Add Equipment
                    </Button>
                </Stack>

                {/* Stats cards */}
                <Grid container spacing={2}>
                    {[
                        { label: 'Total Types', value: stats.total, color: 'primary.main' },
                        { label: 'Available', value: stats.available, color: 'success.main' },
                        { label: 'In Use', value: stats.inUse, color: 'warning.main' },
                        { label: 'Total Units', value: stats.totalQuantity, color: 'info.main' },
                    ].map((stat) => (
                        <Grid item xs={6} md={3} key={stat.label}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                                <Typography variant="h3" fontWeight={800} sx={{ color: stat.color }}>
                                    {stat.value}
                                </Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                {/* Error state */}
                {error && <Alert severity="error">Failed to load equipment</Alert>}

                {/* Equipment grid */}
                {isLoading ? (
                    <Typography color="text.secondary">Loading equipment...</Typography>
                ) : (
                    <Grid container spacing={2}>
                        {(equipment ?? []).map((item) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                                <EquipmentCard equipment={item} />
                            </Grid>
                        ))}
                        {equipment?.length === 0 && (
                            <Grid item xs={12}>
                                <Paper sx={{ p: 6, textAlign: 'center' }}>
                                    <Typography color="text.secondary" mb={2}>
                                        No equipment registered yet
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        startIcon={<AddIcon />}
                                        onClick={() => setDialogOpen(true)}
                                    >
                                        Add Your First Equipment
                                    </Button>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>
                )}
            </Stack>

            {/* Add Equipment Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle fontWeight={700}>Add New Equipment</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Equipment Type</InputLabel>
                            <Select
                                value={equipmentType}
                                label="Equipment Type"
                                onChange={(e) => setEquipmentType(e.target.value as EquipmentType)}
                            >
                                <MenuItem value="ambulance">Ambulance</MenuItem>
                                <MenuItem value="boat">Rescue Boat</MenuItem>
                                <MenuItem value="rescue_kit">Rescue Kit</MenuItem>
                                <MenuItem value="drone">Drone</MenuItem>
                                <MenuItem value="fire_truck">Fire Truck</MenuItem>
                                <MenuItem value="other">Other</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            label="Quantity"
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            inputProps={{ min: 1 }}
                            fullWidth
                        />
                        <TextField
                            label="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            multiline
                            rows={2}
                            fullWidth
                            placeholder="e.g., 4x4 Off-road ambulance, equipped with medical supplies"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={addMutation.isPending}
                    >
                        {addMutation.isPending ? 'Adding...' : 'Add Equipment'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AppShell>
    );
}
