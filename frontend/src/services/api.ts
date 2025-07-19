import axios from 'axios';
import {
  BacktestConfig,
  BacktestResult,
  BinanceSymbolsResponse,
  BinanceTimeframesResponse,
  BinanceLimitsResponse,
  BacktestProgress,
  FilterOptions,
  SignalSummary,
  SignalDetection,
  SignalPerformance
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Binance API endpoints
export const binanceApi = {
  // Test connection to Binance API
  testConnection: async (): Promise<{ connected: boolean; timestamp: string }> => {
    const response = await api.get('/binance/test-connection');
    return response.data;
  },

  // Get all USDT perpetual symbols
  getSymbols: async (): Promise<BinanceSymbolsResponse> => {
    const response = await api.get('/binance/symbols');
    return response.data;
  },

  // Get supported timeframes
  getTimeframes: async (): Promise<BinanceTimeframesResponse> => {
    const response = await api.get('/binance/timeframes');
    return response.data;
  },

  // Get historical data limits
  getLimits: async (): Promise<BinanceLimitsResponse> => {
    const response = await api.get('/binance/limits');
    return response.data;
  },

  // Get server time
  getServerTime: async (): Promise<{
    serverTime: number;
    serverTimeISO: string;
    localTime: number;
    localTimeISO: string;
  }> => {
    const response = await api.get('/binance/server-time');
    return response.data;
  },

  // Preview data availability
  previewData: async (data: {
    symbols: string[];
    timeframes: string[];
    startDate: string;
    endDate: string;
  }): Promise<{
    preview: Array<{
      symbol: string;
      timeframe: string;
      available: boolean;
      dataCount: number;
      actualRange: { start: string; end: string } | null;
      error: string | null;
    }>;
    totalCombinations: number;
    sampledCombinations: number;
    requestedRange: { startDate: string; endDate: string };
  }> => {
    const response = await api.post('/binance/preview-data', data);
    return response.data;
  },
};

// Backtest API endpoints
export const backtestApi = {
  // Start a new backtest
  startBacktest: async (config: BacktestConfig): Promise<{
    backtestId: string;
    status: string;
    message: string;
  }> => {
    const response = await api.post('/backtest/start', config);
    return response.data;
  },

  // Get backtest result by ID
  getBacktestResult: async (backtestId: string): Promise<BacktestResult> => {
    const response = await api.get(`/backtest/${backtestId}`);
    return response.data;
  },

  // Get all backtest results with pagination
  getAllBacktestResults: async (page: number = 1, limit: number = 10): Promise<{
    results: BacktestResult[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const response = await api.get(`/backtest?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get backtest progress
  getBacktestProgress: async (backtestId: string): Promise<BacktestProgress> => {
    const response = await api.get(`/backtest/${backtestId}/progress`);
    return response.data;
  },

  // Cancel a running backtest
  cancelBacktest: async (backtestId: string): Promise<{ message: string }> => {
    const response = await api.post(`/backtest/${backtestId}/cancel`);
    return response.data;
  },

  // Delete a backtest result
  deleteBacktest: async (backtestId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/backtest/${backtestId}`);
    return response.data;
  },

  // Get filtered signals from a backtest
  getFilteredSignals: async (
    backtestId: string,
    filters: FilterOptions
  ): Promise<{
    signals: SignalDetection[];
    performances: SignalPerformance[];
    totalSignals: number;
    totalPerformances: number;
    filters: FilterOptions;
  }> => {
    const response = await api.post(`/backtest/${backtestId}/signals/filter`, filters);
    return response.data;
  },

  // Get signals summary for a backtest
  getSignalsSummary: async (backtestId: string): Promise<SignalSummary> => {
    const response = await api.get(`/backtest/${backtestId}/signals/summary`);
    return response.data;
  },

  // Export backtest results to CSV
  exportToCsv: async (backtestId: string): Promise<Blob> => {
    const response = await api.get(`/backtest/${backtestId}/export/csv`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Validate backtest configuration
  validateConfig: async (config: BacktestConfig): Promise<{
    isValid: boolean;
    errors: string[];
  }> => {
    const response = await api.post('/backtest/validate-config', config);
    return response.data;
  },
};

// Health check endpoint
export const healthApi = {
  checkHealth: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await api.get('/health');
    return response.data;
  },
};

// Utility functions
export const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const formatDate = (timestamp: number | string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatNumber = (value: number | null | undefined, decimals: number = 4): string => {
  if (value === null || value === undefined || isNaN(Number(value)) || !isFinite(Number(value))) {
    return 'N/A';
  }
  return Number(value).toFixed(decimals);
};

export const getSignalTypeColor = (type: string): string => {
  switch (type) {
    case 'PRIMARY_BUY':
      return '#4caf50'; // Green
    case 'BASIC_BUY':
      return '#2196f3'; // Blue
    case 'PRIMARY_SELL':
      return '#f44336'; // Red
    case 'BASIC_SELL':
      return '#ff9800'; // Orange
    default:
      return '#757575'; // Gray
  }
};

export const getSignalTypeIcon = (type: string): string => {
  switch (type) {
    case 'PRIMARY_BUY':
      return '🟢';
    case 'BASIC_BUY':
      return '🔵';
    case 'PRIMARY_SELL':
      return '🔴';
    case 'BASIC_SELL':
      return '🟠';
    default:
      return '⚪';
  }
};

export default api;
