"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backtestRoutes = void 0;
const express_1 = require("express");
const backtestService_1 = require("../services/backtestService");
const router = (0, express_1.Router)();
exports.backtestRoutes = router;
const backtestService = new backtestService_1.BacktestService();
router.post('/start', async (req, res) => {
    try {
        const config = req.body;
        const validation = backtestService.validateConfig(config);
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Invalid configuration',
                details: validation.errors
            });
        }
        const backtestId = await backtestService.startBacktest(config);
        return res.json({
            backtestId,
            status: 'PENDING',
            message: 'Backtest started successfully'
        });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to start backtest',
            details: error.message
        });
    }
});
router.get('/:backtestId', async (req, res) => {
    try {
        const { backtestId } = req.params;
        const result = await backtestService.getBacktestResult(backtestId);
        if (!result) {
            return res.status(404).json({
                error: 'Backtest not found'
            });
        }
        return res.json(result);
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to get backtest result',
            details: error.message
        });
    }
});
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const results = await backtestService.getAllBacktestResults(page, limit);
        return res.json(results);
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to get backtest results',
            details: error.message
        });
    }
});
router.get('/:backtestId/progress', async (req, res) => {
    try {
        const { backtestId } = req.params;
        const progress = await backtestService.getBacktestProgress(backtestId);
        if (!progress) {
            return res.status(404).json({
                error: 'Backtest not found'
            });
        }
        return res.json(progress);
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to get backtest progress',
            details: error.message
        });
    }
});
router.post('/:backtestId/cancel', async (req, res) => {
    try {
        const { backtestId } = req.params;
        const cancelled = await backtestService.cancelBacktest(backtestId);
        if (!cancelled) {
            return res.status(404).json({
                error: 'Backtest not found or cannot be cancelled'
            });
        }
        return res.json({
            message: 'Backtest cancelled successfully'
        });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to cancel backtest',
            details: error.message
        });
    }
});
router.delete('/:backtestId', async (req, res) => {
    try {
        const { backtestId } = req.params;
        const deleted = await backtestService.deleteBacktestResult(backtestId);
        if (!deleted) {
            return res.status(404).json({
                error: 'Backtest not found'
            });
        }
        return res.json({
            message: 'Backtest deleted successfully'
        });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to delete backtest',
            details: error.message
        });
    }
});
router.post('/:backtestId/signals/filter', async (req, res) => {
    try {
        const { backtestId } = req.params;
        const filters = req.body;
        const result = await backtestService.getFilteredSignals(backtestId, filters);
        if (!result) {
            return res.status(404).json({
                error: 'Backtest not found'
            });
        }
        return res.json({
            signals: result.signals,
            performances: result.performances,
            totalSignals: result.signals.length,
            totalPerformances: result.performances.length,
            filters: filters
        });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to filter signals',
            details: error.message
        });
    }
});
router.get('/:backtestId/signals/summary', async (req, res) => {
    try {
        const { backtestId } = req.params;
        const result = await backtestService.getBacktestResult(backtestId);
        if (!result) {
            return res.status(404).json({
                error: 'Backtest not found'
            });
        }
        const signalsByType = result.signals.reduce((acc, signal) => {
            if (!acc[signal.type]) {
                acc[signal.type] = [];
            }
            acc[signal.type].push(signal);
            return acc;
        }, {});
        const signalsBySymbol = result.signals.reduce((acc, signal) => {
            if (!acc[signal.symbol]) {
                acc[signal.symbol] = [];
            }
            acc[signal.symbol].push(signal);
            return acc;
        }, {});
        const signalsByTimeframe = result.signals.reduce((acc, signal) => {
            if (!acc[signal.timeframe]) {
                acc[signal.timeframe] = [];
            }
            acc[signal.timeframe].push(signal);
            return acc;
        }, {});
        const performanceByType = result.performance.reduce((acc, perf) => {
            const signalType = perf.signalId.split('_')[2];
            if (!acc[signalType]) {
                acc[signalType] = {
                    total: 0,
                    successful: 0,
                    avgRiskReward: 0,
                    performances: []
                };
            }
            acc[signalType].total++;
            if (perf.isSuccessful)
                acc[signalType].successful++;
            acc[signalType].performances.push(perf);
            return acc;
        }, {});
        Object.keys(performanceByType).forEach(type => {
            const typeData = performanceByType[type];
            typeData.successRate = (typeData.successful / typeData.total) * 100;
            typeData.avgRiskReward = typeData.performances.reduce((sum, p) => sum + (isFinite(p.riskRewardRatio) ? p.riskRewardRatio : 0), 0) / typeData.total;
        });
        return res.json({
            summary: result.summary,
            signalsByType: Object.keys(signalsByType).map(type => ({
                type,
                count: signalsByType[type].length,
                percentage: (signalsByType[type].length / result.signals.length) * 100
            })),
            signalsBySymbol: Object.keys(signalsBySymbol).map(symbol => ({
                symbol,
                count: signalsBySymbol[symbol].length,
                percentage: (signalsBySymbol[symbol].length / result.signals.length) * 100
            })).sort((a, b) => b.count - a.count),
            signalsByTimeframe: Object.keys(signalsByTimeframe).map(timeframe => ({
                timeframe,
                count: signalsByTimeframe[timeframe].length,
                percentage: (signalsByTimeframe[timeframe].length / result.signals.length) * 100
            })),
            performanceByType: Object.keys(performanceByType).map(type => ({
                type,
                ...performanceByType[type]
            }))
        });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to get signals summary',
            details: error.message
        });
    }
});
router.get('/:backtestId/export/csv', async (req, res) => {
    try {
        const { backtestId } = req.params;
        const result = await backtestService.getBacktestResult(backtestId);
        if (!result) {
            return res.status(404).json({
                error: 'Backtest not found'
            });
        }
        const headers = [
            'Signal ID',
            'Type',
            'Symbol',
            'Timeframe',
            'Timestamp',
            'Date',
            'Price',
            'Max Drawup %',
            'Max Drawdown %',
            'Risk/Reward Ratio',
            'Is Successful',
            'Time to Max Drawup',
            'Time to Max Drawdown',
            'Final Price',
            'Final Price %',
            'Volume Std Bar'
        ];
        const csvRows = [headers.join(',')];
        const signalPerformanceMap = new Map();
        result.performance.forEach(perf => {
            signalPerformanceMap.set(perf.signalId, perf);
        });
        result.signals.forEach(signal => {
            const signalId = `${signal.symbol}_${signal.timeframe}_${signal.type}_${signal.timestamp}`;
            const performance = signalPerformanceMap.get(signalId);
            if (performance) {
                const row = [
                    signalId,
                    signal.type,
                    signal.symbol,
                    signal.timeframe,
                    signal.timestamp,
                    new Date(signal.timestamp).toISOString(),
                    signal.price,
                    performance.maxDrawupPercent.toFixed(4),
                    performance.maxDrawdownPercent.toFixed(4),
                    isFinite(performance.riskRewardRatio) ? performance.riskRewardRatio.toFixed(4) : 'Infinity',
                    performance.isSuccessful ? 'Yes' : 'No',
                    performance.timeToMaxDrawup,
                    performance.timeToMaxDrawdown,
                    performance.finalPrice,
                    performance.finalPricePercent.toFixed(4),
                    signal.volumeData.volumeStdBar.toFixed(4)
                ];
                csvRows.push(row.join(','));
            }
        });
        const csvContent = csvRows.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="backtest_${backtestId}.csv"`);
        return res.send(csvContent);
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to export backtest results',
            details: error.message
        });
    }
});
router.post('/validate-config', (req, res) => {
    try {
        const config = req.body;
        const validation = backtestService.validateConfig(config);
        return res.json(validation);
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to validate configuration',
            details: error.message
        });
    }
});
//# sourceMappingURL=backtest.js.map