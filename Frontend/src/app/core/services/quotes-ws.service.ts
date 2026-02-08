import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WsMessage } from '../models/ws-message';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class QuotesWsService {
    private socket: WebSocket | null = null;

    private readonly statusSubject = new BehaviorSubject<ConnectionStatus>('disconnected');
    readonly status$ = this.statusSubject.asObservable();

    private readonly messagesSubject = new Subject<WsMessage>();
    readonly messages$: Observable<WsMessage> = this.messagesSubject.asObservable();

    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 3;

    constructor(private zone: NgZone) { }

    connect(): void {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.statusSubject.next('connecting');

        this.socket = new WebSocket(environment.backendWsUrl);

        this.socket.onopen = () => {
            this.zone.run(() => {
                this.reconnectAttempts = 0;
                this.statusSubject.next('connected');
            });
        };

        this.socket.onmessage = (ev) => {
            this.zone.run(() => {
                try {
                    const msg = JSON.parse(ev.data) as WsMessage;
                    this.messagesSubject.next(msg);
                } catch {
                }
            });
        };

        this.socket.onerror = () => {
        };

        this.socket.onclose = () => {
            this.zone.run(() => {
                this.statusSubject.next('disconnected');
            });

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), 5000);
            }
        };
    }

    disconnect(): void {
        this.socket?.close();
        this.socket = null;
        this.statusSubject.next('disconnected');
    }
}
