import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import { chartService, ChartData } from '../../services/chartService';
import './ChartModal.css';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: string;
  signalTimestamp: number;
  signalType: string;
  signalPrice: number;
  candleData?: {
    current: any;
    previous1: any;
    previous2: any;
  };
}

const ChartModal: React.FC<ChartModalProps> = ({
  isOpen,
  onClose,
  symbol,
  timeframe,
  signalTimestamp,
  signalType,
  signalPrice,
  candleData
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  // Handle ESC key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle outside click
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // Fetch chart data when modal opens
  useEffect(() => {
    if (!isOpen || !symbol || !timeframe || !signalTimestamp) {
      console.log('ChartModal: Skipping data fetch - missing required parameters:', {
        isOpen,
        symbol,
        timeframe,
        signalTimestamp
      });
      return;
    }

    const fetchChartData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('ChartModal: Starting chart data fetch with parameters:', {
          symbol,
          timeframe,
          signalTimestamp,
          signalDate: new Date(signalTimestamp).toISOString()
        });

        // Validate input parameters
        if (!symbol || typeof symbol !== 'string') {
          throw new Error(`Invalid symbol: ${symbol}`);
        }
        if (!timeframe || typeof timeframe !== 'string') {
          throw new Error(`Invalid timeframe: ${timeframe}`);
        }
        if (!signalTimestamp || isNaN(signalTimestamp) || signalTimestamp <= 0) {
          throw new Error(`Invalid signal timestamp: ${signalTimestamp}`);
        }

        // Calculate time range around signal
        const { startTime, endTime } = chartService.calculateChartTimeRange(
          signalTimestamp,
          timeframe,
          2 // 2 weeks around signal
        );

        console.log('ChartModal: Calculated time range:', {
          startTime,
          endTime,
          startDate: new Date(startTime).toISOString(),
          endDate: new Date(endTime).toISOString(),
          rangeHours: (endTime - startTime) / (1000 * 60 * 60)
        });

        // Validate time range
        if (startTime >= endTime) {
          throw new Error(`Invalid time range: start (${startTime}) >= end (${endTime})`);
        }
        if (endTime > Date.now() + 24 * 60 * 60 * 1000) {
          console.warn('ChartModal: End time is in the future, adjusting to current time');
        }

        // Fetch data from backend
        console.log('ChartModal: Calling chartService.fetchChartData...');
        const response = await chartService.fetchChartData(
          symbol,
          timeframe,
          startTime,
          endTime
        );

        console.log('ChartModal: Received response from chartService:', {
          success: response.success,
          dataLength: response.data?.length || 0,
          symbol: response.symbol,
          timeframe: response.timeframe,
          totalCandles: response.totalCandles,
          dataRange: response.dataRange
        });

        // Validate response
        if (!response.success) {
          throw new Error(`API returned error: ${response.message || 'Unknown error'}`);
        }
        if (!response.data || !Array.isArray(response.data)) {
          throw new Error(`Invalid response data format: expected array, got ${typeof response.data}`);
        }
        if (response.data.length === 0) {
          throw new Error(`No chart data available for ${symbol} ${timeframe} in the specified time range`);
        }

        // Format and validate data
        console.log('ChartModal: Formatting chart data...');
        const formattedData = chartService.formatChartData(response.data);
        
        console.log('ChartModal: Data formatting complete:', {
          originalLength: response.data.length,
          formattedLength: formattedData.length,
          firstCandle: formattedData[0],
          lastCandle: formattedData[formattedData.length - 1]
        });

        if (formattedData.length === 0) {
          throw new Error('All chart data was filtered out during validation - data may be corrupted');
        }

        setChartData(formattedData);
        console.log(`ChartModal: Successfully loaded ${formattedData.length} candles for chart`);

      } catch (err: any) {
        console.error('ChartModal: Error fetching chart data:', {
          error: err,
          message: err.message,
          stack: err.stack,
          symbol,
          timeframe,
          signalTimestamp
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to load chart data';
        if (err.message) {
          if (err.message.includes('Network Error') || err.message.includes('fetch')) {
            errorMessage = 'Network error - please check your connection and try again';
          } else if (err.message.includes('timeout')) {
            errorMessage = 'Request timed out - please try again';
          } else if (err.message.includes('Invalid')) {
            errorMessage = `Data validation error: ${err.message}`;
          } else if (err.message.includes('No chart data available')) {
            errorMessage = `No data available for ${symbol} ${timeframe} around ${new Date(signalTimestamp).toLocaleDateString()}`;
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [isOpen, symbol, timeframe, signalTimestamp]);

  // Initialize and update chart
  useEffect(() => {
    if (!isOpen || !chartContainerRef.current || chartData.length === 0) {
      console.log('ChartModal: Skipping chart creation:', {
        isOpen,
        hasContainer: !!chartContainerRef.current,
        dataLength: chartData.length
      });
      return;
    }

    console.log('ChartModal: Starting chart creation with data:', {
      dataLength: chartData.length,
      containerDimensions: {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight
      },
      signalTimestamp,
      signalType,
      signalPrice
    });

    // Clean up existing chart
    if (chartRef.current) {
      console.log('ChartModal: Cleaning up existing chart');
      try {
        chartRef.current.remove();
      } catch (cleanupError) {
        console.warn('ChartModal: Error during chart cleanup:', cleanupError);
      }
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    }

    try {
      // Validate container dimensions
      const containerWidth = chartContainerRef.current.clientWidth;
      const containerHeight = chartContainerRef.current.clientHeight;
      
      if (containerWidth <= 0 || containerHeight <= 0) {
        throw new Error(`Invalid container dimensions: ${containerWidth}x${containerHeight}`);
      }

      console.log('ChartModal: Creating chart with dimensions:', { containerWidth, containerHeight });

      // Create chart
      const chart = createChart(chartContainerRef.current, {
        ...chartService.getChartConfig(false), // You can detect dark mode here
        width: containerWidth,
        height: containerHeight,
      });

      if (!chart) {
        throw new Error('Failed to create chart instance');
      }

      chartRef.current = chart;
      console.log('ChartModal: Chart instance created successfully');

      // Add candlestick series using the v5 API
      const candlestickSeries = chart.addSeries(CandlestickSeries, 
        chartService.getCandlestickConfig(false)
      );
      
      if (!candlestickSeries) {
        throw new Error('Failed to create candlestick series');
      }
      
      candlestickSeriesRef.current = candlestickSeries;
      console.log('ChartModal: Candlestick series created');


      // Prepare and validate data for chart
      console.log('ChartModal: Preparing chart data...');
      const candlestickData = chartData.map((candle, index) => {
        // Validate each candle
        if (!candle || typeof candle !== 'object') {
          throw new Error(`Invalid candle data at index ${index}: ${JSON.stringify(candle)}`);
        }
        
        const requiredFields = ['time', 'open', 'high', 'low', 'close'];
        for (const field of requiredFields) {
          if (candle[field as keyof ChartData] === undefined || candle[field as keyof ChartData] === null) {
            throw new Error(`Missing ${field} in candle at index ${index}`);
          }
        }

        return {
          time: candle.time as any,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
        };
      });

      console.log('ChartModal: Data prepared:', {
        candlestickCount: candlestickData.length,
        firstCandle: candlestickData[0],
        lastCandle: candlestickData[candlestickData.length - 1]
      });

      // Set data with error handling
      try {
        console.log('ChartModal: Setting candlestick data...');
        candlestickSeries.setData(candlestickData);
        console.log('ChartModal: Candlestick data set successfully');
      } catch (dataError: any) {
        console.error('ChartModal: Error setting candlestick data:', dataError);
        throw new Error(`Failed to set candlestick data: ${dataError.message || dataError}`);
      }


      // Add signal markers using v5 plugin system
      console.log('ChartModal: Creating signal markers...');
      const markers = chartService.createSignalMarkers(
        signalTimestamp,
        signalType,
        signalPrice,
        timeframe,
        candleData
      );

      if (markers.length > 0) {
        try {
          const chartMarkers = markers.map(marker => ({
            time: marker.time as any,
            position: marker.position,
            color: marker.color,
            shape: marker.shape,
            text: marker.text,
            size: marker.size
          }));
          
          console.log('ChartModal: Creating markers plugin:', chartMarkers);
          
          // Use the v5 plugin system for markers
          const markersPlugin = createSeriesMarkers(candlestickSeries);
          markersPlugin.setMarkers(chartMarkers);
          
          console.log('ChartModal: Markers set successfully');
        } catch (markerError) {
          console.error('ChartModal: Error setting markers:', markerError);
          // Don't throw here, markers are optional
        }
      }

      // Fit content and center on signal
      try {
        console.log('ChartModal: Fitting chart content...');
        chart.timeScale().fitContent();
        
        // Try to center on signal timestamp
        const signalTime = Math.floor(signalTimestamp / 1000);
        const signalIndex = candlestickData.findIndex(d => (d.time as number) >= signalTime);
        
        console.log('ChartModal: Signal positioning:', {
          signalTime,
          signalIndex,
          totalCandles: candlestickData.length
        });
        
        if (signalIndex >= 0) {
          const from = Math.max(0, signalIndex - 50);
          const to = Math.min(candlestickData.length - 1, signalIndex + 50);
          
          console.log('ChartModal: Setting visible range:', { from, to });
          chart.timeScale().setVisibleLogicalRange({ from, to });
        }
        
        console.log('ChartModal: Chart positioning complete');
      } catch (positionError) {
        console.error('ChartModal: Error positioning chart:', positionError);
        // Don't throw here, positioning is optional
      }

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chart) {
          try {
            const newWidth = chartContainerRef.current.clientWidth;
            const newHeight = chartContainerRef.current.clientHeight;
            
            if (newWidth > 0 && newHeight > 0) {
              chart.applyOptions({
                width: newWidth,
                height: newHeight,
              });
            }
          } catch (resizeError) {
            console.error('ChartModal: Error during resize:', resizeError);
          }
        }
      };

      window.addEventListener('resize', handleResize);
      console.log('ChartModal: Chart creation completed successfully');

      return () => {
        console.log('ChartModal: Cleaning up chart and event listeners');
        window.removeEventListener('resize', handleResize);
        if (chart) {
          try {
            chart.remove();
          } catch (cleanupError) {
            console.warn('ChartModal: Error during cleanup:', cleanupError);
          }
        }
      };

    } catch (err: any) {
      console.error('ChartModal: Error creating chart:', {
        error: err,
        message: err.message,
        stack: err.stack,
        chartData: chartData.slice(0, 3), // Log first 3 candles for debugging
        containerDimensions: chartContainerRef.current ? {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        } : null
      });
      
      // Provide specific error messages
      let errorMessage = 'Failed to create chart';
      if (err.message) {
        if (err.message.includes('dimensions')) {
          errorMessage = 'Chart container has invalid dimensions - please try resizing the window';
        } else if (err.message.includes('data')) {
          errorMessage = 'Invalid chart data format - the data may be corrupted';
        } else if (err.message.includes('series')) {
          errorMessage = 'Failed to create chart series - there may be a library compatibility issue';
        } else {
          errorMessage = `Chart creation failed: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    }
  }, [isOpen, chartData, signalTimestamp, signalType, signalPrice, candleData]);

  if (!isOpen) return null;

  return (
    <div className="chart-modal-overlay" onClick={handleOverlayClick}>
      <div className="chart-modal">
        <div className="chart-modal-header">
          <div className="chart-modal-title">
            <h3>{symbol} - {timeframe}</h3>
            <div className="signal-info">
              <span className={`signal-type ${signalType.toLowerCase().replace('_', '-')}`}>
                {signalType}
              </span>
              <span className="signal-price">${signalPrice.toFixed(4)}</span>
              <span className="signal-time">
                {new Date(signalTimestamp).toLocaleString()}
              </span>
            </div>
          </div>
          <button className="chart-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="chart-modal-content">
          {loading && (
            <div className="chart-loading">
              <div className="loading-spinner"></div>
              <p>Loading chart data...</p>
            </div>
          )}

          {error && (
            <div className="chart-error">
              <p>Error: {error}</p>
              <div className="chart-error-actions">
                <button 
                  onClick={() => {
                    setError(null);
                    setChartData([]);
                    // Trigger a re-fetch by updating a dependency
                    const fetchChartData = async () => {
                      setLoading(true);
                      setError(null);

                      try {
                        console.log('ChartModal: Retry - Starting chart data fetch with parameters:', {
                          symbol,
                          timeframe,
                          signalTimestamp,
                          signalDate: new Date(signalTimestamp).toISOString()
                        });

                        const { startTime, endTime } = chartService.calculateChartTimeRange(
                          signalTimestamp,
                          timeframe,
                          2
                        );

                        const response = await chartService.fetchChartData(
                          symbol,
                          timeframe,
                          startTime,
                          endTime
                        );

                        if (!response.success) {
                          throw new Error(`API returned error: ${response.message || 'Unknown error'}`);
                        }

                        const formattedData = chartService.formatChartData(response.data);
                        if (formattedData.length === 0) {
                          throw new Error('All chart data was filtered out during validation - data may be corrupted');
                        }

                        setChartData(formattedData);
                        console.log(`ChartModal: Retry successful - loaded ${formattedData.length} candles`);

                      } catch (err: any) {
                        console.error('ChartModal: Retry failed:', err);
                        let errorMessage = 'Failed to load chart data';
                        if (err.message) {
                          if (err.message.includes('Network Error') || err.message.includes('fetch')) {
                            errorMessage = 'Network error - please check your connection and try again';
                          } else if (err.message.includes('timeout')) {
                            errorMessage = 'Request timed out - please try again';
                          } else if (err.message.includes('Invalid')) {
                            errorMessage = `Data validation error: ${err.message}`;
                          } else if (err.message.includes('No chart data available')) {
                            errorMessage = `No data available for ${symbol} ${timeframe} around ${new Date(signalTimestamp).toLocaleDateString()}`;
                          } else {
                            errorMessage = err.message;
                          }
                        }
                        setError(errorMessage);
                      } finally {
                        setLoading(false);
                      }
                    };

                    fetchChartData();
                  }}
                  disabled={loading}
                >
                  {loading ? 'Retrying...' : 'Retry'}
                </button>
                <button onClick={onClose}>Close</button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div 
              ref={chartContainerRef} 
              className="chart-container"
            />
          )}
        </div>

        <div className="chart-modal-footer">
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color buy"></span>
              <span>Buy Signal</span>
            </div>
            <div className="legend-item">
              <span className="legend-color sell"></span>
              <span>Sell Signal</span>
            </div>
            <div className="legend-item">
              <span className="legend-color pattern"></span>
              <span>Pattern Candles</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartModal;
