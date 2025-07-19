import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Chip,
  Autocomplete,
  Switch,
  Divider,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { backtestApi, binanceApi } from '../services/api';
import { BacktestConfig } from '../types';

const Configuration: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [config, setConfig] = useState<Partial<BacktestConfig>>({
    symbols: [],
    timeframes: ['1h'],
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    lookforwardCandles: 24, // Default to 24 as requested
    volumeMaLength: 610, // Pine Script default
    volumeStdLength: 610, // Pine Script default
    volumeThresholds: {
      medium: 1.0, // Pine Script default
      high: 2.5,   // Pine Script default
      extraHigh: 4.0, // Pine Script default
    },
    bodyRatioThreshold: 0.61, // Pine Script default
    enabledSignals: {
      primaryBuy: true,
      basicBuy: false, // Pine Script default (disabled)
      primarySell: true, // Pine Script default (enabled)
      basicSell: false, // Pine Script default (disabled)
    },
  });

  // Fetch available symbols from Binance
  const { data: symbolsData, isLoading: symbolsLoading } = useQuery({
    queryKey: ['binance-symbols'],
    queryFn: binanceApi.getSymbols,
  });

  // Test connection
  const { data: connectionData } = useQuery({
    queryKey: ['binance-connection'],
    queryFn: binanceApi.testConnection,
  });

  // Start backtest mutation
  const startBacktestMutation = useMutation({
    mutationFn: backtestApi.startBacktest,
    onSuccess: (data) => {
      navigate(`/dashboard`);
    },
    onError: (error) => {
      console.error('Failed to start backtest:', error);
    },
  });

  const steps = [
    'Select Symbols',
    'Configure Timeframes',
    'Set Date Range',
    'Signal Settings',
    'Review & Start',
  ];

  const timeframeOptions = [
    { value: '1m', label: '1 Minute' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '30m', label: '30 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' },
  ];


  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSymbolChange = (event: any, newValue: string[]) => {
    setConfig(prev => ({ ...prev, symbols: newValue }));
  };

  const handleTimeframeChange = (timeframe: string) => {
    setConfig(prev => ({
      ...prev,
      timeframes: prev.timeframes?.includes(timeframe)
        ? prev.timeframes.filter(tf => tf !== timeframe)
        : [...(prev.timeframes || []), timeframe]
    }));
  };

  const handleSignalTypeChange = (signalType: keyof NonNullable<BacktestConfig['enabledSignals']>) => {
    setConfig(prev => ({
      ...prev,
      enabledSignals: {
        primaryBuy: prev.enabledSignals?.primaryBuy || false,
        basicBuy: prev.enabledSignals?.basicBuy || false,
        primarySell: prev.enabledSignals?.primarySell || false,
        basicSell: prev.enabledSignals?.basicSell || false,
        [signalType]: !prev.enabledSignals?.[signalType]
      }
    }));
  };


  const handleStartBacktest = () => {
    if (isConfigValid()) {
      startBacktestMutation.mutate(config as BacktestConfig);
    }
  };

  const isConfigValid = () => {
    return (
      config.symbols && config.symbols.length > 0 &&
      config.timeframes && config.timeframes.length > 0 &&
      config.startDate &&
      config.endDate &&
      config.startDate < config.endDate &&
      config.enabledSignals && Object.values(config.enabledSignals).some(Boolean)
    );
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Trading Symbols
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choose the cryptocurrency pairs you want to backtest. You can select multiple symbols.
            </Typography>

            {/* All Symbols Selection */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">
                  Available Symbols ({symbolsData?.symbols?.length || 0})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setConfig(prev => ({ ...prev, symbols: symbolsData?.symbols || [] }))}
                    disabled={symbolsLoading}
                  >
                    Select All
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setConfig(prev => ({ ...prev, symbols: [] }))}
                  >
                    Clear All
                  </Button>
                </Box>
              </Box>

              <Autocomplete
                multiple
                options={symbolsData?.symbols || []}
                value={config.symbols || []}
                onChange={handleSymbolChange}
                loading={symbolsLoading}
                limitTags={10}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search and Select Symbols"
                    placeholder="Type to search from all available symbols..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {symbolsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip variant="outlined" label={option} size="small" {...getTagProps({ index })} />
                  ))
                }
              />

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Selected: {config.symbols?.length || 0} of {symbolsData?.symbols?.length || 0} symbols
                </Typography>
              </Box>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configure Timeframes
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Select the timeframes for analysis. Multiple timeframes will provide more comprehensive results.
            </Typography>

            <FormGroup>
              {timeframeOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={config.timeframes?.includes(option.value) || false}
                      onChange={() => handleTimeframeChange(option.value)}
                    />
                  }
                  label={option.label}
                />
              ))}
            </FormGroup>

            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Selected: {config.timeframes?.length || 0} timeframes
              </Typography>
            </Box>
          </Box>
        );

      case 2:
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Set Date Range
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Choose the historical period for backtesting. Longer periods provide more data but take more time to process.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <DatePicker
                  label="Start Date"
                  value={config.startDate ? new Date(config.startDate) : null}
                  onChange={(newValue) => setConfig(prev => ({ 
                    ...prev, 
                    startDate: newValue ? newValue.toISOString().split('T')[0] : undefined 
                  }))}
                  maxDate={new Date()}
                />
                <DatePicker
                  label="End Date"
                  value={config.endDate ? new Date(config.endDate) : null}
                  onChange={(newValue) => setConfig(prev => ({ 
                    ...prev, 
                    endDate: newValue ? newValue.toISOString().split('T')[0] : undefined 
                  }))}
                  maxDate={new Date()}
                  minDate={config.startDate ? new Date(config.startDate) : undefined}
                />
              </Box>

              {config.startDate && config.endDate && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Period: {Math.ceil((new Date(config.endDate).getTime() - new Date(config.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                  </Typography>
                </Box>
              )}
            </Box>
          </LocalizationProvider>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Signal Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure which volume signals to detect and their parameters.
            </Typography>

            {/* Signal Types */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Signal Types
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enabledSignals?.primaryBuy || false}
                      onChange={() => handleSignalTypeChange('primaryBuy')}
                    />
                  }
                  label="Primary Buy Signals"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enabledSignals?.basicBuy || false}
                      onChange={() => handleSignalTypeChange('basicBuy')}
                    />
                  }
                  label="Basic Buy Signals"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enabledSignals?.primarySell || false}
                      onChange={() => handleSignalTypeChange('primarySell')}
                    />
                  }
                  label="Primary Sell Signals"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enabledSignals?.basicSell || false}
                      onChange={() => handleSignalTypeChange('basicSell')}
                    />
                  }
                  label="Basic Sell Signals"
                />
              </FormGroup>
            </Paper>

            {/* Backtest Parameters (Configurable) */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Backtest Parameters
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Configure how the backtest analyzes signal performance.
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>
                  Lookforward Candles: {config.lookforwardCandles}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Number of candles after each signal to analyze for performance measurement.
                </Typography>
                <TextField
                  type="number"
                  value={config.lookforwardCandles || 24}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    lookforwardCandles: Math.max(1, Math.min(10000, parseInt(e.target.value) || 24))
                  }))}
                  inputProps={{ min: 1, max: 10000, step: 1 }}
                  size="small"
                  sx={{ width: 120 }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>
                  Body Ratio Threshold: {config.bodyRatioThreshold}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Minimum body ratio required for candles in signal patterns. Higher values require stronger candle bodies.
                </Typography>
                <TextField
                  type="number"
                  value={config.bodyRatioThreshold || 0.61}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    bodyRatioThreshold: Math.max(0.1, Math.min(1.0, parseFloat(e.target.value) || 0.61))
                  }))}
                  inputProps={{ min: 0.1, max: 1.0, step: 0.01 }}
                  size="small"
                  sx={{ width: 120 }}
                />
              </Box>
            </Paper>

            {/* Pine Script Parameters (Read-only) */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Pine Script Parameters (Fixed)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                These parameters are set to match the original Pine Script indicator and cannot be modified.
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Volume MA Length</Typography>
                  <Typography variant="h6">610</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Volume Std Length</Typography>
                  <Typography variant="h6">610</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Medium Volume Threshold</Typography>
                  <Typography variant="h6">1.0x</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">High Volume Threshold</Typography>
                  <Typography variant="h6">2.5x</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Extra High Volume Threshold</Typography>
                  <Typography variant="h6">4.0x</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Body Ratio Threshold</Typography>
                  <Typography variant="h6">{config.bodyRatioThreshold || 0.61}</Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Review your backtest configuration before starting.
            </Typography>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Symbols ({config.symbols?.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {config.symbols?.map((symbol) => (
                  <Chip key={symbol} label={symbol} size="small" />
                ))}
              </Box>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Timeframes ({config.timeframes?.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {config.timeframes?.map((tf) => (
                  <Chip key={tf} label={tf} size="small" />
                ))}
              </Box>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Date Range
              </Typography>
              <Typography variant="body2">
                {config.startDate} - {config.endDate}
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Backtest Parameters
              </Typography>
              <Typography variant="body2">
                Lookforward Candles: {config.lookforwardCandles}
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Active Signals
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {config.enabledSignals && Object.entries(config.enabledSignals)
                  .filter(([_, enabled]) => enabled)
                  .map(([signal, _]) => (
                    <Chip key={signal} label={signal} size="small" color="primary" />
                  ))}
              </Box>
            </Paper>

            {!connectionData && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Warning: Unable to connect to Binance API. The backtest will use cached data if available.
              </Alert>
            )}

            {!isConfigValid() && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Please complete all required fields before starting the backtest.
              </Alert>
            )}
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Backtest Configuration
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Configure your volume pattern backtest parameters and start analyzing historical data.
      </Typography>

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ minHeight: 400 }}>
            {renderStepContent(activeStep)}
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            
            <Box>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleStartBacktest}
                  disabled={!isConfigValid() || startBacktestMutation.isPending}
                  startIcon={startBacktestMutation.isPending ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  size="large"
                >
                  {startBacktestMutation.isPending ? 'Starting...' : 'Start Backtest'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={
                    (activeStep === 0 && (!config.symbols || config.symbols.length === 0)) ||
                    (activeStep === 1 && (!config.timeframes || config.timeframes.length === 0)) ||
                    (activeStep === 2 && (!config.startDate || !config.endDate || config.startDate >= config.endDate)) ||
                    (activeStep === 3 && (!config.enabledSignals || !Object.values(config.enabledSignals).some(Boolean)))
                  }
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Configuration;
