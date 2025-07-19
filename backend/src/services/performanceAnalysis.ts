import { CandleData, SignalDetection, SignalPerformance, BacktestConfig } from '../types';

export class PerformanceAnalysisService {

  /**
   * Analyze signal performance by looking forward X candles with enhanced validation
   */
  public analyzeSignalPerformance(
    signal: SignalDetection,
    candles: CandleData[],
    signalIndex: number,
    config: BacktestConfig
  ): SignalPerformance {
    const entryPrice = signal.price;
    const lookforwardCandles = config.lookforwardCandles;
    
    // Enhanced input validation
    if (!signal || !candles || signalIndex < 0 || signalIndex >= candles.length) {
      console.warn(`Invalid inputs for performance analysis: signalIndex=${signalIndex}, candles.length=${candles?.length}`);
      return this.createEmptyPerformance(signal, entryPrice);
    }

    if (entryPrice <= 0 || !isFinite(entryPrice)) {
      console.warn(`Invalid entry price: ${entryPrice} for signal ${this.generateSignalId(signal)}`);
      return this.createEmptyPerformance(signal, entryPrice);
    }
    
    // Get the candles to analyze (X candles after the signal)
    const endIndex = Math.min(signalIndex + lookforwardCandles + 1, candles.length);
    const analyzedCandles = candles.slice(signalIndex + 1, endIndex);
    
    if (analyzedCandles.length === 0) {
      console.log(`No lookforward data available for signal ${this.generateSignalId(signal)}`);
      return this.createEmptyPerformance(signal, entryPrice);
    }

    // Validate lookforward candles
    const validCandles = analyzedCandles.filter(candle => 
      candle && 
      candle.high > 0 && 
      candle.low > 0 && 
      candle.close > 0 && 
      candle.open > 0 &&
      candle.high >= candle.low &&
      isFinite(candle.high) && 
      isFinite(candle.low) && 
      isFinite(candle.close) && 
      isFinite(candle.open)
    );

    if (validCandles.length === 0) {
      console.warn(`No valid lookforward candles for signal ${this.generateSignalId(signal)}`);
      return this.createEmptyPerformance(signal, entryPrice);
    }

    if (validCandles.length < analyzedCandles.length) {
      console.warn(`Filtered out ${analyzedCandles.length - validCandles.length} invalid lookforward candles for signal ${this.generateSignalId(signal)}`);
    }

    let maxDrawup = 0;
    let maxDrawdown = 0;
    let maxDrawupPercent = 0;
    let maxDrawdownPercent = 0;
    let timeToMaxDrawup = 0;
    let timeToMaxDrawdown = 0;
    
    const finalPrice = validCandles[validCandles.length - 1].close;
    const finalPricePercent = ((finalPrice - entryPrice) / entryPrice) * 100;

    // Analyze each valid candle in the lookforward period
    for (let i = 0; i < validCandles.length; i++) {
      const candle = validCandles[i];
      
      try {
        // For BUY signals, we look for upward movement (drawup) and downward movement (drawdown)
        // For SELL signals, we look for downward movement (drawup) and upward movement (drawdown)
        
        if (signal.type === 'PRIMARY_BUY' || signal.type === 'BASIC_BUY') {
          // BUY signals: drawup is upward price movement, drawdown is downward price movement
          const highDrawup = Math.max(0, candle.high - entryPrice);
          const lowDrawdown = Math.max(0, entryPrice - candle.low);
          
          if (highDrawup > maxDrawup) {
            maxDrawup = highDrawup;
            maxDrawupPercent = (highDrawup / entryPrice) * 100;
            timeToMaxDrawup = i + 1; // +1 because we start from next candle
          }
          
          if (lowDrawdown > maxDrawdown) {
            maxDrawdown = lowDrawdown;
            maxDrawdownPercent = (lowDrawdown / entryPrice) * 100;
            timeToMaxDrawdown = i + 1;
          }
          
        } else {
          // SELL signals: drawup is downward price movement, drawdown is upward price movement
          const lowDrawup = Math.max(0, entryPrice - candle.low);
          const highDrawdown = Math.max(0, candle.high - entryPrice);
          
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
      } catch (error: any) {
        console.warn(`Error analyzing candle ${i} for signal ${this.generateSignalId(signal)}: ${error.message}`);
        continue;
      }
    }

    // Enhanced risk/reward ratio calculation with realistic approach
    let riskRewardRatio = 0;
    let isPerfectSignal = false;
    
    // Set minimum thresholds for meaningful movements (0.1%)
    const minMovementThreshold = 0.1;
    const meaningfulDrawup = maxDrawupPercent >= minMovementThreshold;
    const meaningfulDrawdown = maxDrawdownPercent >= minMovementThreshold;
    
    if (meaningfulDrawdown && meaningfulDrawup) {
      // Both risk and reward exist - calculate normal R/R ratio
      riskRewardRatio = maxDrawup / maxDrawdown;
    } else if (meaningfulDrawup && !meaningfulDrawdown) {
      // Only reward, no risk - perfect signal (exclude from R/R averaging)
      riskRewardRatio = 0; // Will be excluded from averaging
      isPerfectSignal = true;
    } else if (meaningfulDrawdown && !meaningfulDrawup) {
      // Only risk, no reward - failed signal
      riskRewardRatio = 0;
    } else {
      // No meaningful movement in either direction
      riskRewardRatio = 0;
    }

    // Ensure finite and reasonable values
    if (!isFinite(riskRewardRatio) || riskRewardRatio < 0) {
      riskRewardRatio = 0;
    }
    
    // Cap extremely high ratios to reasonable levels
    if (riskRewardRatio > 100) {
      riskRewardRatio = 100; // Cap at 100:1 ratio
    }
    
    // Determine if signal was successful with enhanced logic
    let isSuccessful = false;
    
    if (maxDrawup > 0 && maxDrawdown > 0) {
      // Both movements exist, compare them
      isSuccessful = maxDrawup > maxDrawdown;
    } else if (maxDrawup > 0 && maxDrawdown === 0) {
      // Only positive movement, definitely successful
      isSuccessful = true;
    } else if (maxDrawup === 0 && maxDrawdown > 0) {
      // Only negative movement, definitely unsuccessful
      isSuccessful = false;
    } else {
      // No significant movement in either direction
      isSuccessful = false;
    }

    // Validate final results
    const result: SignalPerformance = {
      signalId: this.generateSignalId(signal),
      maxDrawup: isFinite(maxDrawup) ? maxDrawup : 0,
      maxDrawdown: isFinite(maxDrawdown) ? maxDrawdown : 0,
      maxDrawupPercent: isFinite(maxDrawupPercent) ? maxDrawupPercent : 0,
      maxDrawdownPercent: isFinite(maxDrawdownPercent) ? maxDrawdownPercent : 0,
      riskRewardRatio,
      isSuccessful,
      timeToMaxDrawup,
      timeToMaxDrawdown,
      finalPrice: isFinite(finalPrice) ? finalPrice : entryPrice,
      finalPricePercent: isFinite(finalPricePercent) ? finalPricePercent : 0
    };

    return result;
  }

  /**
   * Create empty performance data when no analysis is possible
   */
  private createEmptyPerformance(signal: SignalDetection, entryPrice: number): SignalPerformance {
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

  /**
   * Generate unique signal ID
   */
  private generateSignalId(signal: SignalDetection): string {
    return `${signal.symbol}_${signal.timeframe}_${signal.type}_${signal.timestamp}`;
  }

  /**
   * Calculate summary statistics for all signals with corrected R/R averaging
   */
  public calculateSummaryStatistics(performances: SignalPerformance[]): {
    totalSignals: number;
    successfulSignals: number;
    successRate: number;
    avgRiskReward: number;
    avgDrawup: number;
    avgDrawdown: number;
    bestSignal: SignalPerformance | null;
    worstSignal: SignalPerformance | null;
    perfectSignals: number;
  } {
    if (performances.length === 0) {
      return {
        totalSignals: 0,
        successfulSignals: 0,
        successRate: 0,
        avgRiskReward: 0,
        avgDrawup: 0,
        avgDrawdown: 0,
        bestSignal: null,
        worstSignal: null,
        perfectSignals: 0
      };
    }

    const totalSignals = performances.length;
    const successfulSignals = performances.filter(p => p.isSuccessful).length;
    const successRate = (successfulSignals / totalSignals) * 100;

    // Enhanced R/R calculation: Only include signals with both meaningful risk and reward
    const validRiskRewards = performances
      .filter(p => {
        // Only include signals with both drawup and drawdown > 0.1%
        const hasRisk = p.maxDrawdownPercent >= 0.1;
        const hasReward = p.maxDrawupPercent >= 0.1;
        const validRatio = p.riskRewardRatio > 0 && p.riskRewardRatio < 100 && isFinite(p.riskRewardRatio);
        return hasRisk && hasReward && validRatio;
      })
      .map(p => p.riskRewardRatio);

    // Count perfect signals (drawup > 0.1% but drawdown < 0.1%)
    const perfectSignals = performances.filter(p => 
      p.maxDrawupPercent >= 0.1 && p.maxDrawdownPercent < 0.1
    ).length;

    // Calculate realistic average R/R (only from signals with both risk and reward)
    const avgRiskReward = validRiskRewards.length > 0 
      ? validRiskRewards.reduce((sum, rr) => sum + rr, 0) / validRiskRewards.length
      : 0;

    const avgDrawup = performances.reduce((sum, p) => sum + p.maxDrawupPercent, 0) / totalSignals;
    const avgDrawdown = performances.reduce((sum, p) => sum + p.maxDrawdownPercent, 0) / totalSignals;

    // Find best and worst signals (excluding perfect signals for realistic comparison)
    const realisticPerformances = performances.filter(p => p.riskRewardRatio < 999999);
    
    const bestSignal = realisticPerformances.reduce((best, current) => {
      if (!best) return current;
      return current.riskRewardRatio > best.riskRewardRatio ? current : best;
    }, null as SignalPerformance | null);

    const worstSignal = realisticPerformances.reduce((worst, current) => {
      if (!worst) return current;
      return current.riskRewardRatio < worst.riskRewardRatio ? current : worst;
    }, null as SignalPerformance | null);

    console.log(`R/R Calculation: ${validRiskRewards.length} valid signals, ${perfectSignals} perfect signals, avg R/R: ${avgRiskReward.toFixed(4)}`);

    return {
      totalSignals,
      successfulSignals,
      successRate,
      avgRiskReward,
      avgDrawup,
      avgDrawdown,
      bestSignal,
      worstSignal,
      perfectSignals
    };
  }

  /**
   * Filter performances based on criteria
   */
  public filterPerformances(
    performances: SignalPerformance[],
    filters: {
      signalTypes?: string[];
      minRiskReward?: number;
      maxRiskReward?: number;
      minSuccessRate?: number;
      onlySuccessful?: boolean;
    }
  ): SignalPerformance[] {
    return performances.filter(performance => {
      // Filter by signal type
      if (filters.signalTypes && filters.signalTypes.length > 0) {
        const signalType = performance.signalId.split('_')[2]; // Extract type from ID
        if (!filters.signalTypes.includes(signalType)) {
          return false;
        }
      }

      // Filter by risk/reward ratio
      if (filters.minRiskReward !== undefined && performance.riskRewardRatio < filters.minRiskReward) {
        return false;
      }

      if (filters.maxRiskReward !== undefined && performance.riskRewardRatio > filters.maxRiskReward) {
        return false;
      }

      // Filter by success
      if (filters.onlySuccessful && !performance.isSuccessful) {
        return false;
      }

      return true;
    });
  }

  /**
   * Group performances by various criteria
   */
  public groupPerformances(
    performances: SignalPerformance[],
    groupBy: 'signalType' | 'symbol' | 'timeframe' | 'success'
  ): { [key: string]: SignalPerformance[] } {
    const groups: { [key: string]: SignalPerformance[] } = {};

    performances.forEach(performance => {
      let key: string;
      const idParts = performance.signalId.split('_');

      switch (groupBy) {
        case 'signalType':
          key = idParts[2]; // Signal type
          break;
        case 'symbol':
          key = idParts[0]; // Symbol
          break;
        case 'timeframe':
          key = idParts[1]; // Timeframe
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

  /**
   * Calculate performance metrics by time periods
   */
  public calculateTimeBasedMetrics(
    signals: SignalDetection[],
    performances: SignalPerformance[]
  ): {
    hourlyDistribution: { [hour: string]: number };
    dailyDistribution: { [day: string]: number };
    monthlyDistribution: { [month: string]: number };
  } {
    const hourlyDistribution: { [hour: string]: number } = {};
    const dailyDistribution: { [day: string]: number } = {};
    const monthlyDistribution: { [month: string]: number } = {};

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
