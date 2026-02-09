'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Map as MapIcon,
  Build as EquipmentIcon,
  Analytics as AnalyticsIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/lib/authStore';

const drawerWidth = 280;

const navItems = [
  { label: 'Live Alerts', href: '/dashboard', icon: DashboardIcon },
  { label: 'Map Monitor', href: '/dashboard?tab=map', icon: MapIcon },
  { label: 'Equipment', href: '/dashboard/equipment', icon: EquipmentIcon },
  { label: 'Analytics', href: '/dashboard/analytics', icon: AnalyticsIcon },
  { label: 'Notifications', href: '/dashboard/notifications', icon: NotificationsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const searchParams = useSearchParams();

  const onLogout = () => {
    clear();
    router.replace('/login');
  };

  const isSelected = (href: string) => {
    const tabParam = searchParams.get('tab');
    if (href === '/dashboard') {
      return pathname === '/dashboard' && tabParam !== 'map';
    }
    if (href.includes('?tab=map')) {
      return pathname === '/dashboard' && tabParam === 'map';
    }
    return pathname.startsWith(href.split('?')[0]);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
        }}
        elevation={0}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
            <WarningIcon sx={{ color: 'error.main', fontSize: 28 }} />
            <Typography variant="h6" fontWeight={800} sx={{
              background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Smart Disaster Command Center
            </Typography>
            <Chip
              label="LIVE"
              size="small"
              color="error"
              sx={{
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
          </Box>
          <Button
            color="inherit"
            onClick={onLogout}
            startIcon={<LogoutIcon />}
            sx={{ color: 'text.secondary' }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
              A
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>Authority</Typography>
              <Typography variant="caption" color="text.secondary">Command Access</Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

        <Box sx={{ px: 1, py: 2 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ px: 2, fontSize: '0.65rem', letterSpacing: 1.5 }}
          >
            Main Menu
          </Typography>
        </Box>

        <List sx={{ px: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = isSelected(item.href);
            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={selected}
                sx={{
                  mb: 0.5,
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    transform: 'translateX(4px)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    borderLeft: '3px solid',
                    borderLeftColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'rgba(99, 102, 241, 0.25)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon sx={{
                    color: selected ? 'primary.main' : 'text.secondary',
                    fontSize: 22,
                  }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: selected ? 600 : 500,
                    fontSize: '0.9rem',
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box component="main" sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

