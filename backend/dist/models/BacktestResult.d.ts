import mongoose, { Document } from 'mongoose';
import { BacktestResult as IBacktestResult } from '../types';
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
export declare const BacktestResultModel: mongoose.Model<IBacktestResultDocument, {}, {}, {}, mongoose.Document<unknown, {}, IBacktestResultDocument, {}> & IBacktestResultDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=BacktestResult.d.ts.map