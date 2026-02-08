import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Quote } from '../../core/models/quote';
import { WsMessage } from '../../core/models/ws-message';
import { ConnectionStatus, QuotesWsService } from '../../core/services/quotes-ws.service';
import { filter, scan } from 'rxjs';

type Trend = 'up' | 'down' | 'same';

interface BtcState {
  quote: Quote | null;
  trend: Trend;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  private readonly ws = inject(QuotesWsService);

  readonly status = toSignal(this.ws.status$, { initialValue: 'disconnected' as const });

  private readonly btcState$ = this.ws.messages$.pipe(
    filter((msg: WsMessage): msg is Extract<WsMessage, { type: 'quote' }> => msg.type === 'quote'),
    filter((msg) => msg.data.symbol === 'BTCUSD'),
    scan((state: BtcState, msg) => {
      const prevBid = state.quote?.bid;
      const nextBid = msg.data.bid;

      const trend: Trend =
        prevBid == null ? 'same' :
          nextBid > prevBid ? 'up' :
            nextBid < prevBid ? 'down' : 'same';

      return { quote: msg.data, trend };
    }, { quote: null, trend: 'same' } satisfies BtcState)
  );

  readonly btcState = toSignal(this.btcState$, { initialValue: { quote: null, trend: 'same' } satisfies BtcState });

  readonly btcQuote = computed(() => this.btcState().quote);
  readonly bidTrend = computed(() => this.btcState().trend);

  readonly lastUpdateText = computed(() => {
    const quote = this.btcQuote();
    return quote ? new Date(quote.timestamp * 1000).toLocaleTimeString() : '—';
  });

  ngOnInit(): void {
    this.ws.connect();
  }
}