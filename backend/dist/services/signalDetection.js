"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalDetectionService = void 0;
class SignalDetectionService {
    calculateSMA(values, length) {
        if (values.length < length)
            return 0;
        const slice = values.slice(-length);
        return slice.reduce((sum, val) => sum + val, 0) / length;
    }
    calculateStdDev(values, length) {
        if (values.length < length)
            return 0;
        const slice = values.slice(-length);
        const mean = this.calculateSMA(slice, length);
        const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / length;
        return Math.sqrt(avgSquaredDiff);
    }
    analyzeVolume(candles, currentIndex, config) {
        const volumes = candles.slice(0, currentIndex + 1).map(c => c.volume);
        const volumeMean = this.calculateSMA(volumes, config.volumeMaLength);
        const volumeStd = this.calculateStdDev(volumes, config.volumeStdLength);
        const currentVolume = candles[currentIndex].volume;
        const volumeStdBar = volumeStd === 0 ? 0 : (currentVolume - volumeMean) / volumeStd;
        const isVolumeColored = volumeStdBar > config.volumeThresholds.medium;
        return {
            volumeMean,
            volumeStd,
            volumeStdBar,
            isVolumeColored
        };
    }
    isRedCandle(candle) {
        return candle.close < candle.open;
    }
    isGreenCandle(candle) {
        return candle.close > candle.open;
    }
    calculateBodyRatio(candle) {
        const bodySize = Math.abs(candle.close - candle.open);
        const totalLength = candle.high - candle.low;
        return totalLength > 0 ? bodySize / totalLength : 0;
    }
    detectPrimaryBuySignal(candles, currentIndex, config) {
        if (currentIndex < 2)
            return null;
        const current = candles[currentIndex];
        const prev1 = candles[currentIndex - 1];
        const prev2 = candles[currentIndex - 2];
        const currentVolumeAnalysis = this.analyzeVolume(candles, currentIndex, config);
        const prev1VolumeAnalysis = this.analyzeVolume(candles, currentIndex - 1, config);
        const twoConsecutiveReds = this.isRedCandle(prev2) && this.isRedCandle(prev1);
        const red2HasVolume = prev1VolumeAnalysis.isVolumeColored;
        const greenWithVolume = this.isGreenCandle(current) && currentVolumeAnalysis.isVolumeColored;
        const greenClosesAboveRed2Open = current.close > prev1.open;
        const red2StrongBody = this.calculateBodyRatio(prev1) >= config.bodyRatioThreshold;
        if (twoConsecutiveReds && red2HasVolume && greenWithVolume && greenClosesAboveRed2Open && red2StrongBody) {
            return {
                type: 'PRIMARY_BUY',
                timestamp: current.timestamp,
                price: current.close,
                symbol: '',
                timeframe: '',
                volumeData: currentVolumeAnalysis,
                candleData: {
                    current,
                    previous1: prev1,
                    previous2: prev2
                }
            };
        }
        return null;
    }
    detectBasicBuySignal(candles, currentIndex, config) {
        if (currentIndex < 2 || !config.enabledSignals.basicBuy)
            return null;
        const current = candles[currentIndex];
        const prev1 = candles[currentIndex - 1];
        const prev2 = candles[currentIndex - 2];
        const currentVolumeAnalysis = this.analyzeVolume(candles, currentIndex, config);
        const twoConsecutiveReds = this.isRedCandle(prev2) && this.isRedCandle(prev1);
        const greenWithVolume = this.isGreenCandle(current) && currentVolumeAnalysis.isVolumeColored;
        const greenClosesAboveRed1Open = current.close > prev2.open;
        if (twoConsecutiveReds && greenWithVolume && greenClosesAboveRed1Open) {
            return {
                type: 'BASIC_BUY',
                timestamp: current.timestamp,
                price: current.close,
                symbol: '',
                timeframe: '',
                volumeData: currentVolumeAnalysis,
                candleData: {
                    current,
                    previous1: prev1,
                    previous2: prev2
                }
            };
        }
        return null;
    }
    detectPrimarySellSignal(candles, currentIndex, config) {
        if (currentIndex < 2 || !config.enabledSignals.primarySell)
            return null;
        const current = candles[currentIndex];
        const prev1 = candles[currentIndex - 1];
        const prev2 = candles[currentIndex - 2];
        const currentVolumeAnalysis = this.analyzeVolume(candles, currentIndex, config);
        const prev1VolumeAnalysis = this.analyzeVolume(candles, currentIndex - 1, config);
        const twoConsecutiveGreens = this.isGreenCandle(prev2) && this.isGreenCandle(prev1);
        const green2HasVolume = prev1VolumeAnalysis.isVolumeColored;
        const redWithVolume = this.isRedCandle(current) && currentVolumeAnalysis.isVolumeColored;
        const redClosesBelowGreen2Open = current.close < prev1.open;
        const green2StrongBody = this.calculateBodyRatio(prev1) >= config.bodyRatioThreshold;
        if (twoConsecutiveGreens && green2HasVolume && redWithVolume && redClosesBelowGreen2Open && green2StrongBody) {
            return {
                type: 'PRIMARY_SELL',
                timestamp: current.timestamp,
                price: current.close,
                symbol: '',
                timeframe: '',
                volumeData: currentVolumeAnalysis,
                candleData: {
                    current,
                    previous1: prev1,
                    previous2: prev2
                }
            };
        }
        return null;
    }
    detectBasicSellSignal(candles, currentIndex, config) {
        if (currentIndex < 2 || !config.enabledSignals.basicSell)
            return null;
        const current = candles[currentIndex];
        const prev1 = candles[currentIndex - 1];
        const prev2 = candles[currentIndex - 2];
        const currentVolumeAnalysis = this.analyzeVolume(candles, currentIndex, config);
        const twoConsecutiveGreens = this.isGreenCandle(prev2) && this.isGreenCandle(prev1);
        const redWithVolume = this.isRedCandle(current) && currentVolumeAnalysis.isVolumeColored;
        const redClosesBelowGreen1Open = current.close < prev2.open;
        if (twoConsecutiveGreens && redWithVolume && redClosesBelowGreen1Open) {
            return {
                type: 'BASIC_SELL',
                timestamp: current.timestamp,
                price: current.close,
                symbol: '',
                timeframe: '',
                volumeData: currentVolumeAnalysis,
                candleData: {
                    current,
                    previous1: prev1,
                    previous2: prev2
                }
            };
        }
        return null;
    }
    detectSignals(candles, symbol, timeframe, config) {
        const signals = [];
        for (let i = Math.max(2, config.volumeMaLength); i < candles.length; i++) {
            const detectedSignals = [
                config.enabledSignals.primaryBuy ? this.detectPrimaryBuySignal(candles, i, config) : null,
                config.enabledSignals.basicBuy ? this.detectBasicBuySignal(candles, i, config) : null,
                config.enabledSignals.primarySell ? this.detectPrimarySellSignal(candles, i, config) : null,
                config.enabledSignals.basicSell ? this.detectBasicSellSignal(candles, i, config) : null,
            ];
            detectedSignals.forEach(signal => {
                if (signal) {
                    signal.symbol = symbol;
                    signal.timeframe = timeframe;
                    signals.push(signal);
                }
            });
        }
        return signals;
    }
}
exports.SignalDetectionService = SignalDetectionService;
//# sourceMappingURL=signalDetection.js.map