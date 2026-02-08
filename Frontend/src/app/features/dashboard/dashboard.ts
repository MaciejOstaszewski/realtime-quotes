import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Quote } from '../../core/models/quote';
import { WsMessage } from '../../core/models/ws-message';
import { ConnectionStatus, QuotesWsService } from '../../core/services/quotes-ws.service';
import { filter, scan } from 'rxjs';
import { MarketStore } from './state/market.store';
import { RangeKey } from './state/market.types';
import { CandlestickChartComponent } from './candlestick-chart/candlestick-chart';

type Trend = 'up' | 'down' | 'same';

interface BtcState {
  quote: Quote | null;
  trend: Trend;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, CandlestickChartComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  readonly store = inject(MarketStore);

  readonly quote = this.store.quote;
  readonly trend = this.store.trend;
  readonly status = this.store.status;
  readonly lastUpdateText = this.store.lastUpdateText;

  readonly error = this.store.lastError;
  readonly range = this.store.range;
  readonly loadingCandles = this.store.loadingCandles;

  readonly bidClass = computed(() => {
    const t = this.trend();
    return t === 'up' ? 'up' : t === 'down' ? 'down' : '';
  });

  setRange(r: RangeKey) {
    this.store.setRange(r);
  }
}