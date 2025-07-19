import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  CircularProgress,
  Alert,
  Tooltip,
  LinearProgress,
  TablePagination,
  Collapse,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterListIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Delete as DeleteIcon,
  Stop as StopIcon,
  CandlestickChart as ChartIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  backtestApi, 
  formatDate, 
  formatPercentage, 
  formatNumber, 
  getSignalTypeColor,
  getSignalTypeIcon 
} from '../services/api';
import { BacktestResult, FilterOptions, SignalDetection } from '../types';
import ChartModal from '../components/ChartModal/ChartModal';

// Chart imports
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Results: React.FC = () => {
  const [page, setPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<BacktestResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [signalPage, setSignalPage] = useState(0);
  const [signalRowsPerPage, setSignalRowsPerPage] = useState(25);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [analyticsTab, setAnalyticsTab] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({
    key: 'timestamp',
    direction: 'desc'
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resultToDelete, setResultToDelete] = useState<BacktestResult | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [resultToCancel, setResultToCancel] = useState<BacktestResult | null>(null);
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<SignalDetection | null>(null);

  const queryClient = useQueryClient();

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: backtestApi.deleteBacktest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtest-results'] });
      setDeleteDialogOpen(false);
      setResultToDelete(null);
    },
    onError: (error) => {
      console.error('Failed to delete backtest:', error);
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: backtestApi.cancelBacktest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtest-results'] });
      setCancelDialogOpen(false);
      setResultToCancel(null);
    },
    onError: (error) => {
      console.error('Failed to cancel backtest:', error);
    },
  });

  const handleDeleteClick = (result: BacktestResult) => {
    setResultToDelete(result);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (resultToDelete) {
      deleteMutation.mutate(resultToDelete.id);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setResultToDelete(null);
  };

  const handleCancelClick = (result: BacktestResult) => {
    setResultToCancel(result);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (resultToCancel) {
      cancelMutation.mutate(resultToCancel.id);
    }
  };

  const handleCancelCancel = () => {
    setCancelDialogOpen(false);
    setResultToCancel(null);
  };

  // Fetch all backtest results
  const { 
    data: resultsData, 
    isLoading: resultsLoading, 
    error: resultsError,
    refetch: refetchResults 
  } = useQuery({
    queryKey: ['backtest-results', page],
    queryFn: () => backtestApi.getAllBacktestResults(page, 10),
    refetchInterval: 30000,
  });

  // Fetch detailed result when selected
  const { 
    data: detailedResult, 
    isLoading: detailLoading 
  } = useQuery({
    queryKey: ['backtest-detail', selectedResult?.id],
    queryFn: () => selectedResult ? backtestApi.getBacktestResult(selectedResult.id) : null,
    enabled: !!selectedResult,
  });

  // Fetch filtered signals for detailed view
  const { 
    data: filteredSignals, 
    isLoading: signalsLoading 
  } = useQuery({
    queryKey: ['filtered-signals', selectedResult?.id, filters],
    queryFn: () => selectedResult ? backtestApi.getFilteredSignals(selectedResult.id, filters) : null,
    enabled: !!selectedResult,
  });

  const handleViewDetails = (result: BacktestResult) => {
    setSelectedResult(result);
    setDetailsOpen(true);
    setFilters({});
    setSignalPage(0);
    setAnalyticsTab(0);
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setSignalPage(0);
  };

  // Sorting functions
  const handleSort = (key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
    setSignalPage(0);
  };

  const getSortedSignals = () => {
    if (!filteredSignals) return [];

    const signalsWithPerformance = filteredSignals.signals.map((signal, index) => {
      const performance = findPerformanceForSignal(signal, index, filteredSignals.performances);
      return {
        ...signal,
        performance,
        maxDrawupPercent: performance?.maxDrawupPercent ?? 0,
        maxDrawdownPercent: performance?.maxDrawdownPercent ?? 0,
        riskRewardRatio: performance?.riskRewardRatio ?? 0,
        isSuccessful: performance?.isSuccessful ?? false,
      };
    });

    return signalsWithPerformance.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue: any;
      let bValue: any;

      switch (key) {
        case 'timestamp':
          aValue = a.timestamp ?? 0;
          bValue = b.timestamp ?? 0;
          break;
        case 'symbol':
          aValue = a.symbol ?? '';
          bValue = b.symbol ?? '';
          break;
        case 'type':
          aValue = a.type ?? '';
          bValue = b.type ?? '';
          break;
        case 'price':
          aValue = a.price ?? 0;
          bValue = b.price ?? 0;
          break;
        case 'maxDrawupPercent':
          aValue = a.maxDrawupPercent ?? 0;
          bValue = b.maxDrawupPercent ?? 0;
          break;
        case 'maxDrawdownPercent':
          aValue = Math.abs(a.maxDrawdownPercent ?? 0);
          bValue = Math.abs(b.maxDrawdownPercent ?? 0);
          break;
        case 'riskRewardRatio':
          aValue = a.riskRewardRatio ?? 0;
          bValue = b.riskRewardRatio ?? 0;
          break;
        case 'isSuccessful':
          aValue = a.isSuccessful ? 1 : 0;
          bValue = b.isSuccessful ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const SortableTableCell = ({ children, sortKey, ...props }: any) => (
    <TableCell
      {...props}
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
        fontWeight: sortConfig.key === sortKey ? 'bold' : 'normal',
        ...props.sx
      }}
      onClick={() => handleSort(sortKey)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {children}
        {sortConfig.key === sortKey && (
          sortConfig.direction === 'asc' ? 
            <ArrowUpwardIcon sx={{ fontSize: 16 }} /> : 
            <ArrowDownwardIcon sx={{ fontSize: 16 }} />
        )}
      </Box>
    </TableCell>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'RUNNING': return 'warning';
      case 'FAILED': return 'error';
      case 'CANCELLED': return 'error';
      case 'PENDING': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '✅';
      case 'RUNNING': return '⏳';
      case 'FAILED': return '❌';
      case 'CANCELLED': return '🛑';
      case 'PENDING': return '⏸️';
      default: return '❓';
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color = 'primary' }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color?: 'primary' | 'success' | 'error' | 'warning';
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={`${color}.main`}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ color: `${color}.main`, opacity: 0.7 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Enhanced performance matching function
  const findPerformanceForSignal = (signal: any, index: number, performances: any[]) => {
    // Strategy 1: Try exact signalId match
    let performance = performances.find(p => 
      p.signalId === `${signal.symbol}-${signal.timeframe}-${signal.timestamp}`
    );
    
    // Strategy 2: Try alternative signalId formats
    if (!performance) {
      performance = performances.find(p => 
        p.signalId === `${signal.symbol}_${signal.timeframe}_${signal.timestamp}` ||
        p.signalId === `${signal.symbol}:${signal.timeframe}:${signal.timestamp}`
      );
    }
    
    // Strategy 3: Try matching by index
    if (!performance && performances[index]) {
      performance = performances[index];
    }
    
    // Strategy 4: Try matching by timestamp and symbol
    if (!performance) {
      performance = performances.find(p => 
        p.timestamp === signal.timestamp && p.symbol === signal.symbol
      );
    }
    
    return performance;
  };

  // Prepare chart data with enhanced matching
  const prepareChartData = () => {
    if (!filteredSignals) return null;

    // Debug logging
    console.log('🔍 Debug - Filtered Signals:', filteredSignals);
    if (filteredSignals.signals.length > 0) {
      console.log('📊 Sample Signal:', filteredSignals.signals[0]);
    }
    if (filteredSignals.performances.length > 0) {
      console.log('📈 Sample Performance:', filteredSignals.performances[0]);
    }

    // Signal type distribution
    const signalTypeData = [
      { name: 'Primary Buy', value: filteredSignals.signals.filter(s => s.type === 'PRIMARY_BUY').length, color: '#4caf50' },
      { name: 'Basic Buy', value: filteredSignals.signals.filter(s => s.type === 'BASIC_BUY').length, color: '#2196f3' },
      { name: 'Primary Sell', value: filteredSignals.signals.filter(s => s.type === 'PRIMARY_SELL').length, color: '#f44336' },
      { name: 'Basic Sell', value: filteredSignals.signals.filter(s => s.type === 'BASIC_SELL').length, color: '#ff9800' },
    ].filter(item => item.value > 0);

    // Enhanced performance over time with better matching
    const timelineData = filteredSignals.signals
      .map((signal, index) => {
        const performance = findPerformanceForSignal(signal, index, filteredSignals.performances);
        return {
          date: new Date(signal.timestamp).toLocaleDateString(),
          timestamp: signal.timestamp,
          drawup: performance?.maxDrawupPercent || 0,
          drawdown: Math.abs(performance?.maxDrawdownPercent || 0),
          successful: performance?.isSuccessful ? 1 : 0,
          index,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    // Group timeline data by date for better visualization
    const groupedTimelineData = Object.entries(
      timelineData.reduce((acc, item) => {
        if (!acc[item.date]) {
          acc[item.date] = { 
            date: item.date, 
            timestamp: item.timestamp,
            drawups: [], 
            drawdowns: [], 
            successes: 0, 
            total: 0 
          };
        }
        acc[item.date].drawups.push(item.drawup);
        acc[item.date].drawdowns.push(item.drawdown);
        acc[item.date].successes += item.successful;
        acc[item.date].total += 1;
        return acc;
      }, {} as Record<string, any>)
    ).map(([_, data]) => ({
      date: data.date,
      timestamp: data.timestamp,
      drawup: data.drawups.reduce((sum: number, val: number) => sum + val, 0) / data.drawups.length,
      drawdown: data.drawdowns.reduce((sum: number, val: number) => sum + val, 0) / data.drawdowns.length,
      successRate: (data.successes / data.total) * 100,
      signalCount: data.total,
    })).sort((a, b) => a.timestamp - b.timestamp);

    // Enhanced symbol performance with better matching and debugging
    const symbolStats = filteredSignals.signals.reduce((acc, signal, index) => {
      const symbol = signal.symbol;
      if (!acc[symbol]) {
        acc[symbol] = { total: 0, successful: 0, totalDrawup: 0, totalDrawdown: 0, hasPerformance: 0 };
      }
      
      acc[symbol].total++;
      const performance = findPerformanceForSignal(signal, index, filteredSignals.performances);
      
      // Debug logging for first few signals
      if (index < 3) {
        console.log(`🔍 Symbol ${symbol} [${index}]:`, {
          signal: { symbol: signal.symbol, timestamp: signal.timestamp, type: signal.type },
          performance: performance ? {
            isSuccessful: performance.isSuccessful,
            maxDrawupPercent: performance.maxDrawupPercent,
            maxDrawdownPercent: performance.maxDrawdownPercent,
            signalId: performance.signalId
          } : null
        });
      }
      
      if (performance) {
        acc[symbol].hasPerformance++;
        if (performance.isSuccessful) {
          acc[symbol].successful++;
        }
        acc[symbol].totalDrawup += performance.maxDrawupPercent || 0;
        acc[symbol].totalDrawdown += Math.abs(performance.maxDrawdownPercent || 0);
      }
      
      return acc;
    }, {} as Record<string, any>);

    console.log('📊 Symbol Stats:', symbolStats);

    // Create symbol performance data with fallback for missing performance data
    const symbolPerformance = Object.entries(symbolStats)
      .map(([symbol, data]) => {
        // If we have performance data, use it; otherwise create basic stats
        const successRate = data.hasPerformance > 0 
          ? (data.successful / data.hasPerformance) * 100 
          : data.total > 0 ? 50 : 0; // Default to 50% if no performance data
        
        return {
          symbol,
          successRate,
          total: data.total,
          successful: data.successful,
          hasPerformance: data.hasPerformance,
          avgDrawup: data.hasPerformance > 0 ? data.totalDrawup / data.hasPerformance : 0,
          avgDrawdown: data.hasPerformance > 0 ? data.totalDrawdown / data.hasPerformance : 0,
        };
      })
      .filter(item => item.total > 0) // Only filter out symbols with no signals
      .sort((a, b) => {
        // Sort by success rate, then by total signals
        if (b.successRate !== a.successRate) {
          return b.successRate - a.successRate;
        }
        return b.total - a.total;
      })
      .slice(0, 10);

    console.log('📈 Symbol Performance:', symbolPerformance);

    // If no symbol performance data, create a basic distribution chart
    if (symbolPerformance.length === 0) {
      console.log('⚠️ No symbol performance data, creating basic distribution');
      const basicSymbolData = Object.entries(
        filteredSignals.signals.reduce((acc, signal) => {
          acc[signal.symbol] = (acc[signal.symbol] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([symbol, count]) => ({
        symbol,
        successRate: 50, // Default rate for visualization
        total: count,
        successful: Math.floor(count * 0.5),
        hasPerformance: 0,
        avgDrawup: 0,
        avgDrawdown: 0,
      })).sort((a, b) => b.total - a.total).slice(0, 10);
      
      symbolPerformance.push(...basicSymbolData);
    }

    // Enhanced Risk/Reward scatter data
    const scatterData = filteredSignals.performances
      .filter(perf => perf.maxDrawupPercent != null && perf.maxDrawdownPercent != null)
      .map((perf) => ({
        x: Math.abs(perf.maxDrawdownPercent),
        y: perf.maxDrawupPercent,
        riskReward: perf.riskRewardRatio,
        successful: perf.isSuccessful,
      }));

    console.log('📊 Chart Data Prepared:', {
      signalTypeCount: signalTypeData.length,
      timelineCount: groupedTimelineData.length,
      symbolCount: symbolPerformance.length,
      scatterCount: scatterData.length
    });

    return {
      signalTypeData,
      timelineData: groupedTimelineData,
      symbolPerformance,
      scatterData,
    };
  };

  const chartData = prepareChartData();

  if (resultsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (resultsError) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load backtest results. Please try again.
        </Alert>
        <Button variant="contained" onClick={() => refetchResults()}>
          Retry
        </Button>
      </Box>
    );
  }

  const results = resultsData?.results || [];
  const completedResults = results.filter(r => r.status === 'COMPLETED');
  const totalSignals = completedResults.reduce((sum, r) => sum + r.summary.totalSignals, 0);
  const totalSuccessful = completedResults.reduce((sum, r) => sum + r.summary.successfulSignals, 0);
  const avgSuccessRate = completedResults.length > 0 
    ? completedResults.reduce((sum, r) => sum + r.summary.successRate, 0) / completedResults.length 
    : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          📊 Backtest Results Analytics
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetchResults()}
          disabled={resultsLoading}
        >
          Refresh
        </Button>
      </Box>

      {/* Quick Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 4 }}>
        <StatCard
          title="Total Backtests"
          value={results.length}
          subtitle={`${completedResults.length} completed`}
          icon={<AssessmentIcon sx={{ fontSize: 40 }} />}
        />
        <StatCard
          title="Total Signals"
          value={totalSignals.toLocaleString()}
          subtitle={`${totalSuccessful.toLocaleString()} successful`}
          icon={<TimelineIcon sx={{ fontSize: 40 }} />}
          color="success"
        />
        <StatCard
          title="Average Success Rate"
          value={formatPercentage(avgSuccessRate)}
          icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
          color={avgSuccessRate >= 50 ? 'success' : 'warning'}
        />
        <StatCard
          title="Running Backtests"
          value={results.filter(r => r.status === 'RUNNING').length}
          icon={<CircularProgress size={24} />}
          color="warning"
        />
      </Box>

      {/* Results Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🗂️ Backtest History
          </Typography>
          
          {results.length === 0 ? (
            <Alert severity="info">
              No backtest results found. Start a backtest from the Configuration page to see results here.
            </Alert>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Symbols</TableCell>
                      <TableCell>Timeframes</TableCell>
                      <TableCell>Lookforward</TableCell>
                      <TableCell>Signals</TableCell>
                      <TableCell>Success Rate</TableCell>
                      <TableCell>Avg R/R</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id} hover>
                        <TableCell>
                          <Chip
                            label={`${getStatusIcon(result.status)} ${result.status}`}
                            color={getStatusColor(result.status) as any}
                            size="small"
                          />
                          {result.status === 'RUNNING' && (
                            <LinearProgress 
                              variant="determinate" 
                              value={result.progress} 
                              sx={{ mt: 1, width: 100 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(new Date(result.createdAt).getTime())}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {result.config.symbols.length} symbols
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {result.config.symbols.slice(0, 3).join(', ')}
                            {result.config.symbols.length > 3 && '...'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {result.config.timeframes.join(', ')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {result.config.lookforwardCandles || 24}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {result.summary.totalSignals.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            color={result.summary.successRate >= 50 ? 'success.main' : 'warning.main'}
                          >
                            {formatPercentage(result.summary.successRate)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatNumber(result.summary.avgRiskReward, 2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            {result.status === 'RUNNING' && (
                              <Tooltip title="Stop Backtest">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCancelClick(result)}
                                  disabled={cancelMutation.isPending}
                                  color="warning"
                                >
                                  <StopIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="View Analytics Dashboard">
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(result)}
                                disabled={result.status !== 'COMPLETED'}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Backtest">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(result)}
                                disabled={result.status === 'RUNNING' || deleteMutation.isPending}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {resultsData && resultsData.totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination
                    count={resultsData.totalPages}
                    page={page}
                    onChange={(_, newPage) => setPage(newPage)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Analytics Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { height: '95vh' } }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              📊 Interactive Analytics Dashboard
            </Typography>
            <Button
              startIcon={<FilterListIcon />}
              onClick={() => setFiltersOpen(!filtersOpen)}
              size="small"
            >
              Filters
            </Button>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : detailedResult && (
            <Box>
              {/* Summary Stats */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
                <StatCard
                  title="Total Signals"
                  value={detailedResult.summary.totalSignals}
                  icon={<TimelineIcon />}
                />
                <StatCard
                  title="Success Rate"
                  value={formatPercentage(detailedResult.summary.successRate)}
                  icon={<TrendingUpIcon />}
                  color={detailedResult.summary.successRate >= 50 ? 'success' : 'warning'}
                />
                <StatCard
                  title="Avg Risk/Reward"
                  value={formatNumber(detailedResult.summary.avgRiskReward, 2)}
                  icon={<AssessmentIcon />}
                />
                <StatCard
                  title="Avg Drawdown"
                  value={formatPercentage(detailedResult.summary.avgDrawdown)}
                  icon={<TrendingDownIcon />}
                  color="error"
                />
              </Box>

              {/* Filters */}
              <Collapse in={filtersOpen}>
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      🔍 Advanced Filters
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Signal Type</InputLabel>
                        <Select
                          value={filters.signalTypes?.[0] || ''}
                          onChange={(e) => handleFilterChange('signalTypes', e.target.value ? [e.target.value] : undefined)}
                        >
                          <MenuItem value="">All Types</MenuItem>
                          <MenuItem value="PRIMARY_BUY">Primary Buy</MenuItem>
                          <MenuItem value="BASIC_BUY">Basic Buy</MenuItem>
                          <MenuItem value="PRIMARY_SELL">Primary Sell</MenuItem>
                          <MenuItem value="BASIC_SELL">Basic Sell</MenuItem>
                        </Select>
                      </FormControl>
                      <FormControl fullWidth size="small">
                        <InputLabel>Symbol</InputLabel>
                        <Select
                          value={filters.symbols?.[0] || ''}
                          onChange={(e) => handleFilterChange('symbols', e.target.value ? [e.target.value] : undefined)}
                        >
                          <MenuItem value="">All Symbols</MenuItem>
                          {detailedResult.config.symbols.map(symbol => (
                            <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth size="small">
                        <InputLabel>Timeframe</InputLabel>
                        <Select
                          value={filters.timeframes?.[0] || ''}
                          onChange={(e) => handleFilterChange('timeframes', e.target.value ? [e.target.value] : undefined)}
                        >
                          <MenuItem value="">All Timeframes</MenuItem>
                          {detailedResult.config.timeframes.map(tf => (
                            <MenuItem key={tf} value={tf}>{tf}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth size="small">
                        <InputLabel>Performance</InputLabel>
                        <Select
                          value={filters.onlySuccessful ? 'successful' : 'all'}
                          onChange={(e) => handleFilterChange('onlySuccessful', e.target.value === 'successful')}
                        >
                          <MenuItem value="all">All Signals</MenuItem>
                          <MenuItem value="successful">Successful Only</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </CardContent>
                </Card>
              </Collapse>

              {/* Analytics Tabs */}
              <Paper sx={{ width: '100%' }}>
                <Tabs 
                  value={analyticsTab} 
                  onChange={(_, newValue) => setAnalyticsTab(newValue)}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab icon={<PieChartIcon />} label="Distribution" />
                  <Tab icon={<ShowChartIcon />} label="Timeline" />
                  <Tab icon={<BarChartIcon />} label="Symbols" />
                  <Tab icon={<AssessmentIcon />} label="Risk/Reward" />
                  <Tab icon={<TimelineIcon />} label="Details" />
                </Tabs>

                {/* Tab 1: Signal Distribution */}
                <TabPanel value={analyticsTab} index={0}>
                  <Typography variant="h6" gutterBottom>
                    📊 Signal Type Distribution
                  </Typography>
                  {chartData?.signalTypeData && chartData.signalTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={chartData.signalTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) => `${name}: ${value} (${((percent || 0) * 100).toFixed(1)}%)`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {chartData.signalTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Alert severity="info">No signal data available for visualization.</Alert>
                  )}
                </TabPanel>

                {/* Tab 2: Performance Timeline */}
                <TabPanel value={analyticsTab} index={1}>
                  <Typography variant="h6" gutterBottom>
                    📈 Performance Over Time
                  </Typography>
                  {chartData?.timelineData && chartData.timelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={chartData.timelineData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="drawup" 
                          stroke="#4caf50" 
                          name="Max Drawup %" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="drawdown" 
                          stroke="#f44336" 
                          name="Max Drawdown %" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Alert severity="info">No timeline data available for visualization.</Alert>
                  )}
                </TabPanel>

                {/* Tab 3: Symbol Performance */}
                <TabPanel value={analyticsTab} index={2}>
                  <Typography variant="h6" gutterBottom>
                    🎯 Top Performing Symbols
                  </Typography>
                  {chartData?.symbolPerformance && chartData.symbolPerformance.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={chartData.symbolPerformance} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis dataKey="symbol" type="category" width={80} />
                        <RechartsTooltip 
                          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Success Rate']}
                          labelFormatter={(label) => `Symbol: ${label}`}
                        />
                        <Bar dataKey="successRate" fill="#4caf50" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Alert severity="info">No symbol performance data available.</Alert>
                  )}
                </TabPanel>

                {/* Tab 4: Risk/Reward Analysis */}
                <TabPanel value={analyticsTab} index={3}>
                  <Typography variant="h6" gutterBottom>
                    ⚖️ Risk vs Reward Analysis
                  </Typography>
                  {chartData?.scatterData && chartData.scatterData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart data={chartData.scatterData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="x" 
                          name="Risk (Drawdown %)" 
                          label={{ value: 'Risk (Drawdown %)', position: 'insideBottom', offset: -10 }}
                        />
                        <YAxis 
                          dataKey="y" 
                          name="Reward (Drawup %)" 
                          label={{ value: 'Reward (Drawup %)', angle: -90, position: 'insideLeft' }}
                        />
                        <RechartsTooltip 
                          formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Value']}
                        />
                        <Scatter dataKey="y" fill="#2196f3" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <Alert severity="info">No risk/reward data available for visualization.</Alert>
                  )}
                </TabPanel>

                {/* Tab 5: Signal Details Table */}
                <TabPanel value={analyticsTab} index={4}>
                  <Typography variant="h6" gutterBottom>
                    📋 Detailed Signal Analysis
                  </Typography>
                  
                  {signalsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                      <CircularProgress />
                    </Box>
                  ) : filteredSignals && (
                    <>
                      <TableContainer sx={{ maxHeight: 400 }}>
                        <Table stickyHeader size="small">
                          <TableHead>
                            <TableRow>
                              <SortableTableCell sortKey="type">Type</SortableTableCell>
                              <SortableTableCell sortKey="symbol">Symbol</SortableTableCell>
                              <TableCell>Timeframe</TableCell>
                              <TableCell>Lookforward</TableCell>
                              <SortableTableCell sortKey="timestamp">Date</SortableTableCell>
                              <SortableTableCell sortKey="price">Price</SortableTableCell>
                              <SortableTableCell sortKey="maxDrawupPercent">Max Drawup</SortableTableCell>
                              <SortableTableCell sortKey="maxDrawdownPercent">Max Drawdown</SortableTableCell>
                              <SortableTableCell sortKey="riskRewardRatio">R/R Ratio</SortableTableCell>
                              <SortableTableCell sortKey="isSuccessful">Success</SortableTableCell>
                              <TableCell>Chart</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {getSortedSignals()
                              .slice(signalPage * signalRowsPerPage, signalPage * signalRowsPerPage + signalRowsPerPage)
                              .map((signal, index) => (
                                <TableRow key={`${signal.symbol}-${signal.timestamp}-${index}`} hover>
                                  <TableCell>
                                    <Chip
                                      label={`${getSignalTypeIcon(signal.type)} ${signal.type.replace('_', ' ')}`}
                                      size="small"
                                      sx={{ 
                                        backgroundColor: getSignalTypeColor(signal.type) + '20',
                                        color: getSignalTypeColor(signal.type),
                                        fontWeight: 'bold'
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>{signal.symbol}</TableCell>
                                  <TableCell>{signal.timeframe}</TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {detailedResult?.config.lookforwardCandles || 24}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption">
                                      {formatDate(signal.timestamp)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>${formatNumber(signal.price)}</TableCell>
                                  <TableCell>
                                    <Typography color="success.main">
                                      {signal.performance ? formatPercentage(signal.performance.maxDrawupPercent) : 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography color="error.main">
                                      {signal.performance ? formatPercentage(signal.performance.maxDrawdownPercent) : 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {signal.performance ? formatNumber(signal.performance.riskRewardRatio, 2) : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {signal.performance ? (
                                      <Chip
                                        label={signal.performance.isSuccessful ? '✅ Success' : '❌ Failed'}
                                        color={signal.performance.isSuccessful ? 'success' : 'error'}
                                        size="small"
                                      />
                                    ) : (
                                      <Chip label="❓ Unknown" color="default" size="small" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Tooltip title="View Chart">
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          setSelectedSignal(signal);
                                          setChartModalOpen(true);
                                        }}
                                        color="primary"
                                      >
                                        <ChartIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      <TablePagination
                        component="div"
                        count={filteredSignals.totalSignals}
                        page={signalPage}
                        onPageChange={(_, newPage) => setSignalPage(newPage)}
                        rowsPerPage={signalRowsPerPage}
                        onRowsPerPageChange={(e) => {
                          setSignalRowsPerPage(parseInt(e.target.value, 10));
                          setSignalPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                      />
                    </>
                  )}
                </TabPanel>
              </Paper>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          🗑️ Delete Backtest Result
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this backtest result?
          </Typography>
          {resultToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Created:</strong> {formatDate(new Date(resultToDelete.createdAt).getTime())}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Symbols:</strong> {resultToDelete.config.symbols.length} symbols
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Signals:</strong> {resultToDelete.summary.totalSignals.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Success Rate:</strong> {formatPercentage(resultToDelete.summary.successRate)}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. All associated data will be permanently deleted.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={handleCancelCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          🛑 Stop Running Backtest
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to stop this running backtest?
          </Typography>
          {resultToCancel && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Created:</strong> {formatDate(new Date(resultToCancel.createdAt).getTime())}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Symbols:</strong> {resultToCancel.config.symbols.length} symbols
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Progress:</strong> {resultToCancel.progress}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Status:</strong> {resultToCancel.status}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will immediately stop the backtest process. The backtest will be marked as cancelled and can be deleted.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelCancel} disabled={cancelMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleCancelConfirm} 
            color="warning" 
            variant="contained"
            disabled={cancelMutation.isPending}
            startIcon={cancelMutation.isPending ? <CircularProgress size={16} /> : <StopIcon />}
          >
            {cancelMutation.isPending ? 'Stopping...' : 'Stop Backtest'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Chart Modal */}
      {selectedSignal && (
        <ChartModal
          isOpen={chartModalOpen}
          onClose={() => {
            setChartModalOpen(false);
            setSelectedSignal(null);
          }}
          symbol={selectedSignal.symbol}
          timeframe={selectedSignal.timeframe}
          signalTimestamp={selectedSignal.timestamp}
          signalType={selectedSignal.type}
          signalPrice={selectedSignal.price}
          candleData={selectedSignal.candleData}
        />
      )}
    </Box>
  );
};

export default Results;
