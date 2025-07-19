import { v4 as uuidv4 } from 'uuid';
import { BacktestConfig, BacktestResult, SignalDetection, SignalPerformance } from '../types';
import { BacktestResultModel } from '../models/BacktestResult';
import { BinanceService } from './binanceService';
import { SignalDetectionService } from './signalDetection';
import { PerformanceAnalysisService } from './performanceAnalysis';

export class BacktestService {
  private binanceService: BinanceService;
  private signalDetectionService: SignalDetectionService;
  private performanceAnalysisService: PerformanceAnalysisService;

  constructor() {
    this.binanceService = new BinanceService();
    this.signalDetectionService = new SignalDetectionService();
    this.performanceAnalysisService = new PerformanceAnalysisService();
  }

  /**
   * Start a new backtest
   */
  async startBacktest(config: BacktestConfig): Promise<string> {
    const backtestId = uuidv4();
    
    // Create initial backtest record
    const backtestResult: BacktestResult = {
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
        worstSignal: null,
        perfectSignals: 0
      },
      createdAt: new Date(),
      completedAt: null,
      status: 'PENDING',
      progress: 0
    };

    // Save to database
    const backtestDoc = new BacktestResultModel(backtestResult);
    await backtestDoc.save();

    // Start the backtest process asynchronously
    this.runBacktest(backtestId).catch(error => {
      console.error(`Backtest ${backtestId} failed:`, error);
      this.updateBacktestStatus(backtestId, 'FAILED', 0, error.message);
    });

    return backtestId;
  }

  /**
   * Run the actual backtest process with enhanced error handling and validation
   */
  private async runBacktest(backtestId: string): Promise<void> {
    console.log(`Starting backtest ${backtestId}`);
    
    try {
      // Update status to running
      await this.updateBacktestStatus(backtestId, 'RUNNING', 0);

      const backtestDoc = await BacktestResultModel.findOne({ id: backtestId });
      if (!backtestDoc) {
        throw new Error('Backtest not found');
      }

      const config = backtestDoc.config;
      const allSignals: SignalDetection[] = [];
      const allPerformances: SignalPerformance[] = [];

      // Enhanced tracking
      const processingStats = {
        totalCombinations: config.symbols.length * config.timeframes.length,
        completedCombinations: 0,
        skippedCombinations: 0,
        failedCombinations: 0,
        totalSignalsDetected: 0,
        totalSignalsProcessed: 0,
        totalSignalsSkipped: 0,
        skipReasons: new Map<string, number>()
      };

      console.log(`Processing ${processingStats.totalCombinations} symbol-timeframe combinations`);

      // Calculate minimum required candles for validation
      const minRequiredCandles = Math.max(
        config.volumeMaLength,
        config.volumeStdLength
      ) + config.lookforwardCandles + 3;

      // Process each symbol-timeframe combination
      for (const symbol of config.symbols) {
        for (const timeframe of config.timeframes) {
          try {
            console.log(`Processing ${symbol} ${timeframe}`);

            const startDate = new Date(config.startDate);
            const endDate = new Date(config.endDate);
            
            // Use AGGRESSIVE data fetching with ZERO-TOLERANCE validation
            const dataResult = await this.binanceService.getHistoricalDataBatchedWithValidation(
              symbol,
              timeframe,
              startDate,
              endDate,
              minRequiredCandles
            );

            if (!dataResult.success) {
              console.log(`❌ SKIPPING ${symbol} ${timeframe}: ${dataResult.skipReason}`);
              processingStats.skippedCombinations++;
              this.updateSkipReason(processingStats.skipReasons, dataResult.skipReason || 'Unknown error');
              continue;
            }

            const candles = dataResult.data;
            console.log(`✅ AGGRESSIVE FETCH SUCCESS for ${symbol} ${timeframe}: ${candles.length} candles (Quality: ${dataResult.dataQuality.qualityScore.toFixed(1)}%)`);

            // Detect signals with validation
            const signals = this.signalDetectionService.detectSignals(
              candles,
              symbol,
              timeframe,
              config
            );

            processingStats.totalSignalsDetected += signals.length;
            console.log(`Detected ${signals.length} signals for ${symbol} ${timeframe}`);

            // Analyze performance for each signal with validation
            let processedSignals = 0;
            let skippedSignals = 0;

            for (const signal of signals) {
              try {
                // Find the signal's index in the candles array
                const signalIndex = candles.findIndex(c => c.timestamp === signal.timestamp);
                
                if (signalIndex < 0) {
                  console.warn(`Signal timestamp not found in candles for ${symbol} ${timeframe}`);
                  skippedSignals++;
                  continue;
                }

                // Validate if signal can be analyzed
                const signalValidation = this.signalDetectionService.validateSignalForAnalysis(
                  signal,
                  candles,
                  signalIndex,
                  config
                );

                if (!signalValidation.canAnalyze) {
                  console.log(`Skipping signal at ${new Date(signal.timestamp).toISOString()}: ${signalValidation.reason}`);
                  skippedSignals++;
                  this.updateSkipReason(processingStats.skipReasons, signalValidation.reason || 'Signal validation failed');
                  continue;
                }

                // Analyze performance
                const performance = this.performanceAnalysisService.analyzeSignalPerformance(
                  signal,
                  candles,
                  signalIndex,
                  config
                );
                
                allSignals.push(signal);
                allPerformances.push(performance);
                processedSignals++;

              } catch (error: any) {
                console.error(`Error analyzing signal for ${symbol} ${timeframe}:`, error.message);
                skippedSignals++;
                this.updateSkipReason(processingStats.skipReasons, `Signal analysis error: ${error.message}`);
              }
            }
            
            processingStats.totalSignalsProcessed += processedSignals;
            processingStats.totalSignalsSkipped += skippedSignals;
            
            console.log(`Processed ${processedSignals}/${signals.length} signals for ${symbol} ${timeframe} (skipped: ${skippedSignals})`);

            processingStats.completedCombinations++;

          } catch (error: any) {
            console.error(`Error processing ${symbol} ${timeframe}:`, error.message);
            processingStats.failedCombinations++;
            this.updateSkipReason(processingStats.skipReasons, `Processing error: ${error.message}`);
            // Continue with other combinations even if one fails
          }

          // Update progress
          const totalProcessed = processingStats.completedCombinations + processingStats.skippedCombinations + processingStats.failedCombinations;
          const progress = Math.round((totalProcessed / processingStats.totalCombinations) * 100);
          await this.updateBacktestStatus(backtestId, 'RUNNING', progress);
        }
      }

      // Calculate summary statistics
      const summary = this.performanceAnalysisService.calculateSummaryStatistics(allPerformances);

      // Log comprehensive processing statistics
      console.log(`\n=== Backtest ${backtestId} Processing Summary ===`);
      console.log(`Total combinations: ${processingStats.totalCombinations}`);
      console.log(`Completed: ${processingStats.completedCombinations}`);
      console.log(`Skipped: ${processingStats.skippedCombinations}`);
      console.log(`Failed: ${processingStats.failedCombinations}`);
      console.log(`Signals detected: ${processingStats.totalSignalsDetected}`);
      console.log(`Signals processed: ${processingStats.totalSignalsProcessed}`);
      console.log(`Signals skipped: ${processingStats.totalSignalsSkipped}`);
      console.log(`Success rate: ${summary.successRate.toFixed(2)}%`);
      
      if (processingStats.skipReasons.size > 0) {
        console.log(`\nSkip reasons:`);
        for (const [reason, count] of processingStats.skipReasons.entries()) {
          console.log(`  - ${reason}: ${count}`);
        }
      }

      // Update final results
      await BacktestResultModel.findOneAndUpdate(
        { id: backtestId },
        {
          signals: allSignals,
          performance: allPerformances,
          summary,
          completedAt: new Date(),
          status: 'COMPLETED',
          progress: 100,
          processingStats: {
            totalCombinations: processingStats.totalCombinations,
            completedCombinations: processingStats.completedCombinations,
            skippedCombinations: processingStats.skippedCombinations,
            failedCombinations: processingStats.failedCombinations,
            totalSignalsDetected: processingStats.totalSignalsDetected,
            totalSignalsProcessed: processingStats.totalSignalsProcessed,
            totalSignalsSkipped: processingStats.totalSignalsSkipped,
            skipReasons: Object.fromEntries(processingStats.skipReasons)
          }
        }
      );

      console.log(`Backtest ${backtestId} completed successfully`);

    } catch (error: any) {
      console.error(`Backtest ${backtestId} failed:`, error);
      await this.updateBacktestStatus(backtestId, 'FAILED', 0, error.message);
      throw error;
    }
  }

  /**
   * Helper method to update skip reason statistics
   */
  private updateSkipReason(skipReasons: Map<string, number>, reason: string): void {
    const count = skipReasons.get(reason) || 0;
    skipReasons.set(reason, count + 1);
  }

  /**
   * Update backtest status
   */
  private async updateBacktestStatus(
    backtestId: string,
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
    progress: number,
    error?: string
  ): Promise<void> {
    const updateData: any = { status, progress };
    
    if (error) {
      updateData.error = error;
    }
    
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    await BacktestResultModel.findOneAndUpdate(
      { id: backtestId },
      updateData
    );
  }

  /**
   * Get backtest result by ID
   */
  async getBacktestResult(backtestId: string): Promise<BacktestResult | null> {
    const backtestDoc = await BacktestResultModel.findOne({ id: backtestId });
    return backtestDoc ? backtestDoc.toObject() : null;
  }

  /**
   * Get all backtest results (with pagination)
   */
  async getAllBacktestResults(
    page: number = 1,
    limit: number = 10
  ): Promise<{ results: BacktestResult[], total: number, page: number, totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const [results, total] = await Promise.all([
      BacktestResultModel.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BacktestResultModel.countDocuments()
    ]);

    return {
      results: results as BacktestResult[],
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Delete backtest result
   */
  async deleteBacktestResult(backtestId: string): Promise<boolean> {
    const result = await BacktestResultModel.findOneAndDelete({ id: backtestId });
    return result !== null;
  }

  /**
   * Get backtest progress
   */
  async getBacktestProgress(backtestId: string): Promise<{ status: string, progress: number, error?: string } | null> {
    const backtestDoc = await BacktestResultModel.findOne({ id: backtestId }, { status: 1, progress: 1, error: 1 });
    return backtestDoc ? {
      status: backtestDoc.status,
      progress: backtestDoc.progress,
      error: backtestDoc.error
    } : null;
  }

  /**
   * Cancel running backtest
   */
  async cancelBacktest(backtestId: string): Promise<boolean> {
    const result = await BacktestResultModel.findOneAndUpdate(
      { id: backtestId, status: { $in: ['PENDING', 'RUNNING'] } },
      { status: 'CANCELLED', error: 'Cancelled by user' }
    );
    return result !== null;
  }

  /**
   * Get filtered signals from a backtest
   */
  async getFilteredSignals(
    backtestId: string,
    filters: {
      signalTypes?: string[];
      symbols?: string[];
      timeframes?: string[];
      startDate?: string;
      endDate?: string;
      minRiskReward?: number;
      maxRiskReward?: number;
      onlySuccessful?: boolean;
    }
  ): Promise<{ signals: SignalDetection[], performances: SignalPerformance[] } | null> {
    const backtestDoc = await BacktestResultModel.findOne({ id: backtestId });
    if (!backtestDoc) return null;

    let filteredSignals = backtestDoc.signals;
    let filteredPerformances = backtestDoc.performance;

    // Apply filters
    if (filters.signalTypes && filters.signalTypes.length > 0) {
      filteredSignals = filteredSignals.filter(signal => 
        filters.signalTypes!.includes(signal.type)
      );
    }

    if (filters.symbols && filters.symbols.length > 0) {
      filteredSignals = filteredSignals.filter(signal => 
        filters.symbols!.includes(signal.symbol)
      );
    }

    if (filters.timeframes && filters.timeframes.length > 0) {
      filteredSignals = filteredSignals.filter(signal => 
        filters.timeframes!.includes(signal.timeframe)
      );
    }

    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      filteredSignals = filteredSignals.filter(signal => 
        signal.timestamp >= startTime
      );
    }

    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      filteredSignals = filteredSignals.filter(signal => 
        signal.timestamp <= endTime
      );
    }

    // Filter performances to match filtered signals
    const signalIds = new Set(filteredSignals.map(signal => 
      `${signal.symbol}_${signal.timeframe}_${signal.type}_${signal.timestamp}`
    ));

    filteredPerformances = filteredPerformances.filter(perf => 
      signalIds.has(perf.signalId)
    );

    // Apply performance-based filters
    if (filters.minRiskReward !== undefined) {
      filteredPerformances = filteredPerformances.filter(perf => 
        perf.riskRewardRatio >= filters.minRiskReward!
      );
    }

    if (filters.maxRiskReward !== undefined) {
      filteredPerformances = filteredPerformances.filter(perf => 
        perf.riskRewardRatio <= filters.maxRiskReward!
      );
    }

    if (filters.onlySuccessful) {
      filteredPerformances = filteredPerformances.filter(perf => 
        perf.isSuccessful
      );
    }

    // Filter signals to match filtered performances
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

  /**
   * Validate backtest configuration
   */
  validateConfig(config: BacktestConfig): { isValid: boolean, errors: string[] } {
    const errors: string[] = [];

    // Check required fields
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

    // Check date validity
    if (config.startDate && config.endDate) {
      const startDate = new Date(config.startDate);
      const endDate = new Date(config.endDate);
      
      if (startDate >= endDate) {
        errors.push('End date must be after start date');
      }

      // Check if date range is too large (more than 2 years)
      const maxDaysBack = this.binanceService.getHistoricalDataLimits().maxDaysBack;
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > maxDaysBack) {
        errors.push(`Date range cannot exceed ${maxDaysBack} days`);
      }
    }

    // Check numeric values
    if (config.lookforwardCandles < 1 || config.lookforwardCandles > 10000) {
      errors.push('Lookforward candles must be between 1 and 10000');
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

    // Check if at least one signal type is enabled
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
