import { Candle } from '../../../core/models/candle';
import { Quote } from '../../../core/models/quote';
import { RangeKey, Trend } from './market.types';

export interface MarketState {
    range: RangeKey;

    quote: Quote | null;
    trend: Trend;

    candles: Candle[];

    loadingCandles: boolean;
    lastError: string | null;
}

export const initialMarketState: MarketState = {
    range: '15m',
    quote: null,
    trend: 'same',
    candles: [],
    loadingCandles: false,
    lastError: null,
};
