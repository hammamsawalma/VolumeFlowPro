import { CandleData, BacktestConfig } from '../types';

export interface DataCompletenessReport {
  isComplete: boolean;
  totalRequired: number;
  totalAvailable: number;
  missingDataPoints: number;
  dataGaps: Array<{ start: number; end: number; duration: number }>;
  qualityScore: number;
  skipReason?: string;
  recommendations: string[];
}

export interface SignalDataRequirements {
  historicalCandles: number; // For VWAP calculation (610)
  patternCandles: number; // For signal pattern (3)
  lookforwardCandles: number; // For performance analysis
  totalRequired: number;
  bufferCandles: number; // Extra buffer for safety
}

export class CompleteDataValidator {
  
  /**
   * Calculate exact data requirements for signal processing
   */
  public calculateSignalDataRequirements(config: BacktestConfig): SignalDataRequirements {
    const historicalCandles = Math.max(config.volumeMaLength, config.volumeStdLength); // 610
    const patternCandles = 3; // Minimum for pattern detection
    const lookforwardCandles = config.lookforwardCandles;
    const bufferCandles = 10; // Safety buffer
    
    const totalRequired = historicalCandles + patternCandles + lookforwardCandles + bufferCandles;
    
    return {
      historicalCandles,
      patternCandles,
      lookforwardCandles,
      totalRequired,
      bufferCandles
    };
  }

  /**
   * ZERO-TOLERANCE data completeness validation
   */
  public validateCompleteDataset(
    candles: CandleData[],
    requirements: SignalDataRequirements,
    symbol: string,
    timeframe: string
  ): DataCompletenessReport {
    const report: DataCompletenessReport = {
      isComplete: false,
      totalRequired: requirements.totalRequired,
      totalAvailable: candles.length,
      missingDataPoints: 0,
      dataGaps: [],
      qualityScore: 0,
      recommendations: []
    };

    // Step 1: Basic quantity validation
    if (!candles || candles.length === 0) {
      report.skipReason = 'No candle data provided';
      report.recommendations.push('Fetch historical data from source');
      return report;
    }

    if (candles.length < requirements.totalRequired) {
      report.missingDataPoints = requirements.totalRequired - candles.length;
      report.skipReason = `Insufficient data: need ${requirements.totalRequired}, have ${candles.length}`;
      report.recommendations.push('Extend historical data range');
      report.recommendations.push('Try alternative data sources');
      return report;
    }

    // Step 2: Data quality validation - ZERO TOLERANCE
    const invalidCandles = this.validateCandleDataQuality(candles);
    if (invalidCandles.length > 0) {
      report.skipReason = `Invalid candles detected: ${invalidCandles.length} corrupted data points`;
      report.recommendations.push('Clean corrupted data points');
      report.recommendations.push('Re-fetch data from source');
      return report;
    }

    // Step 3: Timestamp continuity validation - ZERO TOLERANCE
    const gaps = this.detectDataGaps(candles, timeframe);
    if (gaps.length > 0) {
      report.dataGaps = gaps;
      report.skipReason = `Data gaps detected: ${gaps.length} missing time periods`;
      report.recommendations.push('Fill data gaps with additional requests');
      report.recommendations.push('Use gap-filling algorithms');
      return report;
    }

    // Step 4: Volume data completeness - ZERO TOLERANCE
    const volumeValidation = this.validateVolumeDataCompleteness(candles, requirements.historicalCandles);
    if (!volumeValidation.isComplete) {
      report.skipReason = volumeValidation.reason;
      report.recommendations.push('Ensure all volume data is available');
      report.recommendations.push('Validate volume data source');
      return report;
    }

    // Step 5: Calculate final quality score
    report.qualityScore = this.calculateDataQualityScore(candles, requirements);
    
    // ZERO TOLERANCE: Only accept 100% quality
    if (report.qualityScore < 100) {
      report.skipReason = `Data quality insufficient: ${report.qualityScore.toFixed(1)}% (require 100%)`;
      report.recommendations.push('Improve data quality to 100%');
      return report;
    }

    // All validations passed
    report.isComplete = true;
    console.log(`✅ COMPLETE DATA VALIDATION PASSED for ${symbol} ${timeframe}: ${candles.length} candles, 100% quality`);
    
    return report;
  }

  /**
   * Validate individual candle data quality - ZERO TOLERANCE
   */
  private validateCandleDataQuality(candles: CandleData[]): number[] {
    const invalidIndices: number[] = [];
    
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      
      // Check for null/undefined
      if (!candle) {
        invalidIndices.push(i);
        continue;
      }
      
      // Check for valid numbers
      const values = [candle.open, candle.high, candle.low, candle.close, candle.volume, candle.timestamp];
      if (values.some(val => val === null || val === undefined || isNaN(Number(val)))) {
        invalidIndices.push(i);
        continue;
      }
      
      // Check for positive prices
      if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) {
        invalidIndices.push(i);
        continue;
      }
      
      // Check for non-negative volume
      if (candle.volume < 0) {
        invalidIndices.push(i);
        continue;
      }
      
      // Check price relationships
      if (candle.high < candle.low) {
        invalidIndices.push(i);
        continue;
      }
      
      if (candle.high < Math.max(candle.open, candle.close)) {
        invalidIndices.push(i);
        continue;
      }
      
      if (candle.low > Math.min(candle.open, candle.close)) {
        invalidIndices.push(i);
        continue;
      }
      
      // Check for valid timestamp
      if (candle.timestamp <= 0) {
        invalidIndices.push(i);
        continue;
      }
      
      // Check for reasonable price ranges (no extreme outliers)
      const priceRange = candle.high - candle.low;
      const avgPrice = (candle.high + candle.low) / 2;
      if (priceRange > avgPrice * 0.5) { // More than 50% price range is suspicious
        invalidIndices.push(i);
        continue;
      }
    }
    
    return invalidIndices;
  }

  /**
   * Detect data gaps with ZERO TOLERANCE
   */
  private detectDataGaps(candles: CandleData[], timeframe: string): Array<{ start: number; end: number; duration: number }> {
    if (candles.length < 2) return [];
    
    const timeframeMs = this.getTimeframeInMs(timeframe);
    const gaps: Array<{ start: number; end: number; duration: number }> = [];
    
    for (let i = 1; i < candles.length; i++) {
      const expectedTime = candles[i - 1].timestamp + timeframeMs;
      const actualTime = candles[i].timestamp;
      
      // ZERO TOLERANCE: No gaps allowed
      if (actualTime > expectedTime + 1000) { // Allow 1 second tolerance for timing variations
        gaps.push({
          start: expectedTime,
          end: actualTime,
          duration: actualTime - expectedTime
        });
      }
    }
    
    return gaps;
  }

  /**
   * Validate volume data completeness for VWAP calculation
   */
  private validateVolumeDataCompleteness(
    candles: CandleData[], 
    requiredHistoricalCandles: number
  ): { isComplete: boolean; reason?: string } {
    
    if (candles.length < requiredHistoricalCandles) {
      return {
        isComplete: false,
        reason: `Insufficient volume data: need ${requiredHistoricalCandles}, have ${candles.length}`
      };
    }
    
    // Check every single volume data point
    for (let i = 0; i < requiredHistoricalCandles; i++) {
      const candle = candles[i];
      
      if (!candle || candle.volume === null || candle.volume === undefined || isNaN(candle.volume)) {
        return {
          isComplete: false,
          reason: `Missing volume data at index ${i}`
        };
      }
      
      if (candle.volume < 0) {
        return {
          isComplete: false,
          reason: `Invalid volume data at index ${i}: ${candle.volume}`
        };
      }
    }
    
    return { isComplete: true };
  }

  /**
   * Calculate data quality score (0-100)
   */
  private calculateDataQualityScore(candles: CandleData[], requirements: SignalDataRequirements): number {
    let score = 100;
    
    // Deduct points for any issues
    const invalidCandles = this.validateCandleDataQuality(candles);
    if (invalidCandles.length > 0) {
      score -= (invalidCandles.length / candles.length) * 100;
    }
    
    // Deduct points for insufficient data
    if (candles.length < requirements.totalRequired) {
      score -= ((requirements.totalRequired - candles.length) / requirements.totalRequired) * 50;
    }
    
    return Math.max(0, score);
  }

  /**
   * Validate specific signal data requirements
   */
  public validateSignalDataRequirements(
    candles: CandleData[],
    signalIndex: number,
    requirements: SignalDataRequirements,
    symbol: string,
    timeframe: string
  ): DataCompletenessReport {
    const report: DataCompletenessReport = {
      isComplete: false,
      totalRequired: requirements.lookforwardCandles,
      totalAvailable: 0,
      missingDataPoints: 0,
      dataGaps: [],
      qualityScore: 0,
      recommendations: []
    };

    // Validate signal index
    if (signalIndex < 0 || signalIndex >= candles.length) {
      report.skipReason = 'Invalid signal index';
      return report;
    }

    // Check if we have enough historical data before the signal
    const historicalDataAvailable = signalIndex + 1;
    if (historicalDataAvailable < requirements.historicalCandles) {
      report.skipReason = `Insufficient historical data: need ${requirements.historicalCandles}, have ${historicalDataAvailable}`;
      report.recommendations.push('Extend historical data range');
      return report;
    }

    // Check if we have enough lookforward data after the signal
    const lookforwardDataAvailable = candles.length - signalIndex - 1;
    report.totalAvailable = lookforwardDataAvailable;
    
    if (lookforwardDataAvailable < requirements.lookforwardCandles) {
      report.missingDataPoints = requirements.lookforwardCandles - lookforwardDataAvailable;
      report.skipReason = `Insufficient lookforward data: need ${requirements.lookforwardCandles}, have ${lookforwardDataAvailable}`;
      report.recommendations.push('Extend future data range');
      return report;
    }

    // Validate lookforward data quality
    const lookforwardCandles = candles.slice(signalIndex + 1, signalIndex + 1 + requirements.lookforwardCandles);
    const invalidLookforward = this.validateCandleDataQuality(lookforwardCandles);
    
    if (invalidLookforward.length > 0) {
      report.skipReason = `Invalid lookforward data: ${invalidLookforward.length} corrupted candles`;
      report.recommendations.push('Clean lookforward data');
      return report;
    }

    // All validations passed
    report.isComplete = true;
    report.qualityScore = 100;
    
    return report;
  }

  /**
   * Convert timeframe string to milliseconds
   */
  private getTimeframeInMs(timeframe: string): number {
    const timeframeMap: { [key: string]: number } = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    return timeframeMap[timeframe] || 60 * 1000;
  }

  /**
   * Generate detailed validation report
   */
  public generateValidationReport(
    symbol: string,
    timeframe: string,
    datasetReport: DataCompletenessReport,
    signalReports: DataCompletenessReport[]
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== COMPLETE DATA VALIDATION REPORT ===`);
    lines.push(`Symbol: ${symbol} | Timeframe: ${timeframe}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push('');
    
    lines.push(`Dataset Validation:`);
    lines.push(`  Status: ${datasetReport.isComplete ? '✅ PASSED' : '❌ FAILED'}`);
    lines.push(`  Required: ${datasetReport.totalRequired} candles`);
    lines.push(`  Available: ${datasetReport.totalAvailable} candles`);
    lines.push(`  Quality Score: ${datasetReport.qualityScore.toFixed(1)}%`);
    
    if (!datasetReport.isComplete) {
      lines.push(`  Skip Reason: ${datasetReport.skipReason}`);
      lines.push(`  Recommendations:`);
      datasetReport.recommendations.forEach(rec => lines.push(`    - ${rec}`));
    }
    
    lines.push('');
    lines.push(`Signal Validations: ${signalReports.length} signals checked`);
    const passedSignals = signalReports.filter(r => r.isComplete).length;
    const failedSignals = signalReports.length - passedSignals;
    
    lines.push(`  Passed: ${passedSignals}`);
    lines.push(`  Failed: ${failedSignals}`);
    
    if (failedSignals > 0) {
      lines.push(`  Common Skip Reasons:`);
      const skipReasons = signalReports
        .filter(r => !r.isComplete)
        .map(r => r.skipReason)
        .reduce((acc, reason) => {
          acc[reason || 'Unknown'] = (acc[reason || 'Unknown'] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      
      Object.entries(skipReasons).forEach(([reason, count]) => {
        lines.push(`    - ${reason}: ${count} signals`);
      });
    }
    
    return lines.join('\n');
  }
}
