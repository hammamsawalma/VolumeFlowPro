import { Router } from 'express';
import { BinanceService } from '../services/binanceService';

const router = Router();
const binanceService = new BinanceService();

/**
 * Get chart data for specific symbol and timeframe
 */
router.get('/chart-data/:symbol/:timeframe', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    const { symbol, timeframe } = req.params;
    const { startTime, endTime } = req.query;

    console.log(`[${requestId}] Chart data request received:`, {
      symbol,
      timeframe,
      startTime,
      endTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Validate required parameters
    if (!symbol || !timeframe) {
      console.warn(`[${requestId}] Missing required parameters:`, { symbol, timeframe });
      return res.status(400).json({
        success: false,
        message: 'Symbol and timeframe are required',
        details: {
          symbol: !symbol ? 'Symbol is required' : 'OK',
          timeframe: !timeframe ? 'Timeframe is required' : 'OK'
        }
      });
    }

    if (!startTime || !endTime) {
      console.warn(`[${requestId}] Missing time parameters:`, { startTime, endTime });
      return res.status(400).json({
        success: false,
        message: 'Start time and end time are required',
        details: {
          startTime: !startTime ? 'Start time is required' : 'OK',
          endTime: !endTime ? 'End time is required' : 'OK'
        }
      });
    }

    // Validate symbol format
    if (typeof symbol !== 'string' || symbol.length < 3 || symbol.length > 20) {
      console.warn(`[${requestId}] Invalid symbol format:`, symbol);
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol format',
        details: `Symbol must be a string between 3-20 characters, got: ${symbol}`
      });
    }

    // Validate timeframe
    const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      console.warn(`[${requestId}] Invalid timeframe:`, timeframe);
      return res.status(400).json({
        success: false,
        message: 'Invalid timeframe',
        details: `Timeframe must be one of: ${validTimeframes.join(', ')}, got: ${timeframe}`
      });
    }

    const binanceService = new BinanceService();
    
    // Convert and validate query params
    const start = parseInt(startTime as string);
    let end = parseInt(endTime as string);
    
    if (isNaN(start) || isNaN(end)) {
      console.warn(`[${requestId}] Invalid timestamp format:`, { startTime, endTime, start, end });
      return res.status(400).json({
        success: false,
        message: 'Invalid timestamp format',
        details: {
          startTime: isNaN(start) ? `Cannot parse "${startTime}" as number` : 'OK',
          endTime: isNaN(end) ? `Cannot parse "${endTime}" as number` : 'OK'
        }
      });
    }

    // Validate timestamp logic
    if (start >= end) {
      console.warn(`[${requestId}] Invalid time range:`, { start, end });
      return res.status(400).json({
        success: false,
        message: 'Invalid time range: start time must be before end time',
        details: {
          startTime: new Date(start).toISOString(),
          endTime: new Date(end).toISOString(),
          difference: `${(end - start) / 1000} seconds`
        }
      });
    }

    // Validate timestamp values (not too old, not in future)
    const now = Date.now();
    const maxHistoryMs = 365 * 24 * 60 * 60 * 1000; // 1 year
    const futureThresholdMs = 24 * 60 * 60 * 1000; // 1 day

    if (start < now - maxHistoryMs) {
      console.warn(`[${requestId}] Start time too far in past:`, new Date(start).toISOString());
      return res.status(400).json({
        success: false,
        message: 'Start time is too far in the past (max 1 year)',
        details: {
          startTime: new Date(start).toISOString(),
          maxHistoryDate: new Date(now - maxHistoryMs).toISOString()
        }
      });
    }

    // More lenient validation for chart requests - allow up to 12 hours in the future
    const chartFutureThresholdMs = 12 * 60 * 60 * 1000; // 12 hours
    if (end > now + chartFutureThresholdMs) {
      console.warn(`[${requestId}] End time too far in future:`, new Date(end).toISOString());
      
      // Auto-adjust the end time instead of rejecting the request
      const adjustedEndTime = now + chartFutureThresholdMs;
      console.log(`[${requestId}] Auto-adjusting end time from ${new Date(end).toISOString()} to ${new Date(adjustedEndTime).toISOString()}`);
      end = adjustedEndTime;
    }

    // Validate time range size
    const rangeMs = end - start;
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 90 days max
    if (rangeMs > maxRangeMs) {
      console.warn(`[${requestId}] Time range too large:`, { rangeMs, maxRangeMs });
      return res.status(400).json({
        success: false,
        message: 'Time range too large (max 90 days)',
        details: {
          requestedDays: Math.ceil(rangeMs / (24 * 60 * 60 * 1000)),
          maxDays: 90
        }
      });
    }

    console.log(`[${requestId}] Fetching chart data for ${symbol} ${timeframe} from ${new Date(start).toISOString()} to ${new Date(end).toISOString()}`);

    // Test Binance connection first
    const isConnected = await binanceService.testConnection();
    if (!isConnected) {
      console.error(`[${requestId}] Binance API connection failed`);
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to Binance API',
        details: 'The trading data service is temporarily unavailable'
      });
    }

    // Fetch historical data with enhanced error handling
    let result;
    try {
      result = await binanceService.getHistoricalDataBatched(
        symbol,
        timeframe,
        new Date(start),
        new Date(end)
      );
      
      console.log(`[${requestId}] Data fetch completed:`, {
        dataLength: result.data.length,
        actualRange: {
          start: result.dataRange.start.toISOString(),
          end: result.dataRange.end.toISOString()
        }
      });
    } catch (fetchError: any) {
      console.error(`[${requestId}] Data fetch failed:`, {
        error: fetchError.message,
        stack: fetchError.stack,
        symbol,
        timeframe
      });
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to fetch historical data';
      let statusCode = 500;
      
      if (fetchError.message.includes('symbol') || fetchError.message.includes('Invalid symbol')) {
        errorMessage = `Invalid trading symbol: ${symbol}`;
        statusCode = 400;
      } else if (fetchError.message.includes('rate limit') || fetchError.message.includes('429')) {
        errorMessage = 'Rate limit exceeded - please try again in a few moments';
        statusCode = 429;
      } else if (fetchError.message.includes('network') || fetchError.message.includes('timeout')) {
        errorMessage = 'Network error connecting to data provider';
        statusCode = 503;
      }
      
      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        details: fetchError.message,
        requestId
      });
    }

    // Validate fetched data
    if (!result || !result.data || !Array.isArray(result.data)) {
      console.error(`[${requestId}] Invalid data structure returned:`, typeof result);
      return res.status(500).json({
        success: false,
        message: 'Invalid data structure returned from data provider',
        requestId
      });
    }

    if (result.data.length === 0) {
      console.warn(`[${requestId}] No data available for requested range`);
      return res.status(404).json({
        success: false,
        message: `No trading data available for ${symbol} ${timeframe} in the specified time range`,
        details: {
          symbol,
          timeframe,
          requestedRange: {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString()
          }
        },
        requestId
      });
    }

    // Format and validate data for TradingView Lightweight Charts
    const chartData = result.data
      .filter(candle => {
        // Additional validation for each candle
        if (!candle || typeof candle !== 'object') return false;
        if (typeof candle.timestamp !== 'number' || candle.timestamp <= 0) return false;
        if (typeof candle.open !== 'number' || candle.open <= 0) return false;
        if (typeof candle.high !== 'number' || candle.high <= 0) return false;
        if (typeof candle.low !== 'number' || candle.low <= 0) return false;
        if (typeof candle.close !== 'number' || candle.close <= 0) return false;
        if (typeof candle.volume !== 'number' || candle.volume < 0) return false;
        if (candle.high < candle.low) return false;
        if (candle.high < Math.max(candle.open, candle.close)) return false;
        if (candle.low > Math.min(candle.open, candle.close)) return false;
        return true;
      })
      .map(candle => {
        // TradingView Lightweight Charts time format requirements:
        // - Intraday charts (1m-12h): Unix timestamps in seconds
        // - Daily+ charts (1d, 1w): Date strings (YYYY-MM-DD)
        const isIntraday = !['1d', '1w', '1M'].includes(timeframe);
        
        let timeValue;
        if (isIntraday) {
          // For intraday charts: use Unix seconds (TradingView requirement)
          timeValue = Math.floor(candle.timestamp / 1000);
        } else {
          // For daily+ charts: use local date string
          const date = new Date(candle.timestamp);
          timeValue = date.getFullYear() + '-' + 
            String(date.getMonth() + 1).padStart(2, '0') + '-' + 
            String(date.getDate()).padStart(2, '0');
        }
        
        return {
          time: timeValue, // Format based on timeframe requirements
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          timestamp: candle.timestamp // Keep original timestamp for reference
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by original timestamp

    console.log(`[${requestId}] Data processing completed:`, {
      originalCount: result.data.length,
      validCount: chartData.length,
      filteredOut: result.data.length - chartData.length
    });

    if (chartData.length === 0) {
      console.warn(`[${requestId}] All data filtered out during validation`);
      return res.status(422).json({
        success: false,
        message: 'All trading data failed validation checks',
        details: 'The data may be corrupted or in an unexpected format',
        requestId
      });
    }

    // Final response
    const response = {
      success: true,
      data: chartData,
      dataRange: {
        start: result.dataRange.start,
        end: result.dataRange.end
      },
      symbol,
      timeframe,
      totalCandles: chartData.length,
      requestId,
      metadata: {
        requestTime: new Date().toISOString(),
        processingTime: Date.now() - parseInt(requestId, 36),
        dataQuality: {
          originalCount: result.data.length,
          validCount: chartData.length,
          qualityScore: Math.round((chartData.length / result.data.length) * 100)
        }
      }
    };

    console.log(`[${requestId}] Request completed successfully:`, {
      totalCandles: chartData.length,
      qualityScore: response.metadata.dataQuality.qualityScore
    });

    return res.json(response);

  } catch (error: any) {
    console.error(`[${requestId}] Unexpected error in chart data endpoint:`, {
      error: error.message,
      stack: error.stack,
      params: req.params,
      query: req.query
    });
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching chart data',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later',
      requestId
    });
  }
});

/**
 * Test Binance connection with basic ping
 */
router.get('/test', async (req, res) => {
  try {
    const binanceService = new BinanceService();
    const isConnected = await binanceService.testConnection();
    
    if (isConnected) {
      const serverTime = await binanceService.getServerTime();
      res.json({ 
        success: true, 
        message: 'Successfully connected to Binance API',
        serverTime,
        serverTimeISO: new Date(serverTime).toISOString(),
        localTime: Date.now(),
        localTimeISO: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        success: false, 
        message: 'Failed to connect to Binance API - service may be temporarily unavailable' 
      });
    }
  } catch (error: any) {
    console.error('Binance connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Connection test failed', 
      error: error.message 
    });
  }
});

/**
 * Test connection endpoint that matches frontend API call
 */
router.get('/test-connection', async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    console.log(`[${requestId}] Frontend connection test initiated`);
    
    const binanceService = new BinanceService();
    
    // Test Binance API connection
    const isConnected = await binanceService.testConnection();
    
    if (isConnected) {
      const serverTime = await binanceService.getServerTime();
      
      console.log(`[${requestId}] ✅ Binance API connection successful`);
      
      res.json({ 
        connected: true,
        timestamp: new Date().toISOString(),
        binanceServerTime: serverTime,
        binanceServerTimeISO: new Date(serverTime).toISOString(),
        localTime: Date.now(),
        localTimeISO: new Date().toISOString(),
        requestId,
        message: 'Successfully connected to Binance API'
      });
    } else {
      console.log(`[${requestId}] ❌ Binance API connection failed`);
      
      res.status(503).json({ 
        connected: false,
        timestamp: new Date().toISOString(),
        requestId,
        message: 'Failed to connect to Binance API - service may be temporarily unavailable',
        troubleshooting: [
          'Check internet connection',
          'Verify Binance API is not under maintenance',
          'Try again in a few moments'
        ]
      });
    }
  } catch (error: any) {
    console.error(`[${requestId}] Binance connection test failed:`, error);
    
    res.status(500).json({ 
      connected: false,
      timestamp: new Date().toISOString(),
      requestId,
      message: 'Connection test failed', 
      error: error.message,
      troubleshooting: [
        'Check backend server logs',
        'Verify network connectivity',
        'Contact system administrator if issue persists'
      ]
    });
  }
});

/**
 * Extensive connection test with detailed diagnostics
 */
router.get('/test-extensive', async (req, res) => {
  try {
    const binanceService = new BinanceService();
    const testResult = await binanceService.testConnectionExtensive();
    
    if (testResult.success) {
      res.json({
        success: true,
        message: 'Binance API connection is healthy',
        ...testResult.details
      });
    } else {
      res.status(503).json({
        success: false,
        message: 'Binance API connection issues detected',
        ...testResult.details
      });
    }
  } catch (error: any) {
    console.error('Extensive connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    });
  }
});

/**
 * Get all USDT perpetual symbols
 */
router.get('/symbols', async (req, res) => {
  try {
    const symbols = await binanceService.getUSDTPerpetualSymbols();
    res.json({ 
      symbols,
      count: symbols.length
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch symbols',
      details: error.message 
    });
  }
});

/**
 * Get supported timeframes
 */
router.get('/timeframes', (req, res) => {
  try {
    const timeframes = binanceService.getSupportedTimeframes();
    res.json({ 
      timeframes,
      count: timeframes.length
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get timeframes',
      details: error.message 
    });
  }
});

/**
 * Get historical data limits
 */
router.get('/limits', (req, res) => {
  try {
    const limits = binanceService.getHistoricalDataLimits();
    res.json(limits);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get limits',
      details: error.message 
    });
  }
});

/**
 * Get server time
 */
router.get('/server-time', async (req, res) => {
  try {
    const serverTime = await binanceService.getServerTime();
    res.json({ 
      serverTime,
      serverTimeISO: new Date(serverTime).toISOString(),
      localTime: Date.now(),
      localTimeISO: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get server time',
      details: error.message 
    });
  }
});

/**
 * Get historical data for a specific symbol and timeframe
 */
router.get('/historical-data/:symbol/:timeframe', async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const { startDate, endDate, limit } = req.query;

    // Validate parameters
    const supportedTimeframes = binanceService.getSupportedTimeframes();
    if (!supportedTimeframes.includes(timeframe)) {
      return res.status(400).json({
        error: 'Invalid timeframe',
        supportedTimeframes
      });
    }

    let historicalData;

    if (startDate && endDate) {
      // Get data for date range
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
        });
      }

      const result = await binanceService.getHistoricalDataBatched(symbol, timeframe, start, end);
      historicalData = result.data;
      
      return res.json({
        symbol,
        timeframe,
        requestedRange: { startDate, endDate },
        actualRange: result.dataRange,
        data: historicalData,
        count: historicalData.length
      });
    } else {
      // Get recent data with limit
      const limitNum = limit ? parseInt(limit as string) : 100;
      historicalData = await binanceService.getHistoricalData(symbol, timeframe, undefined, undefined, limitNum);
      
      return res.json({
        symbol,
        timeframe,
        limit: limitNum,
        data: historicalData,
        count: historicalData.length
      });
    }

  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Failed to fetch historical data',
      details: error.message 
    });
  }
});

/**
 * Preview data availability for multiple symbols
 */
router.post('/preview-data', async (req, res) => {
  try {
    const { symbols, timeframes, startDate, endDate } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'Symbols array is required'
      });
    }

    if (!timeframes || !Array.isArray(timeframes) || timeframes.length === 0) {
      return res.status(400).json({
        error: 'Timeframes array is required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format'
      });
    }

    const preview: Array<{
      symbol: string;
      timeframe: string;
      available: boolean;
      dataCount: number;
      actualRange: { start: Date; end: Date } | null;
      error: string | null;
    }> = [];

    // Sample a few symbols to check data availability
    const sampleSymbols = symbols.slice(0, Math.min(5, symbols.length));
    const sampleTimeframes = timeframes.slice(0, Math.min(3, timeframes.length));

    for (const symbol of sampleSymbols) {
      for (const timeframe of sampleTimeframes) {
        try {
          const result = await binanceService.getHistoricalDataBatched(symbol, timeframe, start, end);
          preview.push({
            symbol,
            timeframe,
            available: true,
            dataCount: result.data.length,
            actualRange: result.dataRange,
            error: null
          });
        } catch (error: any) {
          preview.push({
            symbol,
            timeframe,
            available: false,
            dataCount: 0,
            actualRange: null,
            error: error.message
          });
        }
      }
    }

    return res.json({
      preview,
      totalCombinations: symbols.length * timeframes.length,
      sampledCombinations: preview.length,
      requestedRange: { startDate, endDate }
    });

  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Failed to preview data',
      details: error.message 
    });
  }
});

export { router as binanceRoutes };
