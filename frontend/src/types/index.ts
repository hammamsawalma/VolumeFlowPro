export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VolumeAnalysis {
  volumeMean: number;
  volumeStd: number;
  volumeStdBar: number;
  isVolumeColored: boolean;
}

export interface SignalDetection {
  type: 'PRIMARY_BUY' | 'BASIC_BUY' | 'PRIMARY_SELL' | 'BASIC_SELL';
  timestamp: number;
  price: number;
  symbol: string;
  timeframe: string;
  volumeData: VolumeAnalysis;
  candleData: {
    current: CandleData;
    previous1: CandleData;
    previous2: CandleData;
  };
}

export interface SignalPerformance {
  signalId: string;
  maxDrawup: number;
  maxDrawdown: number;
  maxDrawupPercent: number;
  maxDrawdownPercent: number;
  riskRewardRatio: number;
  isSuccessful: boolean;
  timeToMaxDrawup: number;
  timeToMaxDrawdown: number;
  finalPrice: number;
  finalPricePercent: number;
}

export interface BacktestConfig {
  symbols: string[];
  timeframes: string[];
  startDate: string;
  endDate: string;
  lookforwardCandles: number;
  volumeMaLength: number;
  volumeStdLength: number;
  volumeThresholds: {
    medium: number;
    high: number;
    extraHigh: number;
  };
  bodyRatioThreshold: number;
  enabledSignals: {
    primaryBuy: boolean;
    basicBuy: boolean;
    primarySell: boolean;
    basicSell: boolean;
  };
}

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  signals: SignalDetection[];
  performance: SignalPerformance[];
  summary: {
    totalSignals: number;
    successfulSignals: number;
    successRate: number;
    avgRiskReward: number;
    avgDrawup: number;
    avgDrawdown: number;
    bestSignal: SignalPerformance | null;
    worstSignal: SignalPerformance | null;
    perfectSignals: number;
  };
  createdAt: Date;
  completedAt: Date | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  error?: string;
}

export interface BinanceSymbolsResponse {
  symbols: string[];
  count: number;
  timestamp: string;
}

export interface BinanceTimeframesResponse {
  timeframes: string[];
  count: number;
}

export interface BinanceLimitsResponse {
  maxCandles: number;
  maxDaysBack: number;
}

export interface BacktestProgress {
  status: string;
  progress: number;
  error?: string;
}

export interface FilterOptions {
  signalTypes?: string[];
  symbols?: string[];
  timeframes?: string[];
  startDate?: string;
  endDate?: string;
  minRiskReward?: number;
  maxRiskReward?: number;
  onlySuccessful?: boolean;
}

export interface SignalSummary {
  summary: BacktestResult['summary'];
  signalsByType: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  signalsBySymbol: Array<{
    symbol: string;
    count: number;
    percentage: number;
  }>;
  signalsByTimeframe: Array<{
    timeframe: string;
    count: number;
    percentage: number;
  }>;
  performanceByType: Array<{
    type: string;
    total: number;
    successful: number;
    successRate: number;
    avgRiskReward: number;
  }>;
}
