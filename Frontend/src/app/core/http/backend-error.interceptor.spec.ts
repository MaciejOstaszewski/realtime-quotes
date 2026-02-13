import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { backendErrorInterceptor } from './backend-error.interceptor';
import { AppErrorsService } from '../services/app-errors.service';

describe('backendErrorInterceptor', () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;
    let errors: AppErrorsService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                AppErrorsService,
                provideHttpClient(withInterceptors([backendErrorInterceptor])),
                provideHttpClientTesting(),
            ],
        });

        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
        errors = TestBed.inject(AppErrorsService);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('shows backend { error } message for 400', () => {
        const spy = vi.spyOn(errors, 'show');

        http.get('/api/candles?symbol=BAD&from=0&to=1').subscribe({ error: () => { } });

        const req = httpMock.expectOne('/api/candles?symbol=BAD&from=0&to=1');
        req.flush({ error: 'symbol must be BTCUSD or ETHUSD' }, { status: 400, statusText: 'Bad Request' });

        expect(spy).toHaveBeenCalledWith('symbol must be BTCUSD or ETHUSD', 'error');
    });

    it('shows generic server message for 500', () => {
        const spy = vi.spyOn(errors, 'show');

        http.get('/api/candles?symbol=BTCUSD&from=0&to=1').subscribe({ error: () => { } });

        const req = httpMock.expectOne('/api/candles?symbol=BTCUSD&from=0&to=1');
        req.flush({}, { status: 500, statusText: 'Server Error' });

        expect(spy).toHaveBeenCalled();
        const [msg] = spy.mock.calls[0];
        expect(String(msg)).toContain('Server error');
    });

    it('shows connection message on network error (status 0)', () => {
        const spy = vi.spyOn(errors, 'show');

        http.get('/api/candles?symbol=BTCUSD&from=0&to=1').subscribe({ error: () => { } });

        const req = httpMock.expectOne('/api/candles?symbol=BTCUSD&from=0&to=1');
        req.error(new ProgressEvent('error')); // => HttpErrorResponse status 0

        expect(spy).toHaveBeenCalled();
        const [msg] = spy.mock.calls[0];
        expect(String(msg)).toContain('No connection to backend');
    });
});
