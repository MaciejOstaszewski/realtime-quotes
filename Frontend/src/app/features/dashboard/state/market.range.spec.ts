import { describe, it, expect } from 'vitest';
import { getUnixTime } from 'date-fns';
import { computeUnixRange, isInRange } from './market.range';
import { RangeKey } from './market.types';

const fixedNow = new Date('2024-06-15T12:00:00Z');

describe('computeUnixRange', () => {
    it('15m: span is exactly 15 minutes', () => {
        const range = computeUnixRange('15m', fixedNow);
        expect(range.to - range.from).toBe(15 * 60);
    });

    it('1h: span is exactly 1 hour', () => {
        const range = computeUnixRange('1h', fixedNow);
        expect(range.to - range.from).toBe(60 * 60);
    });

    it('6h: span is exactly 6 hours', () => {
        const range = computeUnixRange('6h', fixedNow);
        expect(range.to - range.from).toBe(6 * 60 * 60);
    });

    it('24h: span is exactly 24 hours', () => {
        const range = computeUnixRange('24h', fixedNow);
        expect(range.to - range.from).toBe(24 * 60 * 60);
    });

    it('to equals the unix timestamp of the supplied now date', () => {
        const range = computeUnixRange('1h', fixedNow);
        expect(range.to).toBe(getUnixTime(fixedNow));
    });

    it('from is always less than to for every range key', () => {
        const keys: RangeKey[] = ['15m', '1h', '6h', '24h'];
        for (const key of keys) {
            const range = computeUnixRange(key, fixedNow);
            expect(range.from).toBeLessThan(range.to);
        }
    });

    it('uses current time when no now argument is provided', () => {
        const before = getUnixTime(new Date());
        const range = computeUnixRange('1h');
        const after = getUnixTime(new Date());
        expect(range.to).toBeGreaterThanOrEqual(before);
        expect(range.to).toBeLessThanOrEqual(after);
    });
});

describe('isInRange', () => {
    const range = { from: 1000, to: 2000 };

    it('returns true for a timestamp in the middle of the range', () => {
        expect(isInRange(1500, range)).toBe(true);
    });

    it('returns true at the from boundary (inclusive)', () => {
        expect(isInRange(1000, range)).toBe(true);
    });

    it('returns true at the to boundary (inclusive)', () => {
        expect(isInRange(2000, range)).toBe(true);
    });

    it('returns false for a timestamp before the range', () => {
        expect(isInRange(999, range)).toBe(false);
    });

    it('returns false for a timestamp after the range', () => {
        expect(isInRange(2001, range)).toBe(false);
    });
});
