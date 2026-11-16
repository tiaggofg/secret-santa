import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    service.clear();
    vi.useRealTimers();
  });

  it('shows a toast and auto-dismisses it after durationMs', () => {
    service.success('Operação concluída!', 3000);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Operação concluída!');
    expect(service.toasts()[0].tone).toBe('success');

    vi.advanceTimersByTime(3000);
    expect(service.toasts().length).toBe(0);
  });
});
