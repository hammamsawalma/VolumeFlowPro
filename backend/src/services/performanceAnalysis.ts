import { CandleData, SignalDetection, SignalPerformance, BacktestConfig } from '../types';

export class PerformanceAnalysisService {

  /**
   * Analyze signal performance by looking forward X candles
   */
  public analyzeSignalPerformance(
    signal: SignalDetection,
    candles: CandleData[],
    signalIndex: number,
    config: BacktestConfig
  ): SignalPerformance {
    const entryPrice = signal.price;
    const lookforwardCandles = config.lookforwardCandles;
    
    // Validate inputs
    if (!signal || !candles || signalIndex < 0 || signalIndex >= candles.length) {
      console.warn(`Invalid inputs for performance analysis: signalIndex=${signalIndex}, candles.length=${candles?.length}`);
      return this.createEmptyPerformance(signal, entryPrice);
    }

    if (entryPrice <= 0) {
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

    let maxDrawup = 0;
    let maxDrawdown = 0;
    let maxDrawupPercent = 0;
    let maxDrawdownPercent = 0;
    let timeToMaxDrawup = 0;
    let timeToMaxDrawdown = 0;
    
    const finalPrice = analyzedCandles[analyzedCandles.length - 1].close;
    const finalPricePercent = ((finalPrice - entryPrice) / entryPrice) * 100;

    // Analyze each candle in the lookforward period
    for (let i = 0; i < analyzedCandles.length; i++) {
      const candle = analyzedCandles[i];
      
      // Validate candle data
      if (!candle || candle.high <= 0 || candle.low <= 0 || candle.high < candle.low) {
        console.warn(`Invalid candle data at index ${i} for signal ${this.generateSignalId(signal)}`);
        continue;
      }
      
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
    }

    // Calculate risk/reward ratio with proper handling of edge cases
    let riskRewardRatio = 0;
    if (maxDrawdown > 0) {
      riskRewardRatio = maxDrawup / maxDrawdown;
    } else if (maxDrawup > 0) {
      riskRewardRatio = Infinity;
    }

    // Ensure finite values
    if (!isFinite(riskRewardRatio)) {
      riskRewardRatio = maxDrawup > 0 ? 999999 : 0; // Cap infinity at a large number
    }
    
    // Determine if signal was successful (drawup > drawdown)
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
   * Calculate summary statistics for all signals
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
        worstSignal: null
      };
    }

    const totalSignals = performances.length;
    const successfulSignals = performances.filter(p => p.isSuccessful).length;
    const successRate = (successfulSignals / totalSignals) * 100;

    // Calculate averages
    const avgRiskReward = performances.reduce((sum, p) => {
      return sum + (isFinite(p.riskRewardRatio) ? p.riskRewardRatio : 0);
    }, 0) / totalSignals;

    const avgDrawup = performances.reduce((sum, p) => sum + p.maxDrawupPercent, 0) / totalSignals;
    const avgDrawdown = performances.reduce((sum, p) => sum + p.maxDrawdownPercent, 0) / totalSignals;

    // Find best and worst signals
    const bestSignal = performances.reduce((best, current) => {
      if (!best) return current;
      return current.riskRewardRatio > best.riskRewardRatio ? current : best;
    }, null as SignalPerformance | null);

    const worstSignal = performances.reduce((worst, current) => {
      if (!worst) return current;
      return current.riskRewardRatio < worst.riskRewardRatio ? current : worst;
    }, null as SignalPerformance | null);

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
