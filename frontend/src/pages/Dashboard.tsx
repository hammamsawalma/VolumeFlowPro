import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { backtestApi, binanceApi, formatDate, formatPercentage } from '../services/api';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Fetch recent backtests
  const { data: backtestsData, isLoading: backtestsLoading } = useQuery({
    queryKey: ['backtests', 1, 5],
    queryFn: () => backtestApi.getAllBacktestResults(1, 5),
  });

  // Test Binance connection
  const { data: connectionData } = useQuery({
    queryKey: ['binance-connection'],
    queryFn: binanceApi.testConnection,
    refetchInterval: 60000, // Check every minute
  });

  // Get Binance limits
  const { data: limitsData } = useQuery({
    queryKey: ['binance-limits'],
    queryFn: binanceApi.getLimits,
  });

  const handleStartBacktest = () => {
    navigate('/configuration');
  };

  const handleViewResults = (backtestId: string) => {
    navigate(`/results/${backtestId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'RUNNING':
        return 'info';
      case 'FAILED':
        return 'error';
      case 'PENDING':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <TrendingUpIcon />;
      case 'FAILED':
        return <TrendingDownIcon />;
      default:
        return <AssessmentIcon />;
    }
  };

  // Calculate summary statistics
  const completedBacktests = backtestsData?.results.filter(b => b.status === 'COMPLETED') || [];
  const runningBacktests = backtestsData?.results.filter(b => b.status === 'RUNNING') || [];
  const totalSignals = completedBacktests.reduce((sum, b) => sum + b.summary.totalSignals, 0);
  const avgSuccessRate = completedBacktests.length > 0 
    ? completedBacktests.reduce((sum, b) => sum + b.summary.successRate, 0) / completedBacktests.length 
    : 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Welcome to the Volume Pattern Backtest application. Monitor your backtests and analyze trading signals.
      </Typography>

      {/* Connection Status */}
      <Box sx={{ mb: 3 }}>
        {connectionData ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Connected to Binance API - Data is available for backtesting
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Unable to connect to Binance API - Please check your connection
          </Alert>
        )}
      </Box>

      {/* Quick Stats */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 3, 
        mb: 4,
        '& > *': { flex: '1 1 250px', minWidth: '250px' }
      }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="text.secondary" gutterBottom>
                  Total Backtests
                </Typography>
                <Typography variant="h4">
                  {backtestsData?.total || 0}
                </Typography>
              </Box>
              <AssessmentIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="text.secondary" gutterBottom>
                  Running Tests
                </Typography>
                <Typography variant="h4">
                  {runningBacktests.length}
                </Typography>
              </Box>
              <PlayArrowIcon color="info" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="text.secondary" gutterBottom>
                  Total Signals
                </Typography>
                <Typography variant="h4">
                  {totalSignals.toLocaleString()}
                </Typography>
              </Box>
              <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography color="text.secondary" gutterBottom>
                  Avg Success Rate
                </Typography>
                <Typography variant="h4">
                  {formatPercentage(avgSuccessRate)}
                </Typography>
              </Box>
              <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Quick Actions */}
        <Box sx={{ flex: '0 0 300px', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleStartBacktest}
                  fullWidth
                  size="large"
                >
                  Start New Backtest
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() => navigate('/results')}
                  fullWidth
                >
                  View All Results
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/backtest-manager')}
                  fullWidth
                >
                  Manage Backtests
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* System Info */}
          {limitsData && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Max Historical Data:</strong> {limitsData.maxDaysBack} days
                  </Typography>
                  <Typography variant="body2">
                    <strong>Max Candles per Request:</strong> {limitsData.maxCandles}
                  </Typography>
                  <Typography variant="body2">
                    <strong>API Status:</strong>{' '}
                    <Chip
                      label={connectionData ? 'Connected' : 'Disconnected'}
                      color={connectionData ? 'success' : 'error'}
                      size="small"
                    />
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Recent Backtests */}
        <Box sx={{ flex: '1 1 400px', minWidth: '400px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Backtests
              </Typography>
              {backtestsLoading ? (
                <LinearProgress />
              ) : backtestsData?.results.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No backtests found. Start your first backtest to see results here.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleStartBacktest}
                    sx={{ mt: 2 }}
                  >
                    Start First Backtest
                  </Button>
                </Paper>
              ) : (
                <List>
                  {backtestsData?.results.map((backtest) => (
                    <ListItem key={backtest.id} divider>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getStatusIcon(backtest.status)}
                            <Typography variant="subtitle1">
                              {backtest.config.symbols.slice(0, 3).join(', ')}
                              {backtest.config.symbols.length > 3 && ` +${backtest.config.symbols.length - 3} more`}
                            </Typography>
                            <Chip
                              label={backtest.status}
                              color={getStatusColor(backtest.status) as any}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Created: {formatDate(new Date(backtest.createdAt).getTime())}
                            </Typography>
                            {backtest.status === 'RUNNING' && (
                              <Box sx={{ mt: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={backtest.progress}
                                  sx={{ mb: 0.5 }}
                                />
                                <Typography variant="caption">
                                  Progress: {backtest.progress}%
                                </Typography>
                              </Box>
                            )}
                            {backtest.status === 'COMPLETED' && (
                              <Typography variant="body2" color="success.main">
                                {backtest.summary.totalSignals} signals detected, {formatPercentage(backtest.summary.successRate)} success rate
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleViewResults(backtest.id)}
                          disabled={backtest.status !== 'COMPLETED'}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
