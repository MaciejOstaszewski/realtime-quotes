import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { format } from 'date-fns';
import { initialMarketState, MarketState } from './market.state';
import { RangeKey } from './market.types';
import { computeUnixRange } from './market.range';
import { applyCandle, applyQuote, setCandles, setError, setLoading, setRange } from './market.reducers';
import { WsMessage } from '../../../core/models/ws-message';
import { CandlesApiService } from '../../../core/services/candles-api.service';
import { QuotesWsService } from '../../../core/services/quotes-ws.service';

@Injectable({ providedIn: 'root' })
export class MarketStore {
    private readonly ws = inject(QuotesWsService);
    private readonly api = inject(CandlesApiService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly state = signal<MarketState>(initialMarketState);

    readonly range = computed(() => this.state().range);

    readonly quote = computed(() => this.state().quote);
    readonly trend = computed(() => this.state().trend);

    readonly candles = computed(() => this.state().candles);

    readonly loadingCandles = computed(() => this.state().loadingCandles);
    readonly lastError = computed(() => this.state().lastError);

    readonly status = toSignal(this.ws.status$, { initialValue: 'disconnected' as const });

    readonly lastUpdateText = computed(() => {
        const q = this.quote();
        return q ? format(new Date(q.timestamp * 1000), 'HH:mm:ss') : '—';
    });

    constructor() {
        this.ws.connect();

        this.ws.error$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((err) => this.state.update(s => setError(s, err)));

        this.ws.messages$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((msg: WsMessage) => this.handleWsMessage(msg));

        effect(() => {
            const r = this.range();
            void this.loadCandles(r);
        });
    }

    setRange(range: RangeKey) {
        this.state.update(s => setRange(s, range));
    }

    private handleWsMessage(msg: WsMessage) {
        if (msg.type === 'quote' && msg.data.symbol === 'BTCUSD') {
            this.state.update(s => applyQuote(s, msg.data));
            return;
        }

        if (msg.type === 'candle' && msg.data.symbol === 'BTCUSD') {
            const range = computeUnixRange(this.range());
            this.state.update(s => applyCandle(s, msg.data, range));
            return;
        }
    }

    private async loadCandles(rangeKey: RangeKey) {
        this.state.update(s => setLoading(s, true));

        try {
            const r = computeUnixRange(rangeKey);
            const candles = await firstValueFrom(this.api.getCandles('BTCUSD', r.from, r.to));

            this.state.update(s => setCandles(s, candles));
            this.state.update(s => setError(s, null));
        } catch {
            this.state.update(s => setError(s, 'Nie udało się pobrać świeczek z backendu.'));
        } finally {
            this.state.update(s => setLoading(s, false));
        }
    }
}
