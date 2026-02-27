import { describe, it, expect } from 'vitest';
import { initialMarketState } from './market.state';
import { applyQuote, setCandles, applyCandle, setLoading, setError, setRange } from './market.reducers';
import { Candle } from '../../../core/models/candle';
import { Quote } from '../../../core/models/quote';
import { UnixRange } from './market.range';

const makeQuote = (bid: number, timestamp = 1_700_000_000): Quote => ({
    symbol: 'BTCUSD',
    bid,
    ask: bid + 1,
    timestamp,
});

const makeCandle = (timestamp: number, close = 100): Candle => ({
    symbol: 'BTCUSD',
    timestamp,
    open: 95,
    high: 110,
    low: 90,
    close,
    volume: 5,
});

const fullRange: UnixRange = { from: 0, to: 9_999_999_999 };

describe('market reducers', () => {
    describe('applyQuote', () => {
        it('sets trend to "same" when there is no previous quote', () => {
            const state = { ...initialMarketState, quote: null };
            const result = applyQuote(state, makeQuote(100));
            expect(result.trend).toBe('same');
            expect(result.quote?.bid).toBe(100);
        });

        it('sets trend to "up" when bid increases', () => {
            const state = { ...initialMarketState, quote: makeQuote(90) };
            const result = applyQuote(state, makeQuote(100));
            expect(result.trend).toBe('up');
        });

        it('sets trend to "down" when bid decreases', () => {
            const state = { ...initialMarketState, quote: makeQuote(100) };
            const result = applyQuote(state, makeQuote(90));
            expect(result.trend).toBe('down');
        });

        it('sets trend to "same" when bid is unchanged', () => {
            const state = { ...initialMarketState, quote: makeQuote(100) };
            const result = applyQuote(state, makeQuote(100));
            expect(result.trend).toBe('same');
        });

        it('updates the quote in state', () => {
            const state = { ...initialMarketState, quote: makeQuote(50) };
            const newQuote = makeQuote(75, 1_700_000_010);
            const result = applyQuote(state, newQuote);
            expect(result.quote).toEqual(newQuote);
        });

        it('does not mutate the original state', () => {
            const state = { ...initialMarketState };
            applyQuote(state, makeQuote(100));
            expect(state.quote).toBeNull();
        });
    });

    describe('setCandles', () => {
        it('sorts candles by timestamp ascending', () => {
            const candles = [makeCandle(300), makeCandle(100), makeCandle(200)];
            const result = setCandles(initialMarketState, candles);
            expect(result.candles.map(c => c.timestamp)).toEqual([100, 200, 300]);
        });

        it('replaces the candles in state', () => {
            const state = { ...initialMarketState, candles: [makeCandle(50)] };
            const result = setCandles(state, [makeCandle(100)]);
            expect(result.candles).toHaveLength(1);
            expect(result.candles[0].timestamp).toBe(100);
        });

        it('does not mutate the input array', () => {
            const candles = [makeCandle(200), makeCandle(100)];
            const originalOrder = candles.map(c => c.timestamp);
            setCandles(initialMarketState, candles);
            expect(candles.map(c => c.timestamp)).toEqual(originalOrder);
        });
    });

    describe('applyCandle', () => {
        it('returns the same state reference when candle is outside range', () => {
            const narrowRange: UnixRange = { from: 1000, to: 2000 };
            const state = { ...initialMarketState, candles: [] };
            const result = applyCandle(state, makeCandle(5000), narrowRange);
            expect(result).toBe(state);
        });

        it('adds first candle to an empty list', () => {
            const state = { ...initialMarketState, candles: [] };
            const result = applyCandle(state, makeCandle(100), fullRange);
            expect(result.candles).toHaveLength(1);
            expect(result.candles[0].timestamp).toBe(100);
        });

        it('replaces the last candle when timestamps match', () => {
            const state = { ...initialMarketState, candles: [makeCandle(100, 95)] };
            const result = applyCandle(state, makeCandle(100, 105), fullRange);
            expect(result.candles).toHaveLength(1);
            expect(result.candles[0].close).toBe(105);
        });

        it('appends a new candle when its timestamp is newer than the last', () => {
            const state = { ...initialMarketState, candles: [makeCandle(100)] };
            const result = applyCandle(state, makeCandle(200), fullRange);
            expect(result.candles).toHaveLength(2);
            expect(result.candles[1].timestamp).toBe(200);
        });

        it('filters out-of-range candles when appending pushes oldest out', () => {
            const narrowRange: UnixRange = { from: 100, to: 300 };
            const state = { ...initialMarketState, candles: [makeCandle(50), makeCandle(100)] };
            const result = applyCandle(state, makeCandle(200), narrowRange);
            expect(result.candles.every(c => c.timestamp >= 100 && c.timestamp <= 300)).toBe(true);
        });

        it('updates a candle in the middle by matching timestamp', () => {
            const state = {
                ...initialMarketState,
                candles: [makeCandle(100), makeCandle(200), makeCandle(300)],
            };
            const updated = makeCandle(200, 999);
            const result = applyCandle(state, updated, fullRange);
            expect(result.candles.find(c => c.timestamp === 200)?.close).toBe(999);
        });

        it('inserts a new candle out of order and sorts the result', () => {
            const state = { ...initialMarketState, candles: [makeCandle(100), makeCandle(300)] };
            const result = applyCandle(state, makeCandle(200), fullRange);
            expect(result.candles.map(c => c.timestamp)).toEqual([100, 200, 300]);
        });
    });

    describe('setLoading', () => {
        it('sets loadingCandles to true', () => {
            const result = setLoading(initialMarketState, true);
            expect(result.loadingCandles).toBe(true);
        });

        it('sets loadingCandles to false', () => {
            const state = { ...initialMarketState, loadingCandles: true };
            const result = setLoading(state, false);
            expect(result.loadingCandles).toBe(false);
        });
    });

    describe('setError', () => {
        it('sets an error message', () => {
            const result = setError(initialMarketState, 'Connection failed');
            expect(result.lastError).toBe('Connection failed');
        });

        it('clears the error when null is passed', () => {
            const state = { ...initialMarketState, lastError: 'some error' };
            const result = setError(state, null);
            expect(result.lastError).toBeNull();
        });
    });

    describe('setRange', () => {
        it('updates the range key', () => {
            const result = setRange(initialMarketState, '1h');
            expect(result.range).toBe('1h');
        });

        it('does not mutate other state properties', () => {
            const state = { ...initialMarketState, loadingCandles: true };
            const result = setRange(state, '6h');
            expect(result.loadingCandles).toBe(true);
        });
    });
});
