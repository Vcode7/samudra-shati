'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '@/lib/api';

const roles = ['fire', 'police', 'coast_guard', 'smc', 'incois', 'admin'] as const;

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authority_type, setAuthorityType] = useState<(typeof roles)[number]>('fire');
  const [organization_name, setOrg] = useState('');
  const [contact_number, setContact] = useState('');
  const [base_latitude, setLat] = useState('13.0827');
  const [base_longitude, setLng] = useState('80.2707');
  const [operational_radius_km, setRadius] = useState('30');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post(
        '/api/authorities/register',
        {
          username,
          password,
          authority_type,
          organization_name,
          contact_number,
          base_latitude: Number(base_latitude),
          base_longitude: Number(base_longitude),
          operational_radius_km: Number(operational_radius_km),
        },
        {
          headers: {
            'X-Client': 'web',
          },
        }
      );

      router.replace('/login');
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={700}>
            Register Authority
          </Typography>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Box component="form" onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <TextField
                label="Role"
                select
                value={authority_type}
                onChange={(e) => setAuthorityType(e.target.value as any)}
                required
              >
                {roles.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>

              <TextField label="Organization" value={organization_name} onChange={(e) => setOrg(e.target.value)} required />
              <TextField label="Contact Number" value={contact_number} onChange={(e) => setContact(e.target.value)} required />

              <Stack direction="row" spacing={2}>
                <TextField label="Base Latitude" value={base_latitude} onChange={(e) => setLat(e.target.value)} required fullWidth />
                <TextField label="Base Longitude" value={base_longitude} onChange={(e) => setLng(e.target.value)} required fullWidth />
              </Stack>

              <TextField label="Operational Radius (km)" value={operational_radius_km} onChange={(e) => setRadius(e.target.value)} required />

              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Creating…' : 'Create account'}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
