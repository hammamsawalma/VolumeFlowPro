import { CandleData, SignalDetection, BacktestConfig } from '../types';
export declare class SignalDetectionService {
    private calculateSMA;
    private calculateStdDev;
    private analyzeVolume;
    private isRedCandle;
    private isGreenCandle;
    private calculateBodyRatio;
    private detectPrimaryBuySignal;
    private detectBasicBuySignal;
    private detectPrimarySellSignal;
    private detectBasicSellSignal;
    detectSignals(candles: CandleData[], symbol: string, timeframe: string, config: BacktestConfig): SignalDetection[];
}
//# sourceMappingURL=signalDetection.d.ts.map