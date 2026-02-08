import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AppErrorsService } from '../services/app-errors.service';
import { environment } from '../../../environments/environment';

export const backendErrorInterceptor: HttpInterceptorFn = (req, next) => {
    const errors = inject(AppErrorsService);

    return next(req).pipe(
        catchError((err: unknown) => {
            if (err instanceof HttpErrorResponse) {
                const msg = toUserMessage(err);
                errors.show(msg, err.status === 0 ? 'info' : 'error');
            } else {
                errors.show('An unexpected application error occurred.', 'error');
            }

            return throwError(() => err);
        })
    );
};

function toUserMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
        return `No connection to backend. Make sure it is running at ${environment.backendHttpBaseUrl}.`;
    }

    const body: any = err.error;
    if (body && typeof body === 'object' && typeof body.error === 'string' && body.error.trim()) {
        return body.error;
    }

    if (typeof body === 'string' && body.trim()) {
        return body;
    }

    if (err.status >= 500) return 'Server error. Try again later.';
    if (err.status === 404) return 'Resource not found (404).';
    if (err.status === 401) return 'Unauthorized (401).';
    if (err.status === 403) return 'Forbidden (403).';
    if (err.status === 400) return 'Bad request (400).';

    return `Request error (HTTP ${err.status}).`;
}
