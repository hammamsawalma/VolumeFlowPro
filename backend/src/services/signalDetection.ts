import { CandleData, VolumeAnalysis, SignalDetection, BacktestConfig } from '../types';

export class SignalDetectionService {
  
  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(values: number[], length: number): number {
    if (values.length < length) return 0;
    const slice = values.slice(-length);
    return slice.reduce((sum, val) => sum + val, 0) / length;
  }

  /**
   * Calculate Standard Deviation
   */
  private calculateStdDev(values: number[], length: number): number {
    if (values.length < length) return 0;
    const slice = values.slice(-length);
    const mean = this.calculateSMA(slice, length);
    const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Analyze volume for a given candle
   */
  private analyzeVolume(
    candles: CandleData[], 
    currentIndex: number, 
    config: BacktestConfig
  ): VolumeAnalysis {
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

  /**
   * Check if candle is red (bearish)
   */
  private isRedCandle(candle: CandleData): boolean {
    return candle.close < candle.open;
  }

  /**
   * Check if candle is green (bullish)
   */
  private isGreenCandle(candle: CandleData): boolean {
    return candle.close > candle.open;
  }

  /**
   * Calculate body ratio for a candle
   */
  private calculateBodyRatio(candle: CandleData): number {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalLength = candle.high - candle.low;
    return totalLength > 0 ? bodySize / totalLength : 0;
  }

  /**
   * Detect Primary BUY signal
   * Pattern: 2 consecutive red candles followed by 1 green candle
   * Requirements: 
   * - Second red candle must have significant volume
   * - Green candle must have significant volume
   * - Green candle closes above second red candle's open
   * - Second red candle must have strong body (≥ bodyRatioThreshold)
   */
  private detectPrimaryBuySignal(
    candles: CandleData[],
    currentIndex: number,
    config: BacktestConfig
  ): SignalDetection | null {
    if (currentIndex < 2 || !config.enabledSignals.primaryBuy) return null;

    const current = candles[currentIndex];
    const prev1 = candles[currentIndex - 1];
    const prev2 = candles[currentIndex - 2];

    // Analyze volume for each candle
    const currentVolumeAnalysis = this.analyzeVolume(candles, currentIndex, config);
    const prev1VolumeAnalysis = this.analyzeVolume(candles, currentIndex - 1, config);

    // Check pattern conditions
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
        symbol: '', // Will be set by caller
        timeframe: '', // Will be set by caller
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

  /**
   * Detect Basic BUY signal
   * Pattern: 2 consecutive red candles followed by 1 green candle
   * Requirements:
   * - Green candle must have significant volume
   * - Green candle closes above FIRST red candle's open (less strict)
   */
  private detectBasicBuySignal(
    candles: CandleData[],
    currentIndex: number,
    config: BacktestConfig
  ): SignalDetection | null {
    if (currentIndex < 2 || !config.enabledSignals.basicBuy) return null;

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

  /**
   * Detect Primary SELL signal
   * Pattern: 2 consecutive green candles followed by 1 red candle
   * Requirements:
   * - Second green candle must have significant volume
   * - Red candle must have significant volume
   * - Red candle closes below second green candle's open
   * - Second green candle must have strong body (≥ bodyRatioThreshold)
   */
  private detectPrimarySellSignal(
    candles: CandleData[],
    currentIndex: number,
    config: BacktestConfig
  ): SignalDetection | null {
    if (currentIndex < 2 || !config.enabledSignals.primarySell) return null;

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

  /**
   * Detect Basic SELL signal
   * Pattern: 2 consecutive green candles followed by 1 red candle
   * Requirements:
   * - Red candle must have significant volume
   * - Red candle closes below FIRST green candle's open (less strict)
   */
  private detectBasicSellSignal(
    candles: CandleData[],
    currentIndex: number,
    config: BacktestConfig
  ): SignalDetection | null {
    if (currentIndex < 2 || !config.enabledSignals.basicSell) return null;

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

  /**
   * Detect all signals for given candle data
   */
  public detectSignals(
    candles: CandleData[],
    symbol: string,
    timeframe: string,
    config: BacktestConfig
  ): SignalDetection[] {
    const signals: SignalDetection[] = [];

    // Validate input data
    if (!candles || candles.length < 3) {
      console.log(`Insufficient data for ${symbol} ${timeframe}: ${candles?.length || 0} candles`);
      return signals;
    }

    // Start from the minimum required index for volume analysis, but not too late
    // Use the smaller of volumeMaLength and a reasonable maximum (50) to avoid starting too late
    const startIndex = Math.max(2, Math.min(config.volumeMaLength, 50));
    
    console.log(`Processing ${symbol} ${timeframe}: ${candles.length} candles, starting from index ${startIndex}`);

    for (let i = startIndex; i < candles.length; i++) {
      const detectedSignals: (SignalDetection | null)[] = [
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

    console.log(`Found ${signals.length} signals for ${symbol} ${timeframe}`);
    return signals;
  }
}
