import { AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
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
import { format } from 'date-fns';

@Component({
  selector: 'app-candlestick-chart',
  templateUrl: './candlestick-chart.html',
  styleUrl: './candlestick-chart.scss',
})
export class CandlestickChartComponent implements AfterViewInit {
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip', { static: true }) tooltipRef!: ElementRef<HTMLDivElement>;
  @ViewChild('legend', { static: true }) legendRef!: ElementRef<HTMLDivElement>;

  private readonly store = inject(MarketStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly seriesSig = signal<ISeriesApi<'Candlestick'> | null>(null);
  private chart: IChartApi | null = null;

  private lastRenderedLen = 0;
  private lastRenderedTs: number | null = null;
  private didFit = false;

  private readonly priceFmt = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  private readonly renderEffect = effect(() => {
    const candles = this.store.candles();
    const series = this.seriesSig();
    if (!series) return;

    if (candles.length === 0) {
      series.setData([]);
      this.lastRenderedLen = 0;
      this.lastRenderedTs = null;
      this.didFit = false;
      this.setLegendText('OHLC: —');
      return;
    }

    const last = candles[candles.length - 1];
    const lastTs = last.timestamp;

    if (candles.length < this.lastRenderedLen || this.lastRenderedLen === 0) {
      series.setData(candles.map(toData));
      this.lastRenderedLen = candles.length;
      this.lastRenderedTs = lastTs;
      this.chart?.timeScale().fitContent();
      this.didFit = true;

      this.setLegendFromCandle({
        time: last.timestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });

      return;
    }

    if (candles.length === this.lastRenderedLen && this.lastRenderedTs === lastTs) {
      series.update(toData(last));
      this.setLegendFromCandle({
        time: last.timestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
      return;
    }

    if (candles.length === this.lastRenderedLen + 1) {
      series.update(toData(last));
      this.lastRenderedLen = candles.length;
      this.lastRenderedTs = lastTs;

      if (!this.didFit) {
        this.chart?.timeScale().fitContent();
        this.didFit = true;
      }

      this.setLegendFromCandle({
        time: last.timestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });

      return;
    }

    series.setData(candles.map(toData));
    this.lastRenderedLen = candles.length;
    this.lastRenderedTs = lastTs;

    if (!this.didFit) {
      this.chart?.timeScale().fitContent();
      this.didFit = true;
    }

    this.setLegendFromCandle({
      time: last.timestamp,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });
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
    this.seriesSig.set(series);
    this.chart = chart;

    const tooltip = this.tooltipRef.nativeElement;

    chart.subscribeCrosshairMove((param) => {
      const activeSeries = this.seriesSig();

      if (!activeSeries || !param?.time || !param.seriesData) {
        tooltip.style.display = 'none';
        return;
      }

      if (typeof param.time !== 'number') {
        tooltip.style.display = 'none';
        return;
      }

      const data = param.seriesData.get(activeSeries) as CandlestickData | undefined;
      if (!data) {
        tooltip.style.display = 'none';
        return;
      }

      tooltip.style.display = 'block';
      tooltip.innerHTML = this.formatOHLC(param.time as number, data);

      const x = (param.point?.x ?? 0) + 12;
      const y = (param.point?.y ?? 0) + 12;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;

      this.setLegendHtml(this.formatOHLC(param.time as number, data));
    });

    const onLeave = () => {
      tooltip.style.display = 'none';
    };
    container.addEventListener('mouseleave', onLeave);
    this.destroyRef.onDestroy(() => container.removeEventListener('mouseleave', onLeave));

    const ro = new ResizeObserver(() => chart.applyOptions({}));
    ro.observe(container);
    this.destroyRef.onDestroy(() => ro.disconnect());

    this.destroyRef.onDestroy(() => {
      chart.remove();
      this.chart = null;
      this.seriesSig.set(null);
    });
  }

  private formatOHLC(unixSeconds: number, data: CandlestickData): string {
    const t = format(new Date(unixSeconds * 1000), 'HH:mm');
    return (
      `<div><b>${t}</b></div>` +
      `<div><b>O</b>: ${this.priceFmt.format(data.open)}</div>` +
      `<div><b>H</b>: ${this.priceFmt.format(data.high)}</div>` +
      `<div><b>L</b>: ${this.priceFmt.format(data.low)}</div>` +
      `<div><b>C</b>: ${this.priceFmt.format(data.close)}</div>`
    );
  }

  private setLegendFromCandle(c: { time: number; open: number; high: number; low: number; close: number }) {
    this.setLegendHtml(
      `<div><b>${format(new Date(c.time * 1000), 'HH:mm')}</b></div>` +
      `<div><b>O</b>: ${this.priceFmt.format(c.open)}</div>` +
      `<div><b>H</b>: ${this.priceFmt.format(c.high)}</div>` +
      `<div><b>L</b>: ${this.priceFmt.format(c.low)}</div>` +
      `<div><b>C</b>: ${this.priceFmt.format(c.close)}</div>`
    );
  }

  private setLegendText(text: string) {
    this.legendRef.nativeElement.textContent = text;
  }

  private setLegendHtml(html: string) {
    this.legendRef.nativeElement.innerHTML = html;
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