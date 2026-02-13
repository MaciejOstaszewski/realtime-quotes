import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { environment } from "../../../environments/environment";
import { Candle } from "../models/candle";

@Injectable({ providedIn: 'root' })
export class CandlesApiService {
    private readonly http = inject(HttpClient);

    getCandles(symbol: 'BTCUSD' | 'ETHUSD', from: number, to: number) {
        const url = `${environment.backendHttpBaseUrl}/api/candles`;
        return this.http.get<Candle[]>(url, { params: { symbol, from, to } });
    }
}