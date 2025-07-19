"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestResultModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SignalDetectionSchema = new mongoose_1.Schema({
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
const SignalPerformanceSchema = new mongoose_1.Schema({
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
const BacktestConfigSchema = new mongoose_1.Schema({
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
const SummarySchema = new mongoose_1.Schema({
    totalSignals: { type: Number, required: true },
    successfulSignals: { type: Number, required: true },
    successRate: { type: Number, required: true },
    avgRiskReward: { type: Number, required: true },
    avgDrawup: { type: Number, required: true },
    avgDrawdown: { type: Number, required: true },
    bestSignal: { type: SignalPerformanceSchema, default: null },
    worstSignal: { type: SignalPerformanceSchema, default: null }
});
const BacktestResultSchema = new mongoose_1.Schema({
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
BacktestResultSchema.index({ id: 1 });
BacktestResultSchema.index({ status: 1 });
BacktestResultSchema.index({ createdAt: -1 });
BacktestResultSchema.index({ 'config.symbols': 1 });
BacktestResultSchema.index({ 'config.timeframes': 1 });
exports.BacktestResultModel = mongoose_1.default.model('BacktestResult', BacktestResultSchema);
//# sourceMappingURL=BacktestResult.js.map