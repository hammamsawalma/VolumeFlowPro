const axios = require('axios');

// Configuration for testing
const testConfig = {
  symbols: ['BTCUSDT', 'ETHUSDT'],
  timeframes: ['1h'],
  startDate: '2024-01-01',
  endDate: '2024-01-07', // Short date range for testing
  lookforwardCandles: 24,
  volumeMaLength: 20, // Reduced from default to avoid starting too late
  volumeStdLength: 20,
  volumeThresholds: {
    medium: 1.0,
    high: 2.5,
    extraHigh: 4.0
  },
  bodyRatioThreshold: 0.61,
  enabledSignals: {
    primaryBuy: true,
    basicBuy: true,
    primarySell: true,
    basicSell: true
  }
};

async function testBacktest() {
  try {
    console.log('Starting backtest test...');
    console.log('Configuration:', JSON.stringify(testConfig, null, 2));

    // Start backtest
    const startResponse = await axios.post('http://localhost:5000/api/backtest/start', testConfig);
    const backtestId = startResponse.data.backtestId;
    
    console.log(`Backtest started with ID: ${backtestId}`);

    // Poll for progress
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      try {
        const progressResponse = await axios.get(`http://localhost:5000/api/backtest/${backtestId}/progress`);
        const { status, progress, error } = progressResponse.data;
        
        console.log(`Status: ${status}, Progress: ${progress}%`);
        
        if (error) {
          console.error('Backtest error:', error);
          break;
        }
        
        if (status === 'COMPLETED') {
          completed = true;
          
          // Get results
          const resultResponse = await axios.get(`http://localhost:5000/api/backtest/${backtestId}`);
          const result = resultResponse.data;
          
          console.log('\n=== BACKTEST RESULTS ===');
          console.log(`Total Signals: ${result.summary.totalSignals}`);
          console.log(`Successful Signals: ${result.summary.successfulSignals}`);
          console.log(`Success Rate: ${result.summary.successRate.toFixed(2)}%`);
          console.log(`Average Risk/Reward: ${result.summary.avgRiskReward.toFixed(2)}`);
          console.log(`Average Drawup: ${result.summary.avgDrawup.toFixed(2)}%`);
          console.log(`Average Drawdown: ${result.summary.avgDrawdown.toFixed(2)}%`);
          
          if (result.signals.length > 0) {
            console.log('\nFirst 5 signals:');
            result.signals.slice(0, 5).forEach((signal, index) => {
              console.log(`${index + 1}. ${signal.type} - ${signal.symbol} ${signal.timeframe} at ${new Date(signal.timestamp).toISOString()} - Price: ${signal.price}`);
            });
          }
          
          if (result.summary.totalSignals === 0) {
            console.log('\n⚠️  WARNING: No signals detected! This indicates the issue may still exist.');
          } else {
            console.log('\n✅ SUCCESS: Signals detected! The fixes appear to be working.');
          }
          
        } else if (status === 'FAILED') {
          console.error('Backtest failed');
          break;
        }
        
      } catch (error) {
        console.error('Error checking progress:', error.message);
      }
      
      attempts++;
    }
    
    if (!completed) {
      console.log('Backtest did not complete within expected time');
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testBacktest();
