import { AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, ViewChild } from '@angular/core';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  CrosshairMode,
} from 'lightweight-charts';
import { MarketStore } from '../state/market.store';

@Component({
  selector: 'app-candlestick-chart',
  templateUrl: './candlestick-chart.html',
  styleUrl: './candlestick-chart.scss',
})
export class CandlestickChartComponent implements AfterViewInit {
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip', { static: true }) tooltipRef!: ElementRef<HTMLDivElement>;

  private readonly store = inject(MarketStore);
  private readonly destroyRef = inject(DestroyRef);

  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Candlestick'> | null = null;

  private lastRenderedLen = 0;
  private lastRenderedTs: number | null = null;
  private didFit = false;

  private readonly renderEffect = effect(() => {
    const candles = this.store.candles();
    if (!this.series) return;

    if (candles.length === 0) {
      this.series.setData([]);
      this.lastRenderedLen = 0;
      this.lastRenderedTs = null;
      this.didFit = false;
      return;
    }

    const last = candles[candles.length - 1];
    const lastTs = last.timestamp;

    if (candles.length < this.lastRenderedLen || this.lastRenderedLen === 0) {
      this.series.setData(candles.map(toData));
      this.lastRenderedLen = candles.length;
      this.lastRenderedTs = lastTs;
      this.chart?.timeScale().fitContent();
      this.didFit = true;
      return;
    }

    if (candles.length === this.lastRenderedLen && this.lastRenderedTs === lastTs) {
      this.series.update(toData(last));
      return;
    }

    if (candles.length === this.lastRenderedLen + 1) {
      this.series.update(toData(last));
      this.lastRenderedLen = candles.length;
      this.lastRenderedTs = lastTs;
      if (!this.didFit) {
        this.chart?.timeScale().fitContent();
        this.didFit = true;
      }
      return;
    }

    this.series.setData(candles.map(toData));
    this.lastRenderedLen = candles.length;
    this.lastRenderedTs = lastTs;
    if (!this.didFit) {
      this.chart?.timeScale().fitContent();
      this.didFit = true;
    }
  });

  ngAfterViewInit(): void {
    const container = this.containerRef.nativeElement;

    const chart = createChart(container, {
      autoSize: true,
      rightPriceScale: { visible: true },
      timeScale: { timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addSeries(CandlestickSeries, {});

    this.chart = chart;
    this.series = series;

    const tooltip = this.tooltipRef.nativeElement;
    chart.subscribeCrosshairMove((param) => {
      if (!param?.time || !param.seriesData || !this.series) {
        tooltip.style.display = 'none';
        return;
      }
      const data = param.seriesData.get(this.series) as CandlestickData | undefined;
      if (!data) {
        tooltip.style.display = 'none';
        return;
      }

      tooltip.style.display = 'block';
      tooltip.innerHTML =
        `<div><b>O</b>: ${data.open}</div>` +
        `<div><b>H</b>: ${data.high}</div>` +
        `<div><b>L</b>: ${data.low}</div>` +
        `<div><b>C</b>: ${data.close}</div>`;

      const x = (param.point?.x ?? 0) + 12;
      const y = (param.point?.y ?? 0) + 12;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    });

    const ro = new ResizeObserver(() => chart.applyOptions({}));
    ro.observe(container);
    this.destroyRef.onDestroy(() => ro.disconnect());

    this.destroyRef.onDestroy(() => {
      chart.remove();
      this.chart = null;
      this.series = null;
    });
  }
}

function toData(c: { timestamp: number; open: number; high: number; low: number; close: number }): CandlestickData {
  return {
    time: c.timestamp as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}