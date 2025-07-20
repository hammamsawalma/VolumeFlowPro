import { CandleData, VolumeAnalysis, SignalDetection, BacktestConfig } from '../types';
import { CompleteDataValidator, DataCompletenessReport, SignalDataRequirements } from './completeDataValidator';

export class SignalDetectionService {
  private completeDataValidator: CompleteDataValidator;

  constructor() {
    this.completeDataValidator = new CompleteDataValidator();
  }
  
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
   * Analyze volume for a given candle with enhanced threshold detection
   */
  private analyzeVolume(
    candles: CandleData[], 
    currentIndex: number, 
    config: BacktestConfig
  ): VolumeAnalysis & {
    volumeLevel: 'low' | 'medium' | 'high' | 'extraHigh';
    meetsThreshold: (threshold: 'medium' | 'high' | 'extraHigh') => boolean;
  } {
    // Validate input data
    if (!candles || candles.length === 0 || currentIndex < 0 || currentIndex >= candles.length) {
      console.warn(`Invalid volume analysis parameters: candles.length=${candles?.length}, currentIndex=${currentIndex}`);
      return {
        volumeMean: 0,
        volumeStd: 0,
        volumeStdBar: 0,
        isVolumeColored: false,
        volumeLevel: 'low',
        meetsThreshold: () => false
      };
    }

    // Ensure we have enough data for volume analysis
    const requiredLength = Math.max(config.volumeMaLength, config.volumeStdLength);
    if (currentIndex + 1 < requiredLength) {
      console.warn(`Insufficient data for volume analysis: need ${requiredLength}, have ${currentIndex + 1}`);
      return {
        volumeMean: 0,
        volumeStd: 0,
        volumeStdBar: 0,
        isVolumeColored: false,
        volumeLevel: 'low',
        meetsThreshold: () => false
      };
    }

    const volumes = candles.slice(0, currentIndex + 1).map(c => c.volume);
    
    // Validate volume data
    const validVolumes = volumes.filter(v => v >= 0 && isFinite(v));
    if (validVolumes.length < requiredLength) {
      console.warn(`Insufficient valid volume data: need ${requiredLength}, have ${validVolumes.length}`);
      return {
        volumeMean: 0,
        volumeStd: 0,
        volumeStdBar: 0,
        isVolumeColored: false,
        volumeLevel: 'low',
        meetsThreshold: () => false
      };
    }
    
    const volumeMean = this.calculateSMA(validVolumes, config.volumeMaLength);
    const volumeStd = this.calculateStdDev(validVolumes, config.volumeStdLength);
    
    const currentVolume = candles[currentIndex].volume;
    const volumeStdBar = volumeStd === 0 ? 0 : (currentVolume - volumeMean) / volumeStd;
    
    // Determine volume level based on all thresholds
    let volumeLevel: 'low' | 'medium' | 'high' | 'extraHigh' = 'low';
    if (volumeStdBar >= config.volumeThresholds.extraHigh) {
      volumeLevel = 'extraHigh';
    } else if (volumeStdBar >= config.volumeThresholds.high) {
      volumeLevel = 'high';
    } else if (volumeStdBar >= config.volumeThresholds.medium) {
      volumeLevel = 'medium';
    }
    
    const isVolumeColored = volumeStdBar > config.volumeThresholds.medium;
    
    // Helper function to check if volume meets specific threshold
    const meetsThreshold = (threshold: 'medium' | 'high' | 'extraHigh'): boolean => {
      return volumeStdBar >= config.volumeThresholds[threshold];
    };

    return {
      volumeMean,
      volumeStd,
      volumeStdBar,
      isVolumeColored,
      volumeLevel,
      meetsThreshold
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
   * - BOTH red candles must have strong body (≥ 0.61)
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
    
    // NEW: Both red candles must have body ratio ≥ bodyRatioThreshold
    const red1StrongBody = this.calculateBodyRatio(prev2) >= config.bodyRatioThreshold;
    const red2StrongBody = this.calculateBodyRatio(prev1) >= config.bodyRatioThreshold;
    const bothRedsStrong = red1StrongBody && red2StrongBody;

    if (twoConsecutiveReds && red2HasVolume && greenWithVolume && greenClosesAboveRed2Open && bothRedsStrong) {
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
   * - BOTH red candles must have strong body (≥ 0.61)
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
    
    // NEW: Both red candles must have body ratio ≥ bodyRatioThreshold
    const red1StrongBody = this.calculateBodyRatio(prev2) >= config.bodyRatioThreshold;
    const red2StrongBody = this.calculateBodyRatio(prev1) >= config.bodyRatioThreshold;
    const bothRedsStrong = red1StrongBody && red2StrongBody;

    if (twoConsecutiveReds && greenWithVolume && greenClosesAboveRed1Open && bothRedsStrong) {
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
   * - BOTH green candles must have strong body (≥ 0.61)
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
    
    // NEW: Both green candles must have body ratio ≥ bodyRatioThreshold
    const green1StrongBody = this.calculateBodyRatio(prev2) >= config.bodyRatioThreshold;
    const green2StrongBody = this.calculateBodyRatio(prev1) >= config.bodyRatioThreshold;
    const bothGreensStrong = green1StrongBody && green2StrongBody;

    if (twoConsecutiveGreens && green2HasVolume && redWithVolume && redClosesBelowGreen2Open && bothGreensStrong) {
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
   * - BOTH green candles must have strong body (≥ 0.61)
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
    
    // NEW: Both green candles must have body ratio ≥ bodyRatioThreshold
    const green1StrongBody = this.calculateBodyRatio(prev2) >= config.bodyRatioThreshold;
    const green2StrongBody = this.calculateBodyRatio(prev1) >= config.bodyRatioThreshold;
    const bothGreensStrong = green1StrongBody && green2StrongBody;

    if (twoConsecutiveGreens && redWithVolume && redClosesBelowGreen1Open && bothGreensStrong) {
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
   * Validate if signal processing is possible for given data and configuration
   */
  public validateSignalProcessing(
    candles: CandleData[],
    symbol: string,
    timeframe: string,
    config: BacktestConfig
  ): {
    canProcess: boolean;
    reason?: string;
    minRequiredCandles: number;
    actualCandles: number;
    usableCandles: number;
    startIndex: number;
  } {
    // Calculate minimum required candles
    const minRequiredCandles = Math.max(
      config.volumeMaLength,
      config.volumeStdLength
    ) + config.lookforwardCandles + 3; // +3 for pattern detection

    // Validate basic requirements
    if (!candles || candles.length === 0) {
      return {
        canProcess: false,
        reason: 'No candle data provided',
        minRequiredCandles,
        actualCandles: 0,
        usableCandles: 0,
        startIndex: 0
      };
    }

    if (candles.length < 3) {
      return {
        canProcess: false,
        reason: 'Insufficient data for pattern detection (minimum 3 candles required)',
        minRequiredCandles,
        actualCandles: candles.length,
        usableCandles: 0,
        startIndex: 0
      };
    }

    // Calculate start index for signal detection
    const startIndex = Math.max(2, Math.max(config.volumeMaLength, config.volumeStdLength));
    
    if (candles.length <= startIndex) {
      return {
        canProcess: false,
        reason: `Insufficient data for volume analysis (need ${startIndex + 1} candles, have ${candles.length})`,
        minRequiredCandles,
        actualCandles: candles.length,
        usableCandles: 0,
        startIndex
      };
    }

    // Calculate usable candles (those that can be processed for signals)
    const usableCandles = candles.length - startIndex;
    
    // Check if we have enough candles for lookforward analysis
    if (usableCandles < config.lookforwardCandles + 1) {
      return {
        canProcess: false,
        reason: `Insufficient data for lookforward analysis (need ${config.lookforwardCandles + 1} usable candles, have ${usableCandles})`,
        minRequiredCandles,
        actualCandles: candles.length,
        usableCandles,
        startIndex
      };
    }

    // Validate candle data quality
    const invalidCandles = candles.filter(candle => 
      !candle || 
      candle.open <= 0 || 
      candle.high <= 0 || 
      candle.low <= 0 || 
      candle.close <= 0 || 
      candle.volume < 0 ||
      candle.high < candle.low ||
      candle.timestamp <= 0
    );

    if (invalidCandles.length > candles.length * 0.1) { // More than 10% invalid
      return {
        canProcess: false,
        reason: `Too many invalid candles (${invalidCandles.length}/${candles.length})`,
        minRequiredCandles,
        actualCandles: candles.length,
        usableCandles,
        startIndex
      };
    }

    return {
      canProcess: true,
      minRequiredCandles,
      actualCandles: candles.length,
      usableCandles,
      startIndex
    };
  }

  /**
   * Validate if a specific signal can be analyzed for performance
   */
  public validateSignalForAnalysis(
    signal: SignalDetection,
    candles: CandleData[],
    signalIndex: number,
    config: BacktestConfig
  ): {
    canAnalyze: boolean;
    reason?: string;
    lookforwardCandles: number;
    availableCandles: number;
  } {
    if (!signal || !candles || signalIndex < 0 || signalIndex >= candles.length) {
      return {
        canAnalyze: false,
        reason: 'Invalid signal or candle data',
        lookforwardCandles: 0,
        availableCandles: 0
      };
    }

    const availableCandles = candles.length - signalIndex - 1;
    const requiredCandles = config.lookforwardCandles;

    if (availableCandles < requiredCandles) {
      return {
        canAnalyze: false,
        reason: `Insufficient lookforward data (need ${requiredCandles}, have ${availableCandles})`,
        lookforwardCandles: requiredCandles,
        availableCandles
      };
    }

    // Check if lookforward candles are valid
    const lookforwardData = candles.slice(signalIndex + 1, signalIndex + 1 + requiredCandles);
    const invalidLookforwardCandles = lookforwardData.filter(candle => 
      !candle || 
      candle.open <= 0 || 
      candle.high <= 0 || 
      candle.low <= 0 || 
      candle.close <= 0 ||
      candle.high < candle.low
    );

    if (invalidLookforwardCandles.length > 0) {
      return {
        canAnalyze: false,
        reason: `Invalid lookforward candles detected (${invalidLookforwardCandles.length}/${requiredCandles})`,
        lookforwardCandles: requiredCandles,
        availableCandles
      };
    }

    return {
      canAnalyze: true,
      lookforwardCandles: requiredCandles,
      availableCandles
    };
  }

  /**
   * Detect all signals with 3-Phase data validation approach
   */
  public detectSignals(
    candles: CandleData[],
    symbol: string,
    timeframe: string,
    config: BacktestConfig
  ): SignalDetection[] {
    const signals: SignalDetection[] = [];
    const requestId = Math.random().toString(36).substr(2, 9);
    
    console.log(`🔍 [${requestId}] 3-PHASE SIGNAL DETECTION: ${symbol} ${timeframe}`);

    // Phase 1: Validate basic data requirements for pattern detection
    const phase1Validation = this.validatePhase1Requirements(candles, requestId);
    if (!phase1Validation.success) {
      console.log(`❌ [${requestId}] PHASE 1 FAILED: ${phase1Validation.reason}`);
      return signals;
    }

    // Phase 2: Validate volume analysis requirements
    const volumeLookback = Math.max(config.volumeMaLength, config.volumeStdLength);
    const phase2Validation = this.validatePhase2Requirements(candles, volumeLookback, requestId);
    if (!phase2Validation.success) {
      console.log(`❌ [${requestId}] PHASE 2 FAILED: ${phase2Validation.reason}`);
      return signals;
    }

    // Phase 3: Validate forward analysis requirements
    const phase3Validation = this.validatePhase3Requirements(candles, volumeLookback, config.lookforwardCandles, requestId);
    if (!phase3Validation.success) {
      console.log(`❌ [${requestId}] PHASE 3 FAILED: ${phase3Validation.reason}`);
      return signals;
    }

    console.log(`✅ [${requestId}] ALL 3 PHASES PASSED - Processing ${candles.length} candles`);

    // Calculate processing range
    const startIndex = volumeLookback + 2; // +2 for pattern detection (need 3 candles, 0-indexed)
    const endIndex = candles.length - config.lookforwardCandles;
    
    console.log(`🎯 [${requestId}] Processing range: index ${startIndex} to ${endIndex} (${endIndex - startIndex} potential signals)`);

    if (startIndex >= endIndex) {
      console.log(`❌ [${requestId}] NO PROCESSING RANGE: startIndex=${startIndex}, endIndex=${endIndex}`);
      return signals;
    }

    // Process each potential signal
    let processedSignals = 0;
    let confirmedSignals = 0;

    for (let i = startIndex; i < endIndex; i++) {
      try {
        // Attempt signal detection for all enabled signal types
        const detectedSignals: (SignalDetection | null)[] = [
          config.enabledSignals.primaryBuy ? this.detectPrimaryBuySignal(candles, i, config) : null,
          config.enabledSignals.basicBuy ? this.detectBasicBuySignal(candles, i, config) : null,
          config.enabledSignals.primarySell ? this.detectPrimarySellSignal(candles, i, config) : null,
          config.enabledSignals.basicSell ? this.detectBasicSellSignal(candles, i, config) : null,
        ];

        // Process detected signals
        detectedSignals.forEach(signal => {
          if (signal) {
            // Final validation: Ensure signal has complete data for performance analysis
            const finalValidation = this.validateSignalForAnalysis(signal, candles, i, config);
            
            if (finalValidation.canAnalyze) {
              signal.symbol = symbol;
              signal.timeframe = timeframe;
              signals.push(signal);
              confirmedSignals++;
              console.log(`✅ [${requestId}] Signal CONFIRMED: ${signal.type} at ${new Date(signal.timestamp).toISOString()}`);
            } else {
              console.log(`⚠️ [${requestId}] Signal REJECTED: ${signal.type} - ${finalValidation.reason}`);
            }
          }
        });

        processedSignals++;

      } catch (error: any) {
        console.error(`💥 [${requestId}] Error processing signal at index ${i}: ${error.message}`);
        // Continue processing other signals - don't let one error stop the entire process
      }
    }

    console.log(`📊 [${requestId}] 3-PHASE PROCESSING COMPLETE:`);
    console.log(`   - Processed: ${processedSignals} potential signal positions`);
    console.log(`   - Confirmed: ${confirmedSignals} valid signals`);
    console.log(`   - Success Rate: ${processedSignals > 0 ? ((confirmedSignals / processedSignals) * 100).toFixed(1) : 0}%`);

    return signals;
  }

  /**
   * Phase 1: Validate basic data requirements for pattern detection
   */
  private validatePhase1Requirements(candles: CandleData[], requestId: string): {
    success: boolean;
    reason?: string;
  } {
    console.log(`📊 [${requestId}] Phase 1: Validating basic pattern detection requirements`);

    if (!candles || candles.length < 3) {
      const reason = `Phase 1: Insufficient data for pattern detection: ${candles?.length || 0} candles (minimum 3 required)`;
      console.error(`❌ [${requestId}] ${reason}`);
      return { success: false, reason };
    }

    // Validate data quality
    const invalidCandles = candles.filter(candle => 
      !candle || 
      candle.open <= 0 || 
      candle.high <= 0 || 
      candle.low <= 0 || 
      candle.close <= 0 || 
      candle.volume < 0 ||
      candle.high < candle.low ||
      candle.timestamp <= 0
    );

    if (invalidCandles.length > candles.length * 0.05) { // More than 5% invalid
      const reason = `Phase 1: Too many invalid candles: ${invalidCandles.length}/${candles.length} (${((invalidCandles.length / candles.length) * 100).toFixed(1)}%)`;
      console.error(`❌ [${requestId}] ${reason}`);
      return { success: false, reason };
    }

    console.log(`✅ [${requestId}] Phase 1 SUCCESS: ${candles.length} candles, ${((candles.length - invalidCandles.length) / candles.length * 100).toFixed(1)}% valid`);
    return { success: true };
  }

  /**
   * Phase 2: Validate volume analysis requirements
   */
  private validatePhase2Requirements(
    candles: CandleData[],
    volumeLookbackCandles: number,
    requestId: string
  ): {
    success: boolean;
    reason?: string;
  } {
    console.log(`📈 [${requestId}] Phase 2: Validating volume analysis requirements (${volumeLookbackCandles} lookback)`);

    const requiredForVolumeAnalysis = volumeLookbackCandles + 3; // +3 for pattern detection
    
    if (candles.length < requiredForVolumeAnalysis) {
      const reason = `Phase 2: Insufficient data for volume analysis: need ${requiredForVolumeAnalysis}, have ${candles.length}`;
      console.error(`❌ [${requestId}] ${reason}`);
      return { success: false, reason };
    }

    // Validate volume data quality
    const validVolumeCandles = candles.filter(c => c.volume >= 0 && isFinite(c.volume));
    if (validVolumeCandles.length < requiredForVolumeAnalysis) {
      const reason = `Phase 2: Insufficient valid volume data: need ${requiredForVolumeAnalysis}, have ${validVolumeCandles.length}`;
      console.error(`❌ [${requestId}] ${reason}`);
      return { success: false, reason };
    }

    console.log(`✅ [${requestId}] Phase 2 SUCCESS: Volume analysis requirements met`);
    return { success: true };
  }

  /**
   * Phase 3: Validate forward analysis requirements
   */
  private validatePhase3Requirements(
    candles: CandleData[],
    volumeLookbackCandles: number,
    lookforwardCandles: number,
    requestId: string
  ): {
    success: boolean;
    reason?: string;
  } {
    console.log(`🔮 [${requestId}] Phase 3: Validating forward analysis requirements (${lookforwardCandles} lookforward)`);

    // Calculate usable candles for signal detection
    const usableForSignals = candles.length - volumeLookbackCandles - 3; // -3 for pattern detection
    
    if (usableForSignals <= 0) {
      const reason = `Phase 3: No usable candles for signal detection after volume lookback`;
      console.error(`❌ [${requestId}] ${reason}`);
      return { success: false, reason };
    }

    // Check if we have enough forward data for performance analysis
    if (usableForSignals < lookforwardCandles) {
      const reason = `Phase 3: Insufficient forward data: need ${lookforwardCandles} lookforward candles, can only analyze ${usableForSignals}`;
      console.error(`❌ [${requestId}] ${reason}`);
      return { success: false, reason };
    }

    console.log(`✅ [${requestId}] Phase 3 SUCCESS: Forward analysis requirements met (${usableForSignals} usable candles)`);
    return { success: true };
  }
}
