import { Router } from 'express';
import { BinanceService } from '../services/binanceService';

const router = Router();
const binanceService = new BinanceService();

/**
 * Test Binance API connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    const isConnected = await binanceService.testConnection();
    res.json({ 
      connected: isConnected,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to test connection',
      details: error.message 
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
      count: symbols.length,
      timestamp: new Date().toISOString()
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
