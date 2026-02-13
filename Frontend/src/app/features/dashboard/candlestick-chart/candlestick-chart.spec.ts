import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CandlestickChartComponent } from './candlestick-chart';
import { MarketStore } from '../state/market.store';

const mockStore = {
    quote: signal(null),
    trend: signal('same'),
    status: signal('disconnected'),
    lastUpdateText: signal('—'),
    lastError: signal(null),
    range: signal('15m'),
    loadingCandles: signal(false),
    candles: signal<any[]>([]),
    candlesCount: signal(0),
    setRange: vi.fn(),
};

describe('CandlestickChart', () => {
    let component: CandlestickChartComponent;
    let fixture: ComponentFixture<CandlestickChartComponent>;
    let ngAfterViewInitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        // Polyfill browser APIs missing in JSDOM
        if (typeof globalThis.ResizeObserver === 'undefined') {
            globalThis.ResizeObserver = class {
                observe() {}
                unobserve() {}
                disconnect() {}
            } as any;
        }

        // Stub ngAfterViewInit to avoid lightweight-charts canvas interactions
        ngAfterViewInitSpy = vi
            .spyOn(CandlestickChartComponent.prototype, 'ngAfterViewInit')
            .mockImplementation(() => {});

        await TestBed.configureTestingModule({
            imports: [CandlestickChartComponent],
            providers: [{ provide: MarketStore, useValue: mockStore }],
        }).compileComponents();

        fixture = TestBed.createComponent(CandlestickChartComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        ngAfterViewInitSpy.mockRestore();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
