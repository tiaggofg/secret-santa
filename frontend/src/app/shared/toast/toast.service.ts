import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly toastsSignal = signal<ToastMessage[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly toasts = this.toastsSignal.asReadonly();

  show(message: string, tone: ToastTone = 'info', durationMs = 4500): number {
    const id = this.nextId++;
    this.toastsSignal.update((current) => [...current, { id, message, tone }]);

    if (durationMs > 0) {
      const timer = setTimeout(() => this.dismiss(id), durationMs);
      this.timers.set(id, timer);
    }

    return id;
  }

  success(message: string, durationMs = 4500): number {
    return this.show(message, 'success', durationMs);
  }

  info(message: string, durationMs = 4500): number {
    return this.show(message, 'info', durationMs);
  }

  warning(message: string, durationMs = 5500): number {
    return this.show(message, 'warning', durationMs);
  }

  error(message: string, durationMs = 5500): number {
    return this.show(message, 'error', durationMs);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toastsSignal.update((current) => current.filter((t) => t.id !== id));
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.toastsSignal.set([]);
  }
}
