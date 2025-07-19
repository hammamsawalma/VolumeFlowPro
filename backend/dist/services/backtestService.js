"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestService = void 0;
const uuid_1 = require("uuid");
const BacktestResult_1 = require("../models/BacktestResult");
const binanceService_1 = require("./binanceService");
const signalDetection_1 = require("./signalDetection");
const performanceAnalysis_1 = require("./performanceAnalysis");
class BacktestService {
    constructor() {
        this.binanceService = new binanceService_1.BinanceService();
        this.signalDetectionService = new signalDetection_1.SignalDetectionService();
        this.performanceAnalysisService = new performanceAnalysis_1.PerformanceAnalysisService();
    }
    async startBacktest(config) {
        const backtestId = (0, uuid_1.v4)();
        const backtestResult = {
            id: backtestId,
            config,
            signals: [],
            performance: [],
            summary: {
                totalSignals: 0,
                successfulSignals: 0,
                successRate: 0,
                avgRiskReward: 0,
                avgDrawup: 0,
                avgDrawdown: 0,
                bestSignal: null,
                worstSignal: null
            },
            createdAt: new Date(),
            completedAt: null,
            status: 'PENDING',
            progress: 0
        };
        const backtestDoc = new BacktestResult_1.BacktestResultModel(backtestResult);
        await backtestDoc.save();
        this.runBacktest(backtestId).catch(error => {
            console.error(`Backtest ${backtestId} failed:`, error);
            this.updateBacktestStatus(backtestId, 'FAILED', 0, error.message);
        });
        return backtestId;
    }
    async runBacktest(backtestId) {
        console.log(`Starting backtest ${backtestId}`);
        try {
            await this.updateBacktestStatus(backtestId, 'RUNNING', 0);
            const backtestDoc = await BacktestResult_1.BacktestResultModel.findOne({ id: backtestId });
            if (!backtestDoc) {
                throw new Error('Backtest not found');
            }
            const config = backtestDoc.config;
            const allSignals = [];
            const allPerformances = [];
            const totalCombinations = config.symbols.length * config.timeframes.length;
            let completedCombinations = 0;
            for (const symbol of config.symbols) {
                for (const timeframe of config.timeframes) {
                    try {
                        console.log(`Processing ${symbol} ${timeframe}`);
                        const startDate = new Date(config.startDate);
                        const endDate = new Date(config.endDate);
                        const { data: candles, dataRange } = await this.binanceService.getHistoricalDataBatched(symbol, timeframe, startDate, endDate);
                        if (candles.length === 0) {
                            console.log(`No data available for ${symbol} ${timeframe}`);
                            continue;
                        }
                        console.log(`Fetched ${candles.length} candles for ${symbol} ${timeframe}`);
                        const signals = this.signalDetectionService.detectSignals(candles, symbol, timeframe, config);
                        console.log(`Detected ${signals.length} signals for ${symbol} ${timeframe}`);
                        for (let i = 0; i < signals.length; i++) {
                            const signal = signals[i];
                            const signalIndex = candles.findIndex(c => c.timestamp === signal.timestamp);
                            if (signalIndex >= 0) {
                                const performance = this.performanceAnalysisService.analyzeSignalPerformance(signal, candles, signalIndex, config);
                                allSignals.push(signal);
                                allPerformances.push(performance);
                            }
                        }
                        completedCombinations++;
                        const progress = Math.round((completedCombinations / totalCombinations) * 100);
                        await this.updateBacktestStatus(backtestId, 'RUNNING', progress);
                    }
                    catch (error) {
                        console.error(`Error processing ${symbol} ${timeframe}:`, error);
                    }
                }
            }
            const summary = this.performanceAnalysisService.calculateSummaryStatistics(allPerformances);
            await BacktestResult_1.BacktestResultModel.findOneAndUpdate({ id: backtestId }, {
                signals: allSignals,
                performance: allPerformances,
                summary,
                completedAt: new Date(),
                status: 'COMPLETED',
                progress: 100
            });
            console.log(`Backtest ${backtestId} completed successfully`);
            console.log(`Total signals: ${allSignals.length}`);
            console.log(`Success rate: ${summary.successRate.toFixed(2)}%`);
        }
        catch (error) {
            console.error(`Backtest ${backtestId} failed:`, error);
            await this.updateBacktestStatus(backtestId, 'FAILED', 0, error.message);
            throw error;
        }
    }
    async updateBacktestStatus(backtestId, status, progress, error) {
        const updateData = { status, progress };
        if (error) {
            updateData.error = error;
        }
        if (status === 'COMPLETED') {
            updateData.completedAt = new Date();
        }
        await BacktestResult_1.BacktestResultModel.findOneAndUpdate({ id: backtestId }, updateData);
    }
    async getBacktestResult(backtestId) {
        const backtestDoc = await BacktestResult_1.BacktestResultModel.findOne({ id: backtestId });
        return backtestDoc ? backtestDoc.toObject() : null;
    }
    async getAllBacktestResults(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [results, total] = await Promise.all([
            BacktestResult_1.BacktestResultModel.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            BacktestResult_1.BacktestResultModel.countDocuments()
        ]);
        return {
            results: results,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }
    async deleteBacktestResult(backtestId) {
        const result = await BacktestResult_1.BacktestResultModel.findOneAndDelete({ id: backtestId });
        return result !== null;
    }
    async getBacktestProgress(backtestId) {
        const backtestDoc = await BacktestResult_1.BacktestResultModel.findOne({ id: backtestId }, { status: 1, progress: 1, error: 1 });
        return backtestDoc ? {
            status: backtestDoc.status,
            progress: backtestDoc.progress,
            error: backtestDoc.error
        } : null;
    }
    async cancelBacktest(backtestId) {
        const result = await BacktestResult_1.BacktestResultModel.findOneAndUpdate({ id: backtestId, status: { $in: ['PENDING', 'RUNNING'] } }, { status: 'FAILED', error: 'Cancelled by user' });
        return result !== null;
    }
    async getFilteredSignals(backtestId, filters) {
        const backtestDoc = await BacktestResult_1.BacktestResultModel.findOne({ id: backtestId });
        if (!backtestDoc)
            return null;
        let filteredSignals = backtestDoc.signals;
        let filteredPerformances = backtestDoc.performance;
        if (filters.signalTypes && filters.signalTypes.length > 0) {
            filteredSignals = filteredSignals.filter(signal => filters.signalTypes.includes(signal.type));
        }
        if (filters.symbols && filters.symbols.length > 0) {
            filteredSignals = filteredSignals.filter(signal => filters.symbols.includes(signal.symbol));
        }
        if (filters.timeframes && filters.timeframes.length > 0) {
            filteredSignals = filteredSignals.filter(signal => filters.timeframes.includes(signal.timeframe));
        }
        if (filters.startDate) {
            const startTime = new Date(filters.startDate).getTime();
            filteredSignals = filteredSignals.filter(signal => signal.timestamp >= startTime);
        }
        if (filters.endDate) {
            const endTime = new Date(filters.endDate).getTime();
            filteredSignals = filteredSignals.filter(signal => signal.timestamp <= endTime);
        }
        const signalIds = new Set(filteredSignals.map(signal => `${signal.symbol}_${signal.timeframe}_${signal.type}_${signal.timestamp}`));
        filteredPerformances = filteredPerformances.filter(perf => signalIds.has(perf.signalId));
        if (filters.minRiskReward !== undefined) {
            filteredPerformances = filteredPerformances.filter(perf => perf.riskRewardRatio >= filters.minRiskReward);
        }
        if (filters.maxRiskReward !== undefined) {
            filteredPerformances = filteredPerformances.filter(perf => perf.riskRewardRatio <= filters.maxRiskReward);
        }
        if (filters.onlySuccessful) {
            filteredPerformances = filteredPerformances.filter(perf => perf.isSuccessful);
        }
        const performanceSignalIds = new Set(filteredPerformances.map(perf => perf.signalId));
        filteredSignals = filteredSignals.filter(signal => {
            const signalId = `${signal.symbol}_${signal.timeframe}_${signal.type}_${signal.timestamp}`;
            return performanceSignalIds.has(signalId);
        });
        return {
            signals: filteredSignals,
            performances: filteredPerformances
        };
    }
    validateConfig(config) {
        const errors = [];
        if (!config.symbols || config.symbols.length === 0) {
            errors.push('At least one symbol must be selected');
        }
        if (!config.timeframes || config.timeframes.length === 0) {
            errors.push('At least one timeframe must be selected');
        }
        if (!config.startDate) {
            errors.push('Start date is required');
        }
        if (!config.endDate) {
            errors.push('End date is required');
        }
        if (config.startDate && config.endDate) {
            const startDate = new Date(config.startDate);
            const endDate = new Date(config.endDate);
            if (startDate >= endDate) {
                errors.push('End date must be after start date');
            }
            const maxDaysBack = this.binanceService.getHistoricalDataLimits().maxDaysBack;
            const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff > maxDaysBack) {
                errors.push(`Date range cannot exceed ${maxDaysBack} days`);
            }
        }
        if (config.lookforwardCandles < 1 || config.lookforwardCandles > 1000) {
            errors.push('Lookforward candles must be between 1 and 1000');
        }
        if (config.volumeMaLength < 1 || config.volumeMaLength > 2000) {
            errors.push('Volume MA length must be between 1 and 2000');
        }
        if (config.volumeStdLength < 1 || config.volumeStdLength > 2000) {
            errors.push('Volume Std length must be between 1 and 2000');
        }
        if (config.bodyRatioThreshold < 0 || config.bodyRatioThreshold > 1) {
            errors.push('Body ratio threshold must be between 0 and 1');
        }
        const enabledSignals = Object.values(config.enabledSignals);
        if (!enabledSignals.some(enabled => enabled)) {
            errors.push('At least one signal type must be enabled');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
exports.BacktestService = BacktestService;
//# sourceMappingURL=backtestService.js.map