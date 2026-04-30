import { Injectable, computed, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3500,
  info: 3500,
  error: 5000,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private nextId = 0;

  readonly toasts = computed(() => this.toastsSignal());

  success(message: string, duration?: number): void {
    this.push('success', message, duration ?? DEFAULT_DURATION.success);
  }

  error(message: string, duration?: number): void {
    this.push('error', message, duration ?? DEFAULT_DURATION.error);
  }

  info(message: string, duration?: number): void {
    this.push('info', message, duration ?? DEFAULT_DURATION.info);
  }

  remove(id: number): void {
    this.toastsSignal.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this.toastsSignal.set([]);
  }

  private push(type: ToastType, message: string, duration: number): void {
    const id = ++this.nextId;
    this.toastsSignal.update((list) => [...list, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }
}
