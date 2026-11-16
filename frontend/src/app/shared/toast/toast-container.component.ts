import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastMessage, ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (toastService.toasts().length > 0) {
      <div
        data-testid="toast-container"
        aria-live="polite"
        class="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-md space-y-2 pointer-events-none"
      >
        @for (toast of toastService.toasts(); track toast.id) {
          <div
            [attr.role]="toast.tone === 'error' ? 'alert' : 'status'"
            data-testid="toast-item"
            [attr.data-toast-tone]="toast.tone"
            [class]="toastClass(toast)"
          >
            <p class="text-sm font-medium leading-snug break-words flex-1">
              {{ toast.message }}
            </p>
            <button
              type="button"
              (click)="toastService.dismiss(toast.id)"
              aria-label="Fechar aviso"
              class="min-w-8 min-h-8 rounded-lg flex items-center justify-center text-current/70 hover:text-current hover:bg-black/5 font-bold text-base shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              ×
            </button>
          </div>
        }
      </div>
    }
  `
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  toastClass(toast: ToastMessage): string {
    const base =
      'pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm flex items-start gap-2.5 animate-fade-slide-up';
    switch (toast.tone) {
      case 'success':
        return `${base} bg-pine-50/95 border-pine-300 text-pine-950`;
      case 'warning':
        return `${base} bg-gold-50/95 border-gold-300 text-gold-950`;
      case 'error':
        return `${base} bg-cranberry-50/95 border-cranberry-300 text-cranberry-900`;
      default:
        return `${base} bg-white/95 border-stone-300 text-ink-900`;
    }
  }
}
