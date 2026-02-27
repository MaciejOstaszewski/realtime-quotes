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

    const body: unknown = err.error;
    const extracted = extractErrorMessage(body);
    if (extracted) return extracted;

    if (err.status >= 500) return 'Server error. Try again later.';
    if (err.status === 404) return 'Resource not found (404).';
    if (err.status === 401) return 'Unauthorized (401).';
    if (err.status === 403) return 'Forbidden (403).';
    if (err.status === 400) return 'Bad request (400).';

    return `Request error (HTTP ${err.status}).`;
}

function extractErrorMessage(body: unknown): string | null {
    if (typeof body === 'string' && body.trim()) return body.trim();

    if (body !== null && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        if (typeof obj['error'] === 'string' && obj['error'].trim()) {
            return obj['error'].trim();
        }
    }

    return null;
}
