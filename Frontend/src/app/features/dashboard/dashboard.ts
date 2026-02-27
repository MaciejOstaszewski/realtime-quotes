import { Component, computed, inject } from '@angular/core';
import { MarketStore } from './state/market.store';
import { RangeKey } from './state/market.types';
import { CandlestickChartComponent } from './candlestick-chart/candlestick-chart';

@Component({
  selector: 'app-dashboard',
  imports: [CandlestickChartComponent],
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
