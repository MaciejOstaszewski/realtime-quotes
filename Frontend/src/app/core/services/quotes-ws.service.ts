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

    private readonly errorSubject = new BehaviorSubject<string | null>(null);
    readonly error$ = this.errorSubject.asObservable();

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
                this.errorSubject.next(null);
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

        this.socket.onclose = (ev: CloseEvent) => {
            this.zone.run(() => {
                this.statusSubject.next('disconnected');

                if (!ev.wasClean) {
                    this.errorSubject.next('WebSocket connecion lost. Trying to reconnect...');
                }
            });

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), 5000);
            } else {
                this.zone.run(() => {
                    this.errorSubject.next('Failed to reconnect (3 attempts). Refresh the page or check the backend.');
                });
            }
        };
    }

    disconnect(): void {
        this.socket?.close();
        this.socket = null;
        this.statusSubject.next('disconnected');
    }
}