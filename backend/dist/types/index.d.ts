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
    };
    createdAt: Date;
    completedAt: Date | null;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
    error?: string;
}
export interface BinanceKlineData {
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    quoteAssetVolume: string;
    numberOfTrades: number;
    takerBuyBaseAssetVolume: string;
    takerBuyQuoteAssetVolume: string;
    ignore: string;
}
//# sourceMappingURL=index.d.ts.map