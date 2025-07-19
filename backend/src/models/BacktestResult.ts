import mongoose, { Schema, Document } from 'mongoose';
import { BacktestResult as IBacktestResult, SignalDetection, SignalPerformance } from '../types';

// Signal Detection Schema
const SignalDetectionSchema = new Schema({
  type: {
    type: String,
    enum: ['PRIMARY_BUY', 'BASIC_BUY', 'PRIMARY_SELL', 'BASIC_SELL'],
    required: true
  },
  timestamp: { type: Number, required: true },
  price: { type: Number, required: true },
  symbol: { type: String, required: true },
  timeframe: { type: String, required: true },
  volumeData: {
    volumeMean: { type: Number, required: true },
    volumeStd: { type: Number, required: true },
    volumeStdBar: { type: Number, required: true },
    isVolumeColored: { type: Boolean, required: true }
  },
  candleData: {
    current: {
      timestamp: { type: Number, required: true },
      open: { type: Number, required: true },
      high: { type: Number, required: true },
      low: { type: Number, required: true },
      close: { type: Number, required: true },
      volume: { type: Number, required: true }
    },
    previous1: {
      timestamp: { type: Number, required: true },
      open: { type: Number, required: true },
      high: { type: Number, required: true },
      low: { type: Number, required: true },
      close: { type: Number, required: true },
      volume: { type: Number, required: true }
    },
    previous2: {
      timestamp: { type: Number, required: true },
      open: { type: Number, required: true },
      high: { type: Number, required: true },
      low: { type: Number, required: true },
      close: { type: Number, required: true },
      volume: { type: Number, required: true }
    }
  }
});

// Signal Performance Schema
const SignalPerformanceSchema = new Schema({
  signalId: { type: String, required: true },
  maxDrawup: { type: Number, required: true },
  maxDrawdown: { type: Number, required: true },
  maxDrawupPercent: { type: Number, required: true },
  maxDrawdownPercent: { type: Number, required: true },
  riskRewardRatio: { type: Number, required: true },
  isSuccessful: { type: Boolean, required: true },
  timeToMaxDrawup: { type: Number, required: true },
  timeToMaxDrawdown: { type: Number, required: true },
  finalPrice: { type: Number, required: true },
  finalPricePercent: { type: Number, required: true }
});

// Backtest Config Schema
const BacktestConfigSchema = new Schema({
  symbols: [{ type: String, required: true }],
  timeframes: [{ type: String, required: true }],
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  lookforwardCandles: { type: Number, required: true, default: 24 },
  volumeMaLength: { type: Number, required: true, default: 610 },
  volumeStdLength: { type: Number, required: true, default: 610 },
  volumeThresholds: {
    medium: { type: Number, required: true, default: 1.0 },
    high: { type: Number, required: true, default: 2.5 },
    extraHigh: { type: Number, required: true, default: 4.0 }
  },
  bodyRatioThreshold: { type: Number, required: true, default: 0.61 },
  enabledSignals: {
    primaryBuy: { type: Boolean, required: true, default: true },
    basicBuy: { type: Boolean, required: true, default: false },
    primarySell: { type: Boolean, required: true, default: true },
    basicSell: { type: Boolean, required: true, default: false }
  }
});

// Summary Schema
const SummarySchema = new Schema({
  totalSignals: { type: Number, required: true },
  successfulSignals: { type: Number, required: true },
  successRate: { type: Number, required: true },
  avgRiskReward: { type: Number, required: true },
  avgDrawup: { type: Number, required: true },
  avgDrawdown: { type: Number, required: true },
  bestSignal: { type: SignalPerformanceSchema, default: null },
  worstSignal: { type: SignalPerformanceSchema, default: null }
});

// Main Backtest Result Schema
const BacktestResultSchema = new Schema({
  id: { type: String, required: true, unique: true },
  config: { type: BacktestConfigSchema, required: true },
  signals: [SignalDetectionSchema],
  performance: [SignalPerformanceSchema],
  summary: { type: SummarySchema, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
  completedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
    required: true,
    default: 'PENDING'
  },
  progress: { type: Number, required: true, default: 0 },
  error: { type: String, default: null }
});

// Add indexes for better query performance
BacktestResultSchema.index({ id: 1 });
BacktestResultSchema.index({ status: 1 });
BacktestResultSchema.index({ createdAt: -1 });
BacktestResultSchema.index({ 'config.symbols': 1 });
BacktestResultSchema.index({ 'config.timeframes': 1 });

// Interface for the document
export interface IBacktestResultDocument extends Document {
  id: string;
  config: IBacktestResult['config'];
  signals: IBacktestResult['signals'];
  performance: IBacktestResult['performance'];
  summary: IBacktestResult['summary'];
  createdAt: Date;
  completedAt: Date | null;
  status: IBacktestResult['status'];
  progress: number;
  error?: string;
}

// Create and export the model
export const BacktestResultModel = mongoose.model<IBacktestResultDocument>('BacktestResult', BacktestResultSchema);
