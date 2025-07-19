import { CandleData } from '../types';
export declare class BinanceService {
    private baseUrl;
    private requestCount;
    private lastRequestTime;
    private readonly RATE_LIMIT;
    private readonly RATE_LIMIT_WINDOW;
    private rateLimit;
    getUSDTPerpetualSymbols(): Promise<string[]>;
    getSupportedTimeframes(): string[];
    getHistoricalDataLimits(): {
        maxCandles: number;
        maxDaysBack: number;
    };
    private convertKlineData;
    getHistoricalData(symbol: string, timeframe: string, startTime?: number, endTime?: number, limit?: number): Promise<CandleData[]>;
    getHistoricalDataBatched(symbol: string, timeframe: string, startDate: Date, endDate: Date): Promise<{
        data: CandleData[];
        dataRange: {
            start: Date;
            end: Date;
        };
    }>;
    private getTimeframeInMs;
    testConnection(): Promise<boolean>;
    getServerTime(): Promise<number>;
}
//# sourceMappingURL=binanceService.d.ts.map