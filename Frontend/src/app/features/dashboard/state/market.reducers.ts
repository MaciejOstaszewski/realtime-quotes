import { MarketState } from './market.state';
import { Trend } from './market.types';
import { UnixRange, isInRange } from './market.range';
import { Candle } from '../../../core/models/candle';
import { Quote } from '../../../core/models/quote';

export function applyQuote(state: MarketState, quote: Quote): MarketState {
    const prevBid = state.quote?.bid;
    const nextBid = quote.bid;

    const trend: Trend =
        prevBid == null ? 'same' :
            nextBid > prevBid ? 'up' :
                nextBid < prevBid ? 'down' : 'same';

    return { ...state, quote, trend };
}

export function setCandles(state: MarketState, candles: Candle[]): MarketState {
    const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
    return { ...state, candles: sorted };
}

export function applyCandle(state: MarketState, candle: Candle, range: UnixRange): MarketState {
    if (!isInRange(candle.timestamp, range)) return state;

    const current = state.candles;
    if (current.length === 0) return { ...state, candles: [candle] };

    const last = current[current.length - 1];

    if (last.timestamp === candle.timestamp) {
        const next = current.slice(0, -1).concat(candle);
        return { ...state, candles: next };
    }

    if (last.timestamp < candle.timestamp) {
        const next = current.concat(candle).filter(c => isInRange(c.timestamp, range));
        return { ...state, candles: next };
    }

    const idx = current.findIndex(c => c.timestamp === candle.timestamp);
    if (idx >= 0) {
        const next = current.slice();
        next[idx] = candle;
        next.sort((a, b) => a.timestamp - b.timestamp);
        return { ...state, candles: next };
    }

    const next = current.concat(candle);
    next.sort((a, b) => a.timestamp - b.timestamp);
    return { ...state, candles: next };
}

export function setLoading(state: MarketState, loading: boolean): MarketState {
    return { ...state, loadingCandles: loading };
}

export function setError(state: MarketState, error: string | null): MarketState {
    return { ...state, lastError: error };
}

export function setRange(state: MarketState, rangeKey: MarketState['range']): MarketState {
    return { ...state, range: rangeKey };
}
