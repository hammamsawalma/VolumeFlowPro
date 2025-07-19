import { BacktestConfig, BacktestResult, SignalDetection, SignalPerformance } from '../types';
export declare class BacktestService {
    private binanceService;
    private signalDetectionService;
    private performanceAnalysisService;
    constructor();
    startBacktest(config: BacktestConfig): Promise<string>;
    private runBacktest;
    private updateBacktestStatus;
    getBacktestResult(backtestId: string): Promise<BacktestResult | null>;
    getAllBacktestResults(page?: number, limit?: number): Promise<{
        results: BacktestResult[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    deleteBacktestResult(backtestId: string): Promise<boolean>;
    getBacktestProgress(backtestId: string): Promise<{
        status: string;
        progress: number;
        error?: string;
    } | null>;
    cancelBacktest(backtestId: string): Promise<boolean>;
    getFilteredSignals(backtestId: string, filters: {
        signalTypes?: string[];
        symbols?: string[];
        timeframes?: string[];
        startDate?: string;
        endDate?: string;
        minRiskReward?: number;
        maxRiskReward?: number;
        onlySuccessful?: boolean;
    }): Promise<{
        signals: SignalDetection[];
        performances: SignalPerformance[];
    } | null>;
    validateConfig(config: BacktestConfig): {
        isValid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=backtestService.d.ts.map