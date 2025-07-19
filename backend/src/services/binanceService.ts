import axios from 'axios';
import { CandleData, BinanceKlineData } from '../types';

export class BinanceService {
  private baseUrl = 'https://fapi.binance.com';
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly RATE_LIMIT = 1200; // requests per minute
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

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
   * Get historical candlestick data for a symbol
   */
  async getHistoricalData(
    symbol: string,
    timeframe: string,
    startTime?: number,
    endTime?: number,
    limit: number = 1500
  ): Promise<CandleData[]> {
    try {
      await this.rateLimit();

      const params: any = {
        symbol,
        interval: timeframe,
        limit: Math.min(limit, 1500) // Binance max limit is 1500
      };

      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await axios.get(`${this.baseUrl}/fapi/v1/klines`, { params });
      
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format from Binance API');
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

      return this.convertKlineData(klineData);
    } catch (error: any) {
      console.error(`Error fetching historical data for ${symbol}:`, error.message);
      
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      if (error.response?.status === 400) {
        throw new Error(`Invalid parameters for symbol ${symbol}`);
      }

      throw new Error(`Failed to fetch historical data for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Get historical data in batches to handle large date ranges
   */
  async getHistoricalDataBatched(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ data: CandleData[], dataRange: { start: Date, end: Date } }> {
    const allCandles: CandleData[] = [];
    const batchSize = 1500;
    
    // Calculate timeframe in milliseconds
    const timeframeMs = this.getTimeframeInMs(timeframe);
    const maxBatchTimespan = batchSize * timeframeMs;
    
    let currentStart = startDate.getTime();
    const endTime = endDate.getTime();
    
    let actualStartTime: number | null = null;
    let actualEndTime: number | null = null;

    console.log(`Fetching data for ${symbol} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    while (currentStart < endTime) {
      const currentEnd = Math.min(currentStart + maxBatchTimespan, endTime);
      
      try {
        const batchData = await this.getHistoricalData(
          symbol,
          timeframe,
          currentStart,
          currentEnd,
          batchSize
        );

        if (batchData.length > 0) {
          allCandles.push(...batchData);
          
          if (actualStartTime === null) {
            actualStartTime = batchData[0].timestamp;
          }
          actualEndTime = batchData[batchData.length - 1].timestamp;
        }

        // Move to next batch
        currentStart = currentEnd + timeframeMs;
        
        // Small delay between requests to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error fetching batch starting at ${new Date(currentStart).toISOString()}:`, error);
        break;
      }
    }

    // Remove duplicates and sort by timestamp
    const uniqueCandles = allCandles
      .filter((candle, index, arr) => 
        index === 0 || candle.timestamp !== arr[index - 1].timestamp
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    const dataRange = {
      start: actualStartTime ? new Date(actualStartTime) : startDate,
      end: actualEndTime ? new Date(actualEndTime) : endDate
    };

    console.log(`Fetched ${uniqueCandles.length} candles for ${symbol}, actual range: ${dataRange.start.toISOString()} to ${dataRange.end.toISOString()}`);

    return {
      data: uniqueCandles,
      dataRange
    };
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
   * Test connection to Binance API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.rateLimit();
      const response = await axios.get(`${this.baseUrl}/fapi/v1/ping`);
      return response.status === 200;
    } catch (error) {
      console.error('Binance API connection test failed:', error);
      return false;
    }
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
}
