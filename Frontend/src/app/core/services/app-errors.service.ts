import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppAlertKind = 'info' | 'warning' | 'error';

export interface AppAlert {
    kind: AppAlertKind;
    message: string;
}

@Injectable({ providedIn: 'root' })
export class AppErrorsService {
    private readonly alertSubject = new BehaviorSubject<AppAlert | null>(null);
    readonly alert$ = this.alertSubject.asObservable();

    private timeoutId: number | null = null;

    show(message: string, kind: AppAlertKind = 'error', autoHideMs = 8000) {
        this.alertSubject.next({ message, kind });

        if (this.timeoutId) window.clearTimeout(this.timeoutId);
        this.timeoutId = window.setTimeout(() => this.clear(), autoHideMs);
    }

    clear() {
        if (this.timeoutId) window.clearTimeout(this.timeoutId);
        this.timeoutId = null;
        this.alertSubject.next(null);
    }
}
