import { CandleData, SignalDetection, SignalPerformance, BacktestConfig } from '../types';
export declare class PerformanceAnalysisService {
    analyzeSignalPerformance(signal: SignalDetection, candles: CandleData[], signalIndex: number, config: BacktestConfig): SignalPerformance;
    private createEmptyPerformance;
    private generateSignalId;
    calculateSummaryStatistics(performances: SignalPerformance[]): {
        totalSignals: number;
        successfulSignals: number;
        successRate: number;
        avgRiskReward: number;
        avgDrawup: number;
        avgDrawdown: number;
        bestSignal: SignalPerformance | null;
        worstSignal: SignalPerformance | null;
    };
    filterPerformances(performances: SignalPerformance[], filters: {
        signalTypes?: string[];
        minRiskReward?: number;
        maxRiskReward?: number;
        minSuccessRate?: number;
        onlySuccessful?: boolean;
    }): SignalPerformance[];
    groupPerformances(performances: SignalPerformance[], groupBy: 'signalType' | 'symbol' | 'timeframe' | 'success'): {
        [key: string]: SignalPerformance[];
    };
    calculateTimeBasedMetrics(signals: SignalDetection[], performances: SignalPerformance[]): {
        hourlyDistribution: {
            [hour: string]: number;
        };
        dailyDistribution: {
            [day: string]: number;
        };
        monthlyDistribution: {
            [month: string]: number;
        };
    };
}
//# sourceMappingURL=performanceAnalysis.d.ts.map