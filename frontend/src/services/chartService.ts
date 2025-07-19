import api from './api';
import { ColorType } from 'lightweight-charts';

export interface ChartData {
  time: string | number; // Support both date strings and numeric timestamps
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp?: number; // Optional original timestamp for reference
}

export interface ChartDataResponse {
  success: boolean;
  data: ChartData[];
  dataRange: {
    start: Date;
    end: Date;
  };
  symbol: string;
  timeframe: string;
  totalCandles: number;
  message?: string; // Optional error message when success is false
}

export interface SignalMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
  size: number;
}

export class ChartService {
  /**
   * Calculate time range around signal timestamp with future time handling
   */
  public calculateChartTimeRange(
    signalTimestamp: number,
    timeframe: string,
    weeksAround: number = 2
  ): { startTime: number; endTime: number } {
    const signalTime = new Date(signalTimestamp);
    const millisecondsInWeek = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    // Calculate range based on timeframe for better context
    let rangeMs = weeksAround * millisecondsInWeek;
    
    // Adjust range based on timeframe
    switch (timeframe) {
      case '1m':
      case '3m':
      case '5m':
        rangeMs = Math.min(rangeMs, 3 * 24 * 60 * 60 * 1000); // Max 3 days for minute charts
        break;
      case '15m':
      case '30m':
        rangeMs = Math.min(rangeMs, 7 * 24 * 60 * 60 * 1000); // Max 1 week for short timeframes
        break;
      case '1h':
      case '2h':
      case '4h':
        rangeMs = weeksAround * millisecondsInWeek; // 2 weeks default
        break;
      case '6h':
      case '8h':
      case '12h':
      case '1d':
        rangeMs = weeksAround * 2 * millisecondsInWeek; // 4 weeks for longer timeframes
        break;
    }
    
    // Calculate initial range
    let startTime = signalTime.getTime() - rangeMs;
    let endTime = signalTime.getTime() + rangeMs;
    
    // Handle future time constraints
    const maxFutureTime = now + (12 * 60 * 60 * 1000); // Allow up to 12 hours in the future
    
    if (endTime > maxFutureTime) {
      console.log(`ChartService: End time ${new Date(endTime).toISOString()} extends too far into future, adjusting...`);
      
      // Cap the end time to the maximum allowed future time
      endTime = maxFutureTime;
      
      // If the signal is very recent, extend the start time to maintain a reasonable range
      const actualRange = endTime - startTime;
      const desiredRange = rangeMs * 2; // Total desired range (before + after signal)
      
      if (actualRange < desiredRange) {
        const additionalHistoryNeeded = desiredRange - actualRange;
        startTime = Math.max(
          startTime - additionalHistoryNeeded,
          signalTime.getTime() - (rangeMs * 3) // Don't go more than 3x the original range back
        );
        
        console.log(`ChartService: Extended start time to ${new Date(startTime).toISOString()} to maintain range`);
      }
    }
    
    // Ensure we don't go too far back in history (max 1 year)
    const maxHistoryTime = now - (365 * 24 * 60 * 60 * 1000);
    if (startTime < maxHistoryTime) {
      console.log(`ChartService: Start time too far in past, adjusting to ${new Date(maxHistoryTime).toISOString()}`);
      startTime = maxHistoryTime;
    }
    
    // Final validation
    if (startTime >= endTime) {
      console.warn(`ChartService: Invalid time range after adjustments, using fallback`);
      // Fallback: show 30 days before signal to 12 hours after (or current time)
      startTime = signalTime.getTime() - (30 * 24 * 60 * 60 * 1000);
      endTime = Math.min(signalTime.getTime() + (12 * 60 * 60 * 1000), now + (12 * 60 * 60 * 1000));
    }
    
    console.log(`ChartService: Final time range - Start: ${new Date(startTime).toISOString()}, End: ${new Date(endTime).toISOString()}`);
    
    return { startTime, endTime };
  }

  /**
   * Fetch chart data from backend with retry logic
   */
  public async fetchChartData(
    symbol: string,
    timeframe: string,
    startTime: number,
    endTime: number,
    retries: number = 3
  ): Promise<ChartDataResponse> {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    console.log(`[${requestId}] ChartService: Starting fetchChartData`, {
      symbol,
      timeframe,
      startTime,
      endTime,
      startDate: new Date(startTime).toISOString(),
      endDate: new Date(endTime).toISOString(),
      retries
    });

    // Validate input parameters
    if (!symbol || typeof symbol !== 'string') {
      throw new Error(`Invalid symbol parameter: ${symbol}`);
    }
    if (!timeframe || typeof timeframe !== 'string') {
      throw new Error(`Invalid timeframe parameter: ${timeframe}`);
    }
    if (!startTime || !endTime || isNaN(startTime) || isNaN(endTime)) {
      throw new Error(`Invalid time parameters: startTime=${startTime}, endTime=${endTime}`);
    }
    if (startTime >= endTime) {
      throw new Error(`Invalid time range: startTime (${startTime}) >= endTime (${endTime})`);
    }

    let lastError: any;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[${requestId}] ChartService: Attempt ${attempt}/${retries}`);
        
        const response = await api.get(
          `/binance/chart-data/${symbol}/${timeframe}`,
          {
            params: {
              startTime: startTime.toString(),
              endTime: endTime.toString()
            },
            timeout: 30000, // 30 second timeout
            headers: {
              'X-Request-ID': requestId
            }
          }
        );

        console.log(`[${requestId}] ChartService: Received response`, {
          status: response.status,
          dataExists: !!response.data,
          success: response.data?.success,
          dataLength: response.data?.data?.length || 0
        });

        // Validate response structure
        if (!response.data) {
          throw new Error('Empty response from server');
        }

        if (!response.data.success) {
          const errorMessage = response.data.message || response.data.details || 'API returned error';
          console.error(`[${requestId}] ChartService: API error:`, {
            message: response.data.message,
            details: response.data.details,
            requestId: response.data.requestId
          });
          throw new Error(errorMessage);
        }

        // Validate data structure
        if (!response.data.data || !Array.isArray(response.data.data)) {
          throw new Error(`Invalid response data structure: expected array, got ${typeof response.data.data}`);
        }

        if (response.data.data.length === 0) {
          throw new Error(`No data available for ${symbol} ${timeframe} in the specified time range`);
        }

        // Validate data quality
        const sampleData = response.data.data.slice(0, 3);
        for (let i = 0; i < sampleData.length; i++) {
          const candle = sampleData[i];
          if (!candle || typeof candle !== 'object') {
            throw new Error(`Invalid candle data at index ${i}: ${JSON.stringify(candle)}`);
          }
          
          const requiredFields = ['time', 'open', 'high', 'low', 'close', 'volume'];
          for (const field of requiredFields) {
            if (candle[field] === undefined || candle[field] === null) {
              throw new Error(`Missing ${field} in candle data at index ${i}`);
            }
            if (field !== 'time' && (typeof candle[field] !== 'number' || isNaN(candle[field]))) {
              throw new Error(`Invalid ${field} value in candle data at index ${i}: ${candle[field]}`);
            }
          }
        }

        console.log(`[${requestId}] ChartService: Request successful`, {
          totalCandles: response.data.data.length,
          symbol: response.data.symbol,
          timeframe: response.data.timeframe,
          dataRange: response.data.dataRange
        });

        return response.data;

      } catch (error: any) {
        lastError = error;
        
        console.error(`[${requestId}] ChartService: Attempt ${attempt} failed:`, {
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data
        });

        // Don't retry on certain errors
        if (error.response?.status === 400 || error.response?.status === 404) {
          console.log(`[${requestId}] ChartService: Not retrying due to client error (${error.response.status})`);
          break;
        }

        // Don't retry if this is the last attempt
        if (attempt === retries) {
          console.log(`[${requestId}] ChartService: All retry attempts exhausted`);
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        console.log(`[${requestId}] ChartService: Waiting ${delay}ms before retry...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All attempts failed, throw the last error with enhanced information
    console.error(`[${requestId}] ChartService: All attempts failed`, {
      symbol,
      timeframe,
      startTime,
      endTime,
      lastError: lastError.message,
      attempts: retries
    });

    // Provide user-friendly error messages
    let userMessage = 'Failed to fetch chart data';
    if (lastError.response?.status) {
      switch (lastError.response.status) {
        case 400:
          userMessage = lastError.response.data?.message || 'Invalid request parameters';
          break;
        case 404:
          userMessage = `No data available for ${symbol} ${timeframe}`;
          break;
        case 429:
          userMessage = 'Rate limit exceeded - please try again in a few moments';
          break;
        case 503:
          userMessage = 'Trading data service is temporarily unavailable';
          break;
        case 500:
          userMessage = 'Server error - please try again later';
          break;
        default:
          userMessage = lastError.response.data?.message || `Server error (${lastError.response.status})`;
      }
    } else if (lastError.message) {
      if (lastError.message.includes('timeout')) {
        userMessage = 'Request timed out - please check your connection and try again';
      } else if (lastError.message.includes('Network Error')) {
        userMessage = 'Network error - please check your connection';
      } else if (lastError.message.includes('Invalid')) {
        userMessage = lastError.message;
      } else {
        userMessage = lastError.message;
      }
    }

    throw new Error(userMessage);
  }

  /**
   * Create signal markers for the chart with timezone alignment
   */
  public createSignalMarkers(
    signalTimestamp: number,
    signalType: string,
    signalPrice: number,
    timeframe: string,
    candleData?: {
      current: any;
      previous1: any;
      previous2: any;
    }
  ): SignalMarker[] {
    const markers: SignalMarker[] = [];
    
    // Align signal time with chart data timezone format
    // For intraday charts: use UTC seconds (matching backend format)
    // For daily+ charts: use local date string (matching backend format)
    const isIntraday = !['1d', '1w', '1M'].includes(timeframe);
    
    let signalTime: number | string;
    if (isIntraday) {
      // For intraday: use UTC seconds to match chart data
      signalTime = Math.floor(signalTimestamp / 1000);
    } else {
      // For daily+: use local date string to match chart data
      const date = new Date(signalTimestamp);
      signalTime = date.getFullYear() + '-' + 
        String(date.getMonth() + 1).padStart(2, '0') + '-' + 
        String(date.getDate()).padStart(2, '0');
    }

    // Main signal marker
    const isBuySignal = signalType.includes('BUY');
    const isPrimarySignal = signalType.includes('PRIMARY');
    
    markers.push({
      time: signalTime as number, // TradingView expects number for markers
      position: isBuySignal ? 'belowBar' : 'aboveBar',
      color: isBuySignal ? '#26a69a' : '#ef5350',
      shape: isBuySignal ? 'arrowUp' : 'arrowDown',
      text: `${signalType}\n$${signalPrice.toFixed(4)}`,
      size: isPrimarySignal ? 2 : 1.5
    });

    // Add pattern markers if candle data is available
    if (candleData) {
      const patternMarkers = this.createPatternMarkers(
        typeof signalTime === 'number' ? signalTime : Math.floor(signalTimestamp / 1000),
        signalType,
        timeframe,
        candleData
      );
      markers.push(...patternMarkers);
    }

    return markers;
  }

  /**
   * Create pattern highlight markers
   */
  private createPatternMarkers(
    signalTime: number,
    signalType: string,
    timeframe: string,
    candleData: {
      current: any;
      previous1: any;
      previous2: any;
    }
  ): SignalMarker[] {
    const markers: SignalMarker[] = [];
    const isBuySignal = signalType.includes('BUY');
    
    // Calculate approximate timestamps for previous candles
    // This is an approximation since we don't have exact timestamps
    const timeframeDuration = this.estimateTimeframeDuration(signalTime);
    
    const prev1Time = signalTime - timeframeDuration;
    const prev2Time = signalTime - (2 * timeframeDuration);

    // Pattern markers with smaller size and different colors
    const patternColor = isBuySignal ? '#4caf50' : '#f44336';
    const patternSize = 0.8;

    // Mark the pattern candles
    markers.push(
      {
        time: prev2Time,
        position: 'aboveBar',
        color: patternColor,
        shape: 'circle',
        text: '1',
        size: patternSize
      },
      {
        time: prev1Time,
        position: 'aboveBar',
        color: patternColor,
        shape: 'circle',
        text: '2',
        size: patternSize
      },
      {
        time: signalTime,
        position: 'aboveBar',
        color: patternColor,
        shape: 'circle',
        text: '3',
        size: patternSize
      }
    );

    return markers;
  }

  /**
   * Estimate timeframe duration in seconds (rough approximation)
   */
  private estimateTimeframeDuration(signalTime: number): number {
    // This is a rough estimation - in a real implementation,
    // you'd want to pass the actual timeframe
    // For now, default to 1 hour
    return 3600;
  }

  /**
   * Format chart data for TradingView Lightweight Charts
   */
  public formatChartData(rawData: ChartData[]): ChartData[] {
    return rawData
      .filter(candle => {
        // Validate time field (can be string or number)
        const hasValidTime = candle.time !== undefined && candle.time !== null && 
          (typeof candle.time === 'string' || (typeof candle.time === 'number' && candle.time > 0));
        
        return hasValidTime &&
          candle.open > 0 &&
          candle.high > 0 &&
          candle.low > 0 &&
          candle.close > 0 &&
          candle.high >= candle.low &&
          candle.volume >= 0;
      })
      .sort((a, b) => {
        // Handle sorting for both string and numeric time values
        const timeA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
        const timeB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
        return timeA - timeB;
      });
  }

  /**
   * Get chart configuration for TradingView Lightweight Charts
   */
  public getChartConfig(isDarkMode: boolean = false) {
    return {
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDarkMode ? '#1e1e1e' : '#ffffff'
        },
        textColor: isDarkMode ? '#d1d4dc' : '#191919'
      },
      grid: {
        vertLines: {
          color: isDarkMode ? '#2a2a2a' : '#e1e1e1'
        },
        horzLines: {
          color: isDarkMode ? '#2a2a2a' : '#e1e1e1'
        }
      },
      crosshair: {
        mode: 1 as const
      },
      rightPriceScale: {
        borderColor: isDarkMode ? '#485c7b' : '#cccccc'
      },
      timeScale: {
        borderColor: isDarkMode ? '#485c7b' : '#cccccc',
        timeVisible: true,
        secondsVisible: false
      }
    };
  }

  /**
   * Get candlestick series configuration
   */
  public getCandlestickConfig(isDarkMode: boolean = false) {
    return {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a'
    };
  }

  /**
   * Get volume series configuration
   */
  public getVolumeConfig(isDarkMode: boolean = false) {
    return {
      color: isDarkMode ? '#26a69a80' : '#26a69a60',
      priceFormat: {
        type: 'volume' as const
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    };
  }
}

export const chartService = new ChartService();
