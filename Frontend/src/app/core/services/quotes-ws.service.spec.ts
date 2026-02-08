import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, take } from 'rxjs';

import { QuotesWsService } from './quotes-ws.service';

import { environment } from '../../../environments/environment';
import { Quote } from '../models/quote';

type CloseLike = { wasClean?: boolean; code?: number; reason?: string };

class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    static instances: FakeWebSocket[] = [];

    url: string;
    readyState = FakeWebSocket.CONNECTING;

    onopen: ((ev: any) => void) | null = null;
    onmessage: ((ev: any) => void) | null = null;
    onclose: ((ev: any) => void) | null = null;

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    triggerOpen() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.(new Event('open'));
    }

    triggerMessage(data: string) {
        this.onmessage?.({ data });
    }

    triggerClose(opts: CloseLike = {}) {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({
            wasClean: opts.wasClean ?? true,
            code: opts.code ?? 1000,
            reason: opts.reason ?? 'closed',
        });
    }

    close() {
        this.triggerClose({ wasClean: true, code: 1000, reason: 'client_close' });
    }
}

const noopNgZone = { run: <T>(fn: () => T) => fn() } as NgZone;

describe('QuotesWsService', () => {
    const realWebSocket = globalThis.WebSocket;

    beforeEach(() => {
        vi.useFakeTimers();
        FakeWebSocket.instances = [];
        // @ts-expect-error test override
        globalThis.WebSocket = FakeWebSocket;
        TestBed.configureTestingModule({
            providers: [
                QuotesWsService,
                { provide: NgZone, useValue: noopNgZone },
            ],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        globalThis.WebSocket = realWebSocket;
    });

    it('connect(): sets status connecting -> connected on open', async () => {
        const svc = TestBed.inject(QuotesWsService);

        const initial = await firstValueFrom(svc.status$.pipe(take(1)));
        expect(initial).toBe('disconnected');

        svc.connect();

        expect(FakeWebSocket.instances.length).toBe(1);
        const ws = FakeWebSocket.instances[0];

        expect(ws.url).toBe(environment.backendWsUrl);

        const connecting = await firstValueFrom(svc.status$.pipe(take(1)));
        expect(connecting).toBe('connecting');
        ws.triggerOpen();
        const connected = await firstValueFrom(svc.status$.pipe(take(1)));
        expect(connected).toBe('connected');
    });

    it('messages$: emits parsed JSON WsMessage', async () => {
        const svc = TestBed.inject(QuotesWsService);
        svc.connect();

        const ws = FakeWebSocket.instances[0];
        ws.triggerOpen();

        const p = firstValueFrom(svc.messages$.pipe(take(1)));
        ws.triggerMessage(JSON.stringify({ type: 'quote', data: { symbol: 'BTCUSD', bid: 1, ask: 2, timestamp: 3 } }));

        const msg = await p;
        expect(msg.type).toBe('quote');
        expect((msg.data as Quote).symbol).toBe('BTCUSD');
    });

    it('connect(): does not create a new socket when already OPEN/CONNECTING', () => {
        const svc = TestBed.inject(QuotesWsService);

        svc.connect();
        expect(FakeWebSocket.instances.length).toBe(1);

        svc.connect();
        expect(FakeWebSocket.instances.length).toBe(1);

        FakeWebSocket.instances[0].triggerOpen();
        svc.connect();
        expect(FakeWebSocket.instances.length).toBe(1);
    });

    it('onclose (not clean): sets disconnected and schedules reconnect attempts', async () => {
        const svc = TestBed.inject(QuotesWsService);
        svc.connect();

        const ws1 = FakeWebSocket.instances[0];
        ws1.triggerOpen();

        ws1.triggerClose({ wasClean: false });

        const status = await firstValueFrom(svc.status$.pipe(take(1)));
        expect(status).toBe('disconnected');

        expect(FakeWebSocket.instances.length).toBe(1);
        await vi.advanceTimersByTimeAsync(5000);
        expect(FakeWebSocket.instances.length).toBe(2);

        const ws2 = FakeWebSocket.instances[1];
        ws2.triggerOpen();
        const status2 = await firstValueFrom(svc.status$.pipe(take(1)));
        expect(status2).toBe('connected');
    });

    it('after max reconnect attempts: exposes final error message', async () => {
        const svc = TestBed.inject(QuotesWsService);
        svc.connect();

        const ws1 = FakeWebSocket.instances[0];
        ws1.triggerOpen();

        // 1st close (initial connection lost) → attempts 0→1, schedule reconnect
        ws1.triggerClose({ wasClean: false });
        await vi.advanceTimersByTimeAsync(5000);
        // 2nd close (reconnect #1 fails) → attempts 1→2, schedule reconnect
        FakeWebSocket.instances[1].triggerClose({ wasClean: false });

        await vi.advanceTimersByTimeAsync(5000);
        // 3rd close (reconnect #2 fails) → attempts 2→3, schedule reconnect
        FakeWebSocket.instances[2].triggerClose({ wasClean: false });

        await vi.advanceTimersByTimeAsync(5000);
        // 4th close (reconnect #3 fails) → attempts = 3 = max → final error
        FakeWebSocket.instances[3].triggerClose({ wasClean: false });

        const err = await firstValueFrom(svc.error$.pipe(take(1)));
        expect(err).toBeTruthy();
        expect(String(err)).toContain('Failed to reconnect (3 attempts). Refresh the page or check the backend.');
    });

    it('disconnect(): closes socket and sets status disconnected', async () => {
        const svc = TestBed.inject(QuotesWsService);
        svc.connect();

        const ws = FakeWebSocket.instances[0];
        ws.triggerOpen();

        svc.disconnect();

        const status = await firstValueFrom(svc.status$.pipe(take(1)));
        expect(status).toBe('disconnected');
    });
});
