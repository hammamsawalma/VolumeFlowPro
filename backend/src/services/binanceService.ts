import axios from 'axios';
import { CandleData, BinanceKlineData } from '../types';

export class BinanceService {
  private baseUrl = 'https://fapi.binance.com';
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly RATE_LIMIT = 1200; // requests per minute
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff in ms

  /**
   * Rate limiting to avoid API bans
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if more than 1 minute has passed
    if (now - this.lastRequestTime > this.RATE_LIMIT_WINDOW) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // If we're approaching the rate limit, wait
    if (this.requestCount >= this.RATE_LIMIT - 10) {
      const waitTime = this.RATE_LIMIT_WINDOW - (now - this.lastRequestTime);
      if (waitTime > 0) {
        console.log(`Rate limit approaching, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.lastRequestTime = Date.now();
      }
    }

    this.requestCount++;
  }

  /**
   * Get all USDT perpetual trading pairs from Binance Futures
   */
  async getUSDTPerpetualSymbols(): Promise<string[]> {
    try {
      await this.rateLimit();
      
      const response = await axios.get(`${this.baseUrl}/fapi/v1/exchangeInfo`);
      const symbols = response.data.symbols
        .filter((symbol: any) => 
          symbol.status === 'TRADING' && 
          symbol.contractType === 'PERPETUAL' &&
          symbol.quoteAsset === 'USDT'
        )
        .map((symbol: any) => symbol.symbol);

      console.log(`Found ${symbols.length} USDT perpetual symbols`);
      return symbols;
    } catch (error) {
      console.error('Error fetching symbols:', error);
      throw new Error('Failed to fetch trading symbols');
    }
  }

  /**
   * Get supported timeframes
   */
  getSupportedTimeframes(): string[] {
    return ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
  }

  /**
   * Get historical data limits for Binance
   */
  getHistoricalDataLimits(): { maxCandles: number, maxDaysBack: number } {
    return {
      maxCandles: 1500, // Max candles per request
      maxDaysBack: 365 * 2 // Approximately 2 years of data available
    };
  }

  /**
   * Convert Binance kline data to our CandleData format
   */
  private convertKlineData(klineData: BinanceKlineData[]): CandleData[] {
    return klineData.map(kline => ({
      timestamp: kline.openTime,
      open: parseFloat(kline.open),
      high: parseFloat(kline.high),
      low: parseFloat(kline.low),
      close: parseFloat(kline.close),
      volume: parseFloat(kline.volume)
    }));
  }

  /**
   * Enhanced retry mechanism with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.response?.status === 400 || error.response?.status === 404) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          console.error(`${context}: All ${maxRetries + 1} attempts failed`);
          throw error;
        }
        
        const delay = this.RETRY_DELAYS[attempt] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
        console.warn(`${context}: Attempt ${attempt + 1} failed, retrying in ${delay}ms. Error: ${error.message}`);
        
        // Special handling for rate limits
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * 2;
          console.log(`Rate limited, waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Validate candle data quality
   */
  private validateCandleData(candles: CandleData[]): CandleData[] {
    return candles.filter(candle => {
      // Basic validation
      if (!candle || typeof candle !== 'object') return false;
      
      // Check for valid numbers
      const values = [candle.open, candle.high, candle.low, candle.close, candle.volume, candle.timestamp];
      if (values.some(val => val === null || val === undefined || isNaN(Number(val)))) return false;
      
      // Check for positive prices
      if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) return false;
      
      // Check for non-negative volume
      if (candle.volume < 0) return false;
      
      // Check price relationships
      if (candle.high < candle.low) return false;
      if (candle.high < Math.max(candle.open, candle.close)) return false;
      if (candle.low > Math.min(candle.open, candle.close)) return false;
      
      // Check for valid timestamp
      if (candle.timestamp <= 0) return false;
      
      return true;
    });
  }

  /**
   * Get historical candlestick data for a symbol with enhanced error handling
   */
  async getHistoricalData(
    symbol: string,
    timeframe: string,
    startTime?: number,
    endTime?: number,
    limit: number = 1500
  ): Promise<CandleData[]> {
    return this.retryWithBackoff(async () => {
      await this.rateLimit();

      const params: any = {
        symbol,
        interval: timeframe,
        limit: Math.min(limit, 1500) // Binance max limit is 1500
      };

      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await axios.get(`${this.baseUrl}/fapi/v1/klines`, { 
        params,
        timeout: 30000 // 30 second timeout
      });
      
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format from Binance API');
      }

      if (response.data.length === 0) {
        console.warn(`No data returned for ${symbol} ${timeframe}`);
        return [];
      }

      const klineData: BinanceKlineData[] = response.data.map((kline: any[]) => ({
        openTime: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        closeTime: kline[6],
        quoteAssetVolume: kline[7],
        numberOfTrades: kline[8],
        takerBuyBaseAssetVolume: kline[9],
        takerBuyQuoteAssetVolume: kline[10],
        ignore: kline[11]
      }));

      const candleData = this.convertKlineData(klineData);
      const validCandles = this.validateCandleData(candleData);
      
      if (validCandles.length !== candleData.length) {
        console.warn(`Filtered out ${candleData.length - validCandles.length} invalid candles for ${symbol} ${timeframe}`);
      }
      
      return validCandles;
    }, `getHistoricalData(${symbol}, ${timeframe})`);
  }

  /**
   * Fetch exact data range with parallel batch processing - Phase 1 Implementation
   */
  async fetchExactRange(
    symbol: string,
    timeframe: string,
    startTime: number,
    endTime: number
  ): Promise<{ data: CandleData[], dataRange: { start: Date, end: Date } }> {
    const requestId = Math.random().toString(36).substr(2, 9);
    console.log(`🎯 [${requestId}] EXACT RANGE FETCH: ${symbol} ${timeframe} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

    // Calculate exact requirements
    const timeframeMs = this.getTimeframeInMs(timeframe);
    const totalTimespan = endTime - startTime;
    const expectedCandles = Math.ceil(totalTimespan / timeframeMs);
    
    console.log(`📊 [${requestId}] Expected candles: ${expectedCandles}`);

    // Calculate batches needed
    const batchSize = 1500; // Binance limit
    const batches: Array<{ start: number; end: number; index: number }> = [];
    let currentStart = startTime;
    let batchIndex = 0;

    while (currentStart < endTime) {
      const batchEndTime = Math.min(currentStart + (batchSize * timeframeMs), endTime);
      batches.push({ 
        start: currentStart, 
        end: batchEndTime, 
        index: batchIndex 
      });
      currentStart = batchEndTime;
      batchIndex++;
    }

    console.log(`🔄 [${requestId}] Created ${batches.length} batches for parallel fetching`);

    // Fetch all batches in parallel with controlled concurrency
    const maxConcurrent = Math.min(5, batches.length); // Max 5 concurrent requests
    const batchPromises: Promise<{ data: CandleData[]; batchIndex: number }>[] = [];

    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const batchGroup = batches.slice(i, i + maxConcurrent);
      
      const groupPromises = batchGroup.map(async (batch) => {
        try {
          await this.rateLimit();
          const data = await this.getHistoricalData(
            symbol,
            timeframe,
            batch.start,
            batch.end,
            batchSize
          );
          return { data, batchIndex: batch.index };
        } catch (error: any) {
          console.error(`❌ [${requestId}] Batch ${batch.index} failed: ${error.message}`);
          throw error;
        }
      });

      batchPromises.push(...groupPromises);
      
      // Small delay between batch groups to respect rate limits
      if (i + maxConcurrent < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Wait for all batches to complete
    const results = await Promise.allSettled(batchPromises);
    
    // Process results
    const successfulBatches: Array<{ data: CandleData[]; batchIndex: number }> = [];
    const failedBatches: number[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulBatches.push(result.value);
      } else {
        failedBatches.push(index);
        console.error(`❌ [${requestId}] Batch ${index} failed: ${result.reason.message}`);
      }
    });

    if (failedBatches.length > 0) {
      throw new Error(`Failed to fetch ${failedBatches.length}/${batches.length} batches for ${symbol}`);
    }

    // Combine and sort all candles
    const allCandles = successfulBatches
      .sort((a, b) => a.batchIndex - b.batchIndex) // Sort by batch order
      .flatMap(batch => batch.data)
      .filter(candle => candle.timestamp >= startTime && candle.timestamp <= endTime) // Exact range filter
      .sort((a, b) => a.timestamp - b.timestamp);

    // Remove duplicates
    const uniqueCandles = allCandles.filter((candle, index, arr) => 
      index === 0 || candle.timestamp !== arr[index - 1].timestamp
    );

    // Validate we got the expected amount (allow 5% tolerance for market gaps)
    const minExpected = Math.floor(expectedCandles * 0.95);
    if (uniqueCandles.length < minExpected) {
      throw new Error(`Insufficient data for ${symbol}: got ${uniqueCandles.length}, expected at least ${minExpected}`);
    }

    const dataRange = {
      start: uniqueCandles.length > 0 ? new Date(uniqueCandles[0].timestamp) : new Date(startTime),
      end: uniqueCandles.length > 0 ? new Date(uniqueCandles[uniqueCandles.length - 1].timestamp) : new Date(endTime)
    };

    console.log(`✅ [${requestId}] SUCCESS: ${uniqueCandles.length} candles fetched (${((uniqueCandles.length / expectedCandles) * 100).toFixed(1)}% of expected)`);

    return {
      data: uniqueCandles,
      dataRange
    };
  }

  /**
   * Legacy method - now uses optimized fetchExactRange
   */
  async getHistoricalDataBatched(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ data: CandleData[], dataRange: { start: Date, end: Date } }> {
    return this.fetchExactRange(symbol, timeframe, startDate.getTime(), endDate.getTime());
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

    return timeframeMap[timeframe] || 60 * 1000; // Default to 1 minute
  }

  /**
   * Test connection to Binance API with enhanced diagnostics
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.rateLimit();
      
      console.log('Testing Binance API connection...');
      const startTime = Date.now();
      
      const response = await axios.get(`${this.baseUrl}/fapi/v1/ping`, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'VolumeFlowPro/1.0'
        }
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`Binance API ping successful - Response time: ${responseTime}ms`);
      
      return response.status === 200;
    } catch (error: any) {
      console.error('Binance API connection test failed:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        timeout: error.code === 'ECONNABORTED',
        network: error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED'
      });
      return false;
    }
  }

  /**
   * Enhanced connection test with multiple endpoints
   */
  async testConnectionExtensive(): Promise<{
    success: boolean;
    details: {
      ping: boolean;
      serverTime: boolean;
      exchangeInfo: boolean;
      responseTime: number;
      errors: string[];
    };
  }> {
    const details = {
      ping: false,
      serverTime: false,
      exchangeInfo: false,
      responseTime: 0,
      errors: [] as string[]
    };

    const startTime = Date.now();

    // Test ping endpoint
    try {
      await this.rateLimit();
      const pingResponse = await axios.get(`${this.baseUrl}/fapi/v1/ping`, { timeout: 5000 });
      details.ping = pingResponse.status === 200;
    } catch (error: any) {
      details.errors.push(`Ping failed: ${error.message}`);
    }

    // Test server time endpoint
    try {
      await this.rateLimit();
      const timeResponse = await axios.get(`${this.baseUrl}/fapi/v1/time`, { timeout: 5000 });
      details.serverTime = timeResponse.status === 200;
    } catch (error: any) {
      details.errors.push(`Server time failed: ${error.message}`);
    }

    // Test exchange info endpoint (lightweight)
    try {
      await this.rateLimit();
      const infoResponse = await axios.get(`${this.baseUrl}/fapi/v1/exchangeInfo`, { 
        timeout: 10000,
        params: { symbol: 'BTCUSDT' } // Limit to one symbol for speed
      });
      details.exchangeInfo = infoResponse.status === 200;
    } catch (error: any) {
      details.errors.push(`Exchange info failed: ${error.message}`);
    }

    details.responseTime = Date.now() - startTime;
    const success = details.ping && details.serverTime;

    console.log('Extensive connection test results:', details);

    return { success, details };
  }

  /**
   * Get server time from Binance
   */
  async getServerTime(): Promise<number> {
    try {
      await this.rateLimit();
      const response = await axios.get(`${this.baseUrl}/fapi/v1/time`);
      return response.data.serverTime;
    } catch (error) {
      console.error('Error getting server time:', error);
      return Date.now();
    }
  }

  /**
   * Validate data availability and quality for a symbol-timeframe combination
   */
  async validateDataAvailability(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    minRequiredCandles: number
  ): Promise<{
    isValid: boolean;
    reason?: string;
    actualDataCount: number;
    dataQualityScore: number;
    actualRange?: { start: Date; end: Date };
  }> {
    try {
      console.log(`Validating data availability for ${symbol} ${timeframe}`);
      
      // Try to fetch a small sample first to check availability
      const sampleResult = await this.getHistoricalDataBatched(symbol, timeframe, startDate, endDate);
      
      if (sampleResult.data.length === 0) {
        return {
          isValid: false,
          reason: 'No data available for the specified date range',
          actualDataCount: 0,
          dataQualityScore: 0
        };
      }
      
      if (sampleResult.data.length < minRequiredCandles) {
        return {
          isValid: false,
          reason: `Insufficient data: ${sampleResult.data.length} candles available, ${minRequiredCandles} required`,
          actualDataCount: sampleResult.data.length,
          dataQualityScore: 0
        };
      }
      
      // Calculate data quality score (0-100)
      const totalExpectedCandles = this.calculateExpectedCandles(startDate, endDate, timeframe);
      const dataCompletenessScore = Math.min(100, (sampleResult.data.length / totalExpectedCandles) * 100);
      
      // Check for data gaps
      const gaps = this.detectDataGaps(sampleResult.data, timeframe);
      const gapPenalty = Math.min(50, gaps.length * 5); // Penalize gaps
      
      const dataQualityScore = Math.max(0, dataCompletenessScore - gapPenalty);
      
      return {
        isValid: true,
        actualDataCount: sampleResult.data.length,
        dataQualityScore,
        actualRange: sampleResult.dataRange
      };
      
    } catch (error: any) {
      console.error(`Data validation failed for ${symbol} ${timeframe}:`, error.message);
      return {
        isValid: false,
        reason: `Data validation error: ${error.message}`,
        actualDataCount: 0,
        dataQualityScore: 0
      };
    }
  }

  /**
   * Calculate expected number of candles for a date range and timeframe
   */
  private calculateExpectedCandles(startDate: Date, endDate: Date, timeframe: string): number {
    const timeframeMs = this.getTimeframeInMs(timeframe);
    const totalMs = endDate.getTime() - startDate.getTime();
    return Math.floor(totalMs / timeframeMs);
  }

  /**
   * Detect gaps in candle data
   */
  private detectDataGaps(candles: CandleData[], timeframe: string): Array<{ start: Date; end: Date }> {
    if (candles.length < 2) return [];
    
    const timeframeMs = this.getTimeframeInMs(timeframe);
    const gaps: Array<{ start: Date; end: Date }> = [];
    
    for (let i = 1; i < candles.length; i++) {
      const expectedNextTime = candles[i - 1].timestamp + timeframeMs;
      const actualTime = candles[i].timestamp;
      
      // Allow for small timing variations (up to 10% of timeframe)
      const tolerance = timeframeMs * 0.1;
      
      if (actualTime > expectedNextTime + tolerance) {
        gaps.push({
          start: new Date(expectedNextTime),
          end: new Date(actualTime)
        });
      }
    }
    
    return gaps;
  }

  /**
   * AGGRESSIVE data fetching with multiple strategies and persistent retries
   */
  async getHistoricalDataBatchedWithValidation(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    minRequiredCandles: number
  ): Promise<{
    success: boolean;
    data: CandleData[];
    dataRange: { start: Date; end: Date };
    skipReason?: string;
    dataQuality: {
      totalCandles: number;
      validCandles: number;
      qualityScore: number;
      gaps: number;
    };
  }> {
    const requestId = Math.random().toString(36).substr(2, 9);
    console.log(`[${requestId}] AGGRESSIVE FETCH: ${symbol} ${timeframe} - Need ${minRequiredCandles} candles`);

    try {
      // Strategy 1: Calculate optimal date range based on requirements
      const optimalRange = this.calculateOptimalDateRange(timeframe, minRequiredCandles, startDate, endDate);
      console.log(`[${requestId}] Optimal range: ${optimalRange.start.toISOString()} to ${optimalRange.end.toISOString()}`);

      // Strategy 2: Try multiple fetching approaches
      const strategies = [
        () => this.fetchWithExtendedRange(symbol, timeframe, optimalRange.start, optimalRange.end, minRequiredCandles, requestId),
        () => this.fetchWithMultipleBatches(symbol, timeframe, optimalRange.start, optimalRange.end, minRequiredCandles, requestId),
        () => this.fetchWithFallbackRange(symbol, timeframe, startDate, endDate, minRequiredCandles, requestId)
      ];

      let lastError: any;
      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`[${requestId}] Trying strategy ${i + 1}/${strategies.length}`);
          const result = await strategies[i]();
          
          if (result.success && result.data.length >= minRequiredCandles) {
            console.log(`[${requestId}] SUCCESS with strategy ${i + 1}: ${result.data.length} candles`);
            return result;
          } else if (result.success) {
            console.log(`[${requestId}] Strategy ${i + 1} got ${result.data.length} candles, need ${minRequiredCandles}`);
            lastError = new Error(`Insufficient data: got ${result.data.length}, need ${minRequiredCandles}`);
          } else {
            console.log(`[${requestId}] Strategy ${i + 1} failed: ${result.skipReason}`);
            lastError = new Error(result.skipReason || 'Unknown error');
          }
        } catch (error: any) {
          console.log(`[${requestId}] Strategy ${i + 1} threw error: ${error.message}`);
          lastError = error;
        }
      }

      // All strategies failed
      console.error(`[${requestId}] ALL STRATEGIES FAILED for ${symbol} ${timeframe}`);
      return {
        success: false,
        data: [],
        dataRange: { start: startDate, end: endDate },
        skipReason: `All fetch strategies failed. Last error: ${lastError?.message || 'Unknown error'}`,
        dataQuality: {
          totalCandles: 0,
          validCandles: 0,
          qualityScore: 0,
          gaps: 0
        }
      };
      
    } catch (error: any) {
      console.error(`[${requestId}] CRITICAL ERROR for ${symbol} ${timeframe}:`, error.message);
      return {
        success: false,
        data: [],
        dataRange: { start: startDate, end: endDate },
        skipReason: `Critical fetch error: ${error.message}`,
        dataQuality: {
          totalCandles: 0,
          validCandles: 0,
          qualityScore: 0,
          gaps: 0
        }
      };
    }
  }

  /**
   * Calculate optimal date range to ensure we get enough data
   */
  private calculateOptimalDateRange(
    timeframe: string,
    minRequiredCandles: number,
    requestedStart: Date,
    requestedEnd: Date
  ): { start: Date; end: Date } {
    const timeframeMs = this.getTimeframeInMs(timeframe);
    const requiredTimespan = minRequiredCandles * timeframeMs;
    
    // Add 50% buffer for gaps and weekends
    const bufferedTimespan = requiredTimespan * 1.5;
    
    // Calculate optimal start date
    const optimalStart = new Date(requestedEnd.getTime() - bufferedTimespan);
    
    // Don't go further back than 2 years
    const maxHistoryDate = new Date(Date.now() - (2 * 365 * 24 * 60 * 60 * 1000));
    const finalStart = optimalStart < maxHistoryDate ? maxHistoryDate : optimalStart;
    
    // Use requested start if it's earlier (user wants specific range)
    const actualStart = requestedStart < finalStart ? requestedStart : finalStart;
    
    console.log(`Optimal range calculation: need ${minRequiredCandles} candles, timespan ${(bufferedTimespan / (24 * 60 * 60 * 1000)).toFixed(1)} days`);
    
    return {
      start: actualStart,
      end: requestedEnd
    };
  }

  /**
   * Strategy 1: Fetch with extended range
   */
  private async fetchWithExtendedRange(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    minRequiredCandles: number,
    requestId: string
  ): Promise<{
    success: boolean;
    data: CandleData[];
    dataRange: { start: Date; end: Date };
    skipReason?: string;
    dataQuality: any;
  }> {
    console.log(`[${requestId}] Strategy 1: Extended range fetch`);
    
    try {
      const result = await this.getHistoricalDataBatched(symbol, timeframe, startDate, endDate);
      const gaps = this.detectDataGaps(result.data, timeframe);
      const qualityScore = this.calculateDataQualityScore(result.data, minRequiredCandles, gaps.length);
      
      return {
        success: result.data.length >= minRequiredCandles,
        data: result.data,
        dataRange: result.dataRange,
        skipReason: result.data.length < minRequiredCandles ? 
          `Extended range insufficient: ${result.data.length}/${minRequiredCandles} candles` : undefined,
        dataQuality: {
          totalCandles: result.data.length,
          validCandles: result.data.length,
          qualityScore,
          gaps: gaps.length
        }
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        dataRange: { start: startDate, end: endDate },
        skipReason: `Extended range fetch failed: ${error.message}`,
        dataQuality: { totalCandles: 0, validCandles: 0, qualityScore: 0, gaps: 0 }
      };
    }
  }

  /**
   * Strategy 2: Fetch with multiple smaller batches
   */
  private async fetchWithMultipleBatches(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    minRequiredCandles: number,
    requestId: string
  ): Promise<{
    success: boolean;
    data: CandleData[];
    dataRange: { start: Date; end: Date };
    skipReason?: string;
    dataQuality: any;
  }> {
    console.log(`[${requestId}] Strategy 2: Multiple batches fetch`);
    
    try {
      const timeframeMs = this.getTimeframeInMs(timeframe);
      const batchSize = 1500; // Binance limit
      const batchTimespan = batchSize * timeframeMs;
      
      const allCandles: CandleData[] = [];
      let currentStart = startDate.getTime();
      const endTime = endDate.getTime();
      let actualStartTime: number | null = null;
      let actualEndTime: number | null = null;
      
      let batchCount = 0;
      const maxBatches = 10; // Prevent infinite loops
      
      while (currentStart < endTime && batchCount < maxBatches && allCandles.length < minRequiredCandles * 1.2) {
        const currentEnd = Math.min(currentStart + batchTimespan, endTime);
        
        try {
          console.log(`[${requestId}] Batch ${batchCount + 1}: ${new Date(currentStart).toISOString()} to ${new Date(currentEnd).toISOString()}`);
          
          const batchData = await this.getHistoricalData(
            symbol,
            timeframe,
            currentStart,
            currentEnd,
            batchSize
          );
          
          if (batchData.length > 0) {
            // Remove duplicates and merge
            const existingTimes = new Set(allCandles.map(c => c.timestamp));
            const newCandles = batchData.filter(c => !existingTimes.has(c.timestamp));
            allCandles.push(...newCandles);
            
            if (actualStartTime === null) actualStartTime = batchData[0].timestamp;
            actualEndTime = batchData[batchData.length - 1].timestamp;
            
            console.log(`[${requestId}] Batch ${batchCount + 1}: +${newCandles.length} new candles (total: ${allCandles.length})`);
          }
          
          currentStart = currentEnd + timeframeMs;
          batchCount++;
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (batchError: any) {
          console.warn(`[${requestId}] Batch ${batchCount + 1} failed: ${batchError.message}`);
          currentStart = currentEnd + timeframeMs;
          batchCount++;
        }
      }
      
      // Sort by timestamp
      allCandles.sort((a, b) => a.timestamp - b.timestamp);
      
      const gaps = this.detectDataGaps(allCandles, timeframe);
      const qualityScore = this.calculateDataQualityScore(allCandles, minRequiredCandles, gaps.length);
      
      const dataRange = {
        start: actualStartTime ? new Date(actualStartTime) : startDate,
        end: actualEndTime ? new Date(actualEndTime) : endDate
      };
      
      console.log(`[${requestId}] Multiple batches result: ${allCandles.length} candles from ${batchCount} batches`);
      
      return {
        success: allCandles.length >= minRequiredCandles,
        data: allCandles,
        dataRange,
        skipReason: allCandles.length < minRequiredCandles ? 
          `Multiple batches insufficient: ${allCandles.length}/${minRequiredCandles} candles` : undefined,
        dataQuality: {
          totalCandles: allCandles.length,
          validCandles: allCandles.length,
          qualityScore,
          gaps: gaps.length
        }
      };
      
    } catch (error: any) {
      return {
        success: false,
        data: [],
        dataRange: { start: startDate, end: endDate },
        skipReason: `Multiple batches fetch failed: ${error.message}`,
        dataQuality: { totalCandles: 0, validCandles: 0, qualityScore: 0, gaps: 0 }
      };
    }
  }

  /**
   * Strategy 3: Fallback with maximum available range
   */
  private async fetchWithFallbackRange(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    minRequiredCandles: number,
    requestId: string
  ): Promise<{
    success: boolean;
    data: CandleData[];
    dataRange: { start: Date; end: Date };
    skipReason?: string;
    dataQuality: any;
  }> {
    console.log(`[${requestId}] Strategy 3: Fallback with maximum range`);
    
    try {
      // Go back as far as possible (2 years)
      const maxHistoryDate = new Date(Date.now() - (2 * 365 * 24 * 60 * 60 * 1000));
      const fallbackStart = maxHistoryDate < startDate ? maxHistoryDate : startDate;
      
      console.log(`[${requestId}] Fallback range: ${fallbackStart.toISOString()} to ${endDate.toISOString()}`);
      
      const result = await this.getHistoricalDataBatched(symbol, timeframe, fallbackStart, endDate);
      const gaps = this.detectDataGaps(result.data, timeframe);
      const qualityScore = this.calculateDataQualityScore(result.data, minRequiredCandles, gaps.length);
      
      // Accept partial data if we get at least 50% of required candles
      const minAcceptable = Math.floor(minRequiredCandles * 0.5);
      const isAcceptable = result.data.length >= minAcceptable;
      
      console.log(`[${requestId}] Fallback result: ${result.data.length} candles (min acceptable: ${minAcceptable})`);
      
      return {
        success: isAcceptable,
        data: result.data,
        dataRange: result.dataRange,
        skipReason: !isAcceptable ? 
          `Even fallback insufficient: ${result.data.length}/${minAcceptable} minimum candles` : undefined,
        dataQuality: {
          totalCandles: result.data.length,
          validCandles: result.data.length,
          qualityScore,
          gaps: gaps.length
        }
      };
      
    } catch (error: any) {
      return {
        success: false,
        data: [],
        dataRange: { start: startDate, end: endDate },
        skipReason: `Fallback fetch failed: ${error.message}`,
        dataQuality: { totalCandles: 0, validCandles: 0, qualityScore: 0, gaps: 0 }
      };
    }
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQualityScore(
    candles: CandleData[],
    requiredCandles: number,
    gaps: number
  ): number {
    if (candles.length === 0) return 0;
    
    // Base score from data completeness
    const completenessScore = Math.min(100, (candles.length / requiredCandles) * 100);
    
    // Penalty for gaps
    const gapPenalty = Math.min(30, gaps * 2);
    
    // Final score
    return Math.max(0, completenessScore - gapPenalty);
  }

  /**
   * 3-Phase Data Fetching - Main entry point for optimized data fetching
   */
  async fetch3PhaseData(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    volumeLookbackCandles: number,
    lookforwardCandles: number
  ): Promise<{
    success: boolean;
    data?: CandleData[];
    dataRange?: { start: Date; end: Date };
    skipReason?: string;
    phases: {
      phase1: { success: boolean; reason?: string };
      phase2: { success: boolean; reason?: string };
      phase3: { success: boolean; reason?: string };
    };
  }> {
    const requestId = Math.random().toString(36).substr(2, 9);
    console.log(`🔄 [${requestId}] 3-PHASE FETCH: ${symbol} ${timeframe}`);

    try {
      // Phase 1: Fetch main OHLC data for the requested period
      const phase1Result = await this.fetchPhase1Data(symbol, timeframe, startDate, endDate, requestId);
      if (!phase1Result.success) {
        return {
          success: false,
          skipReason: phase1Result.reason,
          phases: {
            phase1: { success: false, reason: phase1Result.reason },
            phase2: { success: false, reason: 'Skipped due to Phase 1 failure' },
            phase3: { success: false, reason: 'Skipped due to Phase 1 failure' }
          }
        };
      }

      // Phase 2: Validate volume analysis requirements
      const phase2Result = this.validatePhase2Requirements(phase1Result.data!, volumeLookbackCandles, requestId);
      if (!phase2Result.success) {
        return {
          success: false,
          skipReason: phase2Result.reason,
          phases: {
            phase1: { success: true },
            phase2: { success: false, reason: phase2Result.reason },
            phase3: { success: false, reason: 'Skipped due to Phase 2 failure' }
          }
        };
      }

      // Phase 3: Validate forward analysis requirements
      const phase3Result = this.validatePhase3Requirements(phase1Result.data!, volumeLookbackCandles, lookforwardCandles, requestId);
      if (!phase3Result.success) {
        return {
          success: false,
          skipReason: phase3Result.reason,
          phases: {
            phase1: { success: true },
            phase2: { success: true },
            phase3: { success: false, reason: phase3Result.reason }
          }
        };
      }

      console.log(`✅ [${requestId}] ALL 3 PHASES SUCCESSFUL: ${phase1Result.data!.length} candles`);

      return {
        success: true,
        data: phase1Result.data,
        dataRange: phase1Result.dataRange,
        phases: {
          phase1: { success: true },
          phase2: { success: true },
          phase3: { success: true }
        }
      };

    } catch (error: any) {
      const errorResult = this.handleBinanceError(error, symbol);
      return {
        success: false,
        skipReason: errorResult.reason,
        phases: {
          phase1: { success: false, reason: errorResult.reason },
          phase2: { success: false, reason: 'Skipped due to error' },
          phase3: { success: false, reason: 'Skipped due to error' }
        }
      };
    }
  }

  /**
   * Phase 1: Fetch main OHLC data for pattern detection
   */
  private async fetchPhase1Data(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    requestId: string
  ): Promise<{
    success: boolean;
    data?: CandleData[];
    dataRange?: { start: Date; end: Date };
    reason?: string;
  }> {
    console.log(`📊 [${requestId}] Phase 1: Fetching main OHLC data`);

    try {
      const result = await this.fetchExactRange(symbol, timeframe, startDate.getTime(), endDate.getTime());
      
      // Validate minimum data requirements (at least 3 candles for pattern detection)
      if (result.data.length < 3) {
        return {
          success: false,
          reason: `Phase 1: Insufficient data for pattern detection: ${result.data.length} candles (minimum 3 required)`
        };
      }

      console.log(`✅ [${requestId}] Phase 1 SUCCESS: ${result.data.length} candles`);
      return {
        success: true,
        data: result.data,
        dataRange: result.dataRange
      };

    } catch (error: any) {
      console.error(`❌ [${requestId}] Phase 1 FAILED: ${error.message}`);
      return {
        success: false,
        reason: `Phase 1: ${error.message}`
      };
    }
  }

  /**
   * Phase 2: Validate volume analysis requirements (610 candles lookback)
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

    // Check if we have enough historical data for volume analysis
    const requiredForVolumeAnalysis = volumeLookbackCandles + 3; // +3 for pattern detection
    
    if (candles.length < requiredForVolumeAnalysis) {
      const reason = `Phase 2: Insufficient data for volume analysis: need ${requiredForVolumeAnalysis}, have ${candles.length}`;
      console.error(`❌ [${requestId}] ${reason}`);
      return { success: false, reason };
    }

    // Validate that we have enough valid volume data
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

  /**
   * Handle Binance API errors with specific error codes and appropriate actions
   */
  private handleBinanceError(error: any, symbol: string): {
    reason: string;
    shouldSkip: boolean;
    shouldRetry: boolean;
  } {
    const response = error.response;
    
    if (!response) {
      // Network error
      return {
        reason: `Network error for ${symbol}: ${error.message}`,
        shouldSkip: true,
        shouldRetry: false
      };
    }
    
    switch (response.status) {
      case 400:
        if (response.data?.code === -1121) {
          // Invalid symbol
          return {
            reason: `Invalid symbol: ${symbol}`,
            shouldSkip: true,
            shouldRetry: false
          };
        } else if (response.data?.code === -1100) {
          // Illegal characters in parameter
          return {
            reason: `Invalid parameters for ${symbol}`,
            shouldSkip: true,
            shouldRetry: false
          };
        }
        return {
          reason: `Bad request for ${symbol}: ${response.data?.msg || 'Unknown error'}`,
          shouldSkip: true,
          shouldRetry: false
        };
        
      case 404:
        return {
          reason: `No data available for ${symbol}`,
          shouldSkip: true,
          shouldRetry: false
        };
        
      case 429:
        // Rate limit exceeded
        return {
          reason: `Rate limited for ${symbol}`,
          shouldSkip: false,
          shouldRetry: true
        };
        
      case 500:
      case 502:
      case 503:
        // Server errors
        return {
          reason: `Server error for ${symbol} (${response.status})`,
          shouldSkip: false,
          shouldRetry: true
        };
        
      default:
        return {
          reason: `Unknown error for ${symbol}: ${response.status} - ${response.data?.msg || 'Unknown'}`,
          shouldSkip: true,
          shouldRetry: false
        };
    }
  }

  /**
   * Process multiple symbols with 3-phase validation and smart error handling
   */
  async processSymbolsWith3PhaseValidation(
    symbols: string[],
    timeframe: string,
    startDate: Date,
    endDate: Date,
    volumeLookbackCandles: number,
    lookforwardCandles: number
  ): Promise<{
    successful: Array<{ symbol: string; data: CandleData[]; dataRange: { start: Date; end: Date } }>;
    skipped: Array<{ symbol: string; reason: string }>;
    retryable: Array<{ symbol: string; reason: string }>;
    summary: {
      total: number;
      successful: number;
      skipped: number;
      retryable: number;
      successRate: number;
    };
  }> {
    const results = {
      successful: [] as Array<{ symbol: string; data: CandleData[]; dataRange: { start: Date; end: Date } }>,
      skipped: [] as Array<{ symbol: string; reason: string }>,
      retryable: [] as Array<{ symbol: string; reason: string }>
    };

    console.log(`🚀 Processing ${symbols.length} symbols with 3-phase validation`);

    for (const symbol of symbols) {
      try {
        const result = await this.fetch3PhaseData(
          symbol,
          timeframe,
          startDate,
          endDate,
          volumeLookbackCandles,
          lookforwardCandles
        );

        if (result.success) {
          results.successful.push({
            symbol,
            data: result.data!,
            dataRange: result.dataRange!
          });
          console.log(`✅ ${symbol}: SUCCESS - ${result.data!.length} candles`);
        } else {
          results.skipped.push({
            symbol,
            reason: result.skipReason!
          });
          console.log(`⏭️  ${symbol}: SKIPPED - ${result.skipReason}`);
        }

      } catch (error: any) {
        const errorResult = this.handleBinanceError(error, symbol);
        
        if (errorResult.shouldRetry) {
          results.retryable.push({
            symbol,
            reason: errorResult.reason
          });
          console.log(`🔄 ${symbol}: RETRYABLE - ${errorResult.reason}`);
        } else {
          results.skipped.push({
            symbol,
            reason: errorResult.reason
          });
          console.log(`⏭️  ${symbol}: SKIPPED - ${errorResult.reason}`);
        }
      }
    }

    const summary = {
      total: symbols.length,
      successful: results.successful.length,
      skipped: results.skipped.length,
      retryable: results.retryable.length,
      successRate: symbols.length > 0 ? (results.successful.length / symbols.length) * 100 : 0
    };

    console.log(`📊 Processing Summary: ${summary.successful}/${summary.total} successful (${summary.successRate.toFixed(1)}%)`);

    return { ...results, summary };
  }
}
