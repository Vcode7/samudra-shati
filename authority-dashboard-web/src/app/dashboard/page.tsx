'use client';

import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { LiveAlertsTable } from '@/components/LiveAlertsTable';
import { LiveAlertsMap } from '@/components/LiveAlertsMap';
import { AppShell } from '@/components/AppShell';
import { DisasterDetailsDrawer } from '@/components/DisasterDetailsDrawer';
import type { DisasterReport } from '@/lib/types';

export default function DashboardPage() {
  const sp = useSearchParams();
  const initial = sp.get('tab') === 'map' ? 'map' : 'table';
  const [tab, setTab] = useState<'table' | 'map'>(initial);
  const [selected, setSelected] = useState<DisasterReport | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDetails = (d: DisasterReport) => {
    setSelected(d);
    setDrawerOpen(true);
  };

  return (
    <AppShell>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={900}>
            Live Emergency Monitor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Active disasters and emergency controls.
          </Typography>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="inherit" indicatorColor="primary">
          <Tab value="table" label="Table" />
          <Tab value="map" label="Map" />
        </Tabs>
        <Divider />

        {tab === 'table' ? (
          <LiveAlertsTable onOpenDetails={openDetails} />
        ) : (
          <LiveAlertsMap onOpenDetails={openDetails} />
        )}
      </Stack>

      <DisasterDetailsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        disaster={selected}
        onUpdated={() => {
          // Individual widgets will refetch themselves; no-op for now
        }}
      />
    </AppShell>
  );
}
