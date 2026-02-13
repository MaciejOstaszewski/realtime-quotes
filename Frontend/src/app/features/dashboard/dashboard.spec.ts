import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DashboardComponent } from './dashboard';
import { MarketStore } from './state/market.store';
import { CandlestickChartComponent } from './candlestick-chart/candlestick-chart';
import { RangeKey } from './state/market.types';

@Component({ selector: 'app-candlestick-chart', template: '' })
class StubCandlestickChartComponent {}

describe('Dashboard', () => {
  let fixture: ComponentFixture<DashboardComponent>;

  const mockStore = {
    quote: signal<any | null>(null),
    trend: signal<'up' | 'down' | 'same'>('same'),
    status: signal<'connected' | 'connecting' | 'disconnected'>('disconnected'),
    lastUpdateText: signal<string>('—'),
    lastError: signal<string | null>(null),
    range: signal<RangeKey>('15m'),
    loadingCandles: signal<boolean>(false),
    candles: signal<any[]>([]),

    setRange: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: MarketStore, useValue: mockStore }],
    })
      .overrideComponent(DashboardComponent, {
        remove: { imports: [CandlestickChartComponent] },
        add: { imports: [StubCandlestickChartComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders websocket status text', () => {
    mockStore.status.set('connected');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('connected');

    mockStore.status.set('connecting');
    fixture.detectChanges();
    expect(el.textContent).toContain('connecting');
  });

  it('adds trend class for BID when quote updates', () => {
    mockStore.quote.set({ symbol: 'BTCUSD', bid: 123, ask: 124, timestamp: 1 });
    mockStore.trend.set('up');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const bidValue = el.querySelector('.value.up');
    expect(bidValue).toBeTruthy();
    expect(bidValue?.textContent ?? '').toContain('123');

    mockStore.trend.set('down');
    fixture.detectChanges();
    expect(el.querySelector('.value.down')).toBeTruthy();
  });

  it('clicking timeframe button calls store.setRange', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const btn = Array.from(el.querySelectorAll('button'))
      .find(b => (b.textContent ?? '').trim() === '1h') as HTMLButtonElement | undefined;

    expect(btn).toBeTruthy();

    btn!.click();
    expect(mockStore.setRange).toHaveBeenCalledWith('1h');
  });

  it('shows error banner when lastError is set', () => {
    mockStore.lastError.set('WS disconnected');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('WS disconnected');
  });
});
