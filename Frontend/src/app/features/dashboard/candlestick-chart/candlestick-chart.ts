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
import { Candle } from '../../../core/models/candle';
import { format } from 'date-fns';

interface OHLCData {
  open: number;
  high: number;
  low: number;
  close: number;
}

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
    const isUpdateInPlace = candles.length === this.lastRenderedLen && last.timestamp === this.lastRenderedTs;
    const isAppend = candles.length === this.lastRenderedLen + 1;
    const needsFullRedraw = candles.length < this.lastRenderedLen || this.lastRenderedLen === 0;

    if (isUpdateInPlace) {
      series.update(toData(last));
    } else if (isAppend) {
      series.update(toData(last));
      this.lastRenderedLen = candles.length;
      this.lastRenderedTs = last.timestamp;
      if (!this.didFit) {
        this.chart?.timeScale().fitContent();
        this.didFit = true;
      }
    } else {
      series.setData(candles.map(toData));
      this.lastRenderedLen = candles.length;
      this.lastRenderedTs = last.timestamp;
      if (!this.didFit || needsFullRedraw) {
        this.chart?.timeScale().fitContent();
        this.didFit = true;
      }
    }

    this.setLegendFromCandle(last);
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

      const timeSeconds: number = param.time;
      const rawData = param.seriesData.get(activeSeries);

      if (!isOHLCData(rawData)) {
        tooltip.style.display = 'none';
        return;
      }

      tooltip.style.display = 'block';
      this.setOHLCContent(tooltip, timeSeconds, rawData);

      const x = (param.point?.x ?? 0) + 12;
      const y = (param.point?.y ?? 0) + 12;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;

      this.setOHLCContent(this.legendRef.nativeElement, timeSeconds, rawData);
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

  private setLegendFromCandle(candle: Candle): void {
    this.setOHLCContent(this.legendRef.nativeElement, candle.timestamp, candle);
  }

  private setLegendText(text: string) {
    this.legendRef.nativeElement.textContent = text;
  }

  private setOHLCContent(el: HTMLElement, timeSeconds: number, data: OHLCData): void {
    el.replaceChildren();

    const timeDiv = document.createElement('div');
    const tb = document.createElement('b');
    tb.textContent = format(new Date(timeSeconds * 1000), 'HH:mm');
    timeDiv.appendChild(tb);
    el.appendChild(timeDiv);

    const fields: [string, number][] = [
      ['O', data.open],
      ['H', data.high],
      ['L', data.low],
      ['C', data.close],
    ];

    for (const [label, value] of fields) {
      const div = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = label;
      div.appendChild(b);
      div.appendChild(document.createTextNode(`: ${this.priceFmt.format(value)}`));
      el.appendChild(div);
    }
  }
}

function isOHLCData(value: unknown): value is OHLCData {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Record<string, unknown>;
  return typeof d['open'] === 'number'
    && typeof d['high'] === 'number'
    && typeof d['low'] === 'number'
    && typeof d['close'] === 'number';
}

function toData(c: Candle): CandlestickData {
  return {
    time: c.timestamp as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}
