import { getUnixTime, subHours, subMinutes } from 'date-fns';
import { RangeKey } from './market.types';

export interface UnixRange {
    from: number;
    to: number;
}

export function computeUnixRange(range: RangeKey, now: Date = new Date()): UnixRange {
    const to = getUnixTime(now);

    const fromDate =
        range === '15m' ? subMinutes(now, 15) :
            range === '1h' ? subHours(now, 1) :
                range === '6h' ? subHours(now, 6) :
                    subHours(now, 24);

    const from = getUnixTime(fromDate);
    return { from, to };
}

export function isInRange(ts: number, r: UnixRange): boolean {
    return ts >= r.from && ts <= r.to;
}
