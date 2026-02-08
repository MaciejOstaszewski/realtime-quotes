import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppErrorsService } from '../services/app-errors.service';

@Component({
    standalone: true,
    selector: 'app-alert',
    imports: [CommonModule],
    template: `
  @if (alert()) {
    <div class="alert" [attr.data-kind]="alert()!.kind">
      <div class="msg">{{ alert()!.message }}</div>
      <button class="btn" type="button" (click)="close()">×</button>
    </div>
  }
  `,
    styles: [`
    .alert {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
    }
    .alert[data-kind="error"]   { background: #fff1f2; color: #991b1b; border-color: #fecaca; }
    .alert[data-kind="warning"] { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .alert[data-kind="info"]    { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }

    .msg { font-size: 14px; }
    .btn {
      border: 0;
      background: transparent;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 8px;
    }
  `],
})
export class AppAlertComponent {
    private readonly errors = inject(AppErrorsService);
    readonly alert = toSignal(this.errors.alert$, { initialValue: null });

    close() {
        this.errors.clear();
    }
}
