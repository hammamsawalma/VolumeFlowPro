import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayArrowIcon,
  Assessment as AssessmentIcon,
  ManageAccounts as ManageAccountsIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '../../services/api';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  {
    text: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/dashboard',
    enabled: true,
  },
  {
    text: 'Configuration',
    icon: <SettingsIcon />,
    path: '/configuration',
    enabled: true,
  },
  {
    text: 'Backtest Manager',
    icon: <ManageAccountsIcon />,
    path: '/backtest-manager',
    enabled: false,
    comingSoon: true,
  },
  {
    text: 'Results',
    icon: <AssessmentIcon />,
    path: '/results',
    enabled: true,
  },
  {
    text: 'Settings',
    icon: <PlayArrowIcon />,
    path: '/settings',
    enabled: false,
    comingSoon: true,
  },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  // Check API health
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: healthApi.checkHealth,
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string, enabled: boolean) => {
    if (enabled) {
      navigate(path);
      if (isMobile) {
        setMobileOpen(false);
      }
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon color="primary" />
          <Typography variant="h6" noWrap component="div" color="primary">
            Volume Backtest
          </Typography>
        </Box>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path && item.enabled}
              onClick={() => handleNavigation(item.path, item.enabled)}
              disabled={!item.enabled}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '20',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main + '30',
                  },
                },
                '&.Mui-disabled': {
                  opacity: 0.6,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path && item.enabled 
                    ? theme.palette.primary.main 
                    : !item.enabled 
                    ? theme.palette.text.disabled 
                    : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{item.text}</span>
                    {item.comingSoon && (
                      <Chip 
                        label="Soon" 
                        size="small" 
                        color="secondary" 
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: '16px' }}
                      />
                    )}
                  </Box>
                }
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: location.pathname === item.path && item.enabled ? 600 : 400,
                    color: location.pathname === item.path && item.enabled 
                      ? theme.palette.primary.main 
                      : !item.enabled 
                      ? theme.palette.text.disabled 
                      : 'inherit',
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Volume Pattern Backtest
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={healthData ? 'API Connected' : 'API Disconnected'}
              color={healthData ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
