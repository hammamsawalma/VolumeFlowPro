"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceAnalysisService = void 0;
class PerformanceAnalysisService {
    analyzeSignalPerformance(signal, candles, signalIndex, config) {
        const entryPrice = signal.price;
        const lookforwardCandles = config.lookforwardCandles;
        const endIndex = Math.min(signalIndex + lookforwardCandles + 1, candles.length);
        const analyzedCandles = candles.slice(signalIndex + 1, endIndex);
        if (analyzedCandles.length === 0) {
            return this.createEmptyPerformance(signal, entryPrice);
        }
        let maxDrawup = 0;
        let maxDrawdown = 0;
        let maxDrawupPercent = 0;
        let maxDrawdownPercent = 0;
        let timeToMaxDrawup = 0;
        let timeToMaxDrawdown = 0;
        const finalPrice = analyzedCandles[analyzedCandles.length - 1].close;
        const finalPricePercent = ((finalPrice - entryPrice) / entryPrice) * 100;
        for (let i = 0; i < analyzedCandles.length; i++) {
            const candle = analyzedCandles[i];
            if (signal.type === 'PRIMARY_BUY' || signal.type === 'BASIC_BUY') {
                const highDrawup = candle.high - entryPrice;
                const lowDrawdown = entryPrice - candle.low;
                if (highDrawup > maxDrawup) {
                    maxDrawup = highDrawup;
                    maxDrawupPercent = (highDrawup / entryPrice) * 100;
                    timeToMaxDrawup = i + 1;
                }
                if (lowDrawdown > maxDrawdown) {
                    maxDrawdown = lowDrawdown;
                    maxDrawdownPercent = (lowDrawdown / entryPrice) * 100;
                    timeToMaxDrawdown = i + 1;
                }
            }
            else {
                const lowDrawup = entryPrice - candle.low;
                const highDrawdown = candle.high - entryPrice;
                if (lowDrawup > maxDrawup) {
                    maxDrawup = lowDrawup;
                    maxDrawupPercent = (lowDrawup / entryPrice) * 100;
                    timeToMaxDrawup = i + 1;
                }
                if (highDrawdown > maxDrawdown) {
                    maxDrawdown = highDrawdown;
                    maxDrawdownPercent = (highDrawdown / entryPrice) * 100;
                    timeToMaxDrawdown = i + 1;
                }
            }
        }
        const riskRewardRatio = maxDrawdown > 0 ? maxDrawup / maxDrawdown : maxDrawup > 0 ? Infinity : 0;
        const isSuccessful = maxDrawup > maxDrawdown;
        return {
            signalId: this.generateSignalId(signal),
            maxDrawup,
            maxDrawdown,
            maxDrawupPercent,
            maxDrawdownPercent,
            riskRewardRatio,
            isSuccessful,
            timeToMaxDrawup,
            timeToMaxDrawdown,
            finalPrice,
            finalPricePercent
        };
    }
    createEmptyPerformance(signal, entryPrice) {
        return {
            signalId: this.generateSignalId(signal),
            maxDrawup: 0,
            maxDrawdown: 0,
            maxDrawupPercent: 0,
            maxDrawdownPercent: 0,
            riskRewardRatio: 0,
            isSuccessful: false,
            timeToMaxDrawup: 0,
            timeToMaxDrawdown: 0,
            finalPrice: entryPrice,
            finalPricePercent: 0
        };
    }
    generateSignalId(signal) {
        return `${signal.symbol}_${signal.timeframe}_${signal.type}_${signal.timestamp}`;
    }
    calculateSummaryStatistics(performances) {
        if (performances.length === 0) {
            return {
                totalSignals: 0,
                successfulSignals: 0,
                successRate: 0,
                avgRiskReward: 0,
                avgDrawup: 0,
                avgDrawdown: 0,
                bestSignal: null,
                worstSignal: null
            };
        }
        const totalSignals = performances.length;
        const successfulSignals = performances.filter(p => p.isSuccessful).length;
        const successRate = (successfulSignals / totalSignals) * 100;
        const avgRiskReward = performances.reduce((sum, p) => {
            return sum + (isFinite(p.riskRewardRatio) ? p.riskRewardRatio : 0);
        }, 0) / totalSignals;
        const avgDrawup = performances.reduce((sum, p) => sum + p.maxDrawupPercent, 0) / totalSignals;
        const avgDrawdown = performances.reduce((sum, p) => sum + p.maxDrawdownPercent, 0) / totalSignals;
        const bestSignal = performances.reduce((best, current) => {
            if (!best)
                return current;
            return current.riskRewardRatio > best.riskRewardRatio ? current : best;
        }, null);
        const worstSignal = performances.reduce((worst, current) => {
            if (!worst)
                return current;
            return current.riskRewardRatio < worst.riskRewardRatio ? current : worst;
        }, null);
        return {
            totalSignals,
            successfulSignals,
            successRate,
            avgRiskReward,
            avgDrawup,
            avgDrawdown,
            bestSignal,
            worstSignal
        };
    }
    filterPerformances(performances, filters) {
        return performances.filter(performance => {
            if (filters.signalTypes && filters.signalTypes.length > 0) {
                const signalType = performance.signalId.split('_')[2];
                if (!filters.signalTypes.includes(signalType)) {
                    return false;
                }
            }
            if (filters.minRiskReward !== undefined && performance.riskRewardRatio < filters.minRiskReward) {
                return false;
            }
            if (filters.maxRiskReward !== undefined && performance.riskRewardRatio > filters.maxRiskReward) {
                return false;
            }
            if (filters.onlySuccessful && !performance.isSuccessful) {
                return false;
            }
            return true;
        });
    }
    groupPerformances(performances, groupBy) {
        const groups = {};
        performances.forEach(performance => {
            let key;
            const idParts = performance.signalId.split('_');
            switch (groupBy) {
                case 'signalType':
                    key = idParts[2];
                    break;
                case 'symbol':
                    key = idParts[0];
                    break;
                case 'timeframe':
                    key = idParts[1];
                    break;
                case 'success':
                    key = performance.isSuccessful ? 'Successful' : 'Failed';
                    break;
                default:
                    key = 'All';
            }
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(performance);
        });
        return groups;
    }
    calculateTimeBasedMetrics(signals, performances) {
        const hourlyDistribution = {};
        const dailyDistribution = {};
        const monthlyDistribution = {};
        signals.forEach(signal => {
            const date = new Date(signal.timestamp);
            const hour = date.getHours().toString().padStart(2, '0');
            const day = date.toLocaleDateString('en-US', { weekday: 'long' });
            const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
            dailyDistribution[day] = (dailyDistribution[day] || 0) + 1;
            monthlyDistribution[month] = (monthlyDistribution[month] || 0) + 1;
        });
        return {
            hourlyDistribution,
            dailyDistribution,
            monthlyDistribution
        };
    }
}
exports.PerformanceAnalysisService = PerformanceAnalysisService;
//# sourceMappingURL=performanceAnalysis.js.map